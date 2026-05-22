// v2-agent-state — JSON-shaped agent state protocol.
// Forbidden imports: utils/email*, utils/lark, outreach, pulse, phone-verify,
// release, guardian-claims, airlock. (Enforced via grep guard in CI.)

// @ts-expect-error — Deno-runtime npm: specifier
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAuth, HttpError } from "./handlers/auth.ts";
import { handleSnapshot, jsonResponse } from "./handlers/snapshot.ts";
import {
  handleRestoreLatest,
  handleRestoreAt,
  handleLineage,
} from "./handlers/restore.ts";
import { handleReplicate } from "./handlers/replicate.ts";
import { handleHead } from "./handlers/head.ts";
import { handleReplay } from "./handlers/replay.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function buildSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);

  // Routes:
  //   POST /v2/snapshot
  //   GET  /v2/snapshot/:agent_id/latest
  //   GET  /v2/snapshot/:agent_id/lineage
  //   GET  /v2/snapshot/:agent_id/:sequence
  //   POST /replicate     (NOMOREDELAY p3)
  //   GET  /head           (NOMOREDELAY p3)
  //   GET  /replay?since=N (NOMOREDELAY p3)
  //
  // Strip both the function-name prefix (cloud) and the /v2 prefix (sometimes
  // present locally and from older clients). Accept any combination.
  const PREFIXES = new Set(["v2-agent-state", "v2"]);
  let tail = segments;
  while (tail.length > 0 && PREFIXES.has(tail[0])) tail = tail.slice(1);

  try {
    const supabase = buildSupabase();
    const auth = await requireAuth(req, supabase);

    if (req.method === "POST" && tail[0] === "snapshot" && tail.length === 1) {
      return await handleSnapshot(req, supabase, auth);
    }
    if (req.method === "GET" && tail[0] === "snapshot" && tail.length === 3) {
      const agentId = decodeURIComponent(tail[1]);
      const last = tail[2];
      if (last === "latest") return await handleRestoreLatest(supabase, auth, agentId);
      if (last === "lineage") {
        const limit = Number(url.searchParams.get("limit") ?? "100");
        return await handleLineage(supabase, auth, agentId, limit);
      }
      const seq = Number(last);
      if (!Number.isFinite(seq)) throw new HttpError(400, "bad_path_sequence");
      return await handleRestoreAt(supabase, auth, agentId, seq);
    }

    // --- NOMOREDELAY p3: Differential replication log routes ---

    if (req.method === "POST" && tail[0] === "replicate" && tail.length === 1) {
      return await handleReplicate(req, supabase, auth);
    }
    if (req.method === "GET" && tail[0] === "head" && tail.length === 1) {
      return await handleHead(supabase, auth);
    }
    if (req.method === "GET" && tail[0] === "replay" && tail.length === 1) {
      return await handleReplay(url, supabase, auth);
    }

    return jsonResponse(404, { error: "route_not_found" });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse(err.status, { error: err.code });
    }
    console.error("[v2-agent-state] unhandled:", err);
    return jsonResponse(500, { error: "internal_error" });
  }
});
