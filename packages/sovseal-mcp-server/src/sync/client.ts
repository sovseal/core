/**
 * client.ts — Thin HTTP client for the `/replicate` edge function.
 *
 * Wraps a single POST with exponential backoff (250 ms → 8 s, max 6 retries)
 * for transient failures (5xx, ECONNREFUSED, ETIMEDOUT). Special status codes:
 *   401 → auth failure; non-retryable; caller halts the worker.
 *   413 → over-cap; non-retryable; caller skips the offending block.
 *   200 with `idempotent: true` → treated as success (replay safe).
 */

const DEFAULT_MAX_ATTEMPTS = 6;
const INITIAL_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 8_000;

export interface ReplicateChunk {
  sequence_number: number;
  block_hash: string;
  ciphertext_b64: string;
}

export interface ReplicateRequest {
  chunks: ReplicateChunk[];
  merkle_root: string;
}

export interface ReplicateOk {
  outcome: "ok";
  status: 200;
  idempotent: boolean;
  accepted?: number;
  sequence_number?: number;
  merkle_root?: string;
}

export interface ReplicateAuthError {
  outcome: "auth_error";
  status: 401;
  detail: string;
}

export interface ReplicateOverCap {
  outcome: "over_cap";
  status: 413;
  detail: string;
}

export interface ReplicateSplitBrainConflict {
  sequence_number: number;
  existing_block_hash: string;
  attempted_block_hash: string;
}

export interface ReplicateSplitBrain {
  outcome: "split_brain";
  status: 409;
  detail: string;
  conflicts: ReplicateSplitBrainConflict[];
}

export interface ReplicateFailure {
  outcome: "failure";
  status: number | "network";
  detail: string;
  attempts: number;
}

export type ReplicateResult =
  | ReplicateOk
  | ReplicateAuthError
  | ReplicateOverCap
  | ReplicateSplitBrain
  | ReplicateFailure;

export interface ReplicateClientOptions {
  endpoint: string;
  apiKey: string;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
  /** Override for tests — defaults to {@link DEFAULT_MAX_ATTEMPTS}. */
  maxAttempts?: number;
  /** Override for tests — defaults to real `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
}

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientNetworkError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | undefined)?.code;
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ECONNRESET") {
    return true;
  }
  const msg = String((err as Error | undefined)?.message ?? "").toLowerCase();
  return (
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("fetch failed") ||
    msg.includes("network")
  );
}

function backoffDelay(attempt: number): number {
  const exp = Math.min(INITIAL_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  return exp;
}

export class ReplicateClient {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxAttempts: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(opts: ReplicateClientOptions) {
    this.endpoint = opts.endpoint.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.sleep = opts.sleep ?? realSleep;
  }

  async postReplicate(body: ReplicateRequest): Promise<ReplicateResult> {
    const url = `${this.endpoint}/replicate`;
    let attempts = 0;
    let lastDetail = "";
    let lastStatus: number | "network" = "network";

    while (attempts < this.maxAttempts) {
      attempts += 1;
      try {
        const res = await this.fetchImpl(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (res.status === 401) {
          const detail = await safeText(res);
          return { outcome: "auth_error", status: 401, detail };
        }
        if (res.status === 413) {
          const detail = await safeText(res);
          return { outcome: "over_cap", status: 413, detail };
        }
        if (res.status === 409) {
          const text = await safeText(res);
          let conflicts: ReplicateSplitBrainConflict[] = [];
          try {
            const parsed = JSON.parse(text) as {
              conflicts?: ReplicateSplitBrainConflict[];
            };
            if (Array.isArray(parsed.conflicts)) conflicts = parsed.conflicts;
          } catch {
            // detail kept as raw text below
          }
          return { outcome: "split_brain", status: 409, detail: text, conflicts };
        }
        if (res.status === 200) {
          const json = (await res.json().catch(() => ({}))) as Record<
            string,
            unknown
          >;
          return {
            outcome: "ok",
            status: 200,
            idempotent: json.idempotent === true,
            accepted: typeof json.accepted === "number" ? json.accepted : undefined,
            sequence_number:
              typeof json.sequence_number === "number"
                ? json.sequence_number
                : undefined,
            merkle_root:
              typeof json.merkle_root === "string" ? json.merkle_root : undefined,
          };
        }

        lastStatus = res.status;
        lastDetail = await safeText(res);
        if (res.status >= 500 && res.status <= 599) {
          if (attempts < this.maxAttempts) {
            await this.sleep(backoffDelay(attempts - 1));
            continue;
          }
        }
        return {
          outcome: "failure",
          status: res.status,
          detail: lastDetail,
          attempts,
        };
      } catch (err) {
        if (!isTransientNetworkError(err)) {
          return {
            outcome: "failure",
            status: "network",
            detail: String((err as Error).message ?? err),
            attempts,
          };
        }
        lastStatus = "network";
        lastDetail = String((err as Error).message ?? err);
        if (attempts < this.maxAttempts) {
          await this.sleep(backoffDelay(attempts - 1));
          continue;
        }
      }
    }

    return {
      outcome: "failure",
      status: lastStatus,
      detail: lastDetail || "exhausted_retries",
      attempts,
    };
  }

  async getHead(): Promise<{ sequence_number: number; merkle_root: string; updated_at: string } | null> {
    const url = `${this.endpoint}/head`;
    try {
      const res = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
        },
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`GET /head failed: ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error("[sovseal-client] getHead error:", err);
      throw err;
    }
  }

  async getReplay(since: number): Promise<{ chunks: ReplicateChunk[]; count: number }> {
    const url = `${this.endpoint}/replay?since=${since}`;
    try {
      const res = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
        },
      });
      if (!res.ok) {
        throw new Error(`GET /replay failed: ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error("[sovseal-client] getReplay error:", err);
      throw err;
    }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
