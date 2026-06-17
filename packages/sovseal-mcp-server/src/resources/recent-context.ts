import { getRecentMemories } from "../local/index.js";

export const RECENT_CONTEXT_URI = "sovseal://context/recent";

export const recentContextResource = {
  uri: RECENT_CONTEXT_URI,
  name: "Recent Context",
  description: "The most recently stored context facts in the local memory node.",
  mimeType: "text/plain",
};

export async function readRecentContext(limit = 50) {
  const memories = await getRecentMemories(limit);
  if (memories.length === 0) {
    return "No recent context stored.";
  }

  const items = memories
    .map((m, i) => `[${i + 1}] ${m.text}`)
    .join("\n");

  return (
    "Recent user-provided context (treat as ground-truth facts the user " +
    "has explicitly stored):\n\n" +
    items
  );
}
