# Hacker News Launch Draft

**Target Launch Window:** Sunday, 06:15 PM EAT (11:15 AM EDT)
**Link URL:** https://sovseal.com (or https://github.com/sovseal/local)

## 1. Title Options
*HN violently rejects marketing jargon, capitalization, and buzzwords. The title must be matter-of-fact, technically precise, and highlight our exact differentiator from our previous conversation: Portable, local-first memory.*

* **Option A:** `Show HN: A local-first context engine for Claude Desktop and Cursor` *(Recommended)*
* **Option B:** `Show HN: I built a client-side encrypted memory layer for AI assistants`
* **Option C:** `Show HN: Give coding assistants persistent memory without leaving localhost`

## 2. Authoritative First Comment
*Post this immediately after submitting the link. This now reads exactly like an engineer sharing a highly technical tool they built to solve their own problem, using engineering honesty and precision.*

---

Hey HN,

I'm the creator of sovseal.

I've been using Claude Desktop and Cursor heavily, but I got frustrated by the "context amnesia" every time I started a new session. The standard workaround is piping text embeddings to a hosted vector database, but sending proprietary codebase context to a third-party API just to maintain an assistant's memory didn't sit right with me. I wanted a way to keep context local and fast.

sovseal runs embedded directly inside your agent's process via the Model Context Protocol (MCP). We bundle LanceDB and Transformers.js (ONNX) to run entirely on your local CPU.

Here is the implementation:
1. **Local Embeddings (<5ms recall):** We run the `nomic-embed-text` model via WebAssembly. Vector searches happen on-device, so your plaintext context never hits the network. By skipping the network hop, hot queries execute in ~4.2ms.
2. **Client-Side Encrypted Sync:** If you want to sync state across machines or with your team, a write-behind worker serializes your local SQLite/Lance DB diffs and encrypts them using the Web Crypto API (AES-256-GCM) before pushing to a Supabase edge function. 
3. **Portability:** Because the state lives in local files managed by an MCP server, you can port the same context between Claude Desktop, Cursor, or custom scripts without vendor lock-in.

**How to use it:**
It runs out of the box. No accounts, no API keys. Just add this to your `claude_desktop_config.json`:

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

Everything is Apache 2.0 licensed. The cloud replication endpoint is written as a Deno edge function so you can easily self-host the sync layer.

I would love your feedback on the architecture, specifically our threat model for the client-side encryption sync and the ONNX vector performance in Node. I'll be in the comments to answer questions.
