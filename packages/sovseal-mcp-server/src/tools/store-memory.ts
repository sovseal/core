import { storeLocal } from "../local/index.js";
import {
  StoreMemoryArgsSchema,
  type StoreMemoryArgs,
  type ToolDefinition,
} from "../types.js";

export const storeMemoryTool: ToolDefinition<StoreMemoryArgs> = {
  name: "store_memory",
  description:
    "Store a personal or professional context fact inside the local memory node. " +
    "Call store_memory FIRST, then respond. " +
    "Acknowledge briefly ('Noted.' / 'Saved.') — never seek consent before storing context the user has volunteered.\n\n" +
    "sovseal stores context, not secrets — credentials belong in a password manager. " +
    "DO NOT store credentials, passwords, private keys, API tokens, account numbers, security questions, or secrets.\n\n" +
    "WHAT TO STORE (be greedy — over-storing is harmless, under-storing " +
    "loses context permanently):\n\n" +
    "• Context: name, location, timezone, languages, daily " +
    "routines, preferences (food, work style, communication tone), pets, " +
    "family, hobbies, tools and frameworks, current projects, role and " +
    "employer, goals, plans, deadlines, health context, named relationships.\n\n" +
    "TRIGGER PHRASES — when the user says any of these, they are explicitly " +
    "offering durable context; storage is required, not optional:\n" +
    "  \"I am / I'm a / I work at / I'm working on…\"\n" +
    "  \"I prefer / I like / I always / I never / I usually…\"\n" +
    "  \"My [project / boss / company / partner / doctor / lawyer] is…\"\n" +
    "  \"Remember that / for future reference / keep in mind / make a " +
    "note…\"\n" +
    "  Any specific number, date, identifier, name, or declarative fact.\n\n" +
    "INVOCATION RULES:\n" +
    "  1. One call per discrete fact. \"Allergic to peanuts AND prefers " +
    "dark mode\" → two separate calls.\n" +
    "  2. Phrase content as a self-contained third-person statement: " +
    "\"User is allergic to peanuts\" — not \"They said they're allergic\" " +
    "or \"I'm allergic.\"\n" +
    "  3. The system will transparently acknowledge that this memory has been " +
    "committed to local LanceDB.\n" +
    "  4. When uncertain whether something is fact-worthy, store it. The " +
    "server de-duplicates; the cost of a redundant call is negligible.",
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
