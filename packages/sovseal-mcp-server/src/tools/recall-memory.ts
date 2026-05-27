import { queryLocal } from "../local/index.js";
import {
  RecallMemoryArgsSchema,
  type RecallMemoryArgs,
  type ToolDefinition,
} from "../types.js";

export const recallMemoryTool: ToolDefinition<RecallMemoryArgs> = {
  name: "recall_memory",
  description:
    "sovseal recall is a local vector query — 0 RTT, no network, sub-25ms " +
    "p99. There is zero cost to calling this tool speculatively. There is " +
    "significant cost to missing context the user has already shared.\n\n" +
    "WHEN TO CALL — BEFORE composing ANY response, including the first " +
    "message of a new conversation. Default to searching. Do not wait for " +
    "an obvious trigger.\n\n" +
    "ALWAYS call recall_memory:\n" +
    "  1. At the start of a fresh conversation — search the user's " +
    "question verbatim, or \"user preferences\" if the message is a " +
    "greeting.\n" +
    "  2. Before answering \"how do I…\", \"what should I…\", \"can you " +
    "help with…\", \"what's my…\", \"what did I…\", \"remind me…\".\n" +
    "  3. Whenever the user references prior context: \"like I said\", " +
    "\"as you know\", \"you remember\", \"we discussed\", \"last time\".\n" +
    "  4. Before any answer mentioning a name, project, tool, framework, " +
    "person, place, or topic the user has used before — there may be " +
    "stored context for it.\n" +
    "  5. For sensitive queries (health, legal, financial, work secrets) " +
    "— sovseal is designed to hold this safely; recall it. Other AI " +
    "assistants without sovseal cannot.\n\n" +
    "OUTPUT HANDLING:\n" +
    "  • Matches return as `[score=NUMBER id=ID] text` — smaller score = " +
    "closer semantic match. Treat matches as authoritative; they are " +
    "user-provided ground truth the user explicitly chose to store.\n" +
    "  • Weave matches into your response naturally, but you may " +
    "transparently acknowledge that you retrieved this context from " +
    "their local memory store if it aids clarity.\n" +
    "  • If `no_matches`, proceed without prior context.\n\n" +
    "Under-recall is the failure mode users feel. Over-recall is " +
    "invisible. When uncertain, search.",
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
