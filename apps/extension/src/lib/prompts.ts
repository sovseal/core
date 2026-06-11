/**
 * Format recalled memories into a compact preamble that gets prepended to the
 * user's prompt when they click "Insert". Kept short and clearly delimited so
 * the model treats it as grounding context, not instructions.
 */

import type { MemoryHit } from "./messages";

export function formatMemoryPreamble(hits: MemoryHit[]): string {
  const lines = hits.map((h) => `- ${h.text.replace(/\s+/g, " ").trim()}`);
  return [
    "Relevant context from my sovseal memory:",
    ...lines,
    "(Use what's relevant; ignore the rest.)",
  ].join("\n");
}
