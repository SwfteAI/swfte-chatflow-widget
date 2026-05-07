// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Client-side config — used by ChatFlowProvider in the browser.
 * API key is never exposed; all calls go through the endpoint.
 */
export interface ChatFlowConfig {
  /** URL path to the mounted handler (e.g. '/api/chatflow') */
  endpoint: string;
  /** Custom greeting shown before the first AI response */
  greeting?: string;
  /** Pre-populated field values sent when creating a session */
  prefilledData?: Record<string, unknown>;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Custom headers to include in every request */
  headers?: Record<string, string>;
  /** Called when the session completes */
  onComplete?: (data: Record<string, unknown>) => void;
  /** Called on errors */
  onError?: (error: ChatFlowError) => void;
  /** Called on every field extraction */
  onFieldExtracted?: (fieldId: string, value: unknown, allData: Record<string, unknown>) => void;
  /** Called on every agent message */
  onMessage?: (message: ChatFlowMessage) => void;
  /**
   * Voice runtime selector. V1 uses the legacy WebSocket/PCM pipeline,
   * V2 uses the Rust voice-runtime + WebRTC/WHIP path. Defaults to V1
   * when undefined so existing integrations keep their exact behavior.
   */
  voiceRuntimeVersion?: VoiceRuntimeVersion;
  /** Base URL of the agents-service used directly by voice clients (WHIP + WS). */
  voiceEndpoint?: string;
  /** ChatFlow id — needed by voice clients so they can attach to the right flow. */
  chatFlowId?: string;
  /** Workspace id — needed by voice clients for GPU routing. */
  workspaceId?: string;
  /**
   * GPU readiness poller. Defaults to true. When true, the provider polls
   * `${endpoint}/v2/gpu/readiness` every ~1.5s during the cold-start window
   * and surfaces the status as `voiceReadiness` on the context — consumers
   * use this to render a "warming up / connected via cloud / connected"
   * loader caption. Set to false on hosts that don't need the readiness UX.
   */
  voiceReadinessPollerEnabled?: boolean;
}

/** Voice runtime selector surfaced by the host app's ChatFlow config. */
export type VoiceRuntimeVersion = 'V1' | 'V2';

/**
 * Server-side config — used by createChatFlowHandler on the server.
 * Contains secrets that never reach the browser.
 */
export interface ChatFlowServerConfig {
  /** Swfte API base URL (agents-service, not gateway) */
  baseUrl?: string;
  /** API key for Swfte authentication */
  apiKey: string;
  /** Workspace ID */
  workspaceId?: string;
  /** ChatFlow ID */
  chatFlowId: string;
  /** Channel type (default: 'WEB_CHAT') */
  channel?: ChannelType;
  /** Language (default: 'en-US') */
  language?: string;
  /**
   * Voice runtime selector. Server owns the decision and surfaces it
   * via GET /config so the browser client picks the right transport.
   * Defaults to V1 on the server when undefined.
   */
  voiceRuntimeVersion?: VoiceRuntimeVersion;
  /**
   * Public voice endpoint (ALB base URL) the browser should use for
   * WHIP (V2) or WS (V1). If unset the server falls back to baseUrl.
   */
  voiceEndpoint?: string;
  /** Optional greeting — forwarded to the client via GET /config. */
  greeting?: string;
}

export type ChannelType = 'WEB_CHAT' | 'VOICE' | 'SMS' | 'API';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface ChatFlowState {
  status: 'idle' | 'loading' | 'active' | 'completed' | 'error';
  sessionId: string | null;
  messages: ChatFlowMessage[];
  collectedData: Record<string, unknown>;
  currentFieldId: string | null;
  progressPercent: number;
  isSending: boolean;
  error: ChatFlowError | null;
}

export interface ChatFlowMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  fieldId?: string;
}

export interface ChatFlowError {
  code: string;
  message: string;
  retryable?: boolean;
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

export interface CreateSessionResponse {
  sessionId: string;
  chatFlowId: string;
  workspaceId: string;
  state: string;
  channel: string;
}

export interface ProcessInputResponse {
  sessionId: string;
  status: string;
  message: string;
  currentFieldId: string | null;
  progressPercent: number | null;
  extractedData: Record<string, unknown>;
  /** Flattened collected data (returned by the handler, not the raw API) */
  collectedData: Record<string, unknown>;
  sessionComplete: boolean;
  nextAction: string;
}

export interface SessionStateResponse {
  sessionId: string;
  state: string;
  currentFieldId: string | null;
  fieldsCollected: number;
  progressPercent: number | null;
  collectedData: Record<string, CollectedFieldValue>;
}

export interface CollectedFieldValue {
  fieldId: string;
  fieldType: string;
  value: unknown;
  confidence: number;
  validated: boolean;
}

// ---------------------------------------------------------------------------
// Store actions
// ---------------------------------------------------------------------------

export type ChatFlowAction =
  | { type: 'SET_STATUS'; payload: ChatFlowState['status'] }
  | { type: 'SET_SESSION'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: ChatFlowMessage }
  | { type: 'SET_SENDING'; payload: boolean }
  | { type: 'SET_COLLECTED_DATA'; payload: Record<string, unknown> }
  | { type: 'SET_PROGRESS'; payload: { fieldId: string | null; percent: number } }
  | { type: 'SET_ERROR'; payload: ChatFlowError | null }
  | { type: 'RESET' };

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export interface ChatFlowTheme {
  colors?: {
    primary?: string;
    background?: string;
    surface?: string;
    text?: string;
    textMuted?: string;
    userBubble?: string;
    userBubbleText?: string;
    agentBubble?: string;
    agentBubbleText?: string;
    border?: string;
    error?: string;
    success?: string;
    progressBar?: string;
    progressTrack?: string;
  };
  typography?: {
    fontFamily?: string;
    fontSize?: string;
    lineHeight?: string;
  };
  radius?: {
    container?: string;
    bubble?: string;
    input?: string;
    button?: string;
  };
  spacing?: {
    messagePadding?: string;
    containerPadding?: string;
  };
}
