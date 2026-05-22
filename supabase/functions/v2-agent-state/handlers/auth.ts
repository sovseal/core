// API-key middleware. Forks the hash logic from supabase/functions/main/agents.ts:23-31.
//
// Two accepted Bearer formats:
//   1. sov_live_<base62>     — DB-backed API key (production wallets, billed)
//   2. sov_proj_<uuid v4>    — self-asserting local-identity token (MVP frictionless mode)
//
// Self-asserting tokens carry no DB lookup: the project_id IS the credential.
// Knowing the token grants read+write to that project's snapshot lineage.
// CEO-accepted risk per SOVSEAL-MCP-WIRING (2026-05-10).

export interface AuthContext {
  apiKeyId: string;
  walletAddress: string;
  creditsCents: number;
  creditsMilli: number;
  /** Distinguishes DB-backed keys from self-asserting project tokens. */
  authMode: "api_key" | "project_token";
}

const SOV_LIVE_RE = /^Bearer\s+(sov_live_[A-Za-z0-9]+)$/;
const SOV_PROJ_RE =
  /^Bearer\s+(sov_proj_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function requireAuth(
  req: Request,
  supabase: any
): Promise<AuthContext> {
  const header = req.headers.get("authorization") ?? "";

  const projMatch = header.match(SOV_PROJ_RE);
  if (projMatch) {
    return {
      apiKeyId: projMatch[1],
      walletAddress: projMatch[1],
      creditsCents: Number.MAX_SAFE_INTEGER,
      creditsMilli: Number.MAX_SAFE_INTEGER,
      authMode: "project_token",
    };
  }

  const liveMatch = header.match(SOV_LIVE_RE);
  if (!liveMatch) {
    throw new HttpError(401, "missing_or_invalid_bearer_token");
  }
  const rawKey = liveMatch[1];
  const keyHash = await sha256Hex(rawKey);

  const { data: keyRow, error: keyErr } = await supabase
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (keyErr) throw new HttpError(500, "auth_lookup_failed");
  if (!keyRow) throw new HttpError(401, "invalid_api_key");
  if (keyRow.revoked_at) throw new HttpError(401, "api_key_revoked");

  const walletAddress: string = keyRow.user_id;
  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("credits, credits_milli")
    .ilike("wallet_address", walletAddress)
    .maybeSingle();
  if (userErr) throw new HttpError(500, "auth_user_lookup_failed");
  if (!userRow) throw new HttpError(401, "owner_not_found");

  return {
    apiKeyId: keyRow.id,
    walletAddress,
    creditsCents: userRow.credits ?? 0,
    creditsMilli: userRow.credits_milli ?? 0,
    authMode: "api_key",
  };
}

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(`${status} ${code}`);
  }
}
