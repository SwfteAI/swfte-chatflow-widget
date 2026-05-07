/**
 * WebRtcVoiceClient — V2 browser-side voice client.
 *
 * Parallel to the V1 VoiceClient (voice-demo/app/lib/voice-client.ts)
 * but uses RTCPeerConnection + WHIP signaling instead of a raw
 * WebSocket that tunnels PCM frames. Emits the SAME VoiceEvent union
 * so the React dashboard + ChatFlowProvider don't need to branch on
 * which client is in use beyond the factory decision.
 *
 * Flow:
 *   1. getUserMedia (browser AEC/NS/AGC on)
 *   2. new RTCPeerConnection with recvonly audio transceiver for TTS
 *   3. createDataChannel('control') for JSON control frames (transcripts,
 *      vad, eot, metrics, session_state)
 *   4. createOffer / setLocalDescription
 *   5. POST offer SDP to /v2/voice/whip/offer -> get answer SDP
 *   6. setRemoteDescription; ICE handshake runs against the NLB at
 *      {task public IP}:40000; DTLS/SRTP establishes; audio flows.
 *
 * If any step fails or times out, the widget falls back to V1
 * (WebSocket path). The caller (ChatFlowProvider) orchestrates that
 * fallback — this client just throws a typed error.
 */

export type SessionLifecycleState = 'preparing' | 'gpu_warming' | 'gpu_ready' | 'ready';

export type VoiceEvent =
  | { type: 'connection'; state: 'connecting' | 'open' | 'closed' | 'error'; detail?: string }
  | { type: 'mic'; rms: number }
  | {
      type: 'transcript';
      text: string;
      final?: boolean;
      role?: 'user' | 'agent';
      /** Server-side flag-not-drop signal. When true, the transcript is shown
       *  in the rail (so the user sees what STT thought they said) but was NOT
       *  sent to the LLM — extraction was skipped to save cost + avoid garbage.
       *  Render greyed/italic so the user knows it didn't drive the conversation. */
      hallucinationSuspected?: boolean;
      /** Rule code: blocklist | non-ascii-under-en | repetition | vad-no-speech-start
       *  | yamnet-non-speech | etc. Useful for debugging UI / dev-tools. */
      hallucinationReason?: string;
    }
  | { type: 'vad'; state: 'speech_start' | 'speech_end' }
  | { type: 'eot'; probability: number }
  | { type: 'metric'; stage: string; ms: number }
  | { type: 'audio_chunk'; bytes: number; firstChunk?: boolean }
  | { type: 'turn_complete'; durationMs: number }
  | { type: 'session_state'; state: SessionLifecycleState }
  /** Server-driven end-of-conversation. Fires when the chatflow has reached a
   *  terminal node and finished playing its closing TTS. The widget should
   *  render a thank-you / "session ended" UI and stop the mic; the server
   *  closes the peer connection ~800ms later, which produces an `ice: closed`
   *  event for any UI that's listening for transport state instead. */
  | { type: 'session_ended'; reason: string }
  | { type: 'ice'; state: RTCIceConnectionState }
  | { type: 'quality'; rttMs?: number; jitterMs?: number; packetLossPct?: number };

export interface WebRtcVoiceClientConfig {
  /** Base URL of the agents-service ALB (e.g. https://api.swfte.com/agents). */
  whipEndpoint: string;
  chatFlowId: string;
  workspaceId: string;
  sessionId: string;
  apiKey?: string;
  /** Timeout for the ICE connection to reach `connected` before the
   *  caller should fall back to V1 WebSocket. Default 5000 ms. */
  iceTimeoutMs?: number;
  onEvent: (e: VoiceEvent) => void;
}

export class WebRtcConnectError extends Error {
  constructor(
    public readonly reason: 'whip_4xx' | 'whip_5xx' | 'ice_timeout' | 'dtls_failed' | 'sdp_rejected' | 'user_media' | 'other',
    message: string,
  ) {
    super(message);
    this.name = 'WebRtcConnectError';
  }
}

export class WebRtcVoiceClient {
  private pc: RTCPeerConnection | null = null;
  private micStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private controlChannel: RTCDataChannel | null = null;
  private firstAudioReceived = false;
  private speechEndTime: number | null = null;
  private qualityInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private config: WebRtcVoiceClientConfig) {}

  async start(audioEl: HTMLAudioElement): Promise<void> {
    this.remoteAudio = audioEl;
    this.config.onEvent({ type: 'connection', state: 'connecting' });

    // 1. Mic w/ browser AEC + NS + AGC. Tightened beyond the V1
    //    defaults to mitigate AEC drift on long calls (>30 min):
    //    - `echoCancellation: 'system'` asks for OS/hardware AEC where
    //      available (macOS CoreAudio, Win10+ APO). Falls back to
    //      Chrome's WebRTC software AEC3 if not. HW AEC drifts less
    //      because it has access to the speaker reference signal
    //      directly, not via a derived loopback.
    //    - `latency: 0.02` (20ms) hints the audio graph not to add
    //      large buffers. Smaller buffers = less drift accumulation.
    //    - `sampleRate: 48000` matches Opus clock rate so there's no
    //      browser-side resample to drift against.
    //    - googEchoCancellation / googHighpassFilter are Chromium
    //      legacy constraints, ignored on non-Chromium browsers but
    //      no harm sending them.
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: 'system' as unknown as boolean } as ConstrainBoolean,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: { ideal: 48000 },
          latency: { ideal: 0.02 },
          // Chromium-legacy constants — silently ignored on Safari/FF.
          googEchoCancellation: true,
          googHighpassFilter: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
        } as unknown as MediaTrackConstraints,
      });
    } catch (err) {
      // Fall back to plain boolean AEC if the picky constraint set was
      // rejected (older browsers reject unknown keys with NotSupportedError).
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          } as MediaTrackConstraints,
        });
      } catch (err2) {
        throw new WebRtcConnectError('user_media', `getUserMedia failed: ${err2}`);
      }
    }

    // 2. RTCPeerConnection. Fetch TURN credentials from agents-service so
    //    ICE has a relay path — without one, NLB-fronted Fargate can't
    //    consistently complete bidirectional UDP (outbound STUN responses
    //    egress via the task NAT gateway from a different IP than the
    //    advertised NLB host candidate, breaking ICE consistency checks).
    //
    //    Asymmetric ICE policy:
    //    - Browser:  iceTransportPolicy='all'  — gathers host + srflx + relay.
    //    - Server:   iceTransportPolicy='Relay' (peer/connection.rs)
    //                gathers ONLY relay.
    //
    //    Pair check forms across {browser_host, browser_srflx,
    //    browser_relay} × server_relay. The magic pair is
    //    `browser_srflx × server_relay`: server's relay is reachable
    //    (NLB-fronted coturn), browser's srflx is its NAT-mapped public
    //    IP. The relay→srflx leg goes server's TURN → coturn forwards to
    //    browser_srflx → browser's NAT lets it through (return traffic
    //    on a port it just sent from). srflx→relay leg is browser
    //    sending UDP straight to coturn:relay_port. NO coturn loopback,
    //    so it works even when both peers happen to use the same coturn.
    //
    //    Earlier attempt forced both sides to `relay`. That created
    //    relay×relay pairs which require coturn to forward between two
    //    of its own allocations (loopback) AND for both peers to issue
    //    CreatePermission for each other's relay address. webrtc-rs
    //    0.17 didn't reliably complete that bidirectional permission
    //    setup — pairs stayed `state=in-progress` for 30 s on every
    //    session, ICE timeout, V1 fallback. Adding the public STUN
    //    server lets the browser ALSO advertise srflx, which sidesteps
    //    the loopback path entirely.
    //
    //    `stun:stun.l.google.com:19302` is added unconditionally on the
    //    widget side — it's free, public, no auth required, and the
    //    public Google STUN service is the de-facto reliability
    //    benchmark in WebRTC. The TURN entry from /turn-credentials
    //    is appended as the relay-fallback path for restrictive NATs
    //    that block UDP entirely.
    //
    //    If creds are missing the widget falls back to V1 WebSocket
    //    via UnifiedVoiceClient — empty iceServers + relay policy
    //    would produce zero candidates locally and ICE never starts.
    const turnIceServers = await this.fetchIceServers();
    const iceServers: RTCIceServer[] = [
      // Public STUN — gathers srflx for browser, no auth.
      { urls: ['stun:stun.l.google.com:19302'] },
      // TURN from agents-service — gathers relay, fallback for
      // UDP-blocked enterprise networks.
      ...turnIceServers,
    ];
    this.pc = new RTCPeerConnection({
      iceServers,
      // Browser uses 'all' so srflx candidates are gathered + considered.
      // Server-side stays 'Relay' (voice-runtime/src/peer/connection.rs).
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    // Send mic up
    for (const track of this.micStream.getAudioTracks()) {
      this.pc.addTrack(track, this.micStream);
    }
    // Receive TTS down
    this.pc.addTransceiver('audio', { direction: 'recvonly' });

    // Bind inbound audio stream to the <audio> element
    this.pc.ontrack = (ev) => {
      if (audioEl.srcObject !== ev.streams[0]) {
        audioEl.srcObject = ev.streams[0];
        audioEl.autoplay = true;
        // playsInline is iOS Safari-only and not in lib.dom's HTMLAudioElement.
        audioEl.setAttribute('playsinline', 'true');
        audioEl.play().catch(() => {
          // Autoplay policy may block; caller should have triggered
          // start() in a user gesture scope (click handler). If blocked,
          // the ontrack handler's subsequent dispatches will still work.
        });
      }
      if (!this.firstAudioReceived && this.speechEndTime != null) {
        const ttfb = performance.now() - this.speechEndTime;
        this.config.onEvent({ type: 'metric', stage: 'speech_end_to_first_audio', ms: ttfb });
        this.firstAudioReceived = true;
      }
    };

    // Control channel for transcripts + vad + metrics (same JSON
    // payloads the V1 WebSocket sends — reuses handleControlMessage).
    this.controlChannel = this.pc.createDataChannel('control', { ordered: true });
    this.controlChannel.onmessage = (ev) => this.handleControlMessage(ev.data);

    // ICE monitoring with timeout + fallback hook
    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState ?? 'closed';
      this.config.onEvent({ type: 'ice', state });
      if (state === 'failed') {
        this.config.onEvent({ type: 'connection', state: 'error', detail: 'ice_failed' });
      }
      if (state === 'connected' || state === 'completed') {
        this.config.onEvent({ type: 'connection', state: 'open' });
        this.startQualityReporting();
      }
      if (state === 'closed' || state === 'disconnected') {
        this.config.onEvent({ type: 'connection', state: 'closed' });
        this.stopQualityReporting();
      }
    };

    // 3. Create + send offer.
    //
    // CRITICAL: WHIP is one-shot HTTP — there's no trickle-ICE channel for
    // the server to receive candidates after the offer. So we MUST wait
    // for ICE gathering to complete before POSTing, otherwise the offer
    // body has zero `a=candidate:` lines and the server's controlled-side
    // ICE agent ends up with 0 remote candidates → 0 candidate pairs →
    // permanent "no candidate pairs, connection is not possible yet" →
    // ICE timeout at ~30s → V1 fallback. This was the root cause of the
    // V2 100% failure rate observed 2026-04-27 (chrome://webrtc-internals
    // showed the BROWSER had 8 local candidates but the offer it sent
    // contained none of them).
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.awaitIceGatheringComplete();
    const finalOffer = this.pc.localDescription ?? offer;

    const url =
      `${this.config.whipEndpoint.replace(/\/$/, '')}/v2/voice/whip/offer` +
      `?chatFlowId=${encodeURIComponent(this.config.chatFlowId)}` +
      `&workspaceId=${encodeURIComponent(this.config.workspaceId)}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        'X-Session-Id': this.config.sessionId,
        ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: finalOffer.sdp ?? '',
    });

    if (!resp.ok) {
      const reason: WebRtcConnectError['reason'] = resp.status >= 500 ? 'whip_5xx' : 'whip_4xx';
      throw new WebRtcConnectError(reason, `WHIP POST ${resp.status}`);
    }
    const answerSdp = await resp.text();

    try {
      await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    } catch (err) {
      throw new WebRtcConnectError('sdp_rejected', `setRemoteDescription: ${err}`);
    }

    // 4. Wait (bounded) for ICE to reach connected; caller expects to
    //    fall back to V1 WS if we don't make it.
    await this.awaitIceConnected(this.config.iceTimeoutMs ?? 5000);
  }

  private handleControlMessage(data: unknown): void {
    if (typeof data !== 'string') return;
    try {
      const json = JSON.parse(data) as Record<string, unknown>;
      const type = json.type as string;
      switch (type) {
        case 'transcript':
          this.config.onEvent({
            type: 'transcript',
            text: String(json.text ?? ''),
            final: Boolean(json.final),
            role: json.role === 'agent' ? 'agent' : 'user',
          });
          break;
        case 'vad': {
          const state = json.state as 'speech_start' | 'speech_end';
          this.config.onEvent({ type: 'vad', state });
          if (state === 'speech_end') {
            this.speechEndTime = performance.now();
            this.firstAudioReceived = false;
          }
          break;
        }
        case 'eot':
          this.config.onEvent({ type: 'eot', probability: Number(json.probability ?? 0) });
          break;
        case 'metric':
          this.config.onEvent({
            type: 'metric',
            stage: String(json.stage ?? ''),
            ms: Number(json.ms ?? 0),
          });
          break;
        case 'turn_complete':
          this.config.onEvent({
            type: 'turn_complete',
            durationMs: Number(json.duration_ms ?? 0),
          });
          this.speechEndTime = null;
          break;
        case 'session_state': {
          const s = json.state as SessionLifecycleState;
          if (
            s === 'preparing' ||
            s === 'gpu_warming' ||
            s === 'gpu_ready' ||
            s === 'ready'
          ) {
            this.config.onEvent({ type: 'session_state', state: s });
          }
          break;
        }
        case 'session_ended': {
          // Chatflow reached a terminal state and the closing TTS just
          // finished. The server will close the peer ~800ms after sending
          // this so the tail packets reach us first; we surface the event
          // immediately so the host UI can stop the mic and switch to a
          // thank-you screen without waiting for ICE state to flip.
          const reason = String(json.reason ?? 'completed');
          this.config.onEvent({ type: 'session_ended', reason });
          break;
        }
        default:
          // Unknown message types are intentionally ignored; forward
          // compat is preferred to fail-open noise.
          break;
      }
    } catch {
      // Non-JSON messages arrive rarely; ignore.
    }
  }

  /**
   * Fetch TURN credentials from agents-service. Server returns
   * `{urls, username, credential}` matching the RTCIceServer dictionary.
   * Empty `urls` means TURN isn't configured server-side — we go peer-
   * direct (the pre-TURN behavior). Network failures degrade the same
   * way; never blocks session start.
   */
  private async fetchIceServers(): Promise<RTCIceServer[]> {
    const url = `${this.config.whipEndpoint.replace(/\/+$/, '')}/v2/voice/turn-credentials`;
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`;
      const resp = await fetch(url, { method: 'GET', headers });
      if (!resp.ok) {
        // Not fatal — server may not have the endpoint yet, or TURN may
        // be intentionally disabled for this workspace.
        return [];
      }
      const body = (await resp.json()) as {
        urls?: string[];
        username?: string;
        credential?: string;
      };
      if (!body.urls || body.urls.length === 0 || !body.username || !body.credential) {
        return [];
      }
      return [
        {
          urls: body.urls,
          username: body.username,
          credential: body.credential,
        },
      ];
    } catch {
      return [];
    }
  }

  /**
   * Block until the PC's ICE gathering reaches `complete`. Required before
   * POSTing a WHIP offer (no trickle channel for late candidates).
   *
   * Bounded at 4s so a stuck STUN/TURN harvester can't hang the connect
   * forever — if gather isn't done by then we ship whatever candidates
   * are present (typically host + srflx, missing TURN). The server side
   * will then likely fail and we'll cleanly fall back to V1 WS.
   */
  private awaitIceGatheringComplete(timeoutMs: number = 4000): Promise<void> {
    return new Promise((resolve) => {
      if (!this.pc) return resolve();
      if (this.pc.iceGatheringState === 'complete') return resolve();
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(deadline);
        this.pc?.removeEventListener('icegatheringstatechange', listener);
        resolve();
      };
      const deadline = setTimeout(finish, timeoutMs);
      const listener = () => {
        if (this.pc?.iceGatheringState === 'complete') finish();
      };
      this.pc.addEventListener('icegatheringstatechange', listener);
    });
  }

  private awaitIceConnected(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.pc) return reject(new WebRtcConnectError('other', 'pc not created'));
      if (this.pc.iceConnectionState === 'connected' || this.pc.iceConnectionState === 'completed') {
        return resolve();
      }
      const deadline = setTimeout(() => {
        reject(new WebRtcConnectError('ice_timeout', `ICE did not connect in ${timeoutMs} ms`));
      }, timeoutMs);
      const listener = () => {
        const s = this.pc?.iceConnectionState;
        if (s === 'connected' || s === 'completed') {
          clearTimeout(deadline);
          this.pc?.removeEventListener('iceconnectionstatechange', listener);
          resolve();
        } else if (s === 'failed') {
          clearTimeout(deadline);
          this.pc?.removeEventListener('iceconnectionstatechange', listener);
          reject(new WebRtcConnectError('dtls_failed', 'ICE failed'));
        }
      };
      this.pc.addEventListener('iceconnectionstatechange', listener);
    });
  }

  private startQualityReporting(): void {
    if (this.qualityInterval) return;
    this.qualityInterval = setInterval(async () => {
      if (!this.pc) return;
      try {
        const stats = await this.pc.getStats();
        let rttMs: number | undefined;
        let jitterMs: number | undefined;
        let packetLossPct: number | undefined;
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && (report as any).state === 'succeeded') {
            const rtt = (report as any).currentRoundTripTime;
            if (typeof rtt === 'number') rttMs = rtt * 1000;
          }
          if (report.type === 'inbound-rtp' && (report as any).kind === 'audio') {
            const jitter = (report as any).jitter;
            if (typeof jitter === 'number') jitterMs = jitter * 1000;
            const lost = (report as any).packetsLost;
            const total = (report as any).packetsReceived;
            if (typeof lost === 'number' && typeof total === 'number' && total > 0) {
              packetLossPct = (lost / (lost + total)) * 100;
            }
          }
        });
        this.config.onEvent({ type: 'quality', rttMs, jitterMs, packetLossPct });
      } catch {
        // getStats can flake during teardown; ignore.
      }
    }, 5000);
  }

  private stopQualityReporting(): void {
    if (this.qualityInterval) {
      clearInterval(this.qualityInterval);
      this.qualityInterval = null;
    }
  }

  stop(): void {
    this.stopQualityReporting();
    try {
      // WHIP-standard teardown. Best-effort — ignore failures.
      if (this.config.sessionId) {
        fetch(
          `${this.config.whipEndpoint.replace(/\/$/, '')}/v2/voice/whip/sessions/${encodeURIComponent(this.config.sessionId)}`,
          { method: 'DELETE' },
        ).catch(() => void 0);
      }
    } catch {
      /* noop */
    }
    try {
      this.controlChannel?.close();
    } catch {
      /* noop */
    }
    try {
      this.pc?.close();
    } catch {
      /* noop */
    }
    this.micStream?.getTracks().forEach((t) => t.stop());
    // Critical: clear the <audio> element binding before returning. If
    // we don't, a subsequent V1 fallback in the SAME session will set
    // audioEl.src — but per the HTMLMediaElement spec srcObject takes
    // priority over src. So V1's MediaSource URL is silently ignored,
    // chunks pile up in the SourceBuffer, and the user hears nothing.
    // Confirmed via prod 2026-04-27: V2 ontrack fired (setting
    // srcObject) before ICE timed out → fallback to V1 → V1 binary
    // frames arriving but audioEl still bound to the defunct V2
    // MediaStream → no audio.
    if (this.remoteAudio) {
      try {
        this.remoteAudio.srcObject = null;
        this.remoteAudio.removeAttribute('src');
        this.remoteAudio.load();
      } catch {
        /* noop */
      }
    }
    this.pc = null;
    this.controlChannel = null;
    this.micStream = null;
    this.remoteAudio = null;
  }
}
