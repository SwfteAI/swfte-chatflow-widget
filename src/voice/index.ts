/**
 * Voice SDK surface: V1 WebSocket and V2 WebRTC clients + the runtime
 * selector + a small UnifiedVoiceClient that picks between them and
 * auto-falls-back V2 -> V1 on WHIP/ICE/DTLS failures.
 */
export { WebRtcVoiceClient, WebRtcConnectError } from './WebRtcVoiceClient';
export type {
  WebRtcVoiceClientConfig,
  VoiceEvent,
  SessionLifecycleState,
} from './WebRtcVoiceClient';

export { LegacyWebSocketVoiceClient } from './LegacyWebSocketVoiceClient';
export type { LegacyWebSocketVoiceClientConfig } from './LegacyWebSocketVoiceClient';

export { UnifiedVoiceClient } from './UnifiedVoiceClient';
export type { UnifiedVoiceClientConfig } from './UnifiedVoiceClient';

export type { VoiceRuntimeVersion } from '../types';
