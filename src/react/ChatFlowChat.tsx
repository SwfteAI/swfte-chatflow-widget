import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useChatFlow } from './ChatFlowProvider';
import type { ChatFlowTheme, ChatFlowMessage } from '../types';

// ---------------------------------------------------------------------------
// Default theme
// ---------------------------------------------------------------------------

const DEFAULT_THEME: Required<ChatFlowTheme> = {
  colors: {
    primary: '#3b82f6',
    background: '#ffffff',
    surface: '#f4f4f5',
    text: '#18181b',
    textMuted: '#71717a',
    userBubble: '#3b82f6',
    userBubbleText: '#ffffff',
    agentBubble: '#f4f4f5',
    agentBubbleText: '#18181b',
    border: '#e4e4e7',
    error: '#ef4444',
    success: '#22c55e',
    progressBar: '#3b82f6',
    progressTrack: '#e4e4e7',
  },
  typography: {
    fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSize: '14px',
    lineHeight: '1.5',
  },
  radius: {
    container: '12px',
    bubble: '16px',
    input: '10px',
    button: '10px',
  },
  spacing: {
    messagePadding: '12px 16px',
    containerPadding: '16px',
  },
};

function mergeTheme(base: Required<ChatFlowTheme>, overrides?: ChatFlowTheme): Required<ChatFlowTheme> {
  if (!overrides) return base;
  return {
    colors: { ...base.colors, ...overrides.colors },
    typography: { ...base.typography, ...overrides.typography },
    radius: { ...base.radius, ...overrides.radius },
    spacing: { ...base.spacing, ...overrides.spacing },
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MessageBubble({
  msg,
  theme,
}: {
  msg: ChatFlowMessage;
  theme: Required<ChatFlowTheme>;
}) {
  const isUser = msg.role === 'user';

  const bubbleStyle: CSSProperties = {
    maxWidth: '80%',
    padding: theme.spacing.messagePadding,
    borderRadius: theme.radius.bubble,
    fontSize: theme.typography.fontSize,
    lineHeight: theme.typography.lineHeight,
    fontFamily: theme.typography.fontFamily,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    ...(isUser
      ? {
          backgroundColor: theme.colors.userBubble,
          color: theme.colors.userBubbleText,
          borderBottomRightRadius: '4px',
          marginLeft: 'auto',
        }
      : {
          backgroundColor: theme.colors.agentBubble,
          color: theme.colors.agentBubbleText,
          borderBottomLeftRadius: '4px',
          marginRight: 'auto',
        }),
  };

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={bubbleStyle}>{msg.content}</div>
    </div>
  );
}

function TypingIndicator({ theme }: { theme: Required<ChatFlowTheme> }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div
        style={{
          backgroundColor: theme.colors.agentBubble,
          borderRadius: theme.radius.bubble,
          borderBottomLeftRadius: '4px',
          padding: '12px 16px',
          display: 'flex',
          gap: '5px',
          alignItems: 'center',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: theme.colors.textMuted,
              opacity: 0.5,
              display: 'inline-block',
              animation: `cfw-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ProgressBar({
  percent,
  theme,
}: {
  percent: number;
  theme: Required<ChatFlowTheme>;
}) {
  if (percent <= 0) return null;

  return (
    <div
      style={{
        height: 4,
        backgroundColor: theme.colors.progressTrack,
        borderRadius: 2,
        overflow: 'hidden',
        margin: '0 16px',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.min(percent, 100)}%`,
          backgroundColor: theme.colors.progressBar,
          borderRadius: 2,
          transition: 'width 0.4s ease-out',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ChatFlowChatProps {
  /** Theme overrides */
  theme?: ChatFlowTheme;
  /** Show header with agent name (default: true) */
  showHeader?: boolean;
  /** Agent name shown in header */
  agentName?: string;
  /** Agent subtitle */
  agentSubtitle?: string;
  /** Show progress bar (default: true) */
  showProgress?: boolean;
  /** Input placeholder text */
  placeholder?: string;
  /** CSS class name for the container */
  className?: string;
  /** Inline styles for the container */
  style?: CSSProperties;
}

export function ChatFlowChat({
  theme: themeOverrides,
  showHeader = true,
  agentName = 'Assistant',
  agentSubtitle,
  showProgress = true,
  placeholder = 'Type your response...',
  className,
  style,
}: ChatFlowChatProps) {
  const { state, send } = useChatFlow();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const theme = mergeTheme(DEFAULT_THEME, themeOverrides);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages, state.isSending]);

  // Auto-focus input
  useEffect(() => {
    if (state.status === 'active' && !state.isSending) {
      inputRef.current?.focus();
    }
  }, [state.status, state.isSending]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || state.isSending) return;
    setInputValue('');
    await send(text);
  }, [inputValue, state.isSending, send]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Inject bounce animation
  useEffect(() => {
    if (document.getElementById('cfw-keyframes')) return;
    const style = document.createElement('style');
    style.id = 'cfw-keyframes';
    style.textContent = `@keyframes cfw-bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }`;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.container,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.fontSize,
    lineHeight: theme.typography.lineHeight,
    color: theme.colors.text,
    ...style,
  };

  return (
    <div className={className} style={containerStyle}>
      {/* Header */}
      {showHeader && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: `${theme.colors.primary}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>{agentName}</div>
            {agentSubtitle && (
              <div style={{ fontSize: '12px', color: theme.colors.textMuted }}>{agentSubtitle}</div>
            )}
          </div>
        </div>
      )}

      {/* Progress bar */}
      {showProgress && <ProgressBar percent={state.progressPercent} theme={theme} />}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: theme.spacing.containerPadding,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Loading state */}
        {state.status === 'loading' && (
          <div style={{ textAlign: 'center', color: theme.colors.textMuted, padding: 32 }}>
            Starting conversation...
          </div>
        )}

        {/* Messages */}
        {state.messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} theme={theme} />
        ))}

        {/* Typing indicator */}
        {state.isSending && <TypingIndicator theme={theme} />}

        {/* Error */}
        {state.error && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: `${theme.colors.error}10`,
              color: theme.colors.error,
              borderRadius: theme.radius.bubble,
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ flex: 1 }}>{state.error.message}</span>
            {state.error.retryable && (
              <button
                onClick={() => inputRef.current?.focus()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.colors.error,
                  cursor: 'pointer',
                  fontSize: '12px',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Completion */}
        {state.status === 'completed' && (
          <div
            style={{
              textAlign: 'center',
              padding: 16,
              color: theme.colors.success,
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            Conversation complete
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {state.status === 'active' && (
        <div
          style={{
            padding: '10px 12px',
            borderTop: `1px solid ${theme.colors.border}`,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={state.isSending}
            placeholder={placeholder}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: theme.radius.input,
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              fontSize: theme.typography.fontSize,
              fontFamily: theme.typography.fontFamily,
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
            onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || state.isSending}
            style={{
              width: 40,
              height: 40,
              borderRadius: theme.radius.button,
              border: 'none',
              backgroundColor: inputValue.trim() && !state.isSending ? theme.colors.primary : theme.colors.surface,
              color: inputValue.trim() && !state.isSending ? '#fff' : theme.colors.textMuted,
              cursor: inputValue.trim() && !state.isSending ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s, color 0.15s',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
