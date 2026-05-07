/**
 * DeepLinkHandler — parses `?token=` (or `/onboard/v/<token>`) from the
 * current URL, calls the backend `/v2/onboarding/sessions/{token}/consume`
 * endpoint, and bootstraps {@link VideoOnboardingClient}.
 *
 * The backend is expected to expose Phase 12 controller at the given
 * {@link DeepLinkHandlerOptions.apiBaseUrl}.
 */

import { VideoOnboardingClient, VideoOnboardingOptions } from './VideoOnboardingClient';

export interface DeepLinkHandlerOptions {
  /** Backend base URL, e.g. https://api.swfte.com */
  apiBaseUrl: string;
  /** Optional override for where to read the token from — defaults to window.location. */
  url?: string;
  localVideoEl?: HTMLVideoElement;
  remoteVideoEl?: HTMLVideoElement;
  onLog?: (msg: string) => void;
}

export interface ConsumeResponse {
  access_token: string;
  room: string;
  endpoint: string;
  workspaceId?: string;
  flowId?: string;
  userId?: string;
  priorSessionId?: string;
}

export class DeepLinkHandler {
  constructor(private opts: DeepLinkHandlerOptions) {}

  /** Extract the token from a URL's `?token=` param or `/onboard/v/<token>` path. */
  static extractToken(rawUrl: string): string | null {
    try {
      const u = new URL(rawUrl);
      const q = u.searchParams.get('token');
      if (q) return q;
      const m = u.pathname.match(/\/onboard\/v\/([^\/?#]+)/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }

  /** Run the full deep-link flow: parse, consume, connect. */
  async run(): Promise<VideoOnboardingClient> {
    const log = this.opts.onLog ?? ((m: string) => console.debug('[DeepLinkHandler]', m));
    const urlStr =
      this.opts.url ??
      (typeof window !== 'undefined' ? window.location.href : '');
    const token = DeepLinkHandler.extractToken(urlStr);
    if (!token) throw new Error('No onboarding token in URL');

    const resp = await fetch(
      `${this.opts.apiBaseUrl.replace(/\/+$/, '')}/v2/onboarding/sessions/${encodeURIComponent(token)}/consume`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    );
    if (!resp.ok) {
      throw new Error(`consume failed: ${resp.status} ${await resp.text()}`);
    }
    const body = (await resp.json()) as ConsumeResponse;
    log(`consumed token; room=${body.room} endpoint=${body.endpoint}`);

    const client = new VideoOnboardingClient();
    const connectOpts: VideoOnboardingOptions = {
      url: body.endpoint,
      token: body.access_token,
      localVideoEl: this.opts.localVideoEl,
      remoteVideoEl: this.opts.remoteVideoEl,
      onLog: this.opts.onLog,
    };
    await client.connect(connectOpts);
    return client;
  }
}
