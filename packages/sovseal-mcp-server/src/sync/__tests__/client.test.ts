/**
 * client.test.ts — Phase 4 of NOMOREDELAY. Covers the ReplicateClient
 * status code mapping and exponential backoff against a fake fetch.
 */

import { describe, expect, test } from "vitest";

import { ReplicateClient } from "../client.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeBody() {
  return {
    chunks: [
      { sequence_number: 0, block_hash: "abc", ciphertext_b64: "AAAA" },
    ],
    merkle_root: "deadbeef",
  };
}

describe("ReplicateClient", () => {
  test("200 → outcome=ok, idempotent flag mirrored", async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse(200, { accepted: 1, sequence_number: 0, merkle_root: "deadbeef" });
    const client = new ReplicateClient({
      endpoint: "http://x.test/v2",
      apiKey: "sov_proj_00000000-0000-4000-8000-000000000010",
      fetchImpl,
      sleep: async () => undefined,
    });
    const res = await client.postReplicate(makeBody());
    expect(res.outcome).toBe("ok");
    if (res.outcome === "ok") {
      expect(res.idempotent).toBe(false);
      expect(res.accepted).toBe(1);
    }
  });

  test("200 with idempotent:true is success", async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse(200, { idempotent: true });
    const client = new ReplicateClient({
      endpoint: "http://x.test/v2",
      apiKey: "sov_proj_00000000-0000-4000-8000-000000000011",
      fetchImpl,
      sleep: async () => undefined,
    });
    const res = await client.postReplicate(makeBody());
    expect(res.outcome).toBe("ok");
    if (res.outcome === "ok") expect(res.idempotent).toBe(true);
  });

  test("401 → outcome=auth_error, not retried", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return jsonResponse(401, { error: "invalid_api_key" });
    };
    const client = new ReplicateClient({
      endpoint: "http://x.test/v2",
      apiKey: "sov_live_bad",
      fetchImpl,
      sleep: async () => undefined,
    });
    const res = await client.postReplicate(makeBody());
    expect(res.outcome).toBe("auth_error");
    expect(calls).toBe(1);
  });

  test("413 → outcome=over_cap, not retried", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return jsonResponse(413, { error: "chunk_too_large" });
    };
    const client = new ReplicateClient({
      endpoint: "http://x.test/v2",
      apiKey: "sov_proj_00000000-0000-4000-8000-000000000012",
      fetchImpl,
      sleep: async () => undefined,
    });
    const res = await client.postReplicate(makeBody());
    expect(res.outcome).toBe("over_cap");
    expect(calls).toBe(1);
  });

  test("5xx retries up to maxAttempts and reports failure", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return jsonResponse(503, { error: "transient" });
    };
    const client = new ReplicateClient({
      endpoint: "http://x.test/v2",
      apiKey: "sov_proj_00000000-0000-4000-8000-000000000013",
      fetchImpl,
      maxAttempts: 3,
      sleep: async () => undefined,
    });
    const res = await client.postReplicate(makeBody());
    expect(res.outcome).toBe("failure");
    expect(calls).toBe(3);
    if (res.outcome === "failure") expect(res.attempts).toBe(3);
  });

  test("409 → outcome=split_brain, conflicts parsed, not retried (REM-P5-001)", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return jsonResponse(409, {
        error: "split_brain_detected",
        conflicts: [
          {
            sequence_number: 42,
            existing_block_hash: "aaaa",
            attempted_block_hash: "bbbb",
          },
        ],
      });
    };
    const client = new ReplicateClient({
      endpoint: "http://x.test/v2",
      apiKey: "sov_proj_00000000-0000-4000-8000-000000000015",
      fetchImpl,
      sleep: async () => undefined,
    });
    const res = await client.postReplicate(makeBody());
    expect(res.outcome).toBe("split_brain");
    expect(calls).toBe(1);
    if (res.outcome === "split_brain") {
      expect(res.conflicts).toHaveLength(1);
      expect(res.conflicts[0].sequence_number).toBe(42);
      expect(res.conflicts[0].existing_block_hash).toBe("aaaa");
      expect(res.conflicts[0].attempted_block_hash).toBe("bbbb");
    }
  });

  test("transient network error retries then succeeds on third attempt", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      if (calls < 3) {
        const err = new Error("fetch failed: ECONNREFUSED");
        (err as NodeJS.ErrnoException).code = "ECONNREFUSED";
        throw err;
      }
      return jsonResponse(200, { idempotent: false });
    };
    const client = new ReplicateClient({
      endpoint: "http://x.test/v2",
      apiKey: "sov_proj_00000000-0000-4000-8000-000000000014",
      fetchImpl,
      maxAttempts: 6,
      sleep: async () => undefined,
    });
    const res = await client.postReplicate(makeBody());
    expect(res.outcome).toBe("ok");
    expect(calls).toBe(3);
  });
});
