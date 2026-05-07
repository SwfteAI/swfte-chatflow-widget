/**
 * VideoOnboardingClient — thin wrapper around the LiveKit browser SDK
 * for Phase 12 video onboarding.
 *
 * Peer dependency (must be installed by the host app — NOT bundled here):
 *   npm i livekit-client
 *
 * This file intentionally avoids a top-level `import` of `livekit-client`
 * so the widget still type-checks when the peer dep is absent. The LiveKit
 * runtime is loaded dynamically inside {@link connect}.
 */

export interface VideoOnboardingOptions {
  /** LiveKit SFU URL — wss://… — returned by the backend readiness endpoint. */
  url: string;
  /** One-time access token returned by the /consume endpoint. */
  token: string;
  /** Optional element to mount the local preview video track into. */
  localVideoEl?: HTMLVideoElement;
  /** Optional element to mount the remote agent video track into. */
  remoteVideoEl?: HTMLVideoElement;
  /** Optional log hook. */
  onLog?: (msg: string) => void;
}

export class VideoOnboardingClient {
  private room: unknown | null = null;
  private opts: VideoOnboardingOptions | null = null;

  /**
   * Connect to the LiveKit room with the one-time access token. Returns
   * once the local tracks have been published.
   */
  async connect(opts: VideoOnboardingOptions): Promise<void> {
    this.opts = opts;
    const log = opts.onLog ?? ((m: string) => console.debug('[VideoOnboardingClient]', m));
    try {
      // Dynamic import so the widget still builds without the peer dep.
      // @ts-ignore — peer dep resolved at runtime
      const livekit = await import('livekit-client');
      const { Room, RoomEvent } = livekit as any;
      const room = new Room({ adaptiveStream: true, dynacast: true });
      this.room = room;

      room.on(RoomEvent.TrackSubscribed, (track: any) => {
        if (track.kind === 'video' && opts.remoteVideoEl) {
          track.attach(opts.remoteVideoEl);
        } else if (track.kind === 'audio') {
          track.attach();
        }
      });

      await room.connect(opts.url, opts.token);
      await room.localParticipant.enableCameraAndMicrophone();
      if (opts.localVideoEl) {
        const camPub = room.localParticipant.getTrackPublication('camera');
        camPub?.track?.attach(opts.localVideoEl);
      }
      log('connected to ' + opts.url);
    } catch (err: any) {
      log('connect failed: ' + (err?.message ?? String(err)));
      throw err;
    }
  }

  getLocalVideoElement(): HTMLVideoElement | undefined {
    return this.opts?.localVideoEl;
  }

  getRemoteVideoElement(): HTMLVideoElement | undefined {
    return this.opts?.remoteVideoEl;
  }

  async disconnect(): Promise<void> {
    if (!this.room) return;
    try {
      // @ts-ignore — duck-typed against livekit-client Room
      await (this.room as any).disconnect?.();
    } finally {
      this.room = null;
    }
  }
}
