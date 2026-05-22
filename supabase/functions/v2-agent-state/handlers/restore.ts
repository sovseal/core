// Read paths: latest, by-sequence, lineage walk.

import { type AuthContext, HttpError } from "./auth.ts";
import { jsonResponse } from "./snapshot.ts";

const STORAGE_BUCKET = "sovseal-rom";

function ciphertextUrlFor(supabase: any, storagePath: string): string {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

function rowToReceipt(row: any) {
  return {
    snapshot_id: row.id,
    agent_id: row.agent_id,
    sequence_number: row.sequence_number,
    arweave_tx_id: row.arweave_tx_id,
    byte_size: row.byte_size,
    cost_milli: row.cost_milli,
    client_payload_hash: row.client_payload_hash,
    status: row.status,
    confirmed_at: row.confirmed_at,
  };
}

export async function handleRestoreLatest(
  supabase: any,
  auth: AuthContext,
  agentId: string
): Promise<Response> {
  const { data, error } = await supabase
    .from("agent_state_snapshots")
    .select("*")
    .eq("agent_id", agentId)
    .eq("owner_wallet", auth.walletAddress)
    .eq("status", "confirmed")
    .order("sequence_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new HttpError(500, "restore_lookup_failed");
  if (!data) throw new HttpError(404, "no_snapshots_for_agent");
  return jsonResponse(200, {
    receipt: rowToReceipt(data),
    ciphertextUrl: ciphertextUrlFor(supabase, data.arweave_tx_id),
  });
}

export async function handleRestoreAt(
  supabase: any,
  auth: AuthContext,
  agentId: string,
  sequence: number
): Promise<Response> {
  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new HttpError(400, "bad_sequence");
  }
  const { data, error } = await supabase
    .from("agent_state_snapshots")
    .select("*")
    .eq("agent_id", agentId)
    .eq("owner_wallet", auth.walletAddress)
    .eq("sequence_number", sequence)
    .eq("status", "confirmed")
    .maybeSingle();
  if (error) throw new HttpError(500, "restore_lookup_failed");
  if (!data) throw new HttpError(404, "snapshot_not_found");
  return jsonResponse(200, {
    receipt: rowToReceipt(data),
    ciphertextUrl: ciphertextUrlFor(supabase, data.arweave_tx_id),
  });
}

export async function handleLineage(
  supabase: any,
  auth: AuthContext,
  agentId: string,
  limit: number
): Promise<Response> {
  const safeLimit = Math.min(Math.max(1, limit | 0), 500);
  const { data, error } = await supabase
    .from("agent_state_snapshots")
    .select("sequence_number, arweave_tx_id, parent_tx_id, client_payload_hash, confirmed_at")
    .eq("agent_id", agentId)
    .eq("owner_wallet", auth.walletAddress)
    .eq("status", "confirmed")
    .order("sequence_number", { ascending: false })
    .limit(safeLimit);
  if (error) throw new HttpError(500, "lineage_lookup_failed");
  return jsonResponse(200, data ?? []);
}
