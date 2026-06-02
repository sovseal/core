/**
 * sovseal Native Messaging host
 *
 * Bridges the sovseal browser extension to the on-device Semantic Vector
 * Brain. The extension's MV3 service worker cannot run LanceDB,
 * Transformers.js, or touch `~/.sovseal` — so it speaks Chrome Native
 * Messaging to this Node process, which reuses the *exact same* engine the
 * MCP server uses (`storeLocal` / `queryLocal` / `getRecentMemories` /
 * `deleteLocal`). Every canonical guarantee (0 RTT recall, client-side
 * AES-256-GCM, server-blind write-behind sync) holds because the brain
 * never leaves the device.
 *
 * Wire format (Chrome Native Messaging):
 *   [uint32 length, native byte order][UTF-8 JSON payload]
 * This differs from MCP's newline-delimited JSON-RPC, so we implement a
 * tiny framed reader/writer here rather than reusing StdioServerTransport.
 *
 * Request  : { id: number, type: string, ...args }
 * Response : { id: number, ok: true, data: unknown }
 *          | { id: number, ok: false, error: string }
 *
 * stdout carries ONLY framed responses. All logging goes to stderr, exactly
 * like the MCP server, so it never corrupts the channel.
 */

import { endianness } from "node:os";

import {
  storeLocal,
  queryLocal,
  getRecentMemories,
  deleteLocal,
  countLocal,
} from "./local/index.js";
import { getOrCreateIdentity } from "./identity.js";
import { SyncWorker } from "./sync/worker.js";
import { warmupEmbeddingPipeline } from "./local/embeddings.js";

const LE = endianness() === "LE";
/** Chrome caps native-messaging frames at 1 MB in each direction. */
const MAX_FRAME_BYTES = 1024 * 1024;

interface HostRequest {
  id: number;
  type: string;
  content?: unknown;
  query?: unknown;
  topK?: unknown;
  limit?: unknown;
  memoryId?: unknown;
}

interface HostState {
  projectId: string;
  syncEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Framed stdout writer
// ---------------------------------------------------------------------------

function writeFrame(message: unknown): void {
  const json = Buffer.from(JSON.stringify(message), "utf8");
  if (json.byteLength > MAX_FRAME_BYTES) {
    // Never emit an oversized frame — Chrome would drop the port. Replace it
    // with a best-effort error keyed to the original id when we can read it.
    const id =
      message && typeof message === "object" && "id" in message
        ? (message as { id?: unknown }).id
        : undefined;
    const fallback = Buffer.from(
      JSON.stringify({
        id: typeof id === "number" ? id : 0,
        ok: false,
        error: "response exceeds 1MB native-messaging frame limit",
      }),
      "utf8",
    );
    const header = Buffer.allocUnsafe(4);
    if (LE) header.writeUInt32LE(fallback.byteLength, 0);
    else header.writeUInt32BE(fallback.byteLength, 0);
    process.stdout.write(Buffer.concat([header, fallback]));
    return;
  }
  const header = Buffer.allocUnsafe(4);
  if (LE) header.writeUInt32LE(json.byteLength, 0);
  else header.writeUInt32BE(json.byteLength, 0);
  process.stdout.write(Buffer.concat([header, json]));
}

// ---------------------------------------------------------------------------
// Request dispatch
// ---------------------------------------------------------------------------

function asPositiveInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  return fallback;
}

async function dispatch(req: HostRequest, state: HostState): Promise<unknown> {
  switch (req.type) {
    case "ping":
      return { pong: true };

    case "status":
      return {
        connected: true,
        projectId: state.projectId,
        syncEnabled: state.syncEnabled,
        count: await countLocal(),
      };

    case "store": {
      if (typeof req.content !== "string" || req.content.length === 0) {
        throw new Error("store: 'content' must be a non-empty string");
      }
      const { id } = await storeLocal(req.content);
      return { id };
    }

    case "recall": {
      if (typeof req.query !== "string" || req.query.length === 0) {
        throw new Error("recall: 'query' must be a non-empty string");
      }
      const topK = asPositiveInt(req.topK, 5);
      const hits = await queryLocal(req.query, topK);
      return { hits };
    }

    case "recent": {
      const limit = asPositiveInt(req.limit, 50);
      const rows = await getRecentMemories(limit);
      // bigint timestamps don't survive JSON.stringify — coerce to number ms.
      return {
        memories: rows.map((m) => ({
          id: m.id,
          text: m.text,
          timestamp: Number(m.timestamp),
        })),
      };
    }

    case "delete": {
      if (typeof req.memoryId !== "string" || req.memoryId.length === 0) {
        throw new Error("delete: 'memoryId' must be a non-empty string");
      }
      const { deleted } = await deleteLocal(req.memoryId);
      return { deleted };
    }

    default:
      throw new Error(`unknown request type: ${String(req.type)}`);
  }
}

async function handleFrame(raw: Buffer, state: HostState): Promise<void> {
  let req: HostRequest;
  try {
    req = JSON.parse(raw.toString("utf8")) as HostRequest;
  } catch {
    writeFrame({ id: 0, ok: false, error: "malformed JSON frame" });
    return;
  }
  const id = typeof req.id === "number" ? req.id : 0;
  try {
    const data = await dispatch(req, state);
    writeFrame({ id, ok: true, data });
  } catch (err) {
    writeFrame({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Framed stdin reader
// ---------------------------------------------------------------------------

function startReader(state: HostState): void {
  let buffer = Buffer.alloc(0);

  process.stdin.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    // Drain every complete frame currently in the buffer.
    for (;;) {
      if (buffer.byteLength < 4) return;
      const len = LE ? buffer.readUInt32LE(0) : buffer.readUInt32BE(0);
      if (len > MAX_FRAME_BYTES) {
        console.error(
          `[sovseal-native-host] frame length ${len} exceeds limit — disconnecting`,
        );
        process.exit(1);
      }
      if (buffer.byteLength < 4 + len) return;
      const payload = buffer.subarray(4, 4 + len);
      buffer = buffer.subarray(4 + len);
      void handleFrame(Buffer.from(payload), state);
    }
  });

  // Chrome closes stdin when the port disconnects / extension unloads.
  process.stdin.on("end", () => {
    console.error("[sovseal-native-host] stdin closed — exiting");
    process.exit(0);
  });
  process.stdin.on("error", (err) => {
    console.error("[sovseal-native-host] stdin error", err);
    process.exit(1);
  });
}

// ---------------------------------------------------------------------------
// Boot — mirrors src/index.ts: warm embeddings, optionally start sync worker.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  let projectId = "unknown";
  let identity;
  try {
    identity = await getOrCreateIdentity();
    projectId = identity.projectId;
  } catch (err) {
    console.error("[sovseal-native-host] identity bootstrap failed", err);
  }

  const syncEnabled = Boolean(process.env.SOVSEAL_API_KEY);
  const state: HostState = { projectId, syncEnabled };

  startReader(state);
  console.error("[sovseal-native-host] native messaging transport connected");

  void warmupEmbeddingPipeline()
    .then(() => console.error("[sovseal-native-host] embedding pipeline warm"))
    .catch((err) =>
      console.error("[sovseal-native-host] embedding warmup failed", err),
    );

  if (syncEnabled && identity) {
    const worker = new SyncWorker({
      encryptionKey: identity.encryptionKey,
      apiKey: process.env.SOVSEAL_API_KEY as string,
    });
    const shutdown = async (signal: string): Promise<void> => {
      console.error(`[sovseal-native-host] ${signal} — draining sync worker`);
      await worker.stop();
      process.exit(0);
    };
    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
    await worker.start();
    console.error("[sovseal-native-host] sync worker started");
  } else {
    console.error(
      "[sovseal-native-host] SOVSEAL_API_KEY not set — background sync disabled. Memories stored locally only.",
    );
  }
}

main().catch((error) => {
  console.error("[sovseal-native-host] fatal error", error);
  process.exit(1);
});
