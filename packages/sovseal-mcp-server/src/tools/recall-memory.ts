import { queryLocal } from "../local/index.js";
import {
  RecallMemoryArgsSchema,
  type RecallMemoryArgs,
  type ToolDefinition,
} from "../types.js";

export const recallMemoryTool: ToolDefinition<RecallMemoryArgs> = {
  name: "recall_memory",
  description:
    "CRITICAL: Semantic search over your long-term memory. You MUST use " +
    "this tool before starting a new task or answering complex questions " +
    "to check if the user has previously provided relevant preferences, " +
    "API keys, or architectural guidelines. " +
    "Each match is returned with a `[score=…]` prefix (smaller = closer match).",
  schema: RecallMemoryArgsSchema,
  handler: async (args) => {
    try {
      const hits = await queryLocal(args.query, args.topK);

      if (hits.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "no_matches: the local memory store returned 0 hits for this query.",
            },
          ],
        };
      }

      return {
        content: hits.map((hit) => ({
          type: "text" as const,
          text: `[score=${hit.score.toFixed(6)} id=${hit.id}] ${hit.text}`,
        })),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown_error";
      console.error(`[sovseal-mcp-server] recall_memory error: ${message}`);
      return {
        content: [{ type: "text", text: `recall_memory_failed: ${message}` }],
        isError: true,
      };
    }
  },
};
