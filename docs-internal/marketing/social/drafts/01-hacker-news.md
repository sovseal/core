# Hacker News Launch Draft

**Target Launch Window:** Sunday, 06:15 PM EAT (11:15 AM EDT)
**Link URL:** https://sovseal.com (or https://github.com/sovseal/local)

## 1. Title Options
*HN violently rejects marketing jargon, capitalization, and buzzwords. The title must be matter-of-fact, technically precise, and highlight our exact differentiator from our previous conversation: Portable, local-first memory.*

* **Option A:** `Show HN: A portable, local-first memory infrastructure for AI agents` *(Recommended)*
* **Option B:** `Show HN: I built an end-to-end encrypted local memory node for Claude Desktop`
* **Option C:** `Show HN: Give your AI agents persistent memory that you actually own`

## 2. Authoritative First Comment
*Post this immediately after submitting the link. We have stripped out AI-sounding phrases. This now reads exactly like an engineer sharing a highly technical tool they built to solve their own problem, following the Mom Test protocol (no attacking competitors).*

---

Hey HN,

I'm the creator of sovseal.

The current AI agent memory ecosystem heavily emphasizes centralized cloud APIs. While those tools offer incredible knowledge graphs, they introduce a massive data residency challenge: your agent's memory state gets trapped in a specific cloud provider or walled garden. 

I wanted a memory layer that provided the same persistence, but allowed the user to physically own and port their agent's memory across different environments. 

sovseal runs embedded directly inside your agent's process. We bundle LanceDB and Transformers.js (ONNX) to run entirely on your local CPU.

Here is how the architecture works:
1. **<5ms Local Recall:** Semantic embeddings and vector searches happen on-device. Your plaintext context never leaves the machine. Eager warmup and LRU caching bring hot query times down to ~4.2ms.
2. **Zero-Knowledge Cloud Sync:** If you want to sync state across machines, a write-behind worker serializes your local DB diffs, encrypts them using standard Web Crypto API AES-256-GCM, and pushes them to our Supabase edge function. The cloud only ever stores unreadable ciphertext.
3. **True Portability:** Because it's built on Anthropic's Model Context Protocol (MCP), you own the SQLite/Lance files. You can take your memory state and instantly port it between Claude Desktop, Cursor, or custom LangChain scripts.

**How to use it with Claude Desktop or Cursor:**
It runs out of the box without requiring you to create an account, enter an email, or generate an API key. Just add this to your `claude_desktop_config.json`:

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

Everything is fully Apache 2.0 licensed, free, and open-source. The cloud replication endpoint is written as a Deno edge function so you can easily self-host the sync layer on your own Supabase project.

I would love your brutal feedback on the crypto threat model, the ONNX vector performance, and the developer experience. I'll be here in the comments to answer questions!
