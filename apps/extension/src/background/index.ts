/**
 * Service worker — the extension's nerve center.
 *
 * Responsibilities (mirrors OpenMemory's background.ts, minus the cloud):
 *   - own the Native Messaging port to the on-device engine (NativeBridge)
 *   - route typed Msg requests from content scripts + popup
 *   - cache recall results (5-min TTL) so repeated/typed queries stay cheap
 *   - right-click "Save selection to sovseal"
 *
 * Note: NO network. Everything terminates at the local host; replication (if
 * an API key is configured) happens inside the host, server-blind.
 */

import type { Msg, MsgResult, MemoryHit, MemoryRecord, HostStatus } from "../lib/messages";
import { NativeBridge } from "./native";

const bridge = new NativeBridge();

// ---- recall cache (TTL) --------------------------------------------------
const RECALL_TTL_MS = 5 * 60 * 1000;
interface CacheEntry {
  at: number;
  hits: MemoryHit[];
}
const recallCache = new Map<string, CacheEntry>();

function cacheKey(query: string, topK: number): string {
  return `${topK}:${query.trim().toLowerCase()}`;
}

function invalidateRecall(): void {
  recallCache.clear();
}

// ---- request handlers ----------------------------------------------------

async function handle(msg: Msg): Promise<MsgResult> {
  switch (msg.kind) {
    case "STORE": {
      const content = msg.content.trim();
      if (!content) return { ok: false, error: "nothing to store" };
      const res = await bridge.request("store", { content });
      if (!res.ok) return { ok: false, error: res.error ?? "store failed" };
      invalidateRecall(); // a new memory can change future recalls
      const { id } = res.data as { id: string };
      return { ok: true, kind: "STORE", id };
    }

    case "RECALL": {
      const query = msg.query.trim();
      if (!query) return { ok: true, kind: "RECALL", hits: [] };
      const topK = msg.topK ?? 5;
      const key = cacheKey(query, topK);
      const cached = recallCache.get(key);
      if (cached && Date.now() - cached.at < RECALL_TTL_MS) {
        return { ok: true, kind: "RECALL", hits: cached.hits };
      }
      const res = await bridge.request("recall", { query, topK });
      if (!res.ok) return { ok: false, error: res.error ?? "recall failed" };
      const { hits } = res.data as { hits: MemoryHit[] };
      recallCache.set(key, { at: Date.now(), hits });
      return { ok: true, kind: "RECALL", hits };
    }

    case "RECENT": {
      const res = await bridge.request("recent", { limit: msg.limit ?? 50 });
      if (!res.ok) return { ok: false, error: res.error ?? "recent failed" };
      const { memories } = res.data as { memories: MemoryRecord[] };
      return { ok: true, kind: "RECENT", memories };
    }

    case "DELETE": {
      const res = await bridge.request("delete", { memoryId: msg.memoryId });
      if (!res.ok) return { ok: false, error: res.error ?? "delete failed" };
      invalidateRecall();
      const { deleted } = res.data as { deleted: number };
      return { ok: true, kind: "DELETE", deleted };
    }

    case "STATUS": {
      const res = await bridge.request("status");
      if (!res.ok) {
        return { ok: false, error: res.error ?? "host unavailable", disconnected: true };
      }
      return { ok: true, kind: "STATUS", status: res.data as HostStatus };
    }
  }
}

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  handle(msg)
    .then(sendResponse)
    .catch((e: unknown) =>
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }),
    );
  return true; // keep the channel open for the async response
});

// ---- context menu --------------------------------------------------------

const MENU_ID = "sovseal-save-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Save selection to sovseal',
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID) return;
  const text = info.selectionText?.trim();
  if (!text) return;
  void handle({ kind: "STORE", content: text, source: "context-menu" });
});
