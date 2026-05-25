# Changelog — @sovseal/mcp-server

## 0.3.2 — 2026-05-25

### Changed

- **Rewrote `store_memory` and `recall_memory` tool descriptions** to drive proactive memory use without requiring users to explicitly say "store this," and to lean into the privacy-first differentiator. Previous descriptions used opinionated language ("CRITICAL", "MUST") but listed only developer-centric categories (API keys, architectural decisions, project knowledge), which biased the assistant toward firing only on coding contexts. The new descriptions:
  - **Lead with the zero-knowledge differentiator.** Sovseal is the only memory tool where storing sensitive context (credentials, health data, legal matters, financial details, NDA-covered work, mental health context, internal company processes) is safe, because AES-256-GCM encryption happens on-device before anything leaves the process. The tool description tells the assistant to treat this as license to store sensitive content without hesitation.
  - **Broadened categories** to cover the full set every leading memory tool targets: preferences, personal details, plans, professional context, health and routines, relationships, plus the existing dev-context items — and an explicit sensitive-context subcategory that other tools cannot safely hold.
  - **Specified concrete trigger phrases.** Inspired by The Mom Test ("watch what people actually do/say, not what they tell you they value"), the description enumerates the user phrasings that should trigger storage — `"I am / I'm a / I work at"`, `"I prefer / I always / I never"`, `"between us / confidentially / don't repeat"`, etc. This gives the assistant unambiguous behavioral cues rather than vague intent.
  - **Per-turn cadence.** `store_memory`: "call FIRST, then respond." `recall_memory`: "call BEFORE composing ANY response, including the first message of a new conversation."
  - **Greedy invocation, justified by architecture.** "Over-storing is harmless (server de-duplicates); under-storing loses context permanently." "Over-recall is invisible; under-recall is the failure mode users feel." Matches mem0's and Supermemory's aggressive published prompts but grounded in sovseal's actual cost model (0 RTT recall, write-behind store).
  - **Output style guidance.** Stored content is third-person self-contained statements ("User is allergic to peanuts" not "I'm allergic"). Recalled matches are woven into responses without announcing the lookup ("based on your memory…" is banned).

No behavior change in the underlying storage, replication, or embedding stack. Tool descriptions are the only diff between 0.3.1 and 0.3.2.

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
