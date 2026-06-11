/**
 * Injected UI + capture/recall wiring, shared by every per-site content script.
 *
 * Design choices for reliability:
 *  - All listeners are document-level *capture-phase* delegations, so they
 *    survive the aggressive SPA re-renders these chat apps do (no rebinding
 *    when the composer node is swapped out).
 *  - Capture happens at send-time (Enter / Cmd+M / button) by reading the
 *    composer's current text — we never scrape the rendered transcript, which
 *    is far more brittle.
 *  - Recall is surfaced as suggestions the user explicitly inserts; we never
 *    silently rewrite-and-send the prompt.
 *  - Everything lives in a Shadow DOM so styles don't collide with the host.
 */

import { sendToWorker } from "../lib/messages";
import type { MemoryHit, MemoryRecord } from "../lib/messages";
import { formatMemoryPreamble } from "../lib/prompts";
import {
  captureEnabled,
  getSettings,
  setSettings,
  onSettingsChanged,
  type SiteId,
} from "../lib/settings";
import type { SiteConfig } from "../lib/site-config";
import {
  findComposer,
  prependComposer,
  readComposer,
} from "../lib/dom";
import { SHADOW_CSS } from "./styles";

const MOUNT_FLAG = "__sovsealMounted";
const RECALL_DEBOUNCE_MS = 400;
const RECALL_MIN_CHARS = 6;

const LOGO_SVG = `<svg viewBox="3 3 351 245" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:24px;height:24px;"><path d="M151.615 16.548 C 174.979 20.622,200.000 33.253,200.000 40.974 C 200.000 47.495,193.144 50.261,187.664 45.950 C 183.266 42.491,166.641 35.086,158.354 32.896 C 148.408 30.267,129.820 29.306,120.411 30.935 C 98.704 34.693,82.650 45.471,75.054 61.387 C 71.160 69.546,70.051 74.763,70.036 85.000 C 70.017 97.942,73.453 108.312,81.446 119.433 C 83.844 122.770,97.306 136.949,111.362 150.943 C 125.417 164.936,137.406 177.566,138.004 179.009 C 140.836 185.847,134.863 189.899,114.286 195.096 C 92.159 200.684,69.031 200.092,49.084 193.425 C 43.355 191.511,38.260 190.080,37.763 190.246 C 36.595 190.635,41.376 196.595,46.500 201.137 C 61.624 214.544,84.097 220.667,114.500 219.665 C 138.876 218.861,154.606 213.972,164.874 204.006 C 174.674 194.496,176.412 179.648,169.207 167.000 C 167.759 164.458,151.321 147.055,131.425 127.000 C 98.050 93.359,96.122 91.216,94.603 86.068 C 90.936 73.641,93.312 63.543,101.936 54.910 C 108.997 47.841,115.154 45.528,125.026 46.234 C 135.805 47.005,138.639 48.969,160.064 70.513 C 170.723 81.231,179.856 90.000,180.361 90.000 C 180.865 90.000,184.703 86.732,188.889 82.737 C 227.524 45.869,264.117 32.930,297.206 44.437 C 323.885 53.715,342.244 77.824,343.759 105.571 C 345.786 142.711,318.233 174.936,281.383 178.523 C 267.494 179.875,250.711 175.561,238.611 167.530 C 235.259 165.305,211.974 142.842,183.166 114.043 C 155.850 86.735,132.375 63.700,131.000 62.854 C 122.420 57.576,110.591 62.378,107.942 72.215 C 105.631 80.798,105.917 81.172,144.914 120.496 C 176.876 152.726,180.902 157.146,183.328 162.666 C 194.446 187.972,185.019 212.956,159.802 225.011 C 128.684 239.887,77.404 237.565,47.324 219.917 C 38.271 214.606,25.074 200.874,21.064 192.592 C 11.573 172.991,11.662 150.486,21.309 131.082 C 25.235 123.185,28.818 120.198,32.717 121.569 C 34.214 122.096,36.115 123.732,36.942 125.206 C 38.327 127.674,38.260 128.302,36.079 133.192 C 28.630 149.903,27.825 155.862,31.939 163.842 C 36.301 172.304,48.462 179.412,63.944 182.549 C 79.564 185.714,115.218 182.875,116.720 178.347 C 116.930 177.713,107.006 167.138,94.667 154.847 C 71.016 131.288,65.712 124.565,60.573 111.635 C 50.309 85.810,54.819 58.706,72.667 38.946 C 89.151 20.696,121.985 11.381,151.615 16.548 M261.507 56.135 C 238.946 61.415,222.105 71.263,201.250 91.374 C 196.162 96.280,192.000 100.823,192.000 101.470 C 192.000 102.116,203.813 114.356,218.250 128.669 C 242.244 152.457,245.145 155.003,252.000 158.291 C 260.927 162.572,266.380 163.943,274.614 163.976 C 289.404 164.035,302.601 158.588,313.115 148.084 C 323.835 137.376,329.000 124.993,329.000 110.000 C 329.000 84.587,312.207 62.977,287.448 56.528 C 281.037 54.859,267.819 54.658,261.507 56.135" fill="#0B1215" fill-rule="evenodd"/></svg>`;

function isEditable(t: EventTarget | null): t is HTMLElement {
  return (
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLInputElement ||
    (t instanceof HTMLElement && t.isContentEditable)
  );
}

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function mountSovseal(config: SiteConfig): void {
  const w = window as unknown as Record<string, boolean>;
  if (w[MOUNT_FLAG]) return;
  w[MOUNT_FLAG] = true;

  const host = document.createElement("div");
  host.id = "sovseal-host";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = SHADOW_CSS;
  shadow.appendChild(style);

  const root = document.createElement("div");
  root.className = "sov-root";
  root.innerHTML = `
    <div class="sov-launcher" title="sovseal memory">
      ${LOGO_SVG}
      <span class="sov-dot" data-ref="dot"></span>
    </div>
    <div class="sov-panel" data-ref="panel">
      <div class="sov-head">
        <span class="sov-title">sovseal</span>
        <span class="sov-status"><span class="sov-statusdot" data-ref="sdot"></span><span data-ref="stext">checking…</span></span>
      </div>
      <div class="sov-tabs">
        <div class="sov-tab active" data-tab="matches">Matches</div>
        <div class="sov-tab" data-tab="recent">Recent</div>
      </div>
      <div class="sov-body" data-ref="body"></div>
      <div class="sov-foot">
        <span data-ref="foottext">local · zero-knowledge</span>
        <span class="sov-toggle" data-ref="toggle" title="Auto-capture on this site">
          <span>auto-capture</span>
          <span class="sov-switch" data-ref="switch"><span class="sov-knob"></span></span>
        </span>
      </div>
    </div>
    <div class="sov-toast" data-ref="toast"></div>`;
  shadow.appendChild(root);
  document.body.appendChild(host);

  const ref = <T extends HTMLElement = HTMLElement>(name: string): T =>
    root.querySelector(`[data-ref="${name}"]`) as T;
  const launcher = root.querySelector(".sov-launcher") as HTMLElement;
  const panel = ref("panel");
  const body = ref("body");
  const dot = ref("dot");
  const sdot = ref("sdot");
  const stext = ref("stext");
  const toastEl = ref("toast");
  const switchEl = ref("switch");
  const toggleWrap = ref("toggle");

  let activeTab: "matches" | "recent" = "matches";
  let lastHits: MemoryHit[] = [];

  // ---- toast ----
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function toast(msg: string): void {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  // ---- status ----
  function paintStatus(connected: boolean, label: string): void {
    dot.className = `sov-dot ${connected ? "on" : "off"}`;
    sdot.className = `sov-statusdot ${connected ? "on" : "off"}`;
    stext.textContent = label;
  }

  async function refreshStatus(): Promise<void> {
    const res = await sendToWorker({ kind: "STATUS" });
    if (res.ok && res.kind === "STATUS") {
      paintStatus(true, `${res.status.count} memories`);
    } else {
      paintStatus(false, "host not connected");
    }
  }

  // ---- settings toggle ----
  async function paintToggle(): Promise<void> {
    const s = await getSettings();
    const on = s.autoCapture && s.sites[config.id] !== false;
    switchEl.classList.toggle("on", on);
  }
  toggleWrap.addEventListener("click", async () => {
    const s = await getSettings();
    const currentlyOn = s.autoCapture && s.sites[config.id] !== false;
    await setSettings({ sites: { ...s.sites, [config.id]: !currentlyOn } });
    toast(currentlyOn ? "Auto-capture off for this site" : "Auto-capture on");
  });
  onSettingsChanged(() => void paintToggle());

  // ---- capture ----
  async function capture(text: string, source: string): Promise<void> {
    const content = text.trim();
    if (content.length < 2) return;
    const res = await sendToWorker({ kind: "STORE", content, source });
    if (res.ok) {
      toast("Saved to sovseal");
      if (activeTab === "recent") void renderRecent();
      void refreshStatus();
    } else {
      toast(res.error.includes("host") ? "Host not connected" : "Save failed");
    }
  }

  // ---- recall (live) ----
  function renderMatches(): void {
    if (activeTab !== "matches") return;
    if (!lastHits.length) {
      body.innerHTML = `<div class="sov-empty">Start typing in the prompt box —<br/>matching memories appear here.</div>`;
      return;
    }
    body.innerHTML = "";
    for (const hit of lastHits) {
      const item = document.createElement("div");
      item.className = "sov-item";
      const text = document.createElement("div");
      text.className = "sov-text";
      text.textContent = hit.text;
      const rowEl = document.createElement("div");
      rowEl.className = "sov-row";
      const insert = document.createElement("button");
      insert.className = "sov-btn primary";
      insert.textContent = "Insert";
      insert.addEventListener("click", () => {
        const composer = findComposer(config.composerSelectors);
        if (!composer) {
          toast("Couldn't find the prompt box");
          return;
        }
        prependComposer(composer, formatMemoryPreamble([hit]));
        toast("Inserted into prompt");
      });
      rowEl.appendChild(insert);
      item.appendChild(text);
      item.appendChild(rowEl);
      body.appendChild(item);
    }
  }

  let recallTimer: ReturnType<typeof setTimeout> | undefined;
  function scheduleRecall(query: string): void {
    clearTimeout(recallTimer);
    if (query.trim().length < RECALL_MIN_CHARS) {
      lastHits = [];
      renderMatches();
      return;
    }
    recallTimer = setTimeout(async () => {
      const res = await sendToWorker({ kind: "RECALL", query, topK: 5 });
      if (res.ok && res.kind === "RECALL") {
        lastHits = res.hits;
        renderMatches();
      }
    }, RECALL_DEBOUNCE_MS);
  }

  // ---- recent + delete ----
  async function renderRecent(): Promise<void> {
    if (activeTab !== "recent") return;
    body.innerHTML = `<div class="sov-empty">Loading…</div>`;
    const res = await sendToWorker({ kind: "RECENT", limit: 50 });
    if (!res.ok || res.kind !== "RECENT") {
      body.innerHTML = `<div class="sov-empty">Host not connected.<br/>Run the sovseal installer, then reload.</div>`;
      return;
    }
    const memories: MemoryRecord[] = res.memories;
    if (!memories.length) {
      body.innerHTML = `<div class="sov-empty">No memories yet.</div>`;
      return;
    }
    body.innerHTML = "";
    for (const mem of memories) {
      const item = document.createElement("div");
      item.className = "sov-item";
      const text = document.createElement("div");
      text.className = "sov-text";
      text.textContent = mem.text;
      const rowEl = document.createElement("div");
      rowEl.className = "sov-row";
      const meta = document.createElement("span");
      meta.className = "sov-meta";
      meta.textContent = timeAgo(mem.timestamp);
      const del = document.createElement("button");
      del.className = "sov-btn danger icon";
      del.textContent = "Delete";
      del.addEventListener("click", async () => {
        const r = await sendToWorker({ kind: "DELETE", memoryId: mem.id });
        if (r.ok) {
          item.remove();
          toast("Deleted");
          void refreshStatus();
        } else {
          toast("Delete failed");
        }
      });
      rowEl.appendChild(meta);
      rowEl.appendChild(del);
      item.appendChild(text);
      item.appendChild(rowEl);
      body.appendChild(item);
    }
  }

  // ---- first-run notice ----
  async function maybeFirstRun(): Promise<void> {
    const s = await getSettings();
    if (s.firstRunSeen) return;
    const notice = document.createElement("div");
    notice.className = "sov-notice";
    notice.innerHTML = `<b>Everything stays on your device.</b> sovseal captures prompts you send and stores them in an encrypted, on-device memory. Nothing is sent anywhere in plaintext. You can turn auto-capture off any time below.`;
    const ok = document.createElement("button");
    ok.className = "sov-btn primary";
    ok.textContent = "Got it";
    ok.style.marginTop = "8px";
    ok.addEventListener("click", async () => {
      await setSettings({ firstRunSeen: true });
      notice.remove();
    });
    notice.appendChild(ok);
    body.prepend(notice);
  }

  // ---- tabs ----
  for (const tab of Array.from(root.querySelectorAll<HTMLElement>(".sov-tab"))) {
    tab.addEventListener("click", () => {
      for (const t of Array.from(root.querySelectorAll(".sov-tab")))
        t.classList.remove("active");
      tab.classList.add("active");
      activeTab = (tab.dataset.tab as "matches" | "recent") ?? "matches";
      if (activeTab === "matches") renderMatches();
      else void renderRecent();
    });
  }

  // ---- panel open/close ----
  function togglePanel(): void {
    const open = panel.classList.toggle("open");
    if (open) {
      void refreshStatus();
      void paintToggle();
      void maybeFirstRun();
      if (activeTab === "matches") renderMatches();
      else void renderRecent();
    }
  }
  launcher.addEventListener("click", togglePanel);

  // ---- delegated composer events (survive SPA re-renders) ----
  document.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      // Cmd/Ctrl+M → manual capture
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "m") {
        const composer = findComposer(config.composerSelectors);
        if (composer) {
          e.preventDefault();
          void capture(readComposer(composer), "hotkey");
        }
        return;
      }
      // Enter (no shift) → auto-capture the sent prompt
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && isEditable(e.target)) {
        const text = readComposer(e.target);
        void captureEnabled(config.id as SiteId).then((on) => {
          if (on) void capture(text, "auto");
        });
      }
    },
    true,
  );

  document.addEventListener(
    "input",
    (e: Event) => {
      if (!isEditable(e.target)) return;
      if (!panel.classList.contains("open")) return;
      scheduleRecall(readComposer(e.target));
    },
    true,
  );

  void refreshStatus();
  void paintToggle();
}
