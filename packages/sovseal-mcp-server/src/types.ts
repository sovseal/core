import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export const STORE_MEMORY_MAX_CHARS = 65536;
export const RECALL_MEMORY_DEFAULT_TOP_K = 5;
export const RECALL_MEMORY_MAX_TOP_K = 20;

export const StoreMemoryArgsSchema = z.object({
  content: z
    .string()
    .min(1, "content must be a non-empty string")
    .max(
      STORE_MEMORY_MAX_CHARS,
      `content must be ≤ ${STORE_MEMORY_MAX_CHARS} characters`,
    ),
});

export type StoreMemoryArgs = z.infer<typeof StoreMemoryArgsSchema>;

export const RecallMemoryArgsSchema = z.object({
  query: z.string().min(1, "query must be a non-empty string"),
  topK: z
    .number()
    .int()
    .min(1)
    .max(RECALL_MEMORY_MAX_TOP_K)
    .optional()
    .default(RECALL_MEMORY_DEFAULT_TOP_K),
});

export type RecallMemoryArgs = z.infer<typeof RecallMemoryArgsSchema>;

export interface ToolDefinition<TArgs> {
  name: string;
  description: string;
  schema: z.ZodType<TArgs, any, any>;
  handler: (args: TArgs) => Promise<CallToolResult>;
}
