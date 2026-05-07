# React Integration

`@swfte/chatflow-widget/react` ships first-class React 17+ components and hooks for embedding ChatFlows from the [Swfte](https://www.swfte.com) platform.

## Install

```bash
npm install @swfte/chatflow-widget react react-dom
```

## ChatFlowProvider + ChatFlowChat

```tsx
import { ChatFlowProvider, ChatFlowChat } from '@swfte/chatflow-widget/react';

export function App() {
  return (
    <ChatFlowProvider
      config={{
        baseUrl: 'https://api.swfte.com/agents',
        chatFlowId: 'cf_yourchatflowid',
        apiKey: process.env.NEXT_PUBLIC_SWFTE_API_KEY,
        workspaceId: '226',
        greeting: 'Hi! How can I help?',
        onComplete: (data) => save(data),
        onFieldExtracted: (id, value) => console.log(id, value),
      }}
    >
      <ChatFlowChat
        agentName="Assistant"
        agentSubtitle="Powered by Swfte"
        showProgress
        placeholder="Type your response..."
      />
    </ChatFlowProvider>
  );
}
```

## Custom UI with `useChatFlow`

```tsx
import { useChatFlow } from '@swfte/chatflow-widget/react';

function CustomChat() {
  const { state, send, reset } = useChatFlow();
  return (
    <div>
      {state.messages.map((m) => (
        <p key={m.id} className={m.role}>{m.content}</p>
      ))}
      <progress value={state.progressPercent} max={100} />
      {/* ... your input UI ... */}
    </div>
  );
}
```

`state` exposes: `messages`, `collectedData`, `progressPercent`, `phase` (`idle | greeting | collecting | completed | error`), and `lastError`.

## Patterns

- **Conditional mount** — only mount the provider once the user opens a chat trigger; the SDK creates the session on first `send()` so mounting is cheap.
- **Persistence** — pass `sessionId` to resume a prior session; the SDK will sync `collectedData` and `messages` from the backend.
- **Streaming UI** — `messages` streams progressively as the LLM responds. Render with a typewriter/skeleton style for best UX.

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
