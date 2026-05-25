# Reddit Launch Drafts

**Note:** Reddit violently rejects cross-posting. These drafts address the unique architectural preferences and pain points of each subreddit. They follow the "Mom Test" protocol: focus on the user's problem and the Dream Outcome, not on attacking competitors.

---

## Post 1: r/MachineLearningNews
**Angle:** "The Portable Memory Paradigm"
**Title:** [Project] A local-first, zero-knowledge memory infrastructure for AI agents (built on MCP for true portability)

Hey r/MachineLearningNews,

Right now, the AI agent memory ecosystem is heavily focused on centralized cloud APIs and heavy frameworks. While those tools offer incredible knowledge graphs, they introduce a massive challenge for data residency: your agent's memory state gets trapped in a specific cloud provider or walled garden.

A new open-source project called **sovseal** just launched to offer an alternative architecture. Instead of an API, it’s a drop-in local memory infrastructure built entirely on Anthropic's Model Context Protocol (MCP).

**The Architecture:**
*   **Local-First, 0-RTT:** Instead of making HTTP calls to a cloud vector database, it embeds LanceDB directly inside the agent's process.
*   **On-Device Embedding:** Uses Transformers.js (ONNX) to embed vectors locally. Your raw text never leaves the machine.
*   **True Portability:** Because it's an MCP server, the user physically owns the memory state (via a local SQLite/Lance file). You can take your agent's memory and instantly port it between Claude Desktop, Cursor, ElizaOS, or custom LangChain scripts.
*   **Zero-Knowledge Sync:** If you do want to sync state across machines, it uses AES-256-GCM encryption client-side before replicating the ciphertext.

The core philosophy here is **Trust, Privacy, Portability, and Ownership**. It’s built for developers and enterprises who need persistent AI context, but require their data to remain 100% in their control.

It's completely free and open-source (Apache 2.0). 

**GitHub:** [Link to your GitHub Repo]
**NPM:** `npx -y @sovseal/mcp-server`

---

## Post 2: r/selfhosted
**Angle:** "Self-Sovereign Data & Encryption"
**Title:** I built a self-hostable, end-to-end encrypted memory layer for AI agents (Deno/Supabase)

Hey r/selfhosted,

As AI coding agents (like Cursor and Claude Desktop) get smarter, they require persistent "memory layers" to retain codebase context across sessions. The challenge is that for many of us, sending proprietary code to a managed third-party vector DB is a non-starter for data residency.

I wanted cloud synchronization across my devices but demanded total ownership of the plaintext data. So I built sovseal.

**How it maintains data residency:**
1. **Client-Side Compute:** The memory layer runs locally as an MCP server using an embedded LanceDB instance. 
2. **AES-256-GCM:** A write-behind worker serializes the local DB diffs and encrypts them locally using the Web Crypto API.
3. **Self-Hosted Cloud Sync:** The encrypted blobs are pushed to a replication endpoint. The cloud only ever stores unreadable ciphertext.

**Self-Hosting the Cloud Layer:**
The replication endpoint is written as a lightweight Deno edge function. You can self-host the entire cloud backend on your own infrastructure (or a free Supabase project) in two commands:

```bash
supabase functions deploy v2-agent-state
supabase db push
```

Everything is Apache 2.0 licensed. Would love for the community to review the crypto threat model (specifically our Verified Semantic Recall hashing) and the Deno replication logic. 

Repo: [github.com/sovseal/local]

---

## Post 3: r/ClaudeAI & r/Cursor
**Angle:** "The Infinite Memory Trick (Ownership)"
**Title:** Give your Claude Desktop / Cursor agent permanent memory across sessions (Free, Local, Zero Config)

Hey everyone,

The most frustrating part about using Claude Desktop or Cursor is that the agent forgets your specific codebase rules and architectural context the second you start a new session. 

You can fix this by attaching a "Memory Layer". However, you usually have to create an account, get an API key, and route your private codebase context through a cloud server.

I wanted something completely local, fast, and free, so I open-sourced **sovseal**. It's an MCP server that gives your agent infinite semantic memory. It runs locally on your machine, which means you actually own the memory files, and it responds instantly (<5ms).

**The 60-second setup trick:**
You don't need to sign up or create an API key. Just paste this block into your `claude_desktop_config.json` (or Cursor MCP settings):

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

Now, just tell Claude: *"Remember that we always use UUIDv4 for database primary keys."* Tomorrow, in a totally new chat, ask it: *"What is our rule for primary keys?"* It will instantly pull it from your local LanceDB storage.

Check it out and let me know if it improves your workflow!
Repo: [github.com/sovseal/local]

---

## Post 4: r/node & r/typescript
**Angle:** "The Architecture & SDK"
**Title:** How I built a sub-5ms portable vector database in Node using Transformers.js and ONNX

Hey r/node,

I recently open-sourced an MCP (Model Context Protocol) server designed to give AI agents (like Claude Desktop) permanent, portable memory. But the real challenge was the Node architecture. 

I wanted to avoid forcing users to rely on external cloud vector databases, which usually introduce a 500ms network penalty per query and compromise data privacy. The goal was to build an embedded Node engine that did everything locally.

**The Node Architecture:**
1. **Local Embeddings via WebAssembly/ONNX:** We are using `Transformers.js` to run the `nomic-embed-text` model directly inside the Node process. No Python dependency required.
2. **Embedded Vector Search:** The embeddings are dumped into `LanceDB`, providing lightning-fast semantic recall without needing to spin up a separate Qdrant Docker container. Hot queries execute in ~4.2ms.
3. **Write-Behind Cloud Sync:** We built a background worker that watches for local DB diffs, encrypts them using the native `crypto.subtle` AES-256-GCM API, and syncs them to a Deno edge function. It operates entirely off the main thread to ensure the local agent is never blocked.

The entire `@sovseal/mcp-server` compiles down to a tiny 15KB ESM bundle. 

I'd love for the Node and TS community to review the architecture—specifically how we are handling the ONNX model loading and caching within the Node environment to maximize portability. 

Repo: [github.com/sovseal/local]
