# Changelog

<!-- 
AGENT INSTRUCTION:
When updating this changelog, write entirely from the perspective of the DEVELOPER or END-USER reading it.
- DO NOT list internal agent names (e.g., "Agent: Antigravity").
- DO NOT list internal missions, Jira-style ticket numbers, or internal refactoring tasks (e.g., "Ran pnpm typecheck", "Removed scratch scripts").
- Focus exclusively on: What new capability was added? What bug was fixed that affected the user? How was performance improved?
- Format as standard user-facing release notes.
-->

## [5.5.5] - 2026-05-22

### 🛠 Fixes & Improvements
- **TypeScript Stability**: Resolved strict compilation errors across the `@sovseal/mcp-server` package, improving the local developer experience for contributors extending the core platform.
- **Schema Resolution**: Hardened Zod schema typing to seamlessly support custom schemas with default or optional parameters where input and output types differ.
- **Apache Arrow Compatibility**: Added explicit type declarations to resolve compiler warnings for users importing the Apache Arrow module alongside the SDK.

## [5.5.4] - 2026-05-22

### 📖 Documentation
- **Dedicated Release Notes**: Added a persistent "Changelog" navigation tab to the docs. Release notes are now cleanly organized into three flat categories: Highlights (SPK), SDK & Tools (VTC), and Platform & Edge.

## [5.5.3] - 2026-05-22

### 🛠 Fixes & Improvements
- **Repository Hygiene**: Separated the active sovseal platform updates from the legacy Inheribase updates. Historical B2C platform changes (v3.19.0 and below) have been archived, ensuring developers only see relevant MCP and SDK updates in the main changelog.

## [5.5.2] - 2026-05-22

### 📖 Documentation
- **Simplified Navigation**: Redesigned the documentation sidebar to a flat, grouped hierarchy (matching industry standards), making it significantly easier to navigate Getting Started, Core Concepts, and Advanced Configuration without drilling through nested folders.

## [5.5.1] - 2026-05-22

### 📖 Documentation
- **Persistent Topbar Navigation**: Upgraded the documentation layout so that high-level links (Platform, Self-Hosted, Cookbooks, SDK/API Reference) remain persistently accessible at the top of the screen across all sub-pages.

## [5.5.0] - 2026-05-21

### 🚀 Major Platform Update
- **Open-Source Repository Clean-up**: We have officially partitioned the repository to make the open-source developer experience flawless. The public `sovseal/local` repository now strictly contains essential developer tools: `@sovseal/mcp-server`, `@sovseal/sdk`, and the Deno Edge Function. All legacy marketing and internal dashboard code has been migrated to a private internal repository.

## [5.4.1] - 2026-05-20

### ⚡ Performance
- **Sub-5ms Semantic Recall**: Drastically reduced semantic recall latency. Hot query times now reliably hit ~4.2ms.
- **LRU Query Caching**: Implemented a 256-capacity LRU cache for query embeddings to eliminate duplicate ONNX model calls. (Can be overridden or disabled via the `SOVSEAL_EMBEDDING_CACHE_SIZE` environment variable).
- **Eager Pipeline Warmup**: The MCP server now fires a background no-op embedding immediately upon connection, meaning your agent will not experience the 1-3 second ONNX cold-load delay on its first memory query.

## [5.4.0] - 2026-05-20

### 🛡️ Security & Reliability
- **End-to-End Validation Guarantees**: Hardened the replication pipeline to guarantee 100% recall rate post-restoration. If you wipe your local database, the cloud sync will perfectly reconstruct the local Merkle root and database state.
- **Zero-Knowledge Hardening**: Completed a formal security audit on the differential sync protocol, verifying that the server never decrypts client payloads. Cloud sync relies purely on opaque, encrypted block diffs.

## [5.3.0] - 2026-05-20

### 🚀 Features
- **Differential Cloud Replication**: Added support for append-only replication. Instead of rewriting the entire database state on every change, the client now securely syncs O(1) encrypted block diffs to the cloud.
- **Self-Hostable Edge Functions**: The replication endpoints (`/replicate`, `/head`, `/replay`) are now available as Deno Edge functions, easily deployable to your own Supabase project.

## [5.2.1] - 2026-05-20

### 🚀 Features
- **Local-First ML Architecture**: The SDK now integrates `Transformers.js` for on-device embedding generation and `LanceDB` for local vector storage, ensuring your agent's context never leaves your machine unless explicitly synced.

## [5.2.0] - 2026-05-20

### 💥 BREAKING CHANGES: MCP Server
- **Replaced KV with Semantic Memory**: The exact-match `save_context` and `load_context` tools have been completely removed and replaced with semantic tools: `store_memory` and `recall_memory`.
- **Why?** LLMs struggle to produce stable, exact-match keys across sessions. The new semantic tools embed memories locally and rank them by L2 distance, allowing the agent to query conceptually (e.g., "what did we agree about X?") instead of guessing exact string keys.
- **Migration**: Simply update your agent prompts to use `store_memory({ content })` and `recall_memory({ query, topK })`. No API keys or network calls are required—all embedding happens locally.

## [5.1.0] - 2026-05-19

### 🔐 Security Features
- **Verified Semantic Recall (VSR)**: On every state restore, the client now derives a SHA-256 hash of the decrypted payload and compares it against the stored server hash. If there is a mismatch (due to data corruption or tampering), the system fails closed, providing mathematical proof of state integrity.

## [5.0.0] - 2026-05-12

### 🎉 Initial Public Release
- **sovseal Is Live**: Released the highly anticipated `@sovseal/mcp-server` to NPM. It provides an unkillable, zero-knowledge memory node for local AI agents (Claude Desktop, Cursor, etc.).
- **Zero-Config Setup**: `npx -y @sovseal/mcp-server` works immediately without API keys, accounts, or sign-ups.
- **End-to-End Encryption**: Integrates AES-256-GCM encryption client-side, ensuring your cloud backup is entirely zero-knowledge.
