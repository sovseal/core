/**
 * bench-v2.test.ts — NOMOREDELAY Phase 6 Performance Benchmark.
 *
 * Populates a fresh isolated LanceDB table with exactly 10,000 records
 * using batched embedding generation. Runs exactly 1,000 query requests
 * sequentially, measuring latency percentiles (p50, p95, p99).
 *
 * SLA targets:
 *   - p95 < 5ms
 *   - p99 < 15ms
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { beforeAll, afterAll, describe, expect, test } from "vitest";

import { queryLocal, resetLocalDbForTests } from "../local/index.js";
import { initLocalDb } from "../local/db.js";
import { generateEmbedding, getEmbeddingPipeline } from "../local/embeddings.js";

const SHARED_MODEL_DIR = join(homedir(), ".sovseal", "models");

let dbDir = "";
let statePath = "";

beforeAll(async () => {
  process.env.SOVSEAL_MODEL_DIR = SHARED_MODEL_DIR;
  dbDir = await mkdtemp(join(tmpdir(), "sovseal-bench-db-"));
  statePath = join(tmpdir(), `state-${Date.now()}.json`);
  process.env.SOVSEAL_DB_DIR = dbDir;
  process.env.SOVSEAL_STATE_PATH = statePath;
  resetLocalDbForTests();

  // Warm up model
  await generateEmbedding("warmup");
});

afterAll(async () => {
  resetLocalDbForTests();
  if (dbDir) {
    await rm(dbDir, { recursive: true, force: true });
  }
  if (statePath) {
    await rm(statePath, { force: true });
  }
  delete process.env.SOVSEAL_DB_DIR;
  delete process.env.SOVSEAL_STATE_PATH;
});

// Helper for batched embedding to generate 10,000 vectors quickly
async function generateEmbeddingsBatch(texts: string[]): Promise<Float32Array[]> {
  const pipelinePromise = await getEmbeddingPipeline();
  const output = await pipelinePromise(texts, { pooling: "mean", normalize: true });
  const flatData = output.data;
  const results: Float32Array[] = [];
  const dim = 384;
  for (let i = 0; i < texts.length; i++) {
    const start = i * dim;
    const end = start + dim;
    const slice = flatData.slice(start, end);
    results.push(slice instanceof Float32Array ? slice : Float32Array.from(slice));
  }
  return results;
}

describe("Performance Benchmark — LanceDB + Transformers.js Vector Search", () => {
  test("10k populated rows, 1,000 vector search calls", async () => {
    const { table } = await initLocalDb();

    console.log("Generating 10,000 benchmark memories...");
    const batchSize = 500;
    const totalMemories = 10000;
    const textCorpus = [
      "Rust concurrency models are incredibly powerful for thread safety.",
      "React 19 Server Components render on the server, optimizing payload delivery.",
      "Base mainnet is a secure, low-cost Ethereum L2 solution.",
      "The fast, decentralized snapshot recovery protocol prevents data loss.",
      "Deno is a modern, secure runtime for JavaScript and TypeScript.",
    ];

    for (let i = 0; i < totalMemories; i += batchSize) {
      const texts: string[] = [];
      for (let j = 0; j < batchSize; j++) {
        const index = i + j;
        const baseText = textCorpus[index % textCorpus.length];
        texts.push(`${baseText} (suffix ID ${index})`);
      }

      const vectors = await generateEmbeddingsBatch(texts);
      const rows = texts.map((text, idx) => ({
        id: `bench-mem-${i + idx}`,
        vector: Array.from(vectors[idx]),
        text,
        timestamp: BigInt(Date.now()),
        sync_status: "synced",
      }));

      await table.add(rows);
      if ((i + batchSize) % 2000 === 0) {
        console.log(`  Populated ${i + batchSize} / 10,000 rows...`);
      }
    }

    const count = await table.countRows();
    expect(count).toBe(10000);
    console.log("Pre-population of 10,000 rows in LanceDB successfully completed.");

    // Warm up search once
    await queryLocal("concurrency", 5);

    console.log("Executing 1,000 vector query calls sequentially...");
    const latencies: number[] = [];
    const queries = [
      "thread safety in Rust",
      "React Server Components",
      "Ethereum L2 Base",
      "decentralized recovery protocol",
      "modern JS Deno runtime",
    ];

    for (let i = 0; i < 1000; i++) {
      const queryText = queries[i % queries.length];
      const start = performance.now();
      await queryLocal(queryText, 5);
      const duration = performance.now() - start;
      latencies.push(duration);
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    console.log("--- Benchmark Latency Report ---");
    console.log(`p50 latency: ${p50.toFixed(2)}ms`);
    console.log(`p95 latency: ${p95.toFixed(2)}ms`);
    console.log(`p99 latency: ${p99.toFixed(2)}ms`);
    console.log("---------------------------------");

    // Enforce latency SLA assertions (p95 < 5ms, p99 < 15ms)
    try {
      expect(p95).toBeLessThan(5);
      expect(p99).toBeLessThan(15);
      console.log("✅ Vector search latency within SLA bounds!");
    } catch (err) {
      console.error("❌ Vector search latency exceeded SLA bounds!");
      console.error("Please file a P4 remediation ticket to performance-benchmarker.");
      throw err;
    }
  }, 600_000);
});
