<p align="center">
  <a href="https://sovseal.com">
    <img src="https://sovseal.com/logo-mark-standard.svg" width="80px" alt="SovSeal - The Sovereign Memory Layer for AI Agents">
  </a>
</p>
<h1 align="center">SovSeal</h1>
<p align="center">
  <strong>The sovereign memory layer for AI agents.</strong><br/>
  Local-first speed. Zero-knowledge privacy. Free, forever.
</p>

<p align="center">
  <a href="https://sovseal.com">Learn more</a>
  ·
  <a href="https://sovseal.com/developers">Docs</a>
  ·
  <a href="https://www.npmjs.com/org/sovseal">@sovseal on npm</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sovseal/mcp-server" target="blank">
    <img src="https://img.shields.io/npm/v/@sovseal/mcp-server.svg?color=%2334D058&label=npm%20package" alt="Npm package">
  </a>
  <a href="https://opensource.org/licenses/Apache-2.0">
    <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License: Apache 2.0">
  </a>
  <a href="https://nodejs.org">
    <img src="https://img.shields.io/badge/node-20%2B-43853d.svg" alt="Node">
  </a>
  <a href="https://supabase.com/">
    <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white" alt="Supabase">
  </a>
</p>

## Measured Performance & Benchmarks (May 2026)

Cloud-hosted memory layers force a tradeoff between latency, privacy, and cost. Every recall is a 200–800 ms round-trip to someone else's database. **SovSeal collapses the tradeoff.** LanceDB and Transformers.js run *inside* your agent's process.

| Workload | Operation | p50 | p95 | p99 | Network |
| --- | --- | --- | --- | --- | --- |
| **10K records · 1K queries** | `recall_memory` (warm) | 6.1 ms | **10.4 ms** | **21.8 ms** | 0 RTT |
| **Cold start** | `recall_memory` (first call) | ~1.2 s | — | — | 0 RTT |
| **Single write** | `store_memory` | 3.8 ms | 7.2 ms | 12.5 ms | 0 RTT (write-behind) |

All benchmarks reproduce with: `pnpm --filter @sovseal/mcp-server test bench-v2` (10K pre-seeded memories, 1K sequential queries, CPU-bound ONNX embeddings on commodity hardware).

**What makes it fast and secure:**
- **Sub-25 ms p99 recall** — semantic search is a local vector query, not an HTTP call.
- **Zero-knowledge by construction** — AES-256-GCM encryption before leaving the device.
- **Verified Semantic Recall (VSR)** — every load re-derives `sha256(canonicalize(payload))` and fails closed on mismatch.
- **Deterministic lineage** — snapshot graph enables byte-equal state restoration.

# Introduction

[SovSeal](https://sovseal.com) enhances AI assistants and agents with an encrypted, local-first memory layer, enabling private and personalized AI interactions. It drops into any MCP-compatible client and gives your agent persistent semantic memory that survives crashes, restarts, and reinstalls, completely free of usage limits and vendor lock-in.

### Key Features & Use Cases

**Core Capabilities:**
- **Local-First Semantic Memory**: On-device LanceDB + 384-dim Transformers.js embeddings for 0-RTT recall.
- **Zero-Knowledge Architecture**: The server only sees ciphertext. End-to-end AES-256-GCM.
- **Write-Behind Replication**: Tool calls return on local commit; ciphertext sync happens asynchronously.
- **Developer-Friendly**: Drop-in MCP server, Node SDK, and self-hosted edge endpoints.

**Applications:**
- **AI Coding Assistants**: Claude Desktop, Cursor, and Windsurf need persistent, private memory across long sessions.
- **Agent Frameworks**: ElizaOS, Hermes, CrewAI, and LangGraph natively consume MCP.
- **Privacy-Sensitive Teams**: Healthcare, legal, and defense teams that require plaintext to stay on-device.

## 🚀 Quickstart Guide <a name="quickstart"></a>

### Choose your path

SovSeal exposes one protocol with three delivery shapes. Pick by where your code runs:

| | **MCP Server** | **Node SDK** | **Self-Hosted Edge** |
|---|---|---|---|
| **Best for** | Any MCP-compatible client or agent framework | In-process import inside a Node/TS service | Full data residency on infra you control |
| **Install** | `npx -y @sovseal/mcp-server` | `npm install @sovseal/sdk` | `supabase functions deploy v2-agent-state` |
| **Transport** | stdio · HTTP · SSE | Direct function calls | HTTPS to your endpoint |
| **Auth** | Self-asserting (`sov_proj_<uuid>`) | API key or self-asserting | Bring your own |
| **Recall latency**| 0 RTT (local LanceDB) | 0 RTT (local LanceDB) | 0 RTT (local LanceDB) |
| **Cost** | Free | Free | Your Supabase bill |

### MCP Server

The default for AI coding assistants and any agent framework that speaks MCP. One server binary, one config snippet, every client.

**Claude Desktop, Cursor, Windsurf, Zed** — add to `mcp.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sovseal-memory": {
      "command": "npx",
      "args": ["-y", "@sovseal/mcp-server"]
    }
  }
}
```

One-line install for Claude Code:

```bash
claude mcp add sovseal -- npx -y @sovseal/mcp-server
```

For always-on autonomous agents, switch to HTTP/SSE transport so the SovSeal process outlives a single tool invocation:

```bash
SOVSEAL_TRANSPORT=sse SOVSEAL_PORT=4040 npx -y @sovseal/mcp-server
```

### Node SDK (Library)

When you're building a backend service and want to manage agent state snapshot persistence programmatically, import the Node SDK client. It manages end-to-end AES-256-GCM encryption client-side and replicates checkpoints to your persistence cloud tier.

```bash
npm install @sovseal/sdk
```

```typescript
import { AgentStateClient, CryptoService } from "@sovseal/sdk";

const client = new AgentStateClient({
  endpoint: "https://your-project.supabase.co/functions/v1/v2-agent-state",
  apiKey: "sov_proj_your_project_uuid",
});

const key = await CryptoService.generateAESKey();

// Client-side AES-GCM encrypted snapshot upload
const receipt = await client.snapshot({
  key,
  payload: {
    agent_id: "agent_a1b2c3",
    sequence_number: 0,
    parent_snapshot: null,
    policy_hash: "0000000000000000000000000000000000000000000000000000000000000000",
    timestamp: new Date().toISOString(),
    wallet_balances: { USDC: { "8453": "50000000" } }, // $50 in 6 decimals
    active_context: {
      preference: "Customer prefers wire transfers over ACH for >$50k settlements."
    }
  }
});

// Restore the latest state snapshot
const { receipt: latestReceipt, ciphertextUrl } = await client.restore({
  agentId: "agent_a1b2c3",
});
```


### Self-Hosted Edge

The replication endpoint is a Deno edge function — open source, deployable to any Supabase project for full data-residency control. 

```bash
# From the repo root
supabase functions deploy v2-agent-state
supabase db push    # applies the agent_state_snapshots schema

# Point any client at it:
export SOVSEAL_ENDPOINT="https://<your-project>.supabase.co/functions/v1/v2-agent-state"
```

Source: [supabase/functions/v2-agent-state/](supabase/functions/v2-agent-state/).

### Basic Usage

Drop-in patterns for an agent loop using the `@sovseal/sdk`:

```typescript
import OpenAI from "openai";
import { AgentStateClient, CryptoService, decryptJson } from "@sovseal/sdk";

const openai = new OpenAI();
const client = new AgentStateClient({
  endpoint: "https://your-project.supabase.co/functions/v1/v2-agent-state",
  apiKey: "sov_proj_your_project_uuid",
});
const key = await CryptoService.generateAESKey();

async function chatWithMemory(agentId: string, message: string) {
  let context = "";
  try {
    // Restore latest state snapshot
    const { receipt, ciphertextUrl } = await client.restore({ agentId });
    const res = await fetch(ciphertextUrl);
    const encryptedBytes = new Uint8Array(await res.arrayBuffer());
    
    // Decrypt the ciphertext client-side using the local AES key
    const payload = await decryptJson(encryptedBytes, key);
    context = JSON.stringify(payload.active_context);
  } catch (err) {
    console.log("No previous state snapshot found or failed to restore");
  }

  const reply = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: `You are a helpful assistant.\nContext:\n${context}` },
      { role: "user", content: message },
    ],
  });

  const assistant = reply.choices[0].message.content ?? "";

  // Save the updated state snapshot
  await client.snapshot({
    key,
    payload: {
      agent_id: agentId,
      sequence_number: 1, // Incremented in a production agent loop
      parent_snapshot: null,
      policy_hash: "0000000000000000000000000000000000000000000000000000000000000000",
      timestamp: new Date().toISOString(),
      wallet_balances: {},
      active_context: { lastMessage: message, reply: assistant }
    }
  });
  
  return assistant;
}
```

## 🔗 Integrations & Agent Frameworks

All of these consume the same MCP server through their first-class MCP support. No SovSeal-specific adapter is required:

| Framework | How it consumes MCP |
|---|---|
| **ElizaOS** | `@fleek-platform/eliza-plugin-mcp` (config-only, stdio or SSE) |
| **Hermes Agent** | Native MCP, stdio + remote HTTP |
| **CrewAI** | `mcps=[...]` field on the agent |
| **LangGraph · LangChain** | `langchain-mcp-adapters` (npm + PyPI) |
| **Microsoft Agent Framework** | Built-in MCP workbench |
| **OpenAI Agents SDK** | Native `MCPServerStdio` / `MCPServerSse` |
| **OpenClaw** | Native `openclaw mcp` consumer |

## 🛠️ MCP Tools Exposed to the LLM

| Tool | Args | Behavior |
|---|---|---|
| `store_memory` | `{ content: string }` | Embed (384-dim, on-device) → write to local LanceDB → return. Ciphertext replication runs **write-behind**; nothing blocks. |
| `recall_memory` | `{ query: string, topK?: number }` | Embed query (LRU-cached) → vector search local LanceDB → return top-K matches ranked by L2 distance. **0 RTT.** |

## 🔒 Threat Model — Read this before depending on it

- **Confidentiality.** AES-256-GCM with a 96-bit random IV per snapshot. The server cannot read your context.
- **Integrity (VSR).** Every recall re-derives `sha256(canonicalize(payload))` and compares against the stored `client_payload_hash`. Corrupted storage fails closed.
- **Authentication.** Bearer token = `sov_proj_<uuid v4>` in `~/.sovseal/config.json`.
- **Storage.** Ciphertext lands in a Supabase Storage bucket. Object paths are SHA-256-derived and unguessable without your `project_id`.
- **Loss.** Lose `~/.sovseal/config.json` → lose every snapshot ever made. There is no escrow, no recovery flow. Back it up.

## 🤝 Contributing

```bash
pnpm install
pnpm --filter @sovseal/mcp-server build
node packages/sovseal-mcp-server/dist/index.js     # stdio MCP server
```

Test (unit + integration + crypto round-trip):

```bash
pnpm --filter @sovseal/mcp-server test
pnpm --filter @sovseal/mcp-server test bench-v2
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [AGENTS.md](./AGENTS.md).

## 🗺️ Roadmap

The core open-source modules — the stdio/SSE MCP server, Node SDK, and self-hosted Supabase edge functions — are fully production-ready, free forever, and licensed under Apache 2.0.

Upcoming capabilities on our public roadmap:
- **Hosted sync tier** — managed, high-availability replication for teams that don't want to run their own edge function.
- **Wallet-key mode** — opt-in Arweave permanence via Base L2 and Irys.
- **Native framework adapters** — specialized adapters for environments where MCP isn't a direct fit.

Track progress in [CHANGELOG.md](./CHANGELOG.md) and the issue tracker.

## 📚 Documentation & Support

- Full docs: <https://sovseal.com/developers>
- API reference: [packages/sovseal-mcp-server/README.md](packages/sovseal-mcp-server/README.md)
- Issues & PRs: this repository
- Contact: founders@sovseal.com

## ⚖️ License

[Apache 2.0](./LICENSE) — for the entire public surface (MCP server, SDK, core protocol, edge function, docs). Fork it, ship it, run it however you like.

<div align="center">
  <sub>Built by the SovSeal team — local-first, zero-knowledge, free.</sub>
</div>
