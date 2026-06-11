import { defineManifest } from "@crxjs/vite-plugin";

/**
 * sovseal extension manifest (MV3).
 *
 * NOTE: The `key` field is intentionally omitted — the Chrome Web Store rejects
 * any manifest containing the `key` field. For local dev with a stable extension
 * ID (required for native messaging), add the key manually to dist/manifest.json
 * AFTER building but BEFORE loading unpacked:
 *   "key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkCn1xybhPo0ktjlevD20nyGaQ/c4fFdiWKs7wPK5WKiZUuBZp+JpyNgJuEgrXwSCLvoE61f7M3D6TpkPSugqOJmfjgid8j98VWknHNU9wY8bAgX8kgDkr6jfOihqkhE32QAZ+wSTQ+Mdbsb6Bk09CnAbp3vU93I2Qawhb3+7GmpUiVKhbU2bbGUsb3xLNVtTP4QeF/Gi6IF5YUdlI203BgzQ2nBVI/UlCrcJkfiT78ZqUPrqgtsBxRTlpZrdXaVXSX5sWtlk5BQDBDPqZtk2hoHXuf/Ljk/o/6e47E2N5W3nxRCwHuWfmOoCY/eUl4tOrPSO8V8BxNlS6r3bhG051wIDAQAB"
 * The CWS-assigned extension ID must be added to
 * packages/sovseal-mcp-server/native-host/constants.mjs after first publish.
 *
 * Capture posture: auto-capture is ON by default (see lib/settings.ts) with a
 * global + per-site off switch — honest, user-controlled, and unlike
 * OpenMemory nothing leaves the device in plaintext.
 */

// Per-platform URL patterns — reused for both host_permissions and the
// individual content_scripts below.
const SITES: Record<string, string[]> = {
  chatgpt: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
  claude: ["https://claude.ai/*"],
  perplexity: ["https://www.perplexity.ai/*", "https://perplexity.ai/*"],
  grok: ["https://grok.com/*"],
  gemini: ["https://gemini.google.com/*"],
  deepseek: ["https://chat.deepseek.com/*"],
};

const ALL_SITE_MATCHES: string[] = Object.values(SITES).flat();

export default defineManifest({
  manifest_version: 3,
  name: "sovseal — local memory for AI",
  version: "0.1.0",
  description:
    "Truly local, zero-knowledge memory across ChatGPT, Claude, Perplexity, Grok, Gemini and DeepSeek. On-device. Encrypted. Yours.",
  icons: {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png",
  },
  action: {
    default_popup: "src/popup/index.html",
    default_title: "sovseal memory",
    default_icon: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
    },
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  permissions: [
    "storage",
    "activeTab",
    "contextMenus",
    "scripting",
    "webNavigation",
    "nativeMessaging",
  ],
  host_permissions: ALL_SITE_MATCHES,
  content_scripts: [
    { matches: SITES.chatgpt, js: ["src/sites/chatgpt.ts"], run_at: "document_idle" },
    { matches: SITES.claude, js: ["src/sites/claude.ts"], run_at: "document_idle" },
    { matches: SITES.perplexity, js: ["src/sites/perplexity.ts"], run_at: "document_idle" },
    { matches: SITES.grok, js: ["src/sites/grok.ts"], run_at: "document_idle" },
    { matches: SITES.gemini, js: ["src/sites/gemini.ts"], run_at: "document_idle" },
    { matches: SITES.deepseek, js: ["src/sites/deepseek.ts"], run_at: "document_idle" },
  ],
  web_accessible_resources: [
    {
      resources: ["icons/*"],
      matches: ALL_SITE_MATCHES,
    },
  ],
});
