// GET /head — returns the latest replication log entry metadata for the
// authenticated agent. Millisecond response budget. No decryption attempted.

import { type AuthContext, HttpError } from "./auth.ts";
import { jsonResponse } from "./snapshot.ts";

export async function handleHead(
  supabase: any,
  auth: AuthContext
): Promise<Response> {
  const agentUuid = auth.authMode === "project_token"
    ? auth.apiKeyId.replace("sov_proj_", "")
    : auth.walletAddress;

  const { data, error } = await supabase
    .from("agent_replication_log")
    .select("sequence_number, merkle_root, created_at")
    .eq("agent_id", agentUuid)
    .order("sequence_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new HttpError(500, "head_lookup_failed");
  if (!data) throw new HttpError(404, "no_replication_entries");

  return jsonResponse(200, {
    sequence_number: data.sequence_number,
    merkle_root: data.merkle_root,
    updated_at: data.created_at,
  });
}
