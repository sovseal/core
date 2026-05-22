/**
 * @sovseal/sdk
 *
 * HTTP client for the SovSeal agent state protocol.
 * Re-exports core-protocol primitives for consumer convenience.
 */

export { AgentStateClient } from "./client.js";
export type { AgentStateClientConfig, SnapshotInput } from "./client.js";

// Re-export core-protocol for consumers that don't want a direct dependency
export {
  CryptoService,
  canonicalize,
  encryptJson,
  decryptJson,
  MAX_PAYLOAD_BYTES,
  HEX_64,
  validateAgentPayloadDraft,
  validateSnapshotEnvelope,
} from "@inheribase/core-protocol";
export type {
  AgentPayload,
  SnapshotEnvelope,
  SnapshotReceipt,
  LineageEntry,
  EncryptedData,
  EncryptionMetadata,
  ValidationResult,
} from "@inheribase/core-protocol";
