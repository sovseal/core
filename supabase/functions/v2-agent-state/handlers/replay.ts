// GET /replay?since=<sequence_number> — returns all replication log entries
// with sequence_number > since, ordered ascending. Bearer auth required.
// Reads are free (no credit debit).

import { type AuthContext, HttpError } from "./auth.ts";
import { jsonResponse } from "./snapshot.ts";

/** Maximum rows per replay response to prevent unbounded payloads. */
const MAX_REPLAY_ROWS = 1000;

export async function handleReplay(
  url: URL,
  supabase: any,
  auth: AuthContext
): Promise<Response> {
  const sinceParam = url.searchParams.get("since");

  if (sinceParam === null || sinceParam === "") {
    throw new HttpError(400, "missing_since_param");
  }

  const since = Number(sinceParam);
  if (!Number.isFinite(since) || since < 0 || !Number.isInteger(since)) {
    throw new HttpError(400, "bad_since_param");
  }

  const agentUuid = auth.authMode === "project_token"
    ? auth.apiKeyId.replace("sov_proj_", "")
    : auth.walletAddress;

  const { data, error } = await supabase
    .from("agent_replication_log")
    .select("sequence_number, block_hash, ciphertext, merkle_root, created_at")
    .eq("agent_id", agentUuid)
    .gt("sequence_number", since)
    .order("sequence_number", { ascending: true })
    .limit(MAX_REPLAY_ROWS);

  if (error) throw new HttpError(500, "replay_lookup_failed");

  // Encode ciphertext bytea back to base64 for JSON transport
  const chunks = (data ?? []).map((row: any) => ({
    sequence_number: row.sequence_number,
    block_hash: row.block_hash,
    ciphertext_b64: encodeToBase64(row.ciphertext),
    merkle_root: row.merkle_root,
    created_at: row.created_at,
  }));

  return jsonResponse(200, { chunks, count: chunks.length });
}

/**
 * Encode a value to base64. Handles both Uint8Array and already-base64-encoded
 * strings (Supabase returns bytea as base64 via PostgREST in some configurations).
 */
function encodeToBase64(value: unknown): string {
  if (typeof value === "string") {
    // PostgREST may return bytea as hex-encoded string with \x prefix
    if (value.startsWith("\\x")) {
      const hex = value.slice(2);
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
      }
      return btoa(String.fromCharCode(...bytes));
    }
    // Already a base64 string
    return value;
  }
  if (value instanceof Uint8Array) {
    return btoa(String.fromCharCode(...value));
  }
  return "";
}
