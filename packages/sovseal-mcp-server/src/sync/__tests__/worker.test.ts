/**
 * worker.test.ts — Phase 4 of NOMOREDELAY (background sync worker).
 *
 * Each test isolates state with its own SOVSEAL_DB_DIR + SOVSEAL_STATE_PATH
 * and uses a mock client / mock fetch. The crypto key is generated fresh
 * per test via CryptoService.generateAESKey so we never touch the real
 * identity file.
 *
 * Coverage:
 *   - simulated network failure → row stays pending → retry on next poll → 200
 *   - multi-row batching: 5 rows → 1 block → 1 POST
 *   - block-size enforcement: 100 rows × 1 KB ≈ 2 blocks ≤ 64 KB ciphertext
 *   - Merkle root advances monotonically across batches
 *   - idempotent 200 response treated as success, no double-flip
 *   - 401 halts worker
 */

import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { CryptoService } from "@inheribase/core-protocol";

import {
  getPendingMemories,
  resetLocalDbForTests,
  storeLocal,
} from "../../local/index.js";
import { resetEmbeddingPipelineForTests } from "../../local/embeddings.js";
import {
  MAX_BLOCK_BYTES,
  SyncWorker,
  type PollSummary,
} from "../worker.js";
import {
  EMPTY_MERKLE_ROOT,
  loadState,
  type SyncState,
} from "../state.js";
import {
  type ReplicateClientOptions,
  type ReplicateRequest,
  type ReplicateResult,
} from "../client.js";

const SHARED_MODEL_DIR = join(homedir(), ".sovseal", "models");

let dbDir = "";
let statePath = "";

beforeAll(() => {
  process.env.SOVSEAL_MODEL_DIR = SHARED_MODEL_DIR;
});

afterEach(async () => {
  resetLocalDbForTests();
  if (dbDir) {
    await rm(dbDir, { recursive: true, force: true });
    dbDir = "";
  }
  if (statePath) {
    await rm(statePath, { force: true });
    await rm(`${statePath}.tmp`, { force: true });
    statePath = "";
  }
  delete process.env.SOVSEAL_DB_DIR;
  delete process.env.SOVSEAL_STATE_PATH;
});

afterAll(() => {
  resetEmbeddingPipelineForTests();
});

async function freshFixture(label: string): Promise<{
  encryptionKey: CryptoKey;
  endpoint: string;
}> {
  dbDir = await mkdtemp(join(tmpdir(), `sovseal-p4-${label}-db-`));
  const stateDir = await mkdtemp(join(tmpdir(), `sovseal-p4-${label}-state-`));
  statePath = join(stateDir, "state.json");
  process.env.SOVSEAL_DB_DIR = dbDir;
  process.env.SOVSEAL_STATE_PATH = statePath;
  resetLocalDbForTests();
  const encryptionKey = await CryptoService.generateAESKey();
  return { encryptionKey, endpoint: "http://test.local/functions/v1/v2-agent-state" };
}

interface MockClient {
  postReplicate: (body: ReplicateRequest) => Promise<ReplicateResult>;
  calls: ReplicateRequest[];
}

function recordingClient(
  responder: (body: ReplicateRequest, callIndex: number) => ReplicateResult,
): MockClient {
  const calls: ReplicateRequest[] = [];
  return {
    calls,
    async postReplicate(body) {
      calls.push(body);
      return responder(body, calls.length - 1);
    },
  };
}

function buildFactory(mock: MockClient) {
  return (_o: ReplicateClientOptions) => mock as unknown as ReturnType<
    NonNullable<ConstructorParameters<typeof SyncWorker>[0]["clientFactory"]>
  >;
}

describe("NOMOREDELAY P4 — sync worker", () => {
  test(
    "single-row happy path: 5 rows fit in one block, single POST, all rows synced",
    async () => {
      const { encryptionKey } = await freshFixture("happy");
      for (let i = 0; i < 5; i++) {
        await storeLocal(`fact number ${i}: short payload to keep block small`);
      }

      const mock = recordingClient(() => ({
        outcome: "ok",
        status: 200,
        idempotent: false,
        accepted: 1,
      }));

      const worker = new SyncWorker({
        encryptionKey,
        apiKey: "sov_proj_00000000-0000-4000-8000-000000000000",
        clientFactory: buildFactory(mock),
      });

      const summary = await worker.runOnce();

      expect(summary.pendingFound).toBe(5);
      expect(summary.blocksFlushed).toBe(1);
      expect(summary.rowsSynced).toBe(5);
      expect(summary.failures).toBe(0);
      expect(mock.calls.length).toBe(1);
      expect(mock.calls[0].chunks.length).toBe(1);

      const remainingPending = await getPendingMemories(100);
      expect(remainingPending.length).toBe(0);

      const persisted = await loadState(statePath);
      expect(persisted.next_sequence_number).toBe(1);
      expect(persisted.local_merkle_root).not.toBe(EMPTY_MERKLE_ROOT);
      expect(persisted.last_synced_at).toBeGreaterThan(0);
    },
    300_000,
  );

  test(
    "network failure leaves row pending; retry on next cycle succeeds",
    async () => {
      const { encryptionKey } = await freshFixture("retry");
      await storeLocal("retry test fact");

      let firstAttempt = true;
      const mock = recordingClient(() => {
        if (firstAttempt) {
          firstAttempt = false;
          return {
            outcome: "failure",
            status: "network",
            detail: "ECONNREFUSED",
            attempts: 6,
          };
        }
        return { outcome: "ok", status: 200, idempotent: false, accepted: 1 };
      });

      const worker = new SyncWorker({
        encryptionKey,
        apiKey: "sov_proj_00000000-0000-4000-8000-000000000001",
        clientFactory: buildFactory(mock),
      });

      const fail = await worker.runOnce();
      expect(fail.failures).toBe(1);
      expect(fail.rowsSynced).toBe(0);
      expect((await getPendingMemories(100)).length).toBe(1);
      expect((await loadState(statePath)).next_sequence_number).toBe(0);

      const ok = await worker.runOnce();
      expect(ok.rowsSynced).toBe(1);
      expect(ok.blocksFlushed).toBe(1);
      expect((await getPendingMemories(100)).length).toBe(0);
      expect((await loadState(statePath)).next_sequence_number).toBe(1);
    },
    300_000,
  );

  test(
    "block-size enforcement: 100 rows × ~1 KB → ciphertext ≤ 64 KB; merkle root advances per block",
    async () => {
      const { encryptionKey } = await freshFixture("blocksize");

      const filler = "x".repeat(1024);
      for (let i = 0; i < 100; i++) {
        await storeLocal(`row-${i} ${filler}`);
      }

      const seenChunks: { seq: number; cipherBytes: number; root: string }[] = [];
      let lastRoot = EMPTY_MERKLE_ROOT;

      const mock = recordingClient((body) => {
        for (const c of body.chunks) {
          const cipher = Buffer.from(c.ciphertext_b64, "base64");
          seenChunks.push({
            seq: c.sequence_number,
            cipherBytes: cipher.byteLength,
            root: body.merkle_root,
          });
        }
        return { outcome: "ok", status: 200, idempotent: false, accepted: body.chunks.length };
      });

      const worker = new SyncWorker({
        encryptionKey,
        apiKey: "sov_proj_00000000-0000-4000-8000-000000000002",
        clientFactory: buildFactory(mock),
      });

      const summary = await worker.runOnce();

      expect(summary.rowsSynced).toBe(100);
      expect(seenChunks.length).toBeGreaterThanOrEqual(2);

      for (const c of seenChunks) {
        expect(c.cipherBytes).toBeLessThanOrEqual(MAX_BLOCK_BYTES + 256);
      }

      const seqs = seenChunks.map((c) => c.seq);
      const sorted = [...seqs].sort((a, b) => a - b);
      expect(seqs).toEqual(sorted);
      expect(seqs[0]).toBe(0);
      for (let i = 1; i < seqs.length; i++) {
        expect(seqs[i]).toBe(seqs[i - 1] + 1);
      }

      const roots = seenChunks.map((c) => c.root);
      for (let i = 0; i < roots.length; i++) {
        expect(roots[i]).not.toBe(lastRoot);
        lastRoot = roots[i];
      }
      const uniqueRoots = new Set(roots);
      expect(uniqueRoots.size).toBe(roots.length);

      const persisted = await loadState(statePath);
      expect(persisted.next_sequence_number).toBe(seenChunks.length);
      expect(persisted.local_merkle_root).toBe(roots[roots.length - 1]);
    },
    300_000,
  );

  test(
    "idempotent 200 from server is treated as success; rows flip exactly once",
    async () => {
      const { encryptionKey } = await freshFixture("idempotent");
      await storeLocal("idempotency test row");

      const mock = recordingClient(() => ({
        outcome: "ok",
        status: 200,
        idempotent: true,
      }));

      const worker = new SyncWorker({
        encryptionKey,
        apiKey: "sov_proj_00000000-0000-4000-8000-000000000003",
        clientFactory: buildFactory(mock),
      });

      const first = await worker.runOnce();
      expect(first.rowsSynced).toBe(1);
      expect(first.blocksFlushed).toBe(1);
      expect(first.failures).toBe(0);

      const second = await worker.runOnce();
      expect(second.pendingFound).toBe(0);
      expect(second.blocksFlushed).toBe(0);
      expect(mock.calls.length).toBe(1);
    },
    300_000,
  );

  test(
    "401 from server halts worker; cursor untouched",
    async () => {
      const { encryptionKey } = await freshFixture("authfail");
      await storeLocal("about to be rejected for auth");

      const mock = recordingClient(() => ({
        outcome: "auth_error",
        status: 401,
        detail: "invalid_api_key",
      }));

      const worker = new SyncWorker({
        encryptionKey,
        apiKey: "sov_live_invalid",
        clientFactory: buildFactory(mock),
      });

      const summary: PollSummary = await worker.runOnce();
      expect(summary.haltReason).toBe("auth_error");
      expect(summary.rowsSynced).toBe(0);
      expect(worker.isHalted()).toBe(true);

      expect((await getPendingMemories(100)).length).toBe(1);

      const persistedExists = await readFile(statePath, "utf8")
        .then(() => true)
        .catch(() => false);
      expect(persistedExists).toBe(false);

      const next = await worker.runOnce();
      expect(next.haltReason).toBe("auth_error");
      expect(mock.calls.length).toBe(1);
    },
    300_000,
  );

  test(
    "REM-P5-001: 409 split_brain halts worker; cursor untouched; rows stay pending",
    async () => {
      const { encryptionKey } = await freshFixture("splitbrain");
      await storeLocal("conflicting payload from laptop B");

      const mock = recordingClient(() => ({
        outcome: "split_brain",
        status: 409,
        detail: "split_brain_detected",
        conflicts: [
          {
            sequence_number: 0,
            existing_block_hash: "aaaa",
            attempted_block_hash: "bbbb",
          },
        ],
      }));

      const worker = new SyncWorker({
        encryptionKey,
        apiKey: "sov_proj_00000000-0000-4000-8000-000000000006",
        clientFactory: buildFactory(mock),
      });

      const summary: PollSummary = await worker.runOnce();
      expect(summary.haltReason).toBe("split_brain");
      expect(summary.rowsSynced).toBe(0);
      expect(worker.isHalted()).toBe(true);
      expect((await getPendingMemories(100)).length).toBe(1);

      const persistedExists = await readFile(statePath, "utf8")
        .then(() => true)
        .catch(() => false);
      expect(persistedExists).toBe(false);

      const next = await worker.runOnce();
      expect(next.haltReason).toBe("split_brain");
      expect(mock.calls.length).toBe(1);
    },
    300_000,
  );

  test(
    "Merkle root chain: SHA-256(prev || block_hash) — verifiable across blocks",
    async () => {
      const { encryptionKey } = await freshFixture("merkle");
      const filler = "y".repeat(1024);
      for (let i = 0; i < 130; i++) {
        await storeLocal(`m-${i} ${filler}`);
      }

      const roots: string[] = [];
      const hashes: string[] = [];

      const mock = recordingClient((body) => {
        for (const c of body.chunks) {
          hashes.push(c.block_hash);
          roots.push(body.merkle_root);
        }
        return { outcome: "ok", status: 200, idempotent: false, accepted: body.chunks.length };
      });

      const worker = new SyncWorker({
        encryptionKey,
        apiKey: "sov_proj_00000000-0000-4000-8000-000000000004",
        clientFactory: buildFactory(mock),
      });
      await worker.runOnce();

      expect(roots.length).toBeGreaterThanOrEqual(2);
      let prev = EMPTY_MERKLE_ROOT;
      for (let i = 0; i < roots.length; i++) {
        const expected = await sha256OfConcatHex(prev, hashes[i]);
        expect(roots[i]).toBe(expected);
        prev = roots[i];
      }
    },
    300_000,
  );

  test(
    "state.json round-trips: loadState returns persisted cursor after worker writes",
    async () => {
      const { encryptionKey } = await freshFixture("persist");
      await storeLocal("persist a single row");

      const mock = recordingClient(() => ({
        outcome: "ok",
        status: 200,
        idempotent: false,
        accepted: 1,
      }));

      const worker = new SyncWorker({
        encryptionKey,
        apiKey: "sov_proj_00000000-0000-4000-8000-000000000005",
        clientFactory: buildFactory(mock),
        now: () => 1_700_000_000_000,
      });
      await worker.runOnce();

      const persisted: SyncState = await loadState(statePath);
      expect(persisted.next_sequence_number).toBe(1);
      expect(persisted.last_synced_at).toBe(1_700_000_000_000);
      expect(persisted.local_merkle_root.length).toBe(64);
    },
    300_000,
  );
});

async function sha256OfConcatHex(prevHex: string, nextHex: string): Promise<string> {
  const prev = hexToBytes(prevHex);
  const next = hexToBytes(nextHex);
  const merged = new Uint8Array(prev.length + next.length);
  merged.set(prev, 0);
  merged.set(next, prev.length);
  return CryptoService.sha256Hex(merged);
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
