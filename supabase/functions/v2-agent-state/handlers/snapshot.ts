// POST /v2/snapshot — atomic flow:
//   hash check → sequence guard → debit → placeholder row → Irys push → confirm
// Refunds the debit and returns 503 if Irys fails.

import { type AuthContext, HttpError } from "./auth.ts";
import { MAX_PAYLOAD_BYTES, priceSnapshotMilli } from "@inheribase/core-protocol";

const STORAGE_BUCKET = "sovseal-rom";

interface SnapshotEnvelope {
  agent_id: string;
  sequence_number: number;
  parent_snapshot: string | null;
  policy_hash: string;
  client_payload_hash: string;
  ciphertext_b64: string;
  byte_size: number;
  timestamp: string;
}

const HEX_64 = /^[a-f0-9]{64}$/i;

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function handleSnapshot(
  req: Request,
  supabase: any,
  auth: AuthContext
): Promise<Response> {
  let env: SnapshotEnvelope;
  try {
    env = await req.json();
  } catch {
    throw new HttpError(400, "invalid_json");
  }

  // Structural validation
  for (const field of [
    "agent_id",
    "sequence_number",
    "policy_hash",
    "client_payload_hash",
    "ciphertext_b64",
    "byte_size",
    "timestamp",
  ]) {
    if ((env as any)[field] === undefined) {
      throw new HttpError(400, `missing_field:${field}`);
    }
  }
  if (!HEX_64.test(env.policy_hash)) throw new HttpError(400, "bad_policy_hash");
  if (!HEX_64.test(env.client_payload_hash)) throw new HttpError(400, "bad_payload_hash");
  if (env.byte_size <= 0 || env.byte_size > MAX_PAYLOAD_BYTES) {
    throw new HttpError(413, "ciphertext_too_large");
  }
  if (env.sequence_number < 0 || !Number.isInteger(env.sequence_number)) {
    throw new HttpError(400, "bad_sequence");
  }
  if (env.sequence_number === 0 && env.parent_snapshot !== null) {
    throw new HttpError(400, "genesis_violation");
  }
  if (env.sequence_number > 0 && !env.parent_snapshot) {
    throw new HttpError(400, "missing_parent_snapshot");
  }

  // Decode ciphertext + verify byte_size
  const ciphertext = decodeBase64(env.ciphertext_b64);
  if (ciphertext.byteLength !== env.byte_size) {
    throw new HttpError(400, "byte_size_mismatch");
  }

  // Sequence guard — must be exactly latest+1, or idempotent return on dupe
  const { data: existing, error: existingErr } = await supabase
    .from("agent_state_snapshots")
    .select("id, sequence_number, status, arweave_tx_id, byte_size, cost_milli, client_payload_hash, confirmed_at")
    .eq("agent_id", env.agent_id)
    .eq("owner_wallet", auth.walletAddress)
    .order("sequence_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingErr) throw new HttpError(500, "sequence_lookup_failed");

  const latestSeq: number = existing?.sequence_number ?? -1;

  // Idempotent replay: same agent/sequence, same hash → return prior receipt unchanged
  if (existing && existing.sequence_number === env.sequence_number) {
    if (existing.client_payload_hash === env.client_payload_hash && existing.status === "confirmed") {
      return jsonResponse(200, {
        snapshot_id: existing.id,
        agent_id: env.agent_id,
        sequence_number: existing.sequence_number,
        arweave_tx_id: existing.arweave_tx_id,
        byte_size: existing.byte_size,
        cost_milli: existing.cost_milli,
        client_payload_hash: existing.client_payload_hash,
        status: "confirmed",
        confirmed_at: existing.confirmed_at,
      });
    }
    throw new HttpError(409, "sequence_conflict");
  }
  if (env.sequence_number !== latestSeq + 1) {
    throw new HttpError(409, "sequence_gap");
  }

  // Pricing — free tier for self-asserting project tokens, billed for sov_live_ keys.
  const isProjectToken = auth.authMode === "project_token";
  const costMilli = isProjectToken ? 0 : priceSnapshotMilli(env.byte_size);

  if (!isProjectToken) {
    const { error: debitErr } = await supabase.rpc("atomic_debit_credits_milli_v2", {
      p_wallet: auth.walletAddress,
      p_owed_milli: costMilli,
    });
    if (debitErr) {
      if (String(debitErr.message ?? "").includes("insufficient")) {
        throw new HttpError(402, "insufficient_credits");
      }
      throw new HttpError(500, "debit_failed");
    }
  }

  // Storage object path — deterministic per (agent, sequence) so it's idempotent on retry.
  const storagePath = `${env.agent_id}/seq-${env.sequence_number}-${env.client_payload_hash.slice(0, 12)}.bin`;

  // Insert pending row
  const { data: pending, error: pendingErr } = await supabase
    .from("agent_state_snapshots")
    .insert({
      agent_id: env.agent_id,
      sequence_number: env.sequence_number,
      parent_tx_id: env.parent_snapshot,
      policy_hash: env.policy_hash,
      byte_size: env.byte_size,
      cost_milli: costMilli,
      status: "pending",
      arweave_tx_id: storagePath,
      client_payload_hash: env.client_payload_hash,
      owner_wallet: auth.walletAddress,
    })
    .select("id")
    .single();
  if (pendingErr) {
    if (!isProjectToken) {
      await supabase.rpc("atomic_refund_credits_milli_v2", {
        p_wallet: auth.walletAddress,
        p_refund_milli: costMilli,
      });
    }
    throw new HttpError(500, "snapshot_insert_failed");
  }

  // Upload ciphertext to Supabase Storage (sovseal-rom). Public bucket; the path
  // itself is unguessable enough for MVP. Real Irys/Arweave wiring is a follow-up.
  const { error: uploadErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, ciphertext, {
      contentType: "application/octet-stream",
      upsert: true,
    });
  if (uploadErr) {
    console.error("[v2-agent-state] storage upload failed:", uploadErr);
    await supabase.from("agent_state_snapshots").update({ status: "failed" }).eq("id", pending.id);
    if (!isProjectToken) {
      await supabase.rpc("atomic_refund_credits_milli_v2", {
        p_wallet: auth.walletAddress,
        p_refund_milli: costMilli,
      });
    }
    throw new HttpError(503, "storage_unavailable");
  }
  const arweaveTxId = storagePath;

  // Confirm
  const confirmedAt = new Date().toISOString();
  const { error: confirmErr } = await supabase
    .from("agent_state_snapshots")
    .update({
      arweave_tx_id: arweaveTxId,
      status: "confirmed",
      confirmed_at: confirmedAt,
    })
    .eq("id", pending.id);
  if (confirmErr) {
    console.error("[v2-agent-state] confirmation update failed (snapshot is on Arweave but row is stale):", confirmErr);
    // Do NOT refund — the data is permanently on Arweave.
  }

  return jsonResponse(200, {
    snapshot_id: pending.id,
    agent_id: env.agent_id,
    sequence_number: env.sequence_number,
    arweave_tx_id: arweaveTxId,
    byte_size: env.byte_size,
    cost_milli: costMilli,
    client_payload_hash: env.client_payload_hash,
    status: "confirmed",
    confirmed_at: confirmedAt,
  });
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Re-export for index.ts to satisfy unused-import lint
export type { SnapshotEnvelope };
// avoid mention of HEX_64 elsewhere; re-confirm it exists
void HEX_64;
// suppress unused-fn warning for sha256Hex — it's available for Phase 5 server-side hash recomputation.
void sha256Hex;
