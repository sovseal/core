/**
 * embedding-cache.test.ts — REM-PERF-001 (NOMOREDELAY-PERF p0).
 *
 * Validates the LRU query-embedding cache on the recall path:
 *   - cache miss embeds via Transformers.js
 *   - cache hit on identical query string skips the model entirely
 *   - LRU eviction at the configured capacity boundary
 *   - SOVSEAL_EMBEDDING_CACHE_SIZE=0 disables the cache
 *
 * The cache lives behind `generateQueryEmbedding`. The store path
 * (`generateEmbedding`) intentionally bypasses it.
 */

import { homedir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeAll, describe, expect, test } from "vitest";

import {
  generateQueryEmbedding,
  getEmbeddingCacheStats,
  resetEmbeddingPipelineForTests,
} from "../embeddings.js";

const SHARED_MODEL_DIR = join(homedir(), ".sovseal", "models");

beforeAll(() => {
  process.env.SOVSEAL_MODEL_DIR = SHARED_MODEL_DIR;
});

afterEach(() => {
  resetEmbeddingPipelineForTests();
  delete process.env.SOVSEAL_EMBEDDING_CACHE_SIZE;
});

describe("LRU query-embedding cache", () => {
  test("first call is a miss, second call on the same query is a hit", async () => {
    const a = await generateQueryEmbedding("the cat sat on the mat");
    const after1 = getEmbeddingCacheStats();
    expect(after1.misses).toBe(1);
    expect(after1.hits).toBe(0);
    expect(after1.size).toBe(1);

    const b = await generateQueryEmbedding("the cat sat on the mat");
    const after2 = getEmbeddingCacheStats();
    expect(after2.misses).toBe(1);
    expect(after2.hits).toBe(1);
    expect(b).toEqual(a);
  });

  test("distinct queries each produce a miss", async () => {
    await generateQueryEmbedding("alpha bravo charlie");
    await generateQueryEmbedding("delta echo foxtrot");
    const stats = getEmbeddingCacheStats();
    expect(stats.misses).toBe(2);
    expect(stats.hits).toBe(0);
    expect(stats.size).toBe(2);
  });

  test("LRU evicts the oldest entry once capacity is exceeded", async () => {
    process.env.SOVSEAL_EMBEDDING_CACHE_SIZE = "2";
    resetEmbeddingPipelineForTests();

    await generateQueryEmbedding("one");
    await generateQueryEmbedding("two");
    await generateQueryEmbedding("three");
    expect(getEmbeddingCacheStats().size).toBe(2);

    await generateQueryEmbedding("one");
    expect(getEmbeddingCacheStats().misses).toBe(4);
    expect(getEmbeddingCacheStats().hits).toBe(0);

    await generateQueryEmbedding("three");
    expect(getEmbeddingCacheStats().hits).toBe(1);
  });

  test("capacity=0 disables the cache (every call is a miss)", async () => {
    process.env.SOVSEAL_EMBEDDING_CACHE_SIZE = "0";
    resetEmbeddingPipelineForTests();

    await generateQueryEmbedding("disabled");
    await generateQueryEmbedding("disabled");
    const stats = getEmbeddingCacheStats();
    expect(stats.size).toBe(0);
    expect(stats.misses).toBe(2);
    expect(stats.hits).toBe(0);
  });

  test("empty query is rejected before touching the cache", async () => {
    await expect(generateQueryEmbedding("")).rejects.toThrow(
      /non-empty string/,
    );
  });
});
