/**
 * NativeBridge — owns the long-lived Native Messaging port to com.sovseal.host.
 *
 * A persistent port (vs. one-shot sendNativeMessage) keeps the on-device
 * engine warm: LanceDB stays open and the embedding pipeline is warmed once,
 * so recalls hit the 0-RTT warm path (~6 ms) instead of paying cold start
 * every call. Requests are correlated to responses by a monotonic id, exactly
 * matching the host's `{ id, ok, data }` reply envelope.
 */

const HOST_NAME = "com.sovseal.host";
const REQUEST_TIMEOUT_MS = 20_000;

interface HostResponse {
  id: number;
  ok: boolean;
  data?: unknown;
  error?: string;
}

interface Pending {
  resolve: (r: HostResponse) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class NativeBridge {
  private port: chrome.runtime.Port | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  /** Last disconnect reason, surfaced to the popup as install guidance. */
  public lastError: string | null = null;

  private connect(): chrome.runtime.Port {
    if (this.port) return this.port;
    const port = chrome.runtime.connectNative(HOST_NAME);
    port.onMessage.addListener((raw: unknown) => {
      const msg = raw as HostResponse;
      if (typeof msg?.id !== "number") return;
      const p = this.pending.get(msg.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(msg.id);
      p.resolve(msg);
    });
    port.onDisconnect.addListener(() => {
      this.lastError =
        chrome.runtime.lastError?.message ?? "native host disconnected";
      this.port = null;
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.resolve({ id: -1, ok: false, error: this.lastError });
      }
      this.pending.clear();
    });
    this.port = port;
    return port;
  }

  /**
   * Send one request and await its correlated reply. Reconnects transparently
   * if the port was dropped (e.g. host crash, SW restart).
   */
  request(type: string, args: Record<string, unknown> = {}): Promise<HostResponse> {
    return new Promise((resolve) => {
      let port: chrome.runtime.Port;
      try {
        port = this.connect();
      } catch (e) {
        this.lastError = e instanceof Error ? e.message : String(e);
        resolve({ id: -1, ok: false, error: this.lastError });
        return;
      }
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ id, ok: false, error: "native host timed out" });
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve, timer });
      try {
        port.postMessage({ id, type, ...args });
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        this.lastError = e instanceof Error ? e.message : String(e);
        this.port = null;
        resolve({ id, ok: false, error: this.lastError });
      }
    });
  }
}
