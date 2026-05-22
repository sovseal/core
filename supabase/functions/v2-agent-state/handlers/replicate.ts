// POST /replicate — append encrypted block diffs to the replication log.
//
// Atomic flow:
//   auth → validate → size cap (256 KB per chunk) → credit debit → insert
//   On unique_violation (duplicate sequence_number) → idempotent 200.
//   Server never decrypts. Logs only sequence_number, agent_id, and byte counts.

import { type AuthContext, HttpError } from "./auth.ts";
import { jsonResponse } from "./snapshot.ts";

/** 256 KB per-chunk decoded ciphertext cap. */
const MAX_CHUNK_BYTES = 262_144;

/** Milli-cents per byte — mirrors core-protocol RATE_PER_BYTE_MILLI. */
const RATE_PER_BYTE_MILLI = 0.045;

function priceChunkMilli(byteLength: number): number {
  if (byteLength <= 0) return 0;
  return Math.ceil(byteLength * RATE_PER_BYTE_MILLI);
}

interface ReplicateChunk {
  sequence_number: number;
  block_hash: string;
  ciphertext_b64: string;
}

interface ReplicateBody {
  chunks: ReplicateChunk[];
  merkle_root: string;
}

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function handleReplicate(
  req: Request,
  supabase: any,
  auth: AuthContext
): Promise<Response> {
  let body: ReplicateBody;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "invalid_json");
  }

  // Structural validation
  if (!Array.isArray(body.chunks) || body.chunks.length === 0) {
    throw new HttpError(400, "missing_or_empty_chunks");
  }
  if (typeof body.merkle_root !== "string" || body.merkle_root.length === 0) {
    throw new HttpError(400, "missing_merkle_root");
  }

  // Decode and validate each chunk, enforce 256 KB cap
  const decoded: Array<{
    sequence_number: number;
    block_hash: string;
    ciphertext: Uint8Array;
  }> = [];

  let totalBytes = 0;

  for (const chunk of body.chunks) {
    if (
      typeof chunk.sequence_number !== "number" ||
      !Number.isInteger(chunk.sequence_number) ||
      chunk.sequence_number < 0
    ) {
      throw new HttpError(400, "bad_sequence_number");
    }
    if (typeof chunk.block_hash !== "string" || chunk.block_hash.length === 0) {
      throw new HttpError(400, "missing_block_hash");
    }
    if (typeof chunk.ciphertext_b64 !== "string") {
      throw new HttpError(400, "missing_ciphertext_b64");
    }

    const ciphertext = decodeBase64(chunk.ciphertext_b64);

    if (ciphertext.byteLength > MAX_CHUNK_BYTES) {
      throw new HttpError(413, "chunk_too_large");
    }

    totalBytes += ciphertext.byteLength;
    decoded.push({
      sequence_number: chunk.sequence_number,
      block_hash: chunk.block_hash,
      ciphertext,
    });
  }

  // Credit debit — free for project tokens, billed for sov_live_ keys
  const isProjectToken = auth.authMode === "project_token";
  const costMilli = isProjectToken ? 0 : priceChunkMilli(totalBytes);

  if (!isProjectToken && costMilli > 0) {
    const { error: debitErr } = await supabase.rpc(
      "atomic_debit_credits_milli_v2",
      {
        p_wallet: auth.walletAddress,
        p_owed_milli: costMilli,
      }
    );
    if (debitErr) {
      if (String(debitErr.message ?? "").includes("insufficient")) {
        throw new HttpError(402, "insufficient_credits");
      }
      throw new HttpError(500, "debit_failed");
    }
  }

  // Build insert rows — store the agent_id as a deterministic UUID derived
  // from the auth context. For project tokens, use the apiKeyId (which is
  // the sov_proj_<uuid>); for API keys, use the walletAddress.
  const agentUuid = auth.authMode === "project_token"
    ? auth.apiKeyId.replace("sov_proj_", "")
    : auth.walletAddress;

  const rows = decoded.map((d) => ({
    agent_id: agentUuid,
    sequence_number: d.sequence_number,
    block_hash: d.block_hash,
    ciphertext: d.ciphertext,
    merkle_root: body.merkle_root,
  }));

  // Atomic insert — if a unique_violation on (agent_id, sequence_number)
  // is raised, fall back to per-chunk comparison: same block_hash = idempotent
  // retry; different block_hash = split-brain (REM-P5-001).
  const { error: insertErr } = await supabase
    .from("agent_replication_log")
    .insert(rows);

  if (insertErr) {
    const errMsg = String(insertErr.message ?? "");
    const errCode = String(insertErr.code ?? "");
    const refund = async () => {
      if (!isProjectToken && costMilli > 0) {
        await supabase.rpc("atomic_refund_credits_milli_v2", {
          p_wallet: auth.walletAddress,
          p_refund_milli: costMilli,
        });
      }
    };

    // Postgres unique_violation = 23505
    if (errCode === "23505" || errMsg.includes("unique") || errMsg.includes("duplicate")) {
      const sequenceNumbers = decoded.map((d) => d.sequence_number);
      const { data: existingRows, error: lookupErr } = await supabase
        .from("agent_replication_log")
        .select("sequence_number, block_hash")
        .eq("agent_id", agentUuid)
        .in("sequence_number", sequenceNumbers);

      if (lookupErr) {
        await refund();
        console.error("[v2-agent-state] split-brain lookup failed:", lookupErr);
        throw new HttpError(500, "conflict_lookup_failed");
      }

      const existingByseq = new Map<number, string>();
      for (const row of existingRows ?? []) {
        existingByseq.set(Number(row.sequence_number), String(row.block_hash));
      }

      const conflicts: Array<{
        sequence_number: number;
        existing_block_hash: string;
        attempted_block_hash: string;
      }> = [];
      for (const d of decoded) {
        const existing = existingByseq.get(d.sequence_number);
        if (existing !== undefined && existing !== d.block_hash) {
          conflicts.push({
            sequence_number: d.sequence_number,
            existing_block_hash: existing,
            attempted_block_hash: d.block_hash,
          });
        }
      }

      await refund();

      if (conflicts.length > 0) {
        console.error(
          `[v2-agent-state] split_brain: agent=${agentUuid} conflicts=${conflicts.length} seqs=${conflicts.map((c) => c.sequence_number).join(",")}`
        );
        return jsonResponse(409, {
          error: "split_brain_detected",
          conflicts,
        });
      }

      return jsonResponse(200, { idempotent: true });
    }

    // Non-duplicate error → refund and fail
    await refund();
    console.error("[v2-agent-state] replicate insert failed:", insertErr);
    throw new HttpError(500, "insert_failed");
  }

  // Compute max sequence_number from the accepted chunks
  const maxSeq = Math.max(...decoded.map((d) => d.sequence_number));

  console.log(
    `[v2-agent-state] replicate: agent=${agentUuid} chunks=${decoded.length} bytes=${totalBytes} maxSeq=${maxSeq}`
  );

  return jsonResponse(200, {
    accepted: decoded.length,
    sequence_number: maxSeq,
    merkle_root: body.merkle_root,
  });
}
