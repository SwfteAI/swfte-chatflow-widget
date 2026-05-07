/**
 * LegacyWebSocketVoiceClient — V1 browser-side voice client.
 *
 * This is the WebSocket / PCM-over-worklet client that predates the V2
 * WebRTC pipeline. It was previously only present in voice-demo/app/lib/
 * but lives in the SDK now so ChatFlowProvider can instantiate it as a
 * fallback when V2 WHIP negotiation fails. The demo re-exports it from
 * here so there is exactly one implementation in the tree.
 *
 * The public surface (VoiceEvent union, start/stop signature) is identical
 * to WebRtcVoiceClient so the provider can swap instances without the
 * host UI having to branch.
 */

import type { VoiceEvent, SessionLifecycleState } from './WebRtcVoiceClient';

export type { VoiceEvent, SessionLifecycleState };

export interface LegacyWebSocketVoiceClientConfig {
  wsUrl: string;
  chatFlowId: string;
  workspaceId: string;
  sessionId: string;
  apiKey?: string;
  onEvent: (e: VoiceEvent) => void;
}

export class LegacyWebSocketVoiceClient {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private micStream: MediaStream | null = null;
  private mediaSource: MediaSource | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private pendingAudio: ArrayBuffer[] = [];
  private firstAudioReceived = false;
  private speechEndTime: number | null = null;

  constructor(private config: LegacyWebSocketVoiceClientConfig) {}

  async start(audioEl: HTMLAudioElement): Promise<void> {
    this.config.onEvent({ type: 'connection', state: 'connecting' });

    // 1. Mic with browser-level AEC + noise suppression
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      } as MediaTrackConstraints,
    });

    // 2. AudioContext + worklet
    this.audioCtx = new AudioContext({ sampleRate: 48000 });
    await this.audioCtx.audioWorklet.addModule('/audio-worklets/pcm-recorder.js');

    const source = this.audioCtx.createMediaStreamSource(this.micStream);
    this.workletNode = new AudioWorkletNode(this.audioCtx, 'pcm-recorder', {
      processorOptions: { targetSampleRate: 16000 },
    });
    source.connect(this.workletNode);

    // 3. MediaSource for incoming audio
    this.audioEl = audioEl;
    audioEl.autoplay = true;
    // playsInline is a video property but iOS accepts it on <audio> too;
    // set via index to sidestep the DOM lib type narrowing.
    (audioEl as unknown as { playsInline: boolean }).playsInline = true;
    audioEl.preload = 'auto';

    this.mediaSource = new MediaSource();
    audioEl.src = URL.createObjectURL(this.mediaSource);
    this.mediaSource.addEventListener('sourceopen', () => {
      const candidates = ['audio/mpeg', 'audio/mpeg; codecs="mp3"'];
      for (const mime of candidates) {
        try {
          this.sourceBuffer = this.mediaSource!.addSourceBuffer(mime);
          break;
        } catch {
          this.sourceBuffer = null;
        }
      }
      if (!this.sourceBuffer) return;
      this.sourceBuffer.addEventListener('updateend', () => {
        this.flushPendingAudio();
        if (this.audioEl && this.audioEl.paused) {
          this.audioEl.play().catch(() => void 0);
        }
      });
      this.flushPendingAudio();
    });

    // Primer play() under the user gesture — unlocks subsequent async plays.
    audioEl.play().catch(() => void 0);

    // 4. WebSocket
    const url =
      `${this.config.wsUrl}?chatFlowId=${encodeURIComponent(this.config.chatFlowId)}` +
      `&workspaceId=${encodeURIComponent(this.config.workspaceId)}` +
      `&sessionId=${encodeURIComponent(this.config.sessionId)}`;
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.config.onEvent({ type: 'connection', state: 'open' });
      this.workletNode!.port.onmessage = (msg) => {
        const data = msg.data as { type: string; pcm: ArrayBuffer; rms: number };
        if (data.type === 'pcm' && this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(data.pcm);
          this.config.onEvent({ type: 'mic', rms: data.rms });
        }
      };
    };

    this.ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        this.handleControlMessage(ev.data);
      } else {
        const buf = ev.data as ArrayBuffer;
        this.config.onEvent({
          type: 'audio_chunk',
          bytes: buf.byteLength,
          firstChunk: !this.firstAudioReceived,
        });
        if (!this.firstAudioReceived && this.speechEndTime != null) {
          const ttfb = performance.now() - this.speechEndTime;
          this.config.onEvent({ type: 'metric', stage: 'speech_end_to_first_audio', ms: ttfb });
          this.firstAudioReceived = true;
        }
        this.appendAudio(buf);
      }
    };

    this.ws.onclose = () => this.config.onEvent({ type: 'connection', state: 'closed' });
    this.ws.onerror = () => this.config.onEvent({ type: 'connection', state: 'error' });
  }

  private handleControlMessage(text: string): void {
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      switch (json.type as string) {
        case 'transcript':
          this.config.onEvent({
            type: 'transcript',
            text: String(json.text ?? ''),
            final: Boolean(json.final),
            role: json.role === 'agent' ? 'agent' : 'user',
            hallucinationSuspected: Boolean(json.hallucinationSuspected),
            hallucinationReason: typeof json.hallucinationReason === 'string'
              ? (json.hallucinationReason as string) : undefined,
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
          if (s === 'preparing' || s === 'gpu_warming' || s === 'gpu_ready' || s === 'ready') {
            this.config.onEvent({ type: 'session_state', state: s });
          }
          break;
        }
        default:
          break;
      }
    } catch {
      // ignore bad frames
    }
  }

  private appendAudio(buf: ArrayBuffer): void {
    this.pendingAudio.push(buf);
    this.flushPendingAudio();
  }

  private flushPendingAudio(): void {
    if (!this.sourceBuffer || this.sourceBuffer.updating || this.pendingAudio.length === 0) return;
    const chunk = this.pendingAudio.shift();
    if (!chunk) return;
    try {
      this.sourceBuffer.appendBuffer(chunk);
      if (this.audioEl && this.audioEl.paused) {
        this.audioEl.play().catch(() => void 0);
      }
    } catch {
      // appendBuffer can throw on quota / decode errors; drop the chunk.
    }
  }

  stop(): void {
    try { this.ws?.close(); } catch { /* noop */ }
    try { this.workletNode?.disconnect(); } catch { /* noop */ }
    try { this.audioCtx?.close(); } catch { /* noop */ }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
    }
    this.ws = null;
    this.audioCtx = null;
    this.workletNode = null;
    this.micStream = null;
  }
}
