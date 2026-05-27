# @sovseal/mcp-server

Local-first, zero-knowledge semantic memory server for AI agents — speaks the [Model Context Protocol](https://modelcontextprotocol.io). On-device LanceDB + Transformers.js. Write-behind ciphertext replication. **0 RTT** reads.

```bash
npx -y @sovseal/mcp-server
```

## What it does

Exposes two MCP tools to any MCP-compatible client (Claude Desktop, Cursor, Windsurf, Zed, custom agent loops):

| Tool | Args | Behavior |
|---|---|---|
| `store_memory` | `{ content: string }` | Embed (384-dim, on-device) → write local LanceDB → return. Ciphertext sync runs **write-behind**; nothing blocks. |
| `recall_memory` | `{ query: string, topK?: number }` | Embed query (LRU-cached) → vector search local LanceDB → top-K by L2 distance. **0 RTT.** |

## Install for an MCP client

Add to `mcp.json` / `claude_desktop_config.json` / your client's MCP config:

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

For always-on autonomous agents, run as a long-lived HTTP/SSE server:

```bash
SOVSEAL_TRANSPORT=sse SOVSEAL_PORT=4040 npx -y @sovseal/mcp-server
```

After installation the package exposes two equivalent binaries — `mcp-server` (default) and `sovseal-mcp-server`. Either invocation form works for explicit control:

```bash
npx -y --package=@sovseal/mcp-server mcp-server
# or
npx -y --package=@sovseal/mcp-server sovseal-mcp-server
```

## How it stays private

- **AES-256-GCM** client-side encryption with a 96-bit random IV per snapshot
- 256-bit key lives in `~/.sovseal/config.json` (mode `0600`) — **lose this file, lose every snapshot**
- Server only ever sees ciphertext + SHA-256-derived paths; it cannot read your context
- **Verified Semantic Recall (VSR)** — every load re-derives `sha256(canonicalize(payload))` and fails closed on mismatch

## Performance

| Workload | Operation | p50 | p95 | p99 |
|---|---|---|---|---|
| 10K records · 1K queries | `recall_memory` (warm) | 6.1 ms | 10.4 ms | 21.8 ms |
| Single write | `store_memory` | 3.8 ms | 7.2 ms | 12.5 ms |
| First call | `recall_memory` (cold) | ~1.2 s | — | — |

All operations are **0 RTT** — network is never on the read path.

## Full docs, SDK, self-host edge function

Repository: **[github.com/sovseal/core](https://github.com/sovseal/core)**

## License

[Apache 2.0](./LICENSE)
