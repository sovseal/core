# SovSeal — AI Agent Guide

> **Last Updated:** 2026-05-12
> **Brand:** SovSeal — agentic state continuity (formerly the Inheribase B2C inheritance protocol)
> **Public product:** `@sovseal/mcp-server` on npm, edge fn live at `https://ksrlmubaxzwufziwarps.supabase.co/functions/v1/v2-agent-state`
> **Product context:** `.agent/context/product-truth.md` (positioning, terminology, doc paths)
> **Agent directives:** `.agent/memory/global.md` (behavioral rules, observability)

---

## Active Product (2026-05-12) — SovSeal MCP Platform

The shipping product is `@sovseal/mcp-server`: a local stdio MCP server that gives AI agents (Claude Desktop, Cursor, etc.) encrypted, decentralized memory. Three packages back it:

| Package | NPM Name | Role |
|---|---|---|
| `packages/sovseal-mcp-server/` | `@sovseal/mcp-server` | Published stdio MCP server (`npx @sovseal/mcp-server`) |
| `packages/inheribase-node-sdk/` | `@sovseal/sdk` | HTTP client for the snapshot/restore protocol |
| `packages/core-protocol/` | `@inheribase/core-protocol` | Pure-TS crypto / pricing / Arweave primitives, dual-loaded by Node and Deno |

Cloud endpoint: `https://ksrlmubaxzwufziwarps.supabase.co/functions/v1/v2-agent-state` (Supabase project `sovseal`, ref `ksrlmubaxzwufziwarps`). Persistence: `agent_state_snapshots` table + `sovseal-rom` public Storage bucket. Auth: dual-mode — `sov_live_<api_key>` (DB-backed, paid) and `sov_proj_<uuid v4>` (self-asserting, free).

Everything below this section describes the broader monorepo, which still contains the legacy Inheribase B2C inheritance product (vaults / heirs / guardians / dashboard / marketing). That surface remains for historical reasons; new product work targets the SovSeal MCP platform unless explicitly directed otherwise.

---

## Project Structure

```
sovseal/
├── packages/                                # Active MCP platform (the SovSeal launch)
│   ├── sovseal-mcp-server/   # @sovseal/mcp-server  — npm-published stdio MCP server
│   ├── inheribase-node-sdk/  # @sovseal/sdk         — HTTP client for the edge fn
│   ├── core-protocol/        # @inheribase/core-protocol — crypto + pricing primitives
│   ├── config/               # Shared ESLint, TypeScript configs
│   ├── contracts/            # Solidity smart contracts (Foundry) — legacy
│   ├── sdk/                  # Legacy TS SDK (separate from @sovseal/sdk)
│   └── ui/                   # Shared UI component library (legacy B2C)
│
├── supabase/                                # Cloud project: ksrlmubaxzwufziwarps (sovseal)
│   ├── functions/v2-agent-state/   # Live edge fn (snapshot / restore / lineage)
│   ├── functions/main/             # Legacy B2C edge fn (deprecated, not deployed)
│   └── migrations/                 # Includes agent_state_snapshots schema
│
├── apps/                                    # Legacy B2C surface (predates the pivot)
│   ├── dashboard/                  # Vault dashboard — separate roadmap
│   ├── marketing/                  # Marketing site — separate roadmap
│   ├── docs/                       # Fumadocs — separate roadmap
│   ├── playground/                 # Dev playground
│   └── status/                     # Status page
│
├── contract/                                # Smart contract dev (Foundry only) — legacy
│   ├── contracts/                  # Solidity source
│   ├── script/                     # Deployment scripts (Forge)
│   └── test/                       # Solidity fuzzed tests (Forge)
│
├── scripts/                                 # Build, cron, ops utilities
│   └── cron/                       # Scheduled jobs (DMS, releases, credits — legacy)
│
├── tests/                                   # Root-level integration tests
├── types/                                   # Root-level type definitions
└── tools/                                   # MCP tools, ops configs
```

---

## Technology Stack

| Layer           | Technology                                                                                | Notes                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard       | Vite + React 19 + React Router DOM                                                        | SPA, vanilla CSS                                                                                                               |
| Marketing       | Next.js 15 (App Router)                                                                   | Static export                                                                                                                  |
| Docs            | Fumadocs                                                                                  | MDX-based                                                                                                                      |
| Backend         | Supabase Edge Functions (Deno + Hono)                                                     | All API routes                                                                                                                 |
| Storage         | Arweave                                                                                   | Permanent, server-side via Edge Functions                                                                                      |
| Auth            | Alchemy Account Kit                                                                       | Smart Accounts (ERC-4337)                                                                                                      |
| Chain           | Base Mainnet (8453)                                                                       | Primary L2                                                                                                                     |
| Contracts       | Solidity 0.8.20                                                                           | Foundry only                                                                                                                   |
| Encryption      | Web Crypto API (AES-256-GCM)                                                              | Client-side only                                                                                                               |
| Rate Limiting   | Upstash Redis                                                                             | All API routes                                                                                                                 |
| Payments        | Polar (cards, MoR) · MoonPay (crypto USDC on Base) · Direct sovereign transfer (on-chain) | Vault Credits — see [`apps/docs/content/docs/pricing/payment-methods.mdx`](apps/docs/content/docs/pricing/payment-methods.mdx) |
| Hosting         | Cloudflare Pages (all apps) · Cloudflare DNS/CDN                                          | Full infrastructure consolidated on Cloudflare Edge                                                                            |
| Package Manager | pnpm 10+                                                                                  | Monorepo workspaces                                                                                                            |
| Task Runner     | Turborepo                                                                                 | Parallel builds                                                                                                                |

---

## Executive Execution Protocol (MANDATORY)

To ensure reliable command execution across environments, follow the **[COMMAND_GUIDE.md](file:///Users/radebe49/futureproof/COMMAND_GUIDE.md)**.

> [!IMPORTANT]
> **The Fail-Safe Execution Rule**
> Always inject standard Mac paths into your `PATH` before running core binaries:
> `export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" && pnpm <command>`

1. **NPM over ETC**: NEVER run raw binaries (e.g., `node`, `tsx`, `forge`, `python3`) directly if a script exists in `package.json`. Always use `pnpm run <command>`.
2. **The Export PATH Way**: When running local tools not in an NPM script, export the local bin path:
   `export PATH=$PATH:$(pwd)/node_modules/.bin`
3. **Verification**: Always confirm command success with a follow-up check.

---

## Commands

**All applications** (Dashboard, Marketing, Docs, Status) are deployed to **Cloudflare Pages** via automated GitHub triggers. **Cloudflare** handles DNS/CDN proxying and edge routing for the entire protocol.

### Vercel "Standard Monorepo Rule"

All Vercel projects must point to the **Repository Root** (`.`) as their "Root Directory." This is because our custom build orchestration relies on root-level tools and configuration.

| Goal                      | Requirement                           | Rationale                                                                                    |
| ------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Vercel Root Directory** | **`.` (Root)**                        | Allows `scripts/vercel-build.sh` to run at the top level and resolve workspace dependencies. |
| **Build Command**         | `npm run build`                       | Triggers the root's `vercel-build.sh` script via `package.json`.                             |
| **Output Directory**      | `.next` (Next apps) / `public` (Vite) | The staging script copies the specific app's artifacts back to the repo root after building. |

> [!WARNING]
> DO NOT set the "Root Directory" to `apps/docs` (etc.) in Vercel settings. This will cause **path doubling** (`apps/docs/apps/docs`) and break the custom build script's pathing.

---

## Commands

```bash
# Development
pnpm dev                  # All apps
pnpm dev:dashboard        # Dashboard only (port 5173)
pnpm dev:marketing        # Marketing only (port 3000)
pnpm dev:docs             # Docs only
pnpm dev:status           # Status page (port 3002)

# Deployment
# All apps are automatically deployed by Cloudflare Pages on push to the 'main' branch.
# To push changes:
# git add . && git commit -m "message" && git push origin main

# Build & Quality
pnpm build                # All apps
pnpm lint                 # Lint all
pnpm typecheck            # Type check all
pnpm format               # Prettier

# Testing
pnpm test                 # Vitest (once)
pnpm test:watch           # Watch mode
pnpm test:coverage        # Coverage report
cd contract && forge test # Solidity tests

# Cron & Ops
pnpm cron:all             # Run all cron jobs
pnpm cron:dry-run         # Dry run mode
pnpm daemon               # Orchestrator daemon

# Maintenance
pnpm fix:conversations    # Rebuild Antigravity conversation index
```

---

## Smart Contracts (Base Mainnet)

| Contract             | Address                                      | Network      | Status                            |
| -------------------- | -------------------------------------------- | ------------ | --------------------------------- |
| **InheribaseAnchor** | `0xf43e5cC7a7fCF115B573CfF92273B762Bb12C3c7` | Base Mainnet | Production                        |
| **SovereignCredit**  | `0x7a8F8E51be01E75D6779E513Ecb01d4a739afd15` | Base Sepolia | Credit minting (payments-webhook) |
| FutureProof          | `0xC9fe1212894a8722b9990D9Da0Dc43c5a141D088` | Base Mainnet | Legacy                            |
| InheribaseRecovery   | `0xEefC234d7b96d34Fac568Ea661A1537f690DAfa7` | Base Mainnet | Legacy                            |

---

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variable groups:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Alchemy Account Kit
VITE_ALCHEMY_API_KEY=
VITE_ALCHEMY_GAS_POLICY_ID=
NEXT_PUBLIC_PIMLICO_API_KEY=

# Smart Contracts
VITE_INHERIBASE_ANCHOR_ADDRESS=0xf43e5cC7a7fCF115B573CfF92273B762Bb12C3c7

# Network
VITE_NETWORK=base
VITE_RPC_URL=https://mainnet.base.org

# Payments
POLAR_API_TOKEN=
POLAR_WEBHOOK_SECRET=
COINBASE_COMMERCE_API_KEY=
COINBASE_COMMERCE_WEBHOOK_SECRET=

# Rate limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Storage (R2 / S3)
S3_BUCKET_NAME=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT=

# Communications
RESEND_API_KEY=
FROM_EMAIL=
TELNYX_API_KEY=
TELNYX_PHONE_NUMBER=
AT_API_KEY=
AT_USERNAME=

# Monitoring
CHECKLY_API_KEY=
CHECKLY_ACCOUNT_ID=

# Cron
CRON_SECRET=
```

---

## Code Style

| Convention | Pattern                                       | Example                           |
| ---------- | --------------------------------------------- | --------------------------------- |
| Components | PascalCase                                    | `VaultStatusBadge`                |
| Functions  | camelCase                                     | `connectWallet`                   |
| Constants  | UPPER_SNAKE_CASE                              | `MAX_FILE_SIZE`                   |
| Imports    | Absolute with `@/`                            | `import { X } from "@/lib/utils"` |
| Formatting | Prettier (2-space, semicolons, double quotes) | `pnpm format`                     |

- TypeScript strict mode — avoid `any`
- Functional React components with hooks
- JSDoc for public functions
- Run `pnpm format` before committing

---

## Security Rules

1. **Never** transmit plaintext media or encryption keys — all crypto is client-side
2. **Clear** sensitive data from memory after use
3. **Validate** all inputs (timestamps, addresses, hashes)
4. **Rate limit** all API routes via Upstash Redis
5. **Require** `CRON_SECRET` header for all cron endpoints

---

## Testing

- **Vitest** + **Happy DOM** for unit/integration
- **@testing-library/react** for components
- **Playwright** for E2E
- **Foundry** (`forge test`) for Solidity

Test locations:

- `tests/` — Root integration tests
- `packages/*/src/**/*.test.ts` — Package tests
- `contract/test/` — Solidity tests

---

_For human contributors, see `CONTRIBUTING.md`. For product context, see `.agent/context/product-truth.md`._
