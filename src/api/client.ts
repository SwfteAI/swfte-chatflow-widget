import type {
  ChatFlowConfig,
  ProcessInputResponse,
  SessionStateResponse,
} from '../types';

/**
 * Client-side API that calls the mounted Next.js handler.
 * No API keys — the handler handles auth server-side.
 */
export class ChatFlowApi {
  private endpoint: string;
  private headers: Record<string, string>;
  private timeout: number;

  constructor(config: ChatFlowConfig) {
    this.endpoint = config.endpoint.replace(/\/+$/, '');
    this.timeout = config.timeout ?? 30_000;
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.endpoint}${path}`, {
        ...init,
        headers: { ...this.headers, ...((init?.headers as Record<string, string>) ?? {}) },
        signal: controller.signal,
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw Object.assign(new Error(body.error || `API ${res.status}`), {
          status: res.status,
          retryable: res.status >= 500,
        });
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Create a new ChatFlow session.
   *
   * Emits a stable {@code browserId} (UUIDv4 persisted in localStorage) so the
   * server-side {@code SpeakerRegistry} can cross-call-recognize the same user
   * across sessions + devices. Server treats it as the {@code channelKey} on
   * the WEB channel. Silently omitted when localStorage is unavailable
   * (SSR, sandboxed iframe). */
  async createSession(prefilledData?: Record<string, unknown>): Promise<{ sessionId: string }> {
    const browserId = getOrCreateBrowserId();
    return this.request('/start', {
      method: 'POST',
      body: JSON.stringify(browserId ? { prefilledData, browserId } : { prefilledData }),
    });
  }

  /** Send user input to the active session */
  async sendInput(sessionId: string, input: string): Promise<ProcessInputResponse> {
    return this.request('/input', {
      method: 'POST',
      body: JSON.stringify({ sessionId, input }),
    });
  }

  /** Get current session state */
  async getSession(sessionId: string): Promise<SessionStateResponse> {
    return this.request(`/session/${sessionId}`);
  }
}

/**
 * Stable per-browser UUID, persisted in localStorage. Used as the
 * SpeakerRegistry channelKey for cross-session voiceprint recognition.
 * Returns null when localStorage isn't available (SSR, private iframe,
 * quota exceeded) so the server can fall back to sessionId-only scoping.
 */
function getOrCreateBrowserId(): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const KEY = 'swfte.chatflow.browserId';
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto && 'randomUUID' in crypto)
          ? crypto.randomUUID()
          : `bid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
