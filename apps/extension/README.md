# @sovseal/extension

Browser extension that gives ChatGPT, Claude, Perplexity, Grok, Gemini and
DeepSeek a shared memory layer — **truly** local and zero-knowledge.

Unlike cloud "memory" extensions, sovseal never sends your conversations to a
server in plaintext. Capture and recall run against the on-device engine
(LanceDB + Transformers.js + AES-256-GCM) reached over Chrome **Native
Messaging**. Optional sync is server-blind ciphertext only.

## Architecture

```
content scripts ─┐                         ┌─ com.sovseal.host (Node)
sidebar + popup ─┼─ service worker ──NM──► │  storeLocal / queryLocal /
                 │   (NativeBridge port)   │  getRecentMemories / deleteLocal
                 └─ recall cache           │  LanceDB · embeddings · AES · sync
```

The service worker is the only component that touches the native port. The
engine itself is the same code the `@sovseal/mcp-server` MCP server runs — see
`packages/sovseal-mcp-server/src/native-host.ts`.

## Develop

```bash
pnpm --filter @sovseal/extension build      # → apps/extension/dist
```

1. Build the native host + register it:
   ```bash
   pnpm --filter @sovseal/mcp-server build
   node packages/sovseal-mcp-server/native-host/install.mjs
   ```
   (set `SOVSEAL_API_KEY` before installing to enable server-blind sync)
2. Load `apps/extension/dist` as an unpacked extension at `chrome://extensions`.
   The id is pinned to `bhldhhlkfohfogchnnonijocoolmamhm` (matches the host's
   `allowed_origins`).

## Capture posture

Auto-capture is **on by default**, with a global switch and per-site switches
in the popup. Manual capture is always available via the in-page button or
**⌘/Ctrl+M**. A first-run notice states plainly that capture is local-only.
