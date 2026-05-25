# Reddit Launch Drafts

**Note:** Reddit violently rejects cross-posting. These drafts address the unique architectural preferences and pain points of each subreddit. 

---

## Post 1: r/LocalLLaMA
**Angle:** "0 RTT / No Cloud Tradeoff"
**Title:** Stop paying latency taxes for agent memory. I open-sourced an embedded vector DB for Cursor/Claude that runs ONNX locally (<5ms recall).

Hey r/LocalLLaMA,

I built this because I got tired of the "memory layer" ecosystem forcing us to send our local agent context to hosted cloud vector databases just to get persistent state. The 300-800ms network penalty ruins the UX for fast local agents.

I've open-sourced sovseal. It's a zero-knowledge memory layer that runs directly inside your agent's process.

**How it works locally:**
Instead of an API, we bundle LanceDB and Transformers.js natively. The semantic embedding models run entirely on your CPU via ONNX, so it doesn't steal precious VRAM from your actual LLM inference.

Because everything is embedded, warm semantic recall queries resolve in under 5ms. 0 network round-trips.

If you are using Claude Desktop or an MCP-compatible IDE, you can run it right now without any API keys or account creation. Just drop this into your MCP config:

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

I'd love your feedback on the ONNX embedding implementation and whether there are lighter local embedding models you prefer over the default `nomic-embed-text`. 

Repo: [github.com/sovseal/local]

---

## Post 2: r/selfhosted
**Angle:** "Total Data Residency & Encryption"
**Title:** I built a self-hostable, end-to-end encrypted memory layer for AI agents (Deno/Supabase)

Hey r/selfhosted,

As AI coding agents (like Cursor and Claude Desktop) get smarter, they require persistent "memory layers" to retain codebase context across sessions. The problem is that most of these tools (Mem0, Zep) are managed cloud services. Sending proprietary code to a third-party vector DB is an absolute non-starter for data residency.

I wanted cloud synchronization across my devices without giving up ownership of the plaintext data. So I built sovseal.

**The Architecture:**
1. **Client-Side Compute:** The memory layer runs locally as an MCP server using an embedded LanceDB instance. 
2. **AES-256-GCM:** A write-behind worker serializes the local DB diffs and encrypts them locally using the Web Crypto API.
3. **Self-Hosted Cloud Sync:** The encrypted blobs are pushed to a replication endpoint. The cloud only ever stores unreadable ciphertext.

**Self-Hosting the Cloud Layer:**
The replication endpoint is written as a lightweight Deno edge function. You can self-host the entire cloud backend on your own Supabase project in two commands:

```bash
supabase functions deploy v2-agent-state
supabase db push
```

Everything is Apache 2.0 licensed. Would love for the community to tear apart the crypto threat model (specifically our Verified Semantic Recall hashing) and the Deno replication logic. 

Repo: [github.com/sovseal/local]

---

## Post 3: r/ClaudeAI & r/Cursor
**Angle:** "The Infinite Memory Trick"
**Title:** Give your Claude Desktop / Cursor agent permanent memory across sessions (Free & Zero Config)

Hey everyone,

The most frustrating part about using Claude Desktop or Cursor is that the agent forgets your specific codebase rules and architectural context the second you start a new session. 

You can fix this by attaching a "Memory Layer", but most of the existing tools require you to create an account and send your proprietary code to a third-party API just to save a memory.

I wanted something completely local, fast, and free, so I open-sourced **sovseal**. It's an MCP server that gives your agent infinite semantic memory. It runs locally on your machine, which means your code isn't being uploaded to some random startup's database, and it responds instantly (<5ms).

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
**Title:** How I built a sub-5ms local vector database in Node using Transformers.js and ONNX

Hey r/node,

I recently open-sourced an MCP (Model Context Protocol) server designed to give AI agents (like Claude Desktop) permanent memory. But the real challenge was the Node architecture. 

Most AI memory tools in the JS ecosystem are just thin API wrappers that send data to OpenAI for embeddings, resulting in a 500ms network penalty per query. I wanted to build an embedded Node engine that did everything locally.

**The Node Architecture:**
1. **Local Embeddings via WebAssembly/ONNX:** We are using `Transformers.js` to run the `nomic-embed-text` model directly inside the Node process. No Python dependency required.
2. **Embedded Vector Search:** The embeddings are dumped into `LanceDB`, providing lightning-fast semantic recall without needing to spin up a separate Qdrant Docker container. Hot queries execute in ~4.2ms.
3. **Write-Behind Cloud Sync:** We built a background worker that watches for local DB diffs, encrypts them using the native `crypto.subtle` AES-256-GCM API, and syncs them to a Deno edge function. It operates entirely off the main thread to ensure the local agent is never blocked.

The entire `@sovseal/mcp-server` compiles down to a tiny 15KB ESM bundle. 

I'd love for the Node and TS community to review the architecture—specifically how we are handling the ONNX model loading and caching within the Node environment. 

Repo: [github.com/sovseal/local]
