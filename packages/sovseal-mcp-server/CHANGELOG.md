# Changelog — @sovseal/mcp-server

## 0.3.1 — 2026-05-25

### Fixed

- **`npx -y @sovseal/mcp-server` now works.** On npm 11.5.x, `npm exec` derives the default command name from the package basename (`mcp-server`), but 0.3.0 only registered the bin as `sovseal-mcp-server`. The install would exit early with "command not found" before the package finished downloading. The bin map now registers the same executable under both names — `mcp-server` (default) and `sovseal-mcp-server` (kept for backward compat). Affects every MCP-config snippet that uses the `npx -y` install path (Claude Desktop, Cursor, Windsurf, Zed, the README sample).

## 0.3.0 — 2026-05-25

### Added

- First public release on `@sovseal` npm scope.
- Two MCP tools — `store_memory` and `recall_memory` — backed by on-device LanceDB (384-dim Float32 vectors) + `@huggingface/transformers` ONNX embeddings.
- Write-behind ciphertext replication via the v2-agent-state Supabase edge function. AES-256-GCM, 96-bit random IV per snapshot.
- Verified Semantic Recall — every load re-derives `sha256(canonicalize(payload))` and fails closed on mismatch.

### Removed / breaking from 0.1.0

- Legacy `save_context` / `load_context` tool names removed. Use `store_memory` / `recall_memory`.
- B2C "vault" / "heir" / "guardian" surface fully retired.

## 0.1.0 — 2025-12-04

- Initial scaffolding, internal prototype. Not feature-equivalent to 0.3.x.
