/**
 * e2e-v2.test.ts — NOMOREDELAY Phase 6 E2E Integration Test.
 *
 * Validates:
 *   1. Large-scale ingestion of a 100-memory seed corpus.
 *   2. Semantic search recall rate >= 80% (top 5 relevance match).
 *   3. Differential sync and background replication.
 *   4. Cold-start disaster recovery: wipe database/state files, fetch
 *      replication log via GET /replay, decrypt/ingest, and verify
 *      Merkle root matches exactly.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, afterEach, describe, expect, test } from "vitest";

import { CryptoService, decryptJson } from "@inheribase/core-protocol";
import { resetLocalDbForTests } from "../local/index.js";
import { initLocalDb } from "../local/db.js";
import { storeMemoryTool } from "../tools/store-memory.js";
import { recallMemoryTool } from "../tools/recall-memory.js";
import { SyncWorker } from "../sync/worker.js";
import { ReplicateClient } from "../sync/client.js";
import { loadState, saveState, EMPTY_MERKLE_ROOT } from "../sync/state.js";
import { generateEmbedding, resetEmbeddingPipelineForTests } from "../local/embeddings.js";

const SHARED_MODEL_DIR = join(homedir(), ".sovseal", "models");
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let dbDir = "";
let statePath = "";

beforeAll(async () => {
  process.env.SOVSEAL_MODEL_DIR = SHARED_MODEL_DIR;
  // Warm up model
  await generateEmbedding("warmup");
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

async function freshFixture(label: string) {
  dbDir = await mkdtemp(join(tmpdir(), `sovseal-e2e-${label}-db-`));
  const stateDir = await mkdtemp(join(tmpdir(), `sovseal-e2e-${label}-state-`));
  statePath = join(stateDir, "state.json");
  process.env.SOVSEAL_DB_DIR = dbDir;
  process.env.SOVSEAL_STATE_PATH = statePath;
  resetLocalDbForTests();
  const encryptionKey = await CryptoService.generateAESKey();
  return { encryptionKey };
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function advanceMerkleRoot(prevHex: string, blockHashHex: string): Promise<string> {
  const prev = hexToBytes(prevHex);
  const blk = hexToBytes(blockHashHex);
  const merged = new Uint8Array(prev.length + blk.length);
  merged.set(prev, 0);
  merged.set(blk, prev.length);
  return CryptoService.sha256Hex(merged);
}

describe("E2E-V2 — Semantic Memory Vector Brain & Cold-Start Replay", () => {
  test("100 memories seed, 20 queries, and cold-start replay recovery", async () => {
    // 1. Load seed-100 corpus
    const seedPath = join(__dirname, "fixtures", "seed-100.json");
    const corpus = JSON.parse(await readFile(seedPath, "utf8"));
    expect(corpus.memories.length).toBe(100);
    expect(corpus.queries.length).toBe(20);

    const { encryptionKey } = await freshFixture("roundtrip");

    // 2. Ingest 100 memories via storeMemoryTool in-process
    console.log("Ingesting 100 memories into LanceDB...");
    for (const mem of corpus.memories) {
      const res = await storeMemoryTool.handler({ content: mem });
      expect(res.isError).toBeFalsy();
    }

    // 3. Execute 20 queries and assert >= 80% relevance (top 5 match)
    console.log("Verifying 20 queries semantic recall...");
    let matches = 0;
    for (const tc of corpus.queries) {
      const res = await recallMemoryTool.handler({ query: tc.query, topK: 5 });
      expect(res.isError).toBeFalsy();
      const textHits = res.content.map(c => (c as any).text);
      const isMatched = textHits.some(text => text.includes(tc.expected_match));
      if (isMatched) {
        matches++;
      } else {
        console.log(`Failed to recall expected match for query: "${tc.query}"`);
      }
    }
    const recallRate = (matches / corpus.queries.length) * 100;
    console.log(`Recall rate: ${recallRate}% (${matches}/20 queries)`);
    expect(recallRate).toBeGreaterThanOrEqual(80);

    // 4. Setup mock replication server
    const serverLogs: any[] = [];
    let serverMerkleRoot = EMPTY_MERKLE_ROOT;

    const mockFetch = async (url: string, opts: any) => {
      const path = new URL(url).pathname;
      if (path.endsWith("/replicate")) {
        const body = JSON.parse(opts.body);
        for (const chunk of body.chunks) {
          serverLogs.push({
            sequence_number: chunk.sequence_number,
            block_hash: chunk.block_hash,
            ciphertext_b64: chunk.ciphertext_b64,
            merkle_root: body.merkle_root,
            created_at: new Date().toISOString()
          });
        }
        serverMerkleRoot = body.merkle_root;
        return new Response(JSON.stringify({
          outcome: "ok",
          status: 200,
          idempotent: false,
          accepted: body.chunks.length,
          merkle_root: serverMerkleRoot
        }), { status: 200, headers: { "content-type": "application/json" } });
      }

      if (path.endsWith("/head")) {
        if (serverLogs.length === 0) {
          return new Response(JSON.stringify({ error: "no_replication_entries" }), { status: 404 });
        }
        const maxSeq = Math.max(...serverLogs.map(l => l.sequence_number));
        return new Response(JSON.stringify({
          sequence_number: maxSeq,
          merkle_root: serverMerkleRoot,
          updated_at: new Date().toISOString()
        }), { status: 200, headers: { "content-type": "application/json" } });
      }

      if (path.endsWith("/replay")) {
        const urlObj = new URL(url);
        const since = Number(urlObj.searchParams.get("since") ?? "-1");
        const filtered = serverLogs
          .filter(l => l.sequence_number > since)
          .sort((a, b) => a.sequence_number - b.sequence_number);
        return new Response(JSON.stringify({
          chunks: filtered,
          count: filtered.length
        }), { status: 200, headers: { "content-type": "application/json" } });
      }

      return new Response("Not Found", { status: 404 });
    };

    // 5. Spin up background SyncWorker and replicate
    const worker = new SyncWorker({
      encryptionKey,
      apiKey: "sov_proj_mock_key",
      clientFactory: (o) => new ReplicateClient({ ...o, fetchImpl: mockFetch as any }),
      statePath,
      apiEndpoint: "http://mock-server.local"
    });

    console.log("Replicating memories to server...");
    const summary = await worker.runOnce();
    expect(summary.rowsSynced).toBe(100);
    expect(summary.failures).toBe(0);

    const preWipeState = await loadState(statePath);
    expect(preWipeState.local_merkle_root).toBe(serverMerkleRoot);
    console.log("Replication complete. Merkle Root:", preWipeState.local_merkle_root);

    // Stop worker to release files
    await worker.stop();

    // 6. Simulate cold-start wipe: delete LanceDB and state.json
    console.log("Simulating cold-start wipe...");
    resetLocalDbForTests();
    await rm(dbDir, { recursive: true, force: true });
    await rm(statePath, { force: true });

    // Verify empty state
    await expect(loadState(statePath)).resolves.toEqual({
      next_sequence_number: 0,
      local_merkle_root: EMPTY_MERKLE_ROOT,
      last_synced_at: 0,
      api_endpoint: "https://api.sovseal.com/functions/v1/v2-agent-state"
    });

    // 7. Reconstruct local state by replaying replication log via GET /replay
    console.log("Fetching replication logs and replaying states...");
    const client = new ReplicateClient({
      endpoint: "http://mock-server.local",
      apiKey: "sov_proj_mock_key",
      fetchImpl: mockFetch as any
    });

    const replay = await client.getReplay(-1);
    expect(replay.chunks.length).toBeGreaterThan(0);

    // Re-initialize a clean LanceDB
    const { table } = await initLocalDb();

    let localMerkleRoot = EMPTY_MERKLE_ROOT;
    let totalRestored = 0;

    for (const chunk of replay.chunks) {
      const ciphertext = Uint8Array.from(Buffer.from(chunk.ciphertext_b64, "base64"));
      const decrypted = await decryptJson<{ memories: Array<{ id: string; text: string; timestamp: string }> }>(
        ciphertext,
        encryptionKey
      );

      // Verify block hash integrity
      const calculatedHash = await CryptoService.sha256Hex(ciphertext);
      expect(calculatedHash).toBe(chunk.block_hash);

      localMerkleRoot = await advanceMerkleRoot(localMerkleRoot, chunk.block_hash);

      // Ingest the decrypted memories back into LanceDB
      for (const mem of decrypted.memories) {
        const vector = await generateEmbedding(mem.text);
        await table.add([
          {
            id: mem.id,
            vector: Array.from(vector),
            text: mem.text,
            timestamp: BigInt(mem.timestamp),
            sync_status: "synced"
          }
        ]);
        totalRestored++;
      }
    }

    // Save state.json
    const reconstructedState = {
      next_sequence_number: replay.chunks.length,
      local_merkle_root: localMerkleRoot,
      last_synced_at: Date.now(),
      api_endpoint: "http://mock-server.local"
    };
    await saveState(reconstructedState, statePath);

    // 8. Assertions
    expect(totalRestored).toBe(100);
    expect(localMerkleRoot).toBe(preWipeState.local_merkle_root);
    expect((await loadState(statePath)).local_merkle_root).toBe(preWipeState.local_merkle_root);

    console.log("Cold-start replay recovery successfully completed! Merkle roots match:", localMerkleRoot);

    // Verify search works identically on reconstructed database
    let postMatches = 0;
    for (const tc of corpus.queries) {
      const res = await recallMemoryTool.handler({ query: tc.query, topK: 5 });
      expect(res.isError).toBeFalsy();
      const textHits = res.content.map(c => (c as any).text);
      const isMatched = textHits.some(text => text.includes(tc.expected_match));
      if (isMatched) {
        postMatches++;
      }
    }
    const postRecallRate = (postMatches / corpus.queries.length) * 100;
    expect(postRecallRate).toBeGreaterThanOrEqual(80);
    console.log(`Post-restoration search verified: ${postRecallRate}% success`);
  }, 300_000);
});
