/**
 * state.ts — Durable cursor for the background sync worker.
 *
 * Owns `~/.sovseal/state.json` (override via SOVSEAL_STATE_PATH). Tracks the
 * monotonic `next_sequence_number`, the running `local_merkle_root`, the
 * last-synced wall clock, and the resolved API endpoint. Atomic write via
 * write-to-tmp + rename so a mid-write crash never corrupts the cursor.
 *
 * The API key is intentionally NOT persisted here — it lives in env / OS
 * keychain only (per Phase 4 brief negative instruction).
 */

import { mkdir, rename, readFile, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const DEFAULT_API_ENDPOINT =
  "https://api.sovseal.com/functions/v1/v2-agent-state";

export const EMPTY_MERKLE_ROOT =
  "0000000000000000000000000000000000000000000000000000000000000000";

export interface SyncState {
  next_sequence_number: number;
  local_merkle_root: string;
  last_synced_at: number;
  api_endpoint: string;
}

export function resolveStatePath(): string {
  return (
    process.env.SOVSEAL_STATE_PATH ?? join(homedir(), ".sovseal", "state.json")
  );
}

export function resolveApiEndpoint(): string {
  return process.env.SOVSEAL_API_ENDPOINT ?? DEFAULT_API_ENDPOINT;
}

export function initialState(): SyncState {
  return {
    next_sequence_number: 0,
    local_merkle_root: EMPTY_MERKLE_ROOT,
    last_synced_at: 0,
    api_endpoint: resolveApiEndpoint(),
  };
}

export async function loadState(path = resolveStatePath()): Promise<SyncState> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<SyncState>;
    return {
      next_sequence_number:
        typeof parsed.next_sequence_number === "number"
          ? parsed.next_sequence_number
          : 0,
      local_merkle_root:
        typeof parsed.local_merkle_root === "string" &&
        parsed.local_merkle_root.length > 0
          ? parsed.local_merkle_root
          : EMPTY_MERKLE_ROOT,
      last_synced_at:
        typeof parsed.last_synced_at === "number" ? parsed.last_synced_at : 0,
      api_endpoint:
        typeof parsed.api_endpoint === "string" && parsed.api_endpoint.length > 0
          ? parsed.api_endpoint
          : resolveApiEndpoint(),
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return initialState();
    throw err;
  }
}

export async function saveState(
  state: SyncState,
  path = resolveStatePath(),
): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true, mode: 0o700 });

  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(state, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(tmp, 0o600);
  await rename(tmp, path);
}
