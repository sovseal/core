/**
 * AgentStateClient — the only surface a worker imports.
 *
 *   const client = new AgentStateClient({ endpoint, apiKey });
 *   const receipt = await client.snapshot({ agentId, key, payload });
 *   const blob = await client.restore({ agentId });
 */

import {
  CryptoService,
  encryptJson,
  canonicalize,
  MAX_PAYLOAD_BYTES,
  type AgentPayload,
  type SnapshotEnvelope,
  type SnapshotReceipt,
  type LineageEntry,
} from "@inheribase/core-protocol";

export interface AgentStateClientConfig {
  endpoint: string; // e.g. "https://<project>.functions.supabase.co/v2-agent-state"
  apiKey: string; // sov_live_…
  fetch?: typeof fetch; // override for tests / Workers
}

export interface SnapshotInput {
  payload: Omit<AgentPayload, "client_payload_hash">;
  key: CryptoKey;
}

export class AgentStateClient {
  constructor(private readonly cfg: AgentStateClientConfig) {}

  /**
   * Encrypt an AgentPayload client-side and POST the envelope to the protocol.
   * Computes `client_payload_hash` over the canonical form sans the hash field.
   */
  async snapshot(input: SnapshotInput): Promise<SnapshotReceipt> {
    const draft = input.payload;
    const canonicalDraft = canonicalize(draft);
    const clientPayloadHash = await CryptoService.sha256Hex(
      new TextEncoder().encode(canonicalDraft),
    );

    const fullPayload: AgentPayload = {
      ...draft,
      client_payload_hash: clientPayloadHash,
    };

    const ciphertext = await encryptJson(fullPayload, input.key);
    if (ciphertext.byteLength > MAX_PAYLOAD_BYTES) {
      throw new RangeError(
        `ciphertext ${ciphertext.byteLength} bytes exceeds MAX_PAYLOAD_BYTES (${MAX_PAYLOAD_BYTES})`,
      );
    }

    const envelope: SnapshotEnvelope = {
      agent_id: draft.agent_id,
      sequence_number: draft.sequence_number,
      parent_snapshot: draft.parent_snapshot,
      policy_hash: draft.policy_hash,
      client_payload_hash: clientPayloadHash,
      ciphertext_b64: bytesToBase64(ciphertext),
      byte_size: ciphertext.byteLength,
      timestamp: draft.timestamp,
    };

    const res = await this.request("POST", "/v2/snapshot", envelope);
    return res as SnapshotReceipt;
  }

  /** Latest confirmed snapshot for an agent. */
  async restore(args: { agentId: string }): Promise<{ receipt: SnapshotReceipt; ciphertextUrl: string }> {
    const r = await this.request(
      "GET",
      `/v2/snapshot/${encodeURIComponent(args.agentId)}/latest`,
    );
    return r as { receipt: SnapshotReceipt; ciphertextUrl: string };
  }

  /** Snapshot at a specific sequence number for crash-replay. */
  async restoreAt(args: { agentId: string; sequence: number }): Promise<{ receipt: SnapshotReceipt; ciphertextUrl: string }> {
    const r = await this.request(
      "GET",
      `/v2/snapshot/${encodeURIComponent(args.agentId)}/${args.sequence}`,
    );
    return r as { receipt: SnapshotReceipt; ciphertextUrl: string };
  }

  /** Walk the parent_snapshot chain backwards. */
  async lineage(args: { agentId: string; limit?: number }): Promise<LineageEntry[]> {
    const r = await this.request(
      "GET",
      `/v2/snapshot/${encodeURIComponent(args.agentId)}/lineage?limit=${args.limit ?? 100}`,
    );
    return r as LineageEntry[];
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const url = this.cfg.endpoint.replace(/\/$/, "") + path;
    const fetchImpl = this.cfg.fetch ?? fetch;
    const res = await fetchImpl(url, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`v2-agent-state ${res.status}: ${text || res.statusText}`);
    }
    return await res.json();
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  // btoa is universal (Node 16+, Deno, Bun, Workers).
  return btoa(s);
}
