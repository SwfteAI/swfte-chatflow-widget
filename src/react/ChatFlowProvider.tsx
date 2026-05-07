import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { ChatFlowClient } from '../core/client';
import { UnifiedVoiceClient } from '../voice/UnifiedVoiceClient';
import type { VoiceEvent } from '../voice/WebRtcVoiceClient';
import { useVoiceReadiness, type ReadinessStatus } from '../voice/VoiceReadinessPoller';
import type {
  ChatFlowConfig,
  ChatFlowState,
  ChatFlowMessage,
  VoiceRuntimeVersion,
} from '../types';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/** Runtime config pulled from GET {endpoint}/config so the server owns V1/V2. */
interface ResolvedVoiceRuntime {
  runtimeVersion: VoiceRuntimeVersion;
  voiceEndpoint: string | null;
  chatFlowId: string | null;
  workspaceId: string | null;
}

interface VoiceConnState {
  state: 'idle' | 'connecting' | 'open' | 'closed' | 'error';
  /** Which transport is actually live. Starts at the requested runtime and may
   *  flip to 'V1' after a fallback. */
  activeRuntime: VoiceRuntimeVersion | null;
  lastEventDetail?: string;
}

interface VoiceController {
  /** Spawn a voice session. `audioEl` is where received TTS is piped. */
  start: (audioEl: HTMLAudioElement, opts?: { sessionId?: string }) => Promise<void>;
  stop: () => void;
  state: VoiceConnState;
  /**
   * Subscribe to VoiceEvent frames. Returns an unsubscribe fn. Use this
   * inside components that can't pass an `onEvent` prop to the provider
   * (e.g. they are children of the provider themselves).
   */
  subscribe: (listener: (e: VoiceEvent) => void) => () => void;
}

interface ChatFlowContextValue {
  client: ChatFlowClient;
  state: ChatFlowState;
  /** Send a user message */
  send: (text: string) => Promise<void>;
  /** Start (or restart) the session */
  start: () => Promise<void>;
  /** Reset to idle */
  reset: () => void;
  /** Voice sub-controller. Always present — it reports state=idle when no voice session is live. */
  voice: VoiceController;
  /**
   * GPU readiness status during the cold-start window. Updates every ~1s
   * while polling, then settles into a terminal phase ('cloud' or 'ready').
   * Consumers can render `voiceReadiness.copy` directly as a loader caption.
   */
  voiceReadiness: ReadinessStatus;
}

const ChatFlowContext = createContext<ChatFlowContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface ChatFlowProviderProps {
  config: ChatFlowConfig;
  /** Auto-start the session on mount (default: true) */
  autoStart?: boolean;
  /** Subscribe to voice events without threading a ref all the way down. */
  onEvent?: (e: VoiceEvent) => void;
  children: ReactNode;
}

export function ChatFlowProvider({ config, autoStart = true, onEvent, children }: ChatFlowProviderProps) {
  const clientRef = useRef<ChatFlowClient | null>(null);

  // Create client once (config identity doesn't need to be stable)
  if (!clientRef.current) {
    clientRef.current = new ChatFlowClient(config);
  }
  const client = clientRef.current;

  const [state, setState] = useState<ChatFlowState>(client.state);

  // Subscribe to store changes
  useEffect(() => {
    return client.subscribe(() => {
      setState({ ...client.state });
    });
  }, [client]);

  // GPU pre-warm: fire-and-forget scale-up request on mount, before the user
  // clicks "Start". The agents-service hits both Gemma and VoiceUtilities
  // ASGs in parallel (POST /v2/voice/prewarm), turning the ~5 min cold-boot
  // from baked AMIs into background work. If cold boot finishes before the
  // user hits Start, the first turn is on GPU instead of cloud fallback.
  // Failures are swallowed — this is a latency optimization, not a hard
  // dependency.
  useEffect(() => {
    const endpoint = config.endpoint.replace(/\/+$/, '');
    const ctrl = new AbortController();
    fetch(`${endpoint}/prewarm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(config.headers ?? {}) },
      body: '{}',
      signal: ctrl.signal,
    }).catch(() => {
      // Never surface to users — server already logs the root cause.
    });
    return () => ctrl.abort();
  }, [config.endpoint]); // Fires once per mount when the endpoint is stable.

  // ── Server-owned runtime config ───────────────────────────────────
  // GET /config returns { voiceRuntimeVersion, voiceEndpoint, ... }. Host
  // config overrides are honored when set; this is mainly so a server can
  // flip V1<->V2 without a widget rebuild.
  const [resolvedRuntime, setResolvedRuntime] = useState<ResolvedVoiceRuntime | null>(null);
  useEffect(() => {
    const endpoint = config.endpoint.replace(/\/+$/, '');
    const ctrl = new AbortController();
    fetch(`${endpoint}/config`, {
      method: 'GET',
      headers: { ...(config.headers ?? {}) },
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: {
        voiceRuntimeVersion?: VoiceRuntimeVersion;
        voiceEndpoint?: string | null;
        chatFlowId?: string | null;
        workspaceId?: string | null;
      } | null) => {
        setResolvedRuntime({
          runtimeVersion:
            config.voiceRuntimeVersion ?? body?.voiceRuntimeVersion ?? 'V1',
          voiceEndpoint: config.voiceEndpoint ?? body?.voiceEndpoint ?? null,
          chatFlowId: config.chatFlowId ?? body?.chatFlowId ?? null,
          workspaceId: config.workspaceId ?? body?.workspaceId ?? null,
        });
      })
      .catch(() => {
        // Fallback to host-provided config (or defaults) if /config is down.
        setResolvedRuntime({
          runtimeVersion: config.voiceRuntimeVersion ?? 'V1',
          voiceEndpoint: config.voiceEndpoint ?? null,
          chatFlowId: config.chatFlowId ?? null,
          workspaceId: config.workspaceId ?? null,
        });
      });
    return () => ctrl.abort();
  }, [
    config.endpoint,
    config.voiceRuntimeVersion,
    config.voiceEndpoint,
    config.chatFlowId,
    config.workspaceId,
    config.headers,
  ]);

  // Auto-start
  useEffect(() => {
    if (autoStart && client.state.status === 'idle') {
      client.start();
    }
  }, [autoStart, client]);

  const send = useCallback((text: string) => client.send(text), [client]);
  const start = useCallback(() => client.start(), [client]);
  const reset = useCallback(() => client.reset(), [client]);

  // ── Voice controller ─────────────────────────────────────────────
  const voiceClientRef = useRef<UnifiedVoiceClient | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceConnState>({
    state: 'idle',
    activeRuntime: null,
  });
  // Stable latest-event ref so the fallback detection doesn't force us to
  // pin onEvent into the dependency array of startVoice.
  const onEventRef = useRef<typeof onEvent>(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  // Per-mount subscriber list. Children (useVoice consumers) can subscribe
  // without having to thread an onEvent prop into the provider from below.
  const subscribersRef = useRef<Set<(e: VoiceEvent) => void>>(new Set());

  const handleVoiceEvent = useCallback((e: VoiceEvent) => {
    if (e.type === 'connection') {
      setVoiceState((prev) => ({
        state: e.state,
        // 'falling_back_to_v1' is the single place where the active runtime
        // flips — the UnifiedVoiceClient emits it before starting V1.
        activeRuntime:
          e.detail === 'falling_back_to_v1' ? 'V1' : prev.activeRuntime,
        lastEventDetail: e.detail,
      }));
    }
    if (e.type === 'session_ended') {
      // Server says the chatflow finished. Stop the mic immediately so the
      // user isn't holding an open RTCPeerConnection that the server is
      // about to close anyway, and surface a closed state for any UI
      // listening on voiceState.state. The peer-close ICE event arrives
      // ~800ms later and would otherwise appear as a 'closed' transport
      // event with no semantic context.
      setVoiceState((prev) => ({
        state: 'closed',
        activeRuntime: prev.activeRuntime,
        lastEventDetail: `chatflow:${e.reason}`,
      }));
      voiceClientRef.current?.stop();
    }
    onEventRef.current?.(e);
    subscribersRef.current.forEach((fn) => {
      try { fn(e); } catch { /* subscriber errors shouldn't kill the pipeline */ }
    });
  }, []);

  const subscribeVoice = useCallback((listener: (e: VoiceEvent) => void) => {
    subscribersRef.current.add(listener);
    return () => { subscribersRef.current.delete(listener); };
  }, []);

  const startVoice = useCallback(
    async (audioEl: HTMLAudioElement, opts?: { sessionId?: string }) => {
      const runtime = resolvedRuntime;
      if (!runtime) throw new Error('Voice runtime config not yet loaded');
      const whipEndpoint = runtime.voiceEndpoint;
      if (!whipEndpoint) throw new Error('voiceEndpoint is not configured');
      const chatFlowId = runtime.chatFlowId;
      const workspaceId = runtime.workspaceId;
      if (!chatFlowId || !workspaceId) {
        throw new Error('chatFlowId and workspaceId are required for voice');
      }

      voiceClientRef.current?.stop();
      const sessionId =
        opts?.sessionId ?? state.sessionId ?? `voice_${Date.now()}`;
      setVoiceState({ state: 'connecting', activeRuntime: runtime.runtimeVersion });

      const unified = new UnifiedVoiceClient({
        runtimeVersion: runtime.runtimeVersion,
        whipEndpoint,
        chatFlowId,
        workspaceId,
        sessionId,
        onEvent: handleVoiceEvent,
      });
      voiceClientRef.current = unified;
      await unified.start(audioEl);
    },
    [resolvedRuntime, state.sessionId, handleVoiceEvent],
  );

  const stopVoice = useCallback(() => {
    voiceClientRef.current?.stop();
    voiceClientRef.current = null;
    setVoiceState({ state: 'idle', activeRuntime: null });
  }, []);

  // Tear down the voice session on unmount — never leak a peer connection.
  useEffect(() => () => voiceClientRef.current?.stop(), []);

  const voice = useMemo<VoiceController>(
    () => ({ start: startVoice, stop: stopVoice, state: voiceState, subscribe: subscribeVoice }),
    [startVoice, stopVoice, voiceState, subscribeVoice],
  );

  // GPU readiness poller. Runs from mount until either all stacks are warm
  // or cloud fallback has committed. The voice button can disable itself
  // until `voiceReadiness.phase === 'ready' || 'cloud'` to avoid users
  // hitting "Start" during the silent cold-start gap. Consumers that don't
  // care can ignore this field.
  const voiceReadiness = useVoiceReadiness({
    endpoint: config.endpoint,
    workspaceId: resolvedRuntime?.workspaceId ?? config.workspaceId ?? undefined,
    enabled: config.voiceReadinessPollerEnabled !== false,
  });

  const value = useMemo<ChatFlowContextValue>(
    () => ({ client, state, send, start, reset, voice, voiceReadiness }),
    [client, state, send, start, reset, voice, voiceReadiness],
  );

  return (
    <ChatFlowContext.Provider value={value}>
      {children}
    </ChatFlowContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useChatFlow(): ChatFlowContextValue {
  const ctx = useContext(ChatFlowContext);
  if (!ctx) {
    throw new Error('useChatFlow must be used within <ChatFlowProvider>');
  }
  return ctx;
}

/**
 * Convenience hook — returns just the message list.
 * Re-renders only when messages change.
 */
export function useChatFlowMessages(): readonly ChatFlowMessage[] {
  const { state } = useChatFlow();
  return state.messages;
}

/**
 * Hook for the voice sub-controller. Picks V1 or V2 under the hood based on
 * the server's GET /config response (overridable by ChatFlowConfig).
 */
export function useVoice(): VoiceController {
  return useChatFlow().voice;
}

/**
 * Convenience hook returning the GPU readiness status the provider polls
 * every ~1.5s during cold-start. Returns the latest snapshot + a
 * ready-to-render `copy` string ('Connecting…', 'Spinning up your
 * assistant (~Xs)…', 'Connected via cloud', 'Connected'). Polling stops
 * automatically once the GPU is warm or fallback has committed.
 */
export function useVoiceReadinessStatus(): ReadinessStatus {
  return useChatFlow().voiceReadiness;
}
