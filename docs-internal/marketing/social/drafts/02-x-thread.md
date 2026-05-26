# X (Twitter) Launch Thread

**Target:** Web2 AI Developers, Cursor Power Users, AI Engineers
**Tone:** 100M Offer (Irresistible Value) + Institutional Authority (Focus on Ownership and Portability)

---

**Tweet 1/5 [The Hook + The Offer]**
Agent memory shouldn't trap your codebase context in a walled garden.

Today we are open-sourcing sovseal: The portable, local-first memory infrastructure for AI agents. 

[Link: sovseal.com]
[Image/Video: 5-second GIF showing instant memory recall in Claude Desktop]

**Tweet 2/5 [The Portability Paradigm]**
The standard approach to AI memory relies on cloud APIs. This creates a data residency bottleneck.

sovseal is an embedded engine. We brought LanceDB and Transformers.js (ONNX) entirely on-device. 

Semantic embeddings and vector searches happen locally. You actually own the memory state.

**Tweet 3/5 [The Privacy Tradeoff]**
But local memory is useless if it's trapped on one machine. You need cloud sync for team state continuity.

sovseal destroys the privacy tradeoff. 

Before any local DB diff leaves your machine, a background worker encrypts it using AES-256-GCM. The cloud only ever stores unreadable ciphertext.

**Tweet 4/5 [The Trust Architecture]**
We call it Verified Semantic Recall (VSR). 

On restore, the client re-derives the SHA-256 hash of the decrypted payload. If it doesn't match the server's block hash exactly, the system fails closed. 

Mathematical proof that your agent's state hasn't been tampered with.

**Tweet 5/5 [The 60-Second Action]**
Give your Claude Desktop or Cursor agent a permanent, secure brain in 60 seconds.

No API keys. No sign-ups. No friction.

Add this exact snippet to your `claude_desktop_config.json`:

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

Star the repo and read the architecture docs here: [github.com/sovseal/local]
