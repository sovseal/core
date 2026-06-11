/**
 * Settings — persisted in chrome.storage.local.
 *
 * Capture posture (locked with product): auto-capture defaults ON, with a
 * global switch and per-site switches so the user is always in control. The
 * first-run notice states plainly that capture is local-only and what (if
 * anything) syncs.
 */

export type SiteId =
  | "chatgpt"
  | "claude"
  | "perplexity"
  | "grok"
  | "gemini"
  | "deepseek";

export interface Settings {
  /** Master switch for passive capture-on-send. */
  autoCapture: boolean;
  /** Per-site overrides; absent = enabled. */
  sites: Partial<Record<SiteId, boolean>>;
  /** Whether the user has seen the first-run privacy notice. */
  firstRunSeen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  autoCapture: true,
  sites: {},
  firstRunSeen: false,
};

const KEY = "sovseal:settings";

export async function getSettings(): Promise<Settings> {
  const raw = await chrome.storage.local.get(KEY);
  const stored = raw[KEY] as Partial<Settings> | undefined;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    sites: { ...DEFAULT_SETTINGS.sites, ...stored?.sites },
  };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

/** True when passive capture should run for `site` (global AND per-site on). */
export async function captureEnabled(site: SiteId): Promise<boolean> {
  const s = await getSettings();
  if (!s.autoCapture) return false;
  return s.sites[site] !== false;
}

export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area === "local" && changes[KEY]) {
      const newValue = changes[KEY].newValue as Partial<Settings> | undefined;
      cb({
        ...DEFAULT_SETTINGS,
        ...newValue,
        sites: { ...DEFAULT_SETTINGS.sites, ...newValue?.sites },
      });
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
