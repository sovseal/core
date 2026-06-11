/**
 * Per-platform composer selectors + metadata.
 *
 * DOM on these sites churns often, so every selector list is ordered
 * best→fallback and the content layer additionally falls back to the first
 * visible `textarea` / `[contenteditable]` on the page. Keeping the brittle
 * bits centralized here makes a selector break a one-line fix.
 */

import type { SiteId } from "./settings";

export interface SiteConfig {
  id: SiteId;
  label: string;
  /** Ordered candidate selectors for the prompt input. */
  composerSelectors: string[];
  /** Ordered candidate selectors for the send button (best-effort). */
  sendButtonSelectors: string[];
}

export const SITE_CONFIGS: Record<SiteId, SiteConfig> = {
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    composerSelectors: ["#prompt-textarea", "div[contenteditable='true']", "textarea"],
    sendButtonSelectors: ["button[data-testid='send-button']", "button[aria-label*='Send']"],
  },
  claude: {
    id: "claude",
    label: "Claude",
    composerSelectors: ["div.ProseMirror[contenteditable='true']", "div[contenteditable='true']"],
    sendButtonSelectors: ["button[aria-label='Send message']", "button[aria-label*='Send']"],
  },
  perplexity: {
    id: "perplexity",
    label: "Perplexity",
    composerSelectors: ["textarea[placeholder]", "div[contenteditable='true']", "textarea"],
    sendButtonSelectors: ["button[aria-label*='Submit']", "button[aria-label*='Send']"],
  },
  grok: {
    id: "grok",
    label: "Grok",
    composerSelectors: ["textarea", "div[contenteditable='true']"],
    sendButtonSelectors: ["button[aria-label*='Submit']", "button[type='submit']"],
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    composerSelectors: ["div.ql-editor[contenteditable='true']", "div[contenteditable='true']"],
    sendButtonSelectors: ["button[aria-label*='Send']", "button.send-button"],
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    composerSelectors: ["textarea#chat-input", "textarea", "div[contenteditable='true']"],
    sendButtonSelectors: ["div[role='button'][aria-disabled]", "button[type='submit']"],
  },
};
