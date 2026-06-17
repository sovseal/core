/**
 * worker.ts — Background sync worker for the v2 Semantic Vector Brain.
 *
 * Polls the local LanceDB every `SOVSEAL_SYNC_INTERVAL_MS` (default 2000 ms)
 * for rows with `sync_status = 'pending'`. Bundles them into 64 KB encrypted
 * blocks (AES-256-GCM via `encryptJson`), assigns a monotonic
 * `sequence_number` from the durable cursor in `~/.sovseal/state.json`, and
 * POSTs the batch to the server's `/replicate` endpoint. On 200 the rows
 * flip to `'synced'`. On transient failure the rows stay `'pending'` and the
 * next poll retries. On 401 the worker halts (permanent error). The cursor
 * is persisted only after a successful flip — a crash mid-flight replays
 * cleanly because the server enforces `(agent_id, sequence_number)`
 * idempotency.
 *
 * Crash safety lives in the durable LanceDB write-ahead log: the MCP tool
 * handler commits the row before returning, so a worker that never sees
 * the row will pick it up on next start.
 */

import { webcrypto } from "node:crypto";

import { getPendingMemories, markMemoriesSynced } from "../local/index.js";
import {
  ReplicateClient,
  type ReplicateChunk,
  type ReplicateClientOptions,
  type ReplicateResult,
} from "./client.js";
import {
  type SyncState,
  loadState,
  resolveApiEndpoint,
  resolveStatePath,
  saveState,
} from "./state.js";

/** Per-block ciphertext budget. Server-side cap is 256 KB; we stay well under. */
export const MAX_BLOCK_BYTES = 64 * 1024;

/** Hard cap on rows drained per poll — avoids unbounded batches on burst. */
export const MAX_ROWS_PER_POLL = 5_000;

const DEFAULT_POLL_INTERVAL_MS = 2_000;

export interface SyncWorkerOptions {
  encryptionKey: CryptoKey;
  apiKey: string;
  apiEndpoint?: string;
  statePath?: string;
  pollIntervalMs?: number;
  /** Override for tests. */
  clientFactory?: (opts: ReplicateClientOptions) => ReplicateClient;
  /** Hook fired after each poll cycle (used by tests). */
  onCycle?: (summary: PollSummary) => void;
  /** Override for `Date.now()` — used by tests. */
  now?: () => number;
}

export interface PollSummary {
  pendingFound: number;
  blocksFlushed: number;
  rowsSynced: number;
  failures: number;
  haltReason?: "auth_error" | "split_brain";
}

export interface PreparedBlock {
  rowIds: string[];
  sequence_number: number;
  ciphertext: Uint8Array;
  blockHash: string;
}

interface MemoryPayload {
  id: string;
  text: string;
  timestamp: string;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await webcrypto.subtle.digest("SHA-256", data);
  return Buffer.from(digest).toString("hex");
}

/** SHA-256(prev || block_hash) — both inputs hex. */
async function advanceMerkleRoot(
  prevHex: string,
  blockHashHex: string,
): Promise<string> {
  const prev = hexToBytes(prevHex);
  const blk = hexToBytes(blockHashHex);
  const merged = new Uint8Array(prev.length + blk.length);
  merged.set(prev, 0);
  merged.set(blk, prev.length);
  return sha256Hex(merged);
}

/**
 * Greedy chunker: accumulate memories into the current block until adding one
 * more would push the encrypted payload past {@link MAX_BLOCK_BYTES}.
 *
 * We can't know the exact ciphertext size without encrypting, but AES-GCM
 * is length-preserving (modulo the 12-byte IV + 16-byte tag overhead), so
 * we estimate via the canonical JSON serialization length plus a 64-byte
 * overhead allowance per block.
 */
function chunkByEstimatedBytes(memories: MemoryPayload[]): MemoryPayload[][] {
  const OVERHEAD = 64;
  const blocks: MemoryPayload[][] = [];
  let current: MemoryPayload[] = [];
  let currentBytes = OVERHEAD;

  for (const memory of memories) {
    const rowBytes =
      Buffer.byteLength(JSON.stringify(memory), "utf8") + /* sep */ 1;
    if (current.length > 0 && currentBytes + rowBytes > MAX_BLOCK_BYTES) {
      blocks.push(current);
      current = [];
      currentBytes = OVERHEAD;
    }
    current.push(memory);
    currentBytes += rowBytes;
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}

export async function prepareBlock(
  memories: MemoryPayload[],
  sequenceNumber: number,
  encryptionKey: CryptoKey,
): Promise<PreparedBlock> {
  // Inline AES-256-GCM encryption (was @inheribase/core-protocol encryptJson)
  const plaintext = new TextEncoder().encode(
    JSON.stringify({ memories }),
  );
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const encrypted = await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    encryptionKey,
    plaintext,
  );
  // Concat IV || ciphertext (matches encryptJson layout)
  const ciphertext = new Uint8Array(iv.length + encrypted.byteLength);
  ciphertext.set(iv, 0);
  ciphertext.set(new Uint8Array(encrypted), iv.length);

  const blockHash = await sha256Hex(ciphertext);
  return {
    rowIds: memories.map((m) => m.id),
    sequence_number: sequenceNumber,
    ciphertext,
    blockHash,
  };
}

export class SyncWorker {
  private readonly opts: Required<
    Omit<SyncWorkerOptions, "clientFactory" | "onCycle">
  > & {
    clientFactory: NonNullable<SyncWorkerOptions["clientFactory"]>;
    onCycle?: SyncWorkerOptions["onCycle"];
  };
  private client: ReplicateClient;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private stopRequested = false;
  private inFlight: Promise<PollSummary> | null = null;
  private halted = false;
  private haltReason: NonNullable<PollSummary["haltReason"]> | null = null;
  private state: SyncState | null = null;

  constructor(options: SyncWorkerOptions) {
    const endpoint = options.apiEndpoint ?? resolveApiEndpoint();
    this.opts = {
      encryptionKey: options.encryptionKey,
      apiKey: options.apiKey,
      apiEndpoint: endpoint,
      statePath: options.statePath ?? resolveStatePath(),
      pollIntervalMs: parsePollInterval(options.pollIntervalMs),
      now: options.now ?? Date.now,
      clientFactory: options.clientFactory ?? ((o) => new ReplicateClient(o)),
      onCycle: options.onCycle,
    };
    this.client = this.opts.clientFactory({
      endpoint,
      apiKey: options.apiKey,
    });
  }

  /** Start the polling loop. Idempotent — calling twice is a no-op. */
  async start(): Promise<void> {
    if (this.running) return;
    if (this.halted) return;
    this.running = true;
    this.stopRequested = false;
    this.state = await loadState(this.opts.statePath);
    this.schedule();
  }

  /**
   * Stop the polling loop. Waits for any in-flight cycle to finish so the
   * cursor is persisted before exit. Safe to call more than once.
   */
  async stop(): Promise<void> {
    this.stopRequested = true;
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.inFlight) await this.inFlight.catch(() => undefined);
  }

  /** Run one poll cycle synchronously — used by tests and the smoke driver. */
  async runOnce(): Promise<PollSummary> {
    if (!this.state) this.state = await loadState(this.opts.statePath);
    const summary = await this.cycle();
    this.opts.onCycle?.(summary);
    return summary;
  }

  /** True when the worker has halted due to a permanent error (e.g. 401). */
  isHalted(): boolean {
    return this.halted;
  }

  /** Returns a snapshot of the in-memory cursor — used by tests and smoke driver. */
  getState(): SyncState | null {
    return this.state ? { ...this.state } : null;
  }

  private schedule(): void {
    if (this.stopRequested || !this.running || this.halted) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.inFlight = this.cycle()
        .then((summary) => {
          this.opts.onCycle?.(summary);
          return summary;
        })
        .catch((err) => {
          console.error("[sovseal-sync] cycle error:", err);
          return {
            pendingFound: 0,
            blocksFlushed: 0,
            rowsSynced: 0,
            failures: 1,
          } satisfies PollSummary;
        })
        .finally(() => {
          this.inFlight = null;
          this.schedule();
        });
    }, this.opts.pollIntervalMs);
  }

  private async cycle(): Promise<PollSummary> {
    const summary: PollSummary = {
      pendingFound: 0,
      blocksFlushed: 0,
      rowsSynced: 0,
      failures: 0,
    };

    if (this.halted) {
      summary.haltReason = this.haltReason ?? "auth_error";
      return summary;
    }

    const pending = await getPendingMemories(MAX_ROWS_PER_POLL);
    summary.pendingFound = pending.length;
    if (pending.length === 0) return summary;

    const payloads: MemoryPayload[] = pending.map((row) => ({
      id: row.id,
      text: row.text,
      timestamp: row.timestamp.toString(),
    }));

    const blocks = chunkByEstimatedBytes(payloads);
    if (!this.state) this.state = await loadState(this.opts.statePath);
    let cursor: SyncState = this.state;

    for (const block of blocks) {
      const seq: number = cursor.next_sequence_number;
      const prepared = await prepareBlock(
        block,
        seq,
        this.opts.encryptionKey,
      );

      if (prepared.ciphertext.byteLength > MAX_BLOCK_BYTES) {
        console.warn(
          `[sovseal-sync] block ${seq} ${prepared.ciphertext.byteLength} bytes exceeds local cap ${MAX_BLOCK_BYTES} — sending anyway (server cap is 256 KB)`,
        );
      }

      const nextRoot = await advanceMerkleRoot(
        cursor.local_merkle_root,
        prepared.blockHash,
      );

      const chunk: ReplicateChunk = {
        sequence_number: seq,
        block_hash: prepared.blockHash,
        ciphertext_b64: bytesToBase64(prepared.ciphertext),
      };

      const result: ReplicateResult = await this.client.postReplicate({
        chunks: [chunk],
        merkle_root: nextRoot,
      });

      if (result.outcome === "auth_error") {
        console.error(
          `[sovseal-sync] HALT: server returned 401 — API key invalid or revoked. detail=${result.detail}`,
        );
        this.halted = true;
        this.haltReason = "auth_error";
        this.running = false;
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        summary.haltReason = "auth_error";
        return summary;
      }

      if (result.outcome === "split_brain") {
        const seqs = result.conflicts.map((c) => c.sequence_number).join(",");
        console.error(
          `[sovseal-sync] HALT: split-brain detected at sequence(s) ${seqs}. Another writer holds a different block at the same position. Rows stay pending; resolve by reconciling laptops before restart.`,
        );
        this.halted = true;
        this.haltReason = "split_brain";
        this.running = false;
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        summary.haltReason = "split_brain";
        return summary;
      }

      if (result.outcome === "over_cap") {
        console.error(
          `[sovseal-sync] SKIP: block seq=${seq} rejected with 413 (${result.detail}). Rows stay pending; consider lowering MAX_BLOCK_BYTES.`,
        );
        summary.failures += 1;
        continue;
      }

      if (result.outcome === "failure") {
        console.error(
          `[sovseal-sync] block seq=${seq} failed status=${String(result.status)} attempts=${result.attempts} detail=${result.detail}; will retry next poll`,
        );
        summary.failures += 1;
        return summary;
      }

      await markMemoriesSynced(prepared.rowIds);
      cursor = {
        next_sequence_number: seq + 1,
        local_merkle_root: nextRoot,
        last_synced_at: this.opts.now(),
        api_endpoint: this.opts.apiEndpoint,
      };
      this.state = cursor;
      await saveState(cursor, this.opts.statePath);
      summary.blocksFlushed += 1;
      summary.rowsSynced += prepared.rowIds.length;
    }

    return summary;
  }
}

function parsePollInterval(provided?: number): number {
  if (typeof provided === "number" && provided > 0) return provided;
  const env = process.env.SOVSEAL_SYNC_INTERVAL_MS;
  if (env) {
    const parsed = Number.parseInt(env, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_POLL_INTERVAL_MS;
}
