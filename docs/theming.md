# Theming

Every visual aspect of the widget is controllable via the `theme` prop on `<ChatFlowChat>` or via CSS variables.

## Theme object

```tsx
<ChatFlowChat
  theme={{
    colors: {
      primary: '#6366f1',
      background: '#ffffff',
      surface: '#f9fafb',
      text: '#0f172a',
      textMuted: '#64748b',
      userBubble: '#6366f1',
      userBubbleText: '#ffffff',
      agentBubble: '#f1f5f9',
      agentBubbleText: '#0f172a',
      border: '#e2e8f0',
      progressBar: '#6366f1',
      progressTrack: '#e2e8f0',
      error: '#ef4444',
    },
    typography: {
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      fontSize: '15px',
      lineHeight: 1.5,
    },
    radius: {
      container: '16px',
      bubble: '20px',
      input: '12px',
    },
    spacing: {
      bubbleGap: '8px',
      messagePadding: '12px 16px',
    },
  }}
/>
```

## CSS variables

Every theme value is also exposed as a CSS variable, so you can theme via stylesheet:

```css
.swfte-chatflow {
  --swfte-primary: #6366f1;
  --swfte-background: #ffffff;
  --swfte-surface: #f9fafb;
  --swfte-text: #0f172a;
  --swfte-text-muted: #64748b;
  --swfte-user-bubble: var(--swfte-primary);
  --swfte-user-bubble-text: #ffffff;
  --swfte-agent-bubble: #f1f5f9;
  --swfte-agent-bubble-text: var(--swfte-text);
  --swfte-border: #e2e8f0;
  --swfte-radius: 16px;
  --swfte-bubble-radius: 20px;
  --swfte-font-family: 'Inter', system-ui, sans-serif;
  --swfte-font-size: 15px;
}
```

## Dark mode

```tsx
const [dark, setDark] = useState(matchMedia('(prefers-color-scheme: dark)').matches);

<ChatFlowChat
  theme={{
    colors: dark ? {
      background: '#0f172a',
      surface: '#1e293b',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      userBubble: '#6366f1',
      userBubbleText: '#ffffff',
      agentBubble: '#1e293b',
      agentBubbleText: '#f8fafc',
      border: '#334155',
      progressBar: '#6366f1',
      progressTrack: '#334155',
    } : {
      // ...light values
    },
  }}
/>
```

## Brand-matching tips

- **Primary colour** — match your CTA button colour for visual consistency.
- **Bubble radius** — slightly larger than your input radius (20 vs 12) gives a friendlier feel.
- **Font** — match your product font; the widget inherits well from a `font-family` set on the parent.

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
