/**
 * JSON envelope helpers — canonicalize → AES-GCM → packed Uint8Array, and back.
 */

import { canonicalize } from "./canonicalize.js";
import { CryptoService } from "./aes-gcm.js";

/**
 * Encrypt any JSON-serializable value. The value is JCS-canonicalized
 * before encryption so the ciphertext is deterministic given the same
 * key and IV.
 */
export async function encryptJson<T>(
  value: T,
  key: CryptoKey,
): Promise<Uint8Array> {
  const canonical = canonicalize(value);
  const bytes = new TextEncoder().encode(canonical);
  const enc = await CryptoService.encryptBytes(bytes, key);
  return CryptoService.pack(enc);
}

/** Inverse of `encryptJson`. */
export async function decryptJson<T = unknown>(
  blob: Uint8Array,
  key: CryptoKey,
): Promise<T> {
  const enc = CryptoService.unpack(blob);
  const plaintext = await CryptoService.decryptBytes(enc, key);
  const text = new TextDecoder().decode(plaintext);
  return JSON.parse(text) as T;
}
