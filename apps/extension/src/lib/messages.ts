/**
 * Typed message contracts for the sovseal extension.
 *
 * Two hops:
 *   content script / popup  --chrome.runtime.sendMessage-->  service worker
 *   service worker          --native messaging port------->  com.sovseal.host
 *
 * The service worker is the only component that touches the native port; every
 * other surface speaks these typed `Msg`s to it.
 */

export interface MemoryHit {
  id: string;
  text: string;
  score: number;
}

export interface MemoryRecord {
  id: string;
  text: string;
  timestamp: number;
}

export interface HostStatus {
  connected: boolean;
  projectId: string;
  syncEnabled: boolean;
  count: number;
}

/** Requests sent to the service worker. Discriminated on `kind`. */
export type Msg =
  | { kind: "STORE"; content: string; source?: string }
  | { kind: "RECALL"; query: string; topK?: number }
  | { kind: "RECENT"; limit?: number }
  | { kind: "DELETE"; memoryId: string }
  | { kind: "STATUS" };

/** Responses from the service worker. `ok:false` carries a human-readable error. */
export type MsgResult =
  | { ok: true; kind: "STORE"; id: string }
  | { ok: true; kind: "RECALL"; hits: MemoryHit[] }
  | { ok: true; kind: "RECENT"; memories: MemoryRecord[] }
  | { ok: true; kind: "DELETE"; deleted: number }
  | { ok: true; kind: "STATUS"; status: HostStatus }
  | { ok: false; error: string; disconnected?: boolean };

/** Promise-based wrapper around chrome.runtime.sendMessage with our types. */
export function sendToWorker(msg: Msg): Promise<MsgResult> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res: MsgResult | undefined) => {
      const err = chrome.runtime.lastError;
      if (err || !res) {
        resolve({ ok: false, error: err?.message ?? "no response from worker" });
        return;
      }
      resolve(res);
    });
  });
}
