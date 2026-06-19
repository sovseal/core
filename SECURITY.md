# Security Policy

## Scope
This policy covers the core sovseal protocol, including but not limited to:
- `@sovseal/mcp-server`
- `@sovseal/sdk`
- The browser extension (`apps/extension`)
- Self-hosted edge endpoints (e.g. `supabase/functions/v2-agent-state/`)

## Reporting a Vulnerability
We take the security of the zero-knowledge memory architecture very seriously.

If you discover a vulnerability, please report it via email to [security@sovseal.com](mailto:security@sovseal.com).

Please provide:
- A description of the vulnerability and its impact
- Steps to reproduce the issue
- Any proposed remediation

## Disclosure Window
We ask that you allow us a **90-day disclosure window** to resolve the issue before publishing details of the vulnerability. We will acknowledge your report within 48 hours and keep you updated on our progress.

## Safe Harbor
We will not pursue legal action against security researchers who:
- Test systems within the scope of this policy without impacting other users' data.
- Do not exploit the vulnerability beyond what is necessary to demonstrate it.
- Allow us the 90-day window to remediate the issue before public disclosure.
- Make a good faith effort to avoid privacy violations, data destruction, and interruption or degradation of our service.

---

# Threat Model & Security Status

We believe a privacy product earns trust by publishing what is protected, what is not yet protected, and who carries each risk — before anyone has to discover it themselves. This section is the authoritative version of the status table in the README, maintained against an internal security review of the codebase.

## Architecture in one paragraph

All memory capture, embedding (pinned on-device MiniLM, quantized ONNX), and vector search run locally. The local store is LanceDB under `~/.sovseal/db` (created `0700`). As of v0.3.5 the memory text is **encrypted at rest**: each record's content is sealed with AES-256-GCM (12-byte random IV, AAD binding the ciphertext to its record id and schema version) before the database write, and decrypted only on read — the embedding vector is computed on the plaintext beforehand, so search is unaffected. The 32-byte master key lives in the **OS keychain** (macOS Keychain / Windows Credential Manager / Linux libsecret), never in a config file; two purpose-bound subkeys are derived from it via HKDF-SHA256 (`sovseal/at-rest/v1` for local sealing, `sovseal/sync/v1` for replication) so the two domains are cryptographically independent. The on-device embedding model is verified against SHA-256 pins **before it is loaded**, including the first-run download. Replication is optional and write-behind: payloads are encrypted with AES-256-GCM (96-bit random IV per snapshot) **on the device** before transmission; the sync server stores ciphertext and content hashes only and holds no decryption keys. Integrity is enforced by Verified Semantic Recall: every load re-derives `sha256(canonicalize(payload))` and fails closed on mismatch.

## What holds today

| Guarantee | Mechanism |
|---|---|
| Sync server cannot read your memories | Client-side AES-256-GCM before any byte leaves the device; server stores ciphertext + hashes |
| Local store is encrypted at rest | Memory content sealed with AES-256-GCM (per-record IV, id-bound AAD) before the database write; decrypted only on read |
| Master key never sits in a file | Key held in the OS keychain; HKDF domain separation between the at-rest and sync subkeys |
| Model cannot be tampered before it runs | SHA-256 pins on the embedding bundle are verified before load, including the first-run download (abort + re-download on mismatch) |
| No third-party processing of your text | Embeddings computed on-device by a version-pinned, hash-checked model; no embedding or extraction API calls |
| Tamper detection on recall | VSR content hashing, fail-closed |
| Storage path privacy | Object paths are SHA-256-derived; unguessable without your `project_id` |
| Query-predicate injection resistance | Identifier sanitization on memory IDs in delete/sync paths |

## Known gaps and remediation timeline

These are open findings from our internal review, published deliberately. If your threat model includes any of the attackers below, read this table before depending on sovseal.

| # | Finding | Risk carried today | Status |
|---|---|---|---|
| 1 | **Local store is encrypted at rest.** Memory content is sealed with field-level AES-256-GCM (per-record 12-byte IV, AAD bound to record id + schema version) before the database write, decrypted only on read. *Residual:* the embedding **vector** is still stored in the clear — it leaks semantic similarity but not verbatim text; full vector encryption is a tracked follow-up. | Home-directory read no longer yields memory text. Zero-knowledge now holds against local filesystem read for content, not only the server. | ✅ Shipped in v0.3.5: field-level AES-256-GCM encryption of memory content before the database write |
| 2 | **Master key custody.** The 32-byte master key is held in the OS keychain (macOS Keychain / Windows Credential Manager / Linux libsecret); the legacy `config.json` key is migrated out on first run and replaced with a tombstone. A warned file fallback (`SOVSEAL_KEY_FALLBACK=file`, `0600`) exists for headless Linux. | With keychain custody, home-directory file read alone no longer yields the key. (The opt-in file fallback re-opens this risk and warns loudly.) | ✅ Shipped in v0.3.5: OS keychain custody with HKDF domain separation (`sovseal/at-rest/v1` vs `sovseal/sync/v1`) |
| 3 | **No programmatic secret redaction.** The instruction not to store credentials is enforced at the prompt level only; nothing in code scans content before it is written. | A confused or adversarially prompted model can persist API keys or passwords into the local store. With finding 1 closed, such secrets are now encrypted at rest, but they are still embedded and replicated. | 🔄 Still prompt-level only. Fix tracked: code-enforced redaction pass (structural patterns + entropy scan) running before embedding and before any write |
| 4 | **Model integrity verified before load.** SHA-256 pins on the embedding bundle (config + tokenizer + tokenizer_config + ONNX) are checked before the runtime instantiates the model, and the first-run download is fetched and verified before use; a mismatch aborts and removes the file so the next run re-downloads. | A tampered local or downloaded model file is rejected before it can execute. | ✅ Shipped in v0.3.5: unconditional verify-before-load on all pinned files, including the first-run download path |
| 5 | **Key loss (Hobby/Starter/Growth).** Escrow-free, sovereign custody only. | Lose `~/.sovseal/config.json` and every synced snapshot is permanently unreadable. | ✋ By design. Back up your config file. On these plans, we cannot help you recover it. |
| 6 | **Managed Key Recovery (Pro/Enterprise).** Key recovery via permissioned split-shares. | Keys are split and managed via Shamir-split escrow (Pro) or HSM-backed custody (Enterprise) to prevent permanent loss. | ✅ Paid custody feature. Reconstruct keys securely without violating central trust boundaries. |

As of v0.3.5, findings 1, 2, and 4 are closed (at-rest content encryption, OS-keychain key custody, and verify-before-load). Finding 3 (programmatic secret redaction) remains open and is enforced at the prompt level only — do not paste credentials into AI conversations that have memory capture enabled. Defense-in-depth still recommended: enable full-disk encryption (FileVault / BitLocker), exclude `~/.sovseal` from cloud-synced backup tools, and prefer the OS keychain over the `SOVSEAL_KEY_FALLBACK=file` option.

## What we will never do

- Hold keys that can decrypt user content without client split-share authorization.
- Add a recovery backdoor to the sync tier.
- Send memory plaintext to any third-party API, including for "smart" extraction features.

Changes to this document are tracked in git history; the v0.3.5 remediation items above are tracked in [CHANGELOG.md](./CHANGELOG.md) and the issue tracker.
