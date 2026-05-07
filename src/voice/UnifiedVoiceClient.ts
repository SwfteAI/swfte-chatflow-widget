/**
 * UnifiedVoiceClient — host-facing facade that owns the V2->V1 fallback.
 *
 * WHY this exists as a separate class instead of inline in the provider:
 *   - The React provider would otherwise need to juggle two refs, two
 *     cleanup paths, and two different "is-starting" flags; any mistake
 *     leaks a WebSocket or a peer connection.
 *   - Fallback policy is a single-turn retry: on specific WebRtcConnectError
 *     reasons (whip_4xx/5xx, ice_timeout, dtls_failed, sdp_rejected) we
 *     tear down V2 and attempt V1. Any other failure (user_media, thrown
 *     by either transport once running) surfaces to the host.
 *
 * The host always sees the same VoiceEvent stream + the same start(audioEl)
 * / stop() signature regardless of which transport is live.
 */

import {
  WebRtcVoiceClient,
  WebRtcConnectError,
  type WebRtcVoiceClientConfig,
  type VoiceEvent,
} from './WebRtcVoiceClient';
import {
  LegacyWebSocketVoiceClient,
  type LegacyWebSocketVoiceClientConfig,
} from './LegacyWebSocketVoiceClient';
import type { VoiceRuntimeVersion } from '../types';

export interface UnifiedVoiceClientConfig {
  /** Desired runtime. V2 tries WebRTC first then falls back. V1 goes straight to WS. */
  runtimeVersion: VoiceRuntimeVersion;
  /**
   * Base URL of the agents-service for WHIP offers (V2). For V2-first we
   * derive the WS URL from this (https -> wss + /v2/voice/web/ws) unless
   * wsUrl is set explicitly.
   */
  whipEndpoint: string;
  /** Explicit V1 WebSocket URL. Required if runtimeVersion is V1; optional for V2 fallback. */
  wsUrl?: string;
  chatFlowId: string;
  workspaceId: string;
  sessionId: string;
  apiKey?: string;
  iceTimeoutMs?: number;
  onEvent: (e: VoiceEvent) => void;
}

type ReasonsThatFallBack = Extract<
  WebRtcConnectError['reason'],
  'whip_4xx' | 'whip_5xx' | 'ice_timeout' | 'dtls_failed' | 'sdp_rejected'
>;

const FALLBACK_REASONS: ReadonlySet<ReasonsThatFallBack> = new Set([
  'whip_4xx',
  'whip_5xx',
  'ice_timeout',
  'dtls_failed',
  'sdp_rejected',
]);

export class UnifiedVoiceClient {
  private active: WebRtcVoiceClient | LegacyWebSocketVoiceClient | null = null;

  constructor(private readonly cfg: UnifiedVoiceClientConfig) {}

  async start(audioEl: HTMLAudioElement): Promise<void> {
    if (this.cfg.runtimeVersion === 'V2') {
      try {
        const v2 = new WebRtcVoiceClient(this.toWebRtcConfig());
        this.active = v2;
        await v2.start(audioEl);
        return;
      } catch (err) {
        if (this.shouldFallBack(err)) {
          // Tell the host BEFORE we kick off the V1 attempt so logs line up.
          this.cfg.onEvent({
            type: 'connection',
            state: 'error',
            detail: 'falling_back_to_v1',
          });
          try { (this.active as WebRtcVoiceClient | null)?.stop(); } catch { /* noop */ }
          this.active = null;
          // Defense in depth: even after v2.stop() clears srcObject, force
          // a fresh load() before V1 attaches its MediaSource so any
          // browser-internal pipeline state from the failed V2 attempt
          // doesn't bleed into V1. Without this, the V2→V1 fallback
          // produces zero audio because audioEl is still in a half-bound
          // state from V2's ontrack.
          try {
            audioEl.srcObject = null;
            audioEl.removeAttribute('src');
            audioEl.load();
          } catch { /* noop */ }
          await this.startV1(audioEl);
          return;
        }
        throw err;
      }
    }
    await this.startV1(audioEl);
  }

  stop(): void {
    try { this.active?.stop(); } catch { /* noop */ }
    this.active = null;
  }

  // ── Internals ─────────────────────────────────────────────────────

  private async startV1(audioEl: HTMLAudioElement): Promise<void> {
    const v1 = new LegacyWebSocketVoiceClient(this.toWsConfig());
    this.active = v1;
    await v1.start(audioEl);
  }

  private toWebRtcConfig(): WebRtcVoiceClientConfig {
    return {
      whipEndpoint: this.cfg.whipEndpoint,
      chatFlowId: this.cfg.chatFlowId,
      workspaceId: this.cfg.workspaceId,
      sessionId: this.cfg.sessionId,
      apiKey: this.cfg.apiKey,
      iceTimeoutMs: this.cfg.iceTimeoutMs,
      onEvent: this.cfg.onEvent,
    };
  }

  private toWsConfig(): LegacyWebSocketVoiceClientConfig {
    return {
      wsUrl: this.cfg.wsUrl ?? deriveWsUrlFromHttp(this.cfg.whipEndpoint),
      chatFlowId: this.cfg.chatFlowId,
      workspaceId: this.cfg.workspaceId,
      sessionId: this.cfg.sessionId,
      apiKey: this.cfg.apiKey,
      onEvent: this.cfg.onEvent,
    };
  }

  private shouldFallBack(err: unknown): boolean {
    if (!(err instanceof WebRtcConnectError)) return false;
    return FALLBACK_REASONS.has(err.reason as ReasonsThatFallBack);
  }
}

/** http(s)://host/agents -> ws(s)://host/agents/v2/voice/web/ws */
function deriveWsUrlFromHttp(httpBase: string): string {
  const trimmed = httpBase.replace(/\/+$/, '');
  const wsBase = trimmed.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  return `${wsBase}/v2/voice/web/ws`;
}
