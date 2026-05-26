# Reddit Launch Drafts

**Note:** Reddit violently rejects cross-posting. These drafts address the unique architectural preferences and pain points of each subreddit. They focus on practical workflow wins, architectural tradeoffs, and immediate utility, stripping out startup/VC language.

---

## Post 1: r/MachineLearningNews
**Angle:** Benchmarks & Architecture (No Marketing Fluff)
**Title:** [Project] We built a local-first memory layer for MCP clients. Here are our latency benchmarks vs hosted vector databases.

Hey r/MachineLearningNews,

We’ve been testing different approaches to giving coding assistants (like Claude Desktop and Cursor) persistent memory. Most existing solutions pipe text embeddings to a hosted vector DB, which introduces significant latency and privacy concerns when dealing with proprietary code.

We just open-sourced **sovseal**, an alternative architecture that embeds the vector search entirely within the local process. 

**[Insert Benchmark Image: Local (<5ms) vs Hosted (500ms)]**

**The Architecture:**
*   **On-Device Embedding:** We use `Transformers.js` (ONNX) to embed vectors locally. Text never leaves the machine.
*   **Local-First, 0-RTT:** Instead of making HTTP calls, it embeds `LanceDB` directly inside the agent's process via the Model Context Protocol (MCP).
*   **Encrypted Sync:** If users want to sync state across machines, it uses AES-256-GCM encryption client-side before replicating the ciphertext to a Supabase edge function.

By skipping the network hop and caching eagerly, hot queries execute in ~4.2ms. We've found this completely changes the UX of MCP context retrieval. 

I'd love feedback on the architecture, specifically our approach to local ONNX embeddings in Node.

**GitHub:** [Link to your GitHub Repo]
**NPM:** `npx -y @sovseal/mcp-server`

---

## Post 2: r/selfhosted
**Angle:** Self-Sovereign Data & Encryption
**Title:** I built a self-hostable, client-side encrypted memory layer for Claude Desktop and Cursor (Deno/Supabase)

Hey r/selfhosted,

As coding assistants (like Cursor and Claude Desktop) get smarter, they require persistent "memory layers" to retain codebase rules across sessions. For many of us, sending proprietary code to a managed third-party vector DB is a non-starter.

I wanted cloud synchronization across my devices but demanded total ownership of the plaintext data. So I built sovseal.

**How it maintains privacy:**
1. **Client-Side Compute:** The memory layer runs locally as an MCP server using an embedded LanceDB instance. 
2. **AES-256-GCM:** A write-behind worker serializes the local DB diffs and encrypts them locally using the Web Crypto API.
3. **Self-Hosted Cloud Sync:** The encrypted blobs are pushed to a replication endpoint. The cloud only ever stores unreadable ciphertext.

**Self-Hosting the Cloud Layer:**
The replication endpoint is written as a lightweight Deno edge function. You can self-host the entire cloud backend on your own infrastructure (or a free Supabase project) in two commands:

```bash
supabase functions deploy v2-agent-state
supabase db push
```

Everything is Apache 2.0 licensed. Would love for the community to review the client-side crypto threat model (specifically our Verified Semantic Recall hashing) and the Deno replication logic. 

Repo: [github.com/sovseal/local]

---

## Post 3: r/ClaudeAI & r/Cursor
**Angle:** The Magic Moment (Workflow Enhancement)
**Title:** Claude forgets everything between sessions. I built a way to fix it locally in 60 seconds.

Hey everyone,

The most frustrating part about using Claude Desktop or Cursor is that the assistant forgets your specific codebase rules and architectural context the second you start a new session. 

I open-sourced **sovseal** to fix this. It’s a completely local, free MCP server that gives your assistant persistent, cross-session memory. 

**[Insert GIF: Showing Claude answering a codebase rule from a previous day's chat]**

Because it runs locally on your machine, it responds instantly (<5ms) and your proprietary code never leaves your laptop.

**How it works in practice:**
Tell Claude: *"Remember that we always use UUIDv4 for database primary keys."*
Tomorrow, in a totally new chat, ask: *"What is our rule for primary keys?"* 
It instantly pulls it from your local storage.

**The 60-second setup trick:**
No signups, no API keys, no routing your data through a cloud server. Just paste this block into your `claude_desktop_config.json` (or Cursor MCP settings):

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

Check it out and let me know if it improves your workflow!
Repo: [github.com/sovseal/local]

---

## Post 4: r/node & r/typescript
**Angle:** The Architecture & SDK
**Title:** How I built a sub-5ms local memory layer in Node using Transformers.js and ONNX

Hey r/node,

I recently open-sourced an MCP (Model Context Protocol) server designed to give coding assistants (like Claude Desktop) persistent, cross-session memory. But the real challenge was the Node architecture. 

Most memory tools pipe text to a hosted vector database, which introduces a 500ms network penalty per query. The goal was to build an embedded Node engine that did everything locally.

**The Node Architecture:**
1. **Local Embeddings via WebAssembly/ONNX:** We use `Transformers.js` to run the `nomic-embed-text` model directly inside the Node process. No Python dependency required.
2. **Embedded Vector Search:** The embeddings are dumped into `LanceDB`, providing lightning-fast semantic recall without needing to spin up a separate Qdrant Docker container. Hot queries execute in ~4.2ms.
3. **Write-Behind Cloud Sync:** We built a background worker that watches for local DB diffs, encrypts them using the native `crypto.subtle` AES-256-GCM API, and syncs them to a Deno edge function. It operates entirely off the main thread so the local assistant is never blocked.

**[Insert Architecture Diagram showing the Node worker flow]**

I'd love for the Node and TS community to review the architecture—specifically how we handle ONNX model loading and caching within the Node environment. 

Repo: [github.com/sovseal/local]
