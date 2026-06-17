/**
 * Shared identifiers for the sovseal Native Messaging bridge.
 *
 * EXTENSION_ID is the deterministic Chrome extension ID derived from the
 * pinned public key in `apps/extension/public/manifest key` (the `key`
 * field of the extension manifest). It MUST stay in lock-step with that
 * key — regenerating one without the other breaks the native-messaging
 * `allowed_origins` trust check. The keypair lives in `extension-key.pem`.
 */
export const HOST_NAME = "com.sovseal.host";
export const EXTENSION_ID = "bhldhhlkfohfogchnnonijocoolmamhm";
