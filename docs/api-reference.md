# API Reference

## `<ChatFlowProvider>` — config

| Key | Type | Required | Notes |
|---|---|---|---|
| `baseUrl` | `string` | yes | Backend base — e.g. `https://api.swfte.com/agents` or your proxy path. |
| `chatFlowId` | `string` | yes | Swfte ChatFlow ID (`cf_…`). |
| `apiKey` | `string` | yes (or empty if `proxyUrl` is set) | Your `sk-swfte-…` key. **Never** ship this to a browser unless you know what you're doing — use a [proxy](./proxy-pattern.md). |
| `proxyUrl` | `string` | no | If set, the widget routes all requests through this URL and skips Authorization headers — your proxy injects them. |
| `workspaceId` | `string` | no | Workspace ID for scoping. |
| `sessionId` | `string` | no | Resume a prior session. |
| `sessionVariables` | `Record<string,unknown>` | no | Server-side variables injected into the prompt and tools. |
| `greeting` | `string` | no | Initial agent message. |
| `onComplete` | `(data: Record<string, unknown>) => void` | no | Fired when all required fields are collected. |
| `onFieldExtracted` | `(fieldId: string, value: unknown, allData) => void` | no | Fired on each new field extraction. |
| `onMessage` | `(message: Message) => void` | no | Fired on every agent message. |
| `onError` | `(error: { code: string; message: string }) => void` | no | Fired on backend errors. |

## `<ChatFlowChat>` — props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `theme` | `ChatFlowTheme` | default theme | See [theming](./theming.md). |
| `showHeader` | `boolean` | `true` | Show agent name header. |
| `agentName` | `string` | `'Assistant'` | Header title. |
| `agentSubtitle` | `string` | — | Header subtitle. |
| `showProgress` | `boolean` | `true` | Show progress bar. |
| `placeholder` | `string` | `'Type your response...'` | Input placeholder. |
| `className` | `string` | — | CSS class. |
| `style` | `CSSProperties` | — | Inline styles. |

## `useChatFlow()` — hook

Returns:

| Field | Type | Notes |
|---|---|---|
| `state.messages` | `Message[]` | Ordered list of agent + user messages. |
| `state.collectedData` | `Record<string,unknown>` | Field id → value map. |
| `state.progressPercent` | `number` | 0-100. |
| `state.phase` | `'idle' \| 'greeting' \| 'collecting' \| 'completed' \| 'error'` | |
| `state.lastError` | `{ code: string; message: string } \| null` | |
| `send(text: string)` | `Promise<void>` | Send a user message. |
| `reset()` | `void` | Reset to idle. |
| `syncSessionState()` | `Promise<void>` | Sync `collectedData` and `messages` from server. |

## `ChatFlowClient` — framework-agnostic

```ts
const client = new ChatFlowClient({
  baseUrl, chatFlowId, apiKey, workspaceId, sessionId,
  sessionVariables, greeting,
  onComplete, onFieldExtracted, onMessage, onError,
});

await client.start();
await client.send('Hello!');
client.subscribe(() => render(client.state));
client.reset();
```

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
