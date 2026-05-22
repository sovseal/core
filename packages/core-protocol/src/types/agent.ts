/**
 * Public types and runtime guards for the v2 Agent State Protocol.
 * Mirrors docs-internal/architecture/v2-agent-state-contract.md.
 */

export interface AgentPayload {
  agent_id: string;
  policy_hash: string;
  wallet_balances: Record<string, Record<string, string>>;
  active_context: Record<string, unknown>;
  parent_snapshot: string | null;
  sequence_number: number;
  timestamp: string;
  client_payload_hash: string;
}

export interface SnapshotEnvelope {
  agent_id: string;
  sequence_number: number;
  parent_snapshot: string | null;
  policy_hash: string;
  client_payload_hash: string;
  ciphertext_b64: string;
  byte_size: number;
  timestamp: string;
}

export interface SnapshotReceipt {
  snapshot_id: string;
  agent_id: string;
  sequence_number: number;
  arweave_tx_id: string;
  byte_size: number;
  cost_milli: number;
  client_payload_hash: string;
  status: "pending" | "confirmed" | "failed";
  confirmed_at: string | null;
}

export interface LineageEntry {
  sequence_number: number;
  arweave_tx_id: string;
  parent_tx_id: string | null;
  client_payload_hash: string;
  confirmed_at: string;
}

export const HEX_64 = /^[a-f0-9]{64}$/i;
export const MAX_PAYLOAD_BYTES = 262_144; // 256 KB hard cap on ciphertext

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * Pure-TS structural guard for AgentPayload (sans `client_payload_hash`,
 * which the caller must compute *after* validation).
 */
export function validateAgentPayloadDraft(
  value: unknown,
): ValidationResult {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null) {
    return { ok: false, errors: ["payload must be a non-null object"] };
  }
  const v = value as Record<string, unknown>;

  if (typeof v.agent_id !== "string" || v.agent_id.length === 0 || v.agent_id.length > 128) {
    errors.push("agent_id: must be a 1-128 char string");
  }
  if (typeof v.policy_hash !== "string" || !HEX_64.test(v.policy_hash)) {
    errors.push("policy_hash: must be a 64-char hex string");
  }
  if (typeof v.wallet_balances !== "object" || v.wallet_balances === null || Array.isArray(v.wallet_balances)) {
    errors.push("wallet_balances: must be an object");
  }
  if (typeof v.active_context !== "object" || v.active_context === null || Array.isArray(v.active_context)) {
    errors.push("active_context: must be an object");
  }
  if (!(v.parent_snapshot === null || typeof v.parent_snapshot === "string")) {
    errors.push("parent_snapshot: must be string or null");
  }
  if (
    typeof v.sequence_number !== "number" ||
    !Number.isInteger(v.sequence_number) ||
    v.sequence_number < 0
  ) {
    errors.push("sequence_number: must be a non-negative integer");
  }
  if (typeof v.timestamp !== "string" || !isRfc3339(v.timestamp)) {
    errors.push("timestamp: must be an RFC 3339 string");
  }

  // Genesis rule
  if (v.sequence_number === 0 && v.parent_snapshot !== null) {
    errors.push("genesis violation: sequence_number=0 requires parent_snapshot=null");
  }
  if (typeof v.sequence_number === "number" && v.sequence_number > 0 && v.parent_snapshot === null) {
    errors.push("non-genesis: sequence_number>0 requires non-null parent_snapshot");
  }

  return { ok: errors.length === 0, errors };
}

export function validateSnapshotEnvelope(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null) {
    return { ok: false, errors: ["envelope must be a non-null object"] };
  }
  const v = value as Record<string, unknown>;
  if (typeof v.agent_id !== "string") errors.push("agent_id: must be string");
  if (typeof v.sequence_number !== "number") errors.push("sequence_number: must be number");
  if (!(v.parent_snapshot === null || typeof v.parent_snapshot === "string")) {
    errors.push("parent_snapshot: string|null");
  }
  if (typeof v.policy_hash !== "string" || !HEX_64.test(v.policy_hash)) {
    errors.push("policy_hash: 64-char hex");
  }
  if (typeof v.client_payload_hash !== "string" || !HEX_64.test(v.client_payload_hash)) {
    errors.push("client_payload_hash: 64-char hex");
  }
  if (typeof v.ciphertext_b64 !== "string") errors.push("ciphertext_b64: must be string");
  if (typeof v.byte_size !== "number" || v.byte_size < 0 || v.byte_size > MAX_PAYLOAD_BYTES) {
    errors.push(`byte_size: 0..${MAX_PAYLOAD_BYTES}`);
  }
  if (typeof v.timestamp !== "string") errors.push("timestamp: must be string");
  return { ok: errors.length === 0, errors };
}

const RFC3339_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function isRfc3339(s: string): boolean {
  return RFC3339_RE.test(s);
}
