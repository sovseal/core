/**
 * @inheribase/core-protocol
 *
 * Pure-TS crypto primitives, canonicalization, and agent state types
 * for the sovseal Deterministic State Continuity Protocol.
 */

export { CryptoService } from "./crypto/aes-gcm.js";
export type { EncryptedData, EncryptionMetadata } from "./crypto/aes-gcm.js";
export { canonicalize } from "./crypto/canonicalize.js";
export { encryptJson, decryptJson } from "./crypto/json.js";
export {
  MAX_PAYLOAD_BYTES,
  HEX_64,
  validateAgentPayloadDraft,
  validateSnapshotEnvelope,
} from "./types/agent.js";
export type {
  AgentPayload,
  SnapshotEnvelope,
  SnapshotReceipt,
  LineageEntry,
  ValidationResult,
} from "./types/agent.js";
