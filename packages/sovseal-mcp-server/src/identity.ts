import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_ENDPOINT =
  "https://ksrlmubaxzwufziwarps.supabase.co/functions/v1/v2-agent-state";
export const SCHEMA_VERSION = 1 as const;

const TOKEN_PREFIX = "sov_proj_";

export interface Identity {
  schemaVersion: typeof SCHEMA_VERSION;
  projectId: string;
  apiKey: string;
  encryptionKey: CryptoKey;
  endpoint: string;
}

export interface IdentityOptions {
  /** Defaults to `~/.sovseal`. */
  configDir?: string;
  /** Defaults to env `SOVSEAL_ENDPOINT` or {@link DEFAULT_ENDPOINT}. */
  endpoint?: string;
}

interface IdentityFileV1 {
  schema_version: 1;
  project_id: string;
  api_key: string;
  encryption_key_b64: string;
  endpoint: string;
  created_at: string;
}

export async function getOrCreateIdentity(opts: IdentityOptions = {}): Promise<Identity> {
  const configDir = opts.configDir ?? join(homedir(), ".sovseal");
  const configPath = join(configDir, "config.json");
  const endpoint =
    opts.endpoint ?? process.env.SOVSEAL_ENDPOINT ?? DEFAULT_ENDPOINT;

  const existing = await tryRead(configPath);
  if (existing) {
    if (existing.schema_version !== SCHEMA_VERSION) {
      throw new Error(
        `[sovseal] config schema_version ${existing.schema_version} unsupported (expected ${SCHEMA_VERSION})`,
      );
    }
    const encryptionKey = await importRawKey(existing.encryption_key_b64);
    return {
      schemaVersion: SCHEMA_VERSION,
      projectId: existing.project_id,
      apiKey: existing.api_key,
      encryptionKey,
      endpoint: existing.endpoint || endpoint,
    };
  }

  const projectId = crypto.randomUUID();
  const apiKey = `${TOKEN_PREFIX}${projectId}`;
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const encryptionKey = await importRaw(rawKey);

  const file: IdentityFileV1 = {
    schema_version: SCHEMA_VERSION,
    project_id: projectId,
    api_key: apiKey,
    encryption_key_b64: bytesToBase64(rawKey),
    endpoint,
    created_at: new Date().toISOString(),
  };

  await mkdir(configDir, { recursive: true, mode: 0o700 });
  await writeFile(configPath, JSON.stringify(file, null, 2), {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await chmod(configPath, 0o600);

  console.error(
    `[sovseal-mcp-server] identity created at ${configPath} (project_id length=${projectId.length})`,
  );

  return { schemaVersion: SCHEMA_VERSION, projectId, apiKey, encryptionKey, endpoint };
}

async function tryRead(path: string): Promise<IdentityFileV1 | null> {
  try {
    const text = await readFile(path, "utf8");
    return JSON.parse(text) as IdentityFileV1;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function importRawKey(b64: string): Promise<CryptoKey> {
  return importRaw(base64ToBytes(b64));
}

async function importRaw(bytes: Uint8Array): Promise<CryptoKey> {
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return crypto.subtle.importKey(
    "raw",
    ab,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}
