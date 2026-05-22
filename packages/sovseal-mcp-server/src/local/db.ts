/**
 * db.ts — Local LanceDB initializer for the v2 Semantic Vector Brain.
 *
 * Owns `~/.sovseal/db/memories.lance` (override via SOVSEAL_DB_DIR). The
 * connection is opened against the parent dir; the `memories` table is
 * created with an explicit Arrow schema so vector dim, dtype, and the
 * sync_status column survive an empty-table cold start (LanceDB cannot
 * infer FixedSizeList<Float32, 384> from no data).
 */

import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  Field,
  FixedSizeList,
  Float32,
  Int64,
  Schema,
  Utf8,
} from "apache-arrow";
import { connect, type Connection, type Table } from "vectordb";

export const EMBEDDING_DIM = 384;
export const MEMORIES_TABLE = "memories";

export type SyncStatus = "pending" | "synced";

export interface MemoryRow {
  id: string;
  vector: number[];
  text: string;
  timestamp: bigint;
  sync_status: SyncStatus;
}

export interface LocalDb {
  connection: Connection;
  table: Table<number[]>;
  dbDir: string;
}

export function resolveDbDir(): string {
  return process.env.SOVSEAL_DB_DIR ?? join(homedir(), ".sovseal", "db");
}

export const MEMORIES_SCHEMA = new Schema([
  new Field("id", new Utf8(), false),
  new Field(
    "vector",
    new FixedSizeList(
      EMBEDDING_DIM,
      new Field("item", new Float32(), true),
    ),
    false,
  ),
  new Field("text", new Utf8(), false),
  new Field("timestamp", new Int64(), false),
  new Field("sync_status", new Utf8(), false),
]);

export async function initLocalDb(): Promise<LocalDb> {
  const dbDir = resolveDbDir();
  await mkdir(dbDir, { recursive: true, mode: 0o700 });

  const connection = await connect(dbDir);
  const existing = await connection.tableNames();

  const table = existing.includes(MEMORIES_TABLE)
    ? await connection.openTable<number[]>(MEMORIES_TABLE)
    : await connection.createTable<number[]>({
        name: MEMORIES_TABLE,
        schema: MEMORIES_SCHEMA,
      });

  return { connection, table, dbDir };
}
