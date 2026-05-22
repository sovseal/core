/**
 * embeddings.ts — On-device sentence embeddings via Transformers.js.
 *
 * Lazy-loads `Xenova/all-MiniLM-L6-v2` (ONNX quantized, ~22MB) on first
 * call and caches it to `~/.sovseal/models/` (override via
 * SOVSEAL_MODEL_DIR). After the first download, every subsequent call
 * runs entirely on-device — no Hugging Face round-trip.
 *
 * Output: 384-dim Float32Array, mean-pooled + L2-normalized so cosine
 * similarity reduces to a dot product (matches LanceDB's default L2 /
 * cosine ranking on normalized vectors).
 */

import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  env,
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";

import { EMBEDDING_DIM } from "./db.js";

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

/**
 * REM-P5-003: SHA-256 pin of the Xenova/all-MiniLM-L6-v2 model bundle.
 * Computed from the canonical Hugging Face artifacts on 2026-05-20. If
 * Transformers.js downloads a different version (model update, MITM, or
 * tampering), startup aborts.
 *
 * To re-pin after an intentional model update:
 *   $ cd ~/.sovseal/models/Xenova/all-MiniLM-L6-v2 && \
 *     for f in config.json tokenizer.json tokenizer_config.json onnx/model_quantized.onnx; do \
 *       echo "$f: $(shasum -a 256 "$f" | awk '{print $1}')"; \
 *     done
 * then update this map and ship a CHANGELOG note.
 */
export const MODEL_INTEGRITY: Record<string, string> = {
  "config.json":
    "7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7",
  "tokenizer.json":
    "da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0",
  "tokenizer_config.json":
    "9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3",
  "onnx/model_quantized.onnx":
    "afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1",
};

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

/**
 * REM-PERF-001 (NOMOREDELAY-PERF p0): LRU cache for query embeddings.
 *
 * Per the P6 bench, the per-query CPU embedding step (~5–8 ms via Transformers.js
 * `all-MiniLM-L6-v2` int8) dominates p95 — not the LanceDB scan. Real agent
 * recall loops repeat or paraphrase the same query within a session, so a
 * small LRU on the query string yields a high hit rate and skips the model
 * entirely on cache hits. Storage path (`storeLocal`) intentionally bypasses
 * the cache — every stored memory is unique by construction.
 *
 * Capacity is intentionally small (default 256) to keep the working set in
 * L1/L2 and avoid memory pressure for long-running MCP sessions. Override
 * via `SOVSEAL_EMBEDDING_CACHE_SIZE`; set to `0` to disable entirely.
 */
const DEFAULT_EMBEDDING_CACHE_SIZE = 256;

function resolveCacheSize(): number {
  const raw = process.env.SOVSEAL_EMBEDDING_CACHE_SIZE;
  if (raw === undefined) return DEFAULT_EMBEDDING_CACHE_SIZE;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_EMBEDDING_CACHE_SIZE;
  }
  return parsed;
}

const queryEmbeddingCache = new Map<string, Float32Array>();
let cacheHits = 0;
let cacheMisses = 0;

function cacheGet(key: string): Float32Array | undefined {
  const hit = queryEmbeddingCache.get(key);
  if (hit === undefined) return undefined;
  queryEmbeddingCache.delete(key);
  queryEmbeddingCache.set(key, hit);
  return hit;
}

function cacheSet(key: string, value: Float32Array): void {
  const capacity = resolveCacheSize();
  if (capacity === 0) return;
  if (queryEmbeddingCache.has(key)) {
    queryEmbeddingCache.delete(key);
  } else if (queryEmbeddingCache.size >= capacity) {
    const oldest = queryEmbeddingCache.keys().next().value;
    if (oldest !== undefined) queryEmbeddingCache.delete(oldest);
  }
  queryEmbeddingCache.set(key, value);
}

function resolveModelDir(): string {
  return process.env.SOVSEAL_MODEL_DIR ?? join(homedir(), ".sovseal", "models");
}

async function verifyModelIntegrity(cacheDir: string): Promise<void> {
  const modelRoot = join(cacheDir, EMBEDDING_MODEL);
  for (const [relPath, expected] of Object.entries(MODEL_INTEGRITY)) {
    const filePath = join(modelRoot, relPath);
    const bytes = await readFile(filePath);
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== expected) {
      throw new Error(
        `[sovseal] model integrity violation at ${relPath}: expected ${expected}, got ${actual}. ` +
          `Refusing to embed. Re-download the model or update MODEL_INTEGRITY if this was an intentional upgrade.`,
      );
    }
  }
}

async function loadPipeline(): Promise<FeatureExtractionPipeline> {
  const cacheDir = resolveModelDir();
  await mkdir(cacheDir, { recursive: true, mode: 0o700 });

  env.cacheDir = cacheDir;
  env.allowLocalModels = true;
  env.useFSCache = true;

  const extractor = (await pipeline("feature-extraction", EMBEDDING_MODEL, {
    cache_dir: cacheDir,
    dtype: "q8",
  })) as FeatureExtractionPipeline;

  await verifyModelIntegrity(cacheDir);

  return extractor;
}

export function getEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = loadPipeline().catch((err) => {
      pipelinePromise = null;
      throw err;
    });
  }
  return pipelinePromise;
}

export async function generateEmbedding(text: string): Promise<Float32Array> {
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("generateEmbedding: text must be a non-empty string");
  }

  const extractor = await getEmbeddingPipeline();
  const output = await extractor(text, { pooling: "mean", normalize: true });

  const raw = output.data;
  const vector =
    raw instanceof Float32Array ? raw : Float32Array.from(raw as ArrayLike<number>);

  if (vector.length !== EMBEDDING_DIM) {
    throw new Error(
      `generateEmbedding: expected ${EMBEDDING_DIM}-dim vector, got ${vector.length}`,
    );
  }

  return vector;
}

/**
 * Query path: try the LRU cache first, then fall through to the model.
 * Used by `queryLocal` only — store path always embeds afresh because each
 * stored memory is unique by construction.
 */
export async function generateQueryEmbedding(text: string): Promise<Float32Array> {
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("generateQueryEmbedding: text must be a non-empty string");
  }
  const hit = cacheGet(text);
  if (hit !== undefined) {
    cacheHits += 1;
    return hit;
  }
  cacheMisses += 1;
  const vector = await generateEmbedding(text);
  cacheSet(text, vector);
  return vector;
}

export interface EmbeddingCacheStats {
  size: number;
  capacity: number;
  hits: number;
  misses: number;
}

export function getEmbeddingCacheStats(): EmbeddingCacheStats {
  return {
    size: queryEmbeddingCache.size,
    capacity: resolveCacheSize(),
    hits: cacheHits,
    misses: cacheMisses,
  };
}

/**
 * Eagerly load the model and run a tiny no-op embedding so the JIT path is
 * warm before the first user-facing `recall_memory` call. Safe to invoke
 * multiple times — idempotent via `pipelinePromise`.
 */
export async function warmupEmbeddingPipeline(): Promise<void> {
  await getEmbeddingPipeline();
  await generateEmbedding("warmup");
}

export function resetEmbeddingPipelineForTests(): void {
  pipelinePromise = null;
  queryEmbeddingCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}
