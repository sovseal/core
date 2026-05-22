/**
 * CryptoService — AES-256-GCM encryption for the SovSeal protocol.
 *
 * Uses Web Crypto API for cross-runtime compatibility (Node 20+, Deno, Bun, Workers).
 * All encryption is performed client-side for true zero-knowledge security.
 */

export interface EncryptedData {
  /** The encrypted ciphertext */
  ciphertext: ArrayBuffer;
  /** Initialization vector (12 bytes for AES-GCM) */
  iv: Uint8Array;
  /** Encryption algorithm used */
  algorithm: "AES-GCM";
  /** Key length in bits */
  keyLength: 256;
}

export interface EncryptionMetadata {
  algorithm: "AES-GCM";
  keyLength: 256;
  ivLength: 12;
  tagLength: 16;
}

export class CryptoService {
  static readonly ALGORITHM = "AES-GCM";
  static readonly KEY_LENGTH = 256;
  static readonly IV_LENGTH = 12;
  static readonly TAG_LENGTH = 16;

  static async generateAESKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      true,
      ["encrypt", "decrypt"],
    );
  }

  static async encryptBytes(
    plaintext: Uint8Array | ArrayBuffer,
    key: CryptoKey,
  ): Promise<EncryptedData> {
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    const buf =
      plaintext instanceof Uint8Array
        ? plaintext.buffer.slice(
            plaintext.byteOffset,
            plaintext.byteOffset + plaintext.byteLength,
          )
        : plaintext;
    const ciphertext = await crypto.subtle.encrypt(
      { name: this.ALGORITHM, iv, tagLength: this.TAG_LENGTH * 8 },
      key,
      buf,
    );
    return { ciphertext, iv, algorithm: "AES-GCM", keyLength: 256 };
  }

  static async decryptBytes(
    encrypted: EncryptedData,
    key: CryptoKey,
  ): Promise<ArrayBuffer> {
    return await crypto.subtle.decrypt(
      {
        name: this.ALGORITHM,
        iv: encrypted.iv,
        tagLength: this.TAG_LENGTH * 8,
      },
      key,
      encrypted.ciphertext,
    );
  }

  static async exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    return await crypto.subtle.exportKey("raw", key);
  }

  static async importKey(keyData: ArrayBuffer): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      true,
      ["encrypt", "decrypt"],
    );
  }

  /** Pack `IV || ciphertext` into one Uint8Array suitable for transport. */
  static pack(encrypted: EncryptedData): Uint8Array {
    const ct = new Uint8Array(encrypted.ciphertext);
    const out = new Uint8Array(encrypted.iv.length + ct.length);
    out.set(encrypted.iv, 0);
    out.set(ct, encrypted.iv.length);
    return out;
  }

  /** Inverse of `pack`: split a transported blob back into iv + ciphertext. */
  static unpack(blob: Uint8Array): EncryptedData {
    return {
      iv: blob.slice(0, this.IV_LENGTH),
      ciphertext: blob.slice(this.IV_LENGTH).buffer,
      algorithm: "AES-GCM",
      keyLength: 256,
    };
  }

  static async sha256Hex(data: Uint8Array | ArrayBuffer): Promise<string> {
    const buf =
      data instanceof Uint8Array
        ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
        : data;
    const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  static getMetadata(): EncryptionMetadata {
    return { algorithm: "AES-GCM", keyLength: 256, ivLength: 12, tagLength: 16 };
  }
}
