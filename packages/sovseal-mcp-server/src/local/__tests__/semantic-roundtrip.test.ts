/**
 * semantic-roundtrip.test.ts — P1 of NOMOREDELAY (SDK v2 Semantic Vector
 * Brain). Validates the local LanceDB + Transformers.js stack end-to-end:
 *
 *   - directory auto-creation under a sandboxed home
 *   - 384-dim Float32Array embeddings (model dimensionality contract)
 *   - semantic recall (paraphrase ranks the stored row at #1)
 *   - top-K ordering by L2 distance
 *
 * Each test isolates state with its own SOVSEAL_DB_DIR and resets the
 * module-scoped DB/pipeline singletons. The model dir is shared across
 * tests so we only pay the ONNX download once.
 */

import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";

import { beforeAll, afterAll, afterEach, describe, expect, test } from "vitest";

import { EMBEDDING_DIM, MEMORIES_TABLE, initLocalDb } from "../db.js";
import { generateEmbedding, resetEmbeddingPipelineForTests } from "../embeddings.js";
import { queryLocal, resetLocalDbForTests, storeLocal } from "../index.js";

const SHARED_MODEL_DIR = join(homedir(), ".sovseal", "models");

let dbDir: string;

beforeAll(() => {
  process.env.SOVSEAL_MODEL_DIR = SHARED_MODEL_DIR;
});

afterEach(async () => {
  resetLocalDbForTests();
  if (dbDir) {
    await rm(dbDir, { recursive: true, force: true });
    dbDir = "";
  }
});

afterAll(() => {
  resetEmbeddingPipelineForTests();
});

async function freshDbDir(label: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `sovseal-p1-${label}-`));
  process.env.SOVSEAL_DB_DIR = dir;
  resetLocalDbForTests();
  return dir;
}

describe("NOMOREDELAY P1 — local semantic engine", () => {
  test(
    "generateEmbedding returns a 384-dim Float32Array",
    async () => {
      dbDir = await freshDbDir("dim");
      const vector = await generateEmbedding("hello world");
      expect(vector).toBeInstanceOf(Float32Array);
      expect(vector.length).toBe(EMBEDDING_DIM);
      const magnitude = Math.sqrt(
        Array.from(vector).reduce((acc, v) => acc + v * v, 0),
      );
      expect(magnitude).toBeGreaterThan(0.95);
      expect(magnitude).toBeLessThan(1.05);
    },
    300_000,
  );

  test(
    "initLocalDb auto-creates the db dir and is idempotent",
    async () => {
      dbDir = await freshDbDir("init");
      await rm(dbDir, { recursive: true, force: true });

      const first = await initLocalDb();
      expect(first.dbDir).toBe(dbDir);
      expect((await stat(dbDir)).isDirectory()).toBe(true);
      const names = await first.connection.tableNames();
      expect(names).toContain(MEMORIES_TABLE);

      resetLocalDbForTests();
      const second = await initLocalDb();
      const namesAgain = await second.connection.tableNames();
      expect(namesAgain.filter((n) => n === MEMORIES_TABLE).length).toBe(1);
    },
    300_000,
  );

  test(
    "semantic recall: paraphrase retrieves the stored row at top",
    async () => {
      dbDir = await freshDbDir("recall");

      const target = await storeLocal("the cat sat on the mat");
      await storeLocal("the quarterly earnings exceeded analyst expectations");
      await storeLocal("solidity contracts compile under foundry");
      await storeLocal("she planted tulips in the front garden");

      expect(target.id).toMatch(/^[0-9a-f-]{36}$/);

      const hits = await queryLocal("a feline resting on a rug", 3);
      expect(hits.length).toBe(3);
      expect(hits[0].id).toBe(target.id);
      expect(hits[0].text).toBe("the cat sat on the mat");
      for (let i = 1; i < hits.length; i++) {
        expect(hits[i].score).toBeGreaterThanOrEqual(hits[i - 1].score);
      }
    },
    300_000,
  );

  test(
    "queryLocal honors topK and returns nothing on empty table",
    async () => {
      dbDir = await freshDbDir("topk");
      const empty = await queryLocal("anything", 5);
      expect(empty).toEqual([]);

      await storeLocal("alpha beta gamma");
      await storeLocal("delta epsilon zeta");
      await storeLocal("eta theta iota");

      const hits = await queryLocal("greek letters", 2);
      expect(hits.length).toBe(2);
      for (const hit of hits) {
        expect(typeof hit.id).toBe("string");
        expect(typeof hit.text).toBe("string");
        expect(Number.isFinite(hit.score)).toBe(true);
      }
    },
    300_000,
  );

  // P1 acceptance: the default path resolves to ~/.sovseal/db/memories.lance
  // and one round-trip lands a real on-disk artifact. We do NOT clear the
  // directory afterwards — its presence is the deliverable.
  test(
    "default path lands memories.lance under ~/.sovseal/db",
    async () => {
      delete process.env.SOVSEAL_DB_DIR;
      resetLocalDbForTests();
      dbDir = "";

      const defaultDir = join(homedir(), ".sovseal", "db");
      const result = await storeLocal("p1 default-path acceptance row");
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);

      const tableDir = join(defaultDir, `${MEMORIES_TABLE}.lance`);
      expect((await stat(tableDir)).isDirectory()).toBe(true);

      resetLocalDbForTests();
    },
    300_000,
  );
});
