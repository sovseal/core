<p align="center">
  <img src="./brand/sovseal/social/github-banner.png" alt="sovseal — AI memory that never leaves your machine">
</p>

<p align="center">
  <strong>Zero-knowledge, local-first AI memory for work you can't send to the cloud.</strong><br/>
  One private memory across Claude, ChatGPT, Cursor, and every MCP client — plaintext physically never leaves your machine.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sovseal/mcp-server"><code>@sovseal/mcp-server</code></a>
  ·
  <a href="https://www.npmjs.com/org/sovseal">@sovseal on npm</a>
  ·
  <a href="#quickstart">Quickstart</a>
  ·
  <a href="#-how-sovseal-compares">How it compares</a>
  ·
  <a href="./CHANGELOG.md">Changelog</a>
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
  <a href="./SECURITY.md">
    <img src="https://img.shields.io/badge/security-threat_model_published-8A2BE2.svg" alt="Security">
  </a>
</p>

# Why this exists

If you work with code, clients, or data you're not allowed to upload — healthcare, legal, fintech, defense, or anything under an NDA — every AI memory option today asks you to break that rule. Platform memory keeps your context on their cloud, in their walled garden, one platform at a time. Cloud memory layers route your raw conversations through third-party servers and extraction APIs.

sovseal takes the other path: **all capture, embedding, and recall run on your device.** Plaintext never crosses the network. The optional sync tier ships only AES-256-GCM ciphertext — the server cannot read your memories even if it wanted to. And because it speaks MCP and rides a browser extension, it's *one* memory across every AI you use, not six silos.

<!-- TODO(launch-blocker): record cross-platform recall demo — ⌘+M in Claude recalling something said in ChatGPT — save to ./brand/sovseal/demo/cross-platform-recall.gif and uncomment:
<p align="center">
  <img src="./brand/sovseal/demo/cross-platform-recall.gif" alt="Recalling ChatGPT context inside Claude with ⌘+M — all local" width="720">
</p>
-->

## Measured Performance & Benchmarks (May 2026)

Cloud-hosted memory layers force a tradeoff between latency, privacy, and cost. Every recall is a 200–800 ms round-trip to someone else's database. **sovseal collapses the tradeoff.** LanceDB and Transformers.js run *inside* your agent's process.

| Workload | Operation | p50 | p95 | p99 | Network |
| --- | --- | --- | --- | --- | --- |
| **10K records · 1K queries** | `recall_memory` (warm) | 6.1 ms | **10.4 ms** | **21.8 ms** | 0 RTT |
| **Cold start** | `recall_memory` (first call) | ~1.2 s | — | — | 0 RTT |
| **Single write** | `store_memory` | 3.8 ms | 7.2 ms | 12.5 ms | 0 RTT (write-behind) |

All benchmarks reproduce with: `pnpm --filter @sovseal/mcp-server run bench-v2` (10K pre-seeded memories, 1K sequential queries, CPU-bound ONNX embeddings on commodity hardware).

**What makes it fast and private:**
- **Sub-25 ms p99 recall** — semantic search is a local vector query, not an HTTP call.
- **On-device embeddings** — a pinned, hash-verified 384-dim MiniLM model (~22 MB quantized ONNX) runs locally. No embedding API, no per-call cost.
- **Zero-knowledge sync** — when replication is enabled, AES-256-GCM encryption happens before any byte leaves the device. The server stores ciphertext it cannot decrypt.
- **Verified Semantic Recall (VSR)** — every load re-derives `sha256(canonicalize(payload))` and fails closed on mismatch.
- **Deterministic lineage** — snapshot graph enables byte-equal state restoration.

# Introduction

[sovseal](https://sovseal.com) gives AI assistants and autonomous agents persistent, portable context that you actually own. It drops into any MCP-compatible client, captures from the major chat platforms via a browser extension, and keeps your plaintext where it belongs: on your hardware.

### Key Features & Use Cases

**Core Capabilities:**
- **Local-First Semantic Memory**: On-device LanceDB + 384-dim Transformers.js embeddings for 0-RTT recall.
- **Cross-Platform Capture**: The browser extension captures and recalls across ChatGPT, Claude, Perplexity, Grok, Gemini, and DeepSeek — one memory, six platforms, ⌘/Ctrl+M anywhere.
- **Zero-Knowledge Sync (optional)**: Replication ships only end-to-end AES-256-GCM ciphertext. Local-only mode works fully offline with no account.
- **Write-Behind Replication**: Tool calls return on local commit; ciphertext sync happens asynchronously.
- **Developer-Friendly**: Drop-in MCP server, Node SDK, and self-hosted edge endpoints.

**Who it's for:**
- **Privacy-Constrained Teams**: Healthcare, legal, fintech, and defense-adjacent teams whose policies require plaintext to stay on-device.
- **AI Power Users**: People working across Claude Desktop, Cursor, ChatGPT, and more who are tired of six AIs with six separate amnesias.
- **Agent Frameworks**: ElizaOS, Hermes, CrewAI, and LangGraph consume the MCP server natively — local memory with no per-call API bill.

## ⚖️ How sovseal compares

An honest map, because you'll ask anyway:

| | Platform-native memory (ChatGPT / Claude) | Cloud memory layers (mem0, Zep, hosted MCP memories) | **sovseal** |
|---|---|---|---|
| **Where plaintext lives** | Provider's cloud | Provider's cloud, or your servers (self-host = your ops) | **Your device only** |
| **Extraction pipeline** | Provider-internal | Typically an LLM API call on your raw text | **On-device embeddings; no LLM in the loop** |
| **Works across platforms** | No — each platform is a silo | Yes (via their cloud) | **Yes — locally, via MCP + extension** |
| **Offline** | No | No (cloud) / partial (self-host) | **Yes** |
| **Sync model** | Provider-controlled | Server reads your data | **Server sees ciphertext only** |
| **Cost per recall** | Subscription-gated | API/hosting cost | **$0, local compute** |

What you give up with sovseal, stated plainly: there's no cloud LLM doing clever extraction on your behalf (by design — that's the leak we exist to prevent), and you are responsible for your own key (see [Threat Model](#-threat-model--read-this-before-depending-on-it)). If neither of those matters to you and you live inside one platform, its native memory may be all you need. If they do matter, nothing else in this table does what the right-hand column does.

## 🚀 Quickstart Guide <a name="quickstart"></a>

### Choose your path

sovseal exposes one protocol with three delivery shapes. Pick by where your code runs:

| | **MCP Server** | **Browser Extension** | **Node SDK / Self-Hosted** |
|---|---|---|---|
| **Best for** | Claude Desktop/Code, Cursor, Windsurf, Zed, agent frameworks | ChatGPT, Claude.ai, Perplexity, Grok, Gemini, DeepSeek in the browser | In-process use in a Node/TS service; full data residency |
| **Install** | `npx -y @sovseal/mcp-server` | Chrome Web Store + local host installer | `npm install @sovseal/sdk` |
| **Recall latency** | 0 RTT (local LanceDB) | 0 RTT (Native Messaging to local engine) | 0 RTT (local LanceDB) |
| **Cost** | Free (Hobby) | Free (Hobby) | Paid (Starter or above for self-hosted sync) |

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

**System Prompt Snippet (Claude Desktop / Cursor Project Instructions):**
To ensure the AI natively uses the memory server, paste this into your custom instructions:
```text
This session has persistent memory via sovseal. At conversation start, check the sovseal://context/recent resource. Whenever the user shares preferences, plans, or personal context, store it via store_memory.
```

For always-on autonomous agents, switch to HTTP/SSE transport so the sovseal process outlives a single tool invocation:

```bash
SOVSEAL_TRANSPORT=sse SOVSEAL_PORT=4040 npx -y @sovseal/mcp-server
```

### Browser Extension

For the AI platforms that don't speak MCP. The extension bridges ChatGPT, Claude.ai, Perplexity, Grok, Gemini, and DeepSeek to the same on-device engine over Native Messaging — capture-on-send as you chat, ⌘/Ctrl+M to recall anywhere, with per-site toggles and one-click delete.

1. Install from the Chrome Web Store, then run the one-time local host installer.
2. Confirm the popup shows **"On-device engine connected."**
3. Chat normally; press ⌘/Ctrl+M in any supported platform to recall.

Everything the extension captures lives in the same local database the MCP server reads — tell Claude.ai something once, and Claude Code already knows it.

### Node SDK (Library)

When you're building a backend service and want to manage agent state persistence programmatically, import the Node SDK client. It performs end-to-end AES-256-GCM encryption client-side and replicates checkpoints to a sync endpoint you choose.

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
    active_context: {
      project: "acme-migration",
      decisions: ["Postgres over Mongo — team expertise", "Cut scope: no SSO in v1"],
      open_question: "Client prefers staged rollout; confirm dates with their ops lead."
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

## 🔗 Integrations & Agent Frameworks

All of these consume the same MCP server through their first-class MCP support. No sovseal-specific adapter is required:

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

We publish exactly what is protected, what isn't yet, and what's on us versus on you. Full detail in [SECURITY.md](./SECURITY.md).

**Guarantees that hold today:**
- **Sync confidentiality.** AES-256-GCM with a 96-bit random IV per snapshot, encrypted before transmission. The sync server stores ciphertext it cannot read.
- **Integrity (VSR).** Every recall re-derives `sha256(canonicalize(payload))` and compares against the stored `client_payload_hash`. Corrupted storage fails closed.
- **No third-party processing.** Embeddings are computed on-device by a version-pinned, hash-verified model. Your text is never sent to an embedding or extraction API.
- **Authentication.** Bearer token = `sov_proj_<uuid v4>` in `~/.sovseal/config.json`.
- **Storage.** Ciphertext lands in a Supabase Storage bucket. Object paths are SHA-256-derived and unguessable without your `project_id`.

**Honest status — hardening in flight (v0.3.5):**

| Control | Status |
|---|---|
| Zero-knowledge replication (AES-256-GCM + content hashing) | ✅ Shipped |
| On-device, hash-pinned embedding model | ✅ Shipped |
| Identifier sanitization against query-predicate injection | ✅ Shipped |
| Local database encryption at rest | ✅ Shipped v0.3.5 — field-level AES-256-GCM on memory content (embedding vector still in the clear) |
| Master key in OS keychain (HKDF-separated at-rest & sync subkeys) | ✅ Shipped v0.3.5 |
| Programmatic secret redaction before any write | 🔄 Planned — today this is enforced at the prompt level only |
| Model integrity verified strictly before load | ✅ Shipped v0.3.5 — incl. the first-run download path |

As of v0.3.5, memory content is encrypted at rest and the master key lives in the OS keychain, so local filesystem read no longer exposes your memories. Programmatic secret redaction is still prompt-level only — see [SECURITY.md](./SECURITY.md). We'd rather tell you that here than have you find out later.

- **Key loss (Hobby/Starter/Growth).** Lose `~/.sovseal/config.json` → lose every synced snapshot ever made. There is no escrow or recovery flow on these tiers.
- **Key recovery (Pro/Enterprise).** Pro tier adds managed key recovery via Shamir-split escrow custody, and Enterprise adds HSM-backed key recovery.

## 🤝 Contributing

```bash
pnpm install
pnpm --filter @sovseal/mcp-server build
node packages/sovseal-mcp-server/dist/index.js     # stdio MCP server
```

Test (unit + integration + crypto round-trip):

```bash
pnpm --filter @sovseal/mcp-server test
pnpm --filter @sovseal/mcp-server run bench-v2
```

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## 🗺️ Roadmap

The core open-source modules — the stdio/SSE MCP server, browser extension, Node SDK, and self-hosted Supabase edge functions — are stable, free, and licensed under Apache 2.0.

Next up, in order:
- **v0.3.5 — Security hardening + first intelligence**: local at-rest encryption, OS-keychain key custody, code-enforced secret redaction, and the start of typed memory (episodic / semantic / procedural) with reinforcement-aware recall — so sovseal remembers what you've *tried*, not just what you've said.
- **Ambient capture**: deterministic session observation for Claude Code and transcript-capable clients — memory that forms without anyone remembering to store it.
- **Hosted sync tier** — managed, high-availability ciphertext replication for teams that don't want to run their own edge function. (Still zero-knowledge: we host bytes we cannot read.)
- **Wallet-key mode (opt-in)** — Arweave permanence via Base L2 and Irys, for users who want their encrypted snapshots to outlive any company, including ours. Entirely optional; the core product has no blockchain dependency.

Track progress in [CHANGELOG.md](./CHANGELOG.md) and the issue tracker.

## 📚 Documentation & Support

- Quickstart: see the [Quickstart Guide](#quickstart) above
- Integrations: see [Integrations & Agent Frameworks](#-integrations--agent-frameworks)
- Security: [SECURITY.md](./SECURITY.md)
- Source: [`packages/sovseal-mcp-server/`](packages/sovseal-mcp-server/) · [`apps/extension/`](apps/extension/) · [`supabase/functions/v2-agent-state/`](supabase/functions/v2-agent-state/)
- Release notes: [`packages/sovseal-mcp-server/CHANGELOG.md`](packages/sovseal-mcp-server/CHANGELOG.md)
- Issues & PRs: this repository
- Contact: founders@sovseal.com

## ⚖️ License

[Apache 2.0](./LICENSE) — for the entire public surface (MCP server, extension, SDK, core protocol, edge function, docs). Fork it, ship it, run it however you like.

<div align="center">
  <sub>Built by the sovseal team — local-first, zero-knowledge sync, free.</sub>
</div>
