/**
 * local/index.ts — Internal store + query API for the local semantic engine.
 *
 * P1 ships this as an internal-only surface. Phase 2 of NOMOREDELAY will
 * expose `store_memory` / `recall_memory` MCP tools on top of these
 * functions. Nothing here touches the network.
 */

import { randomUUID } from "node:crypto";

import { initLocalDb, type LocalDb, type SyncStatus } from "./db.js";
import { generateEmbedding, generateQueryEmbedding } from "./embeddings.js";

const DEFAULT_TOP_K = 5;

export interface StoreResult {
  id: string;
}

export interface QueryHit {
  id: string;
  text: string;
  score: number;
}

let dbPromise: Promise<LocalDb> | null = null;

function getDb(): Promise<LocalDb> {
  if (!dbPromise) {
    dbPromise = initLocalDb().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export async function storeLocal(text: string): Promise<StoreResult> {
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("storeLocal: text must be a non-empty string");
  }

  const { table } = await getDb();
  const vector = await generateEmbedding(text);

  const id = randomUUID();
  const sync_status: SyncStatus = "pending";

  await table.add([
    {
      id,
      vector: Array.from(vector),
      text,
      timestamp: BigInt(Date.now()),
      sync_status,
    },
  ]);

  return { id };
}

export async function queryLocal(
  query: string,
  topK: number = DEFAULT_TOP_K,
): Promise<QueryHit[]> {
  if (typeof query !== "string" || query.length === 0) {
    throw new Error("queryLocal: query must be a non-empty string");
  }
  if (!Number.isInteger(topK) || topK <= 0) {
    throw new Error("queryLocal: topK must be a positive integer");
  }

  const { table } = await getDb();
  const count = await table.countRows();
  if (count === 0) return [];

  const vector = await generateQueryEmbedding(query);
  const limit = Math.min(topK, count);

  const rows = await table
    .search(Array.from(vector))
    .limit(limit)
    .execute<Record<string, unknown>>();

  return rows.map((row) => ({
    id: String(row.id),
    text: String(row.text),
    score: typeof row._distance === "number" ? row._distance : Number(row._distance),
  }));
}

export interface PendingMemory {
  id: string;
  text: string;
  timestamp: bigint;
}

/**
 * Scan the local LanceDB for rows awaiting replication. Returned in
 * insertion-time order (oldest first) so the worker preserves causal order
 * when chunking into blocks.
 */
export async function getPendingMemories(
  limit: number = 1_000,
): Promise<PendingMemory[]> {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("getPendingMemories: limit must be a positive integer");
  }
  const { table } = await getDb();
  const count = await table.countRows();
  if (count === 0) return [];

  const rows = await table
    .filter("sync_status = 'pending'")
    .select(["id", "text", "timestamp"])
    .limit(limit)
    .execute<Record<string, unknown>>();

  const mapped = rows.map((row) => ({
    id: String(row.id),
    text: String(row.text),
    timestamp: toBigInt(row.timestamp),
  }));

  mapped.sort((a, b) => {
    if (a.timestamp === b.timestamp) return a.id.localeCompare(b.id);
    return a.timestamp < b.timestamp ? -1 : 1;
  });

  return mapped;
}

/**
 * Fetch the N most recent memories ordered by descending timestamp.
 */
export async function getRecentMemories(
  limit: number = 50,
): Promise<PendingMemory[]> {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("getRecentMemories: limit must be a positive integer");
  }
  const { table } = await getDb();
  const count = await table.countRows();
  if (count === 0) return [];

  // LanceDB JS doesn't support order_by yet, so we fetch all and sort.
  // For larger datasets, this would need a different index or strategy,
  // but for local agent memory it's sufficient.
  //
  // `.select` only exists on a filtered query in this vectordb version, so
  // we anchor on an always-true predicate (timestamp is set from Date.now()
  // and is therefore always >= 0) to select every row. Mirrors the working
  // chain in getPendingMemories above.
  const rows = await table
    .filter("timestamp >= 0")
    .select(["id", "text", "timestamp"])
    .execute<Record<string, unknown>>();

  const mapped = rows.map((row) => ({
    id: String(row.id),
    text: String(row.text),
    timestamp: toBigInt(row.timestamp),
  }));

  mapped.sort((a, b) => {
    if (a.timestamp === b.timestamp) return b.id.localeCompare(a.id);
    return a.timestamp > b.timestamp ? -1 : 1;
  });

  return mapped.slice(0, limit);
}

/**
 * Flip a set of rows from `pending` → `synced`. Used by the background
 * worker once the edge function ACKs a block.
 */
export async function markMemoriesSynced(ids: string[]): Promise<void> {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const sanitized = ids.map((id) => {
    if (typeof id !== "string" || id.length === 0 || /['"\\]/.test(id)) {
      throw new Error(`markMemoriesSynced: invalid id ${JSON.stringify(id)}`);
    }
    return `'${id}'`;
  });
  const { table } = await getDb();
  await table.update({
    where: `id IN (${sanitized.join(",")})`,
    valuesSql: { sync_status: "'synced'" },
  });
}

/**
 * Permanently remove a single memory row by id. Used by the browser
 * extension sidebar's delete action via the native host. The id is
 * sanitized exactly like {@link markMemoriesSynced} to keep it out of the
 * SQL predicate string. Returns the number of rows deleted (0 if no match).
 */
export async function deleteLocal(id: string): Promise<{ deleted: number }> {
  if (typeof id !== "string" || id.length === 0 || /['"\\]/.test(id)) {
    throw new Error(`deleteLocal: invalid id ${JSON.stringify(id)}`);
  }
  const { table } = await getDb();
  const before = await table.countRows();
  await table.delete(`id = '${id}'`);
  const after = await table.countRows();
  return { deleted: Math.max(0, before - after) };
}

/**
 * Total number of memories in the local store. Backs the native host's
 * `status` response.
 */
export async function countLocal(): Promise<number> {
  const { table } = await getDb();
  return table.countRows();
}

function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  return BigInt(0);
}

export function resetLocalDbForTests(): void {
  dbPromise = null;
}
