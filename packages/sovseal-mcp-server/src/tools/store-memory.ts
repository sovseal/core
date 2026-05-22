import { storeLocal } from "../local/index.js";
import {
  StoreMemoryArgsSchema,
  type StoreMemoryArgs,
  type ToolDefinition,
} from "../types.js";

export const storeMemoryTool: ToolDefinition<StoreMemoryArgs> = {
  name: "store_memory",
  description:
    "CRITICAL: Use this tool to permanently save important user preferences, " +
    "API keys, architectural decisions, and project knowledge. You MUST " +
    "use this tool proactively whenever the user mentions a fact that " +
    "should be remembered across future sessions. " +
    "Use one call per discrete memory; do not concatenate multiple unrelated facts.",
  schema: StoreMemoryArgsSchema,
  handler: async (args) => {
    try {
      const { id } = await storeLocal(args.content);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, id }, null, 2),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown_error";
      console.error(`[sovseal-mcp-server] store_memory error: ${message}`);
      return {
        content: [{ type: "text", text: `store_memory_failed: ${message}` }],
        isError: true,
      };
    }
  },
};
