/**
 * SovSeal MCP Server
 *
 * Local stdio MCP server exposing the Semantic Vector Brain to LLM agents.
 *
 * Tools:
 *   store_memory  — embed content and write to the on-device LanceDB store
 *                   (write-behind; server replication runs asynchronously)
 *   recall_memory — semantic search over the on-device store, top-K by L2
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";

import { storeMemoryTool } from "./tools/store-memory.js";
import { recallMemoryTool } from "./tools/recall-memory.js";
import { getOrCreateIdentity } from "./identity.js";
import { SyncWorker } from "./sync/worker.js";
import { warmupEmbeddingPipeline } from "./local/embeddings.js";

const tools = [
  storeMemoryTool,
  recallMemoryTool,
];

const server = new Server(
  {
    name: "sovseal-mcp-server",
    version: "0.3.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.schema),
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools.find((candidate) => candidate.name === request.params.name);
  if (!tool) {
    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${request.params.name}`,
        },
      ],
      isError: true,
    };
  }

  const parsed = tool.schema.safeParse(request.params.arguments ?? {});
  if (!parsed.success) {
    return {
      content: [
        {
          type: "text",
          text: `Invalid arguments for ${tool.name}: ${parsed.error.message}`,
        },
      ],
      isError: true,
    };
  }

  return tool.handler(parsed.data);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[sovseal-mcp-server] stdio transport connected");

  void warmupEmbeddingPipeline()
    .then(() => console.error("[sovseal-mcp-server] embedding pipeline warm"))
    .catch((err) =>
      console.error("[sovseal-mcp-server] embedding warmup failed", err),
    );

  await maybeStartSyncWorker();
}

async function maybeStartSyncWorker(): Promise<void> {
  const apiKey = process.env.SOVSEAL_API_KEY;
  if (!apiKey) {
    console.error(
      "[sovseal-mcp-server] SOVSEAL_API_KEY not set — background sync worker disabled. Memories will be stored locally only.",
    );
    return;
  }

  let identity;
  try {
    identity = await getOrCreateIdentity();
  } catch (err) {
    console.error("[sovseal-mcp-server] identity bootstrap failed", err);
    return;
  }

  const worker = new SyncWorker({
    encryptionKey: identity.encryptionKey,
    apiKey,
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.error(`[sovseal-mcp-server] ${signal} — draining sync worker`);
    await worker.stop();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  await worker.start();
  console.error("[sovseal-mcp-server] sync worker started");
}

main().catch((error) => {
  console.error("[sovseal-mcp-server] fatal error", error);
  process.exit(1);
});
