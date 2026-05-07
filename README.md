# @swfte/chatflow-widget

[![npm](https://img.shields.io/npm/v/@swfte/chatflow-widget.svg)](https://www.npmjs.com/package/@swfte/chatflow-widget)
[![npm downloads](https://img.shields.io/npm/dm/@swfte/chatflow-widget.svg)](https://www.npmjs.com/package/@swfte/chatflow-widget)
[![license](https://img.shields.io/npm/l/@swfte/chatflow-widget.svg)](LICENSE)
[![types](https://img.shields.io/npm/types/@swfte/chatflow-widget.svg)](https://www.npmjs.com/package/@swfte/chatflow-widget)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@swfte/chatflow-widget.svg?label=minzip)](https://bundlephobia.com/package/@swfte/chatflow-widget)
[![github](https://img.shields.io/github/stars/SwfteAI/swfte-chatflow-widget?style=social)](https://github.com/SwfteAI/swfte-chatflow-widget)

> The official, embeddable conversational form widget for [Swfte ChatFlows](https://www.swfte.com/products/chatflows). Drop-in onboarding, lead capture, support triage, surveys and voice — for React, Next.js, Vue, Svelte and plain HTML, in a single dependency.

A ChatFlow is a conversational replacement for a static form: a server-side runtime extracts structured fields from natural-language replies, validates them, branches, and finishes when every required field is collected. This widget is the polished, themeable, accessible front-end for that runtime — the same one that powers [Swfte](https://www.swfte.com) production deployments.

---

## Table of contents

- [About Swfte](#about-swfte)
- [What is a ChatFlow?](#what-is-a-chatflow)
- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
  - [React](#react)
  - [Custom UI with hooks](#custom-ui-with-hooks)
  - [Framework-agnostic (no React)](#framework-agnostic-no-react)
- [Configuration](#configuration)
- [Theming](#theming)
- [Callbacks](#callbacks)
- [Voice ChatFlows](#voice-chatflows)
- [Security](#security)
- [API](#api)
- [Examples](#examples)
- [Other Swfte SDKs](#other-swfte-sdks)
- [Resources](#resources)
- [License](#license)

---

## About Swfte

[**Swfte**](https://www.swfte.com) is the unified AI infrastructure platform — one API for **200+ models** from OpenAI, Anthropic, Google, Mistral, Meta and self-hosted GPU deployments, plus production-grade [agents](https://www.swfte.com/products/agents), [workflows](https://www.swfte.com/products/workflows), [chatflows](https://www.swfte.com/products/chatflows), [RAG](https://www.swfte.com/products/rag), [voice](https://www.swfte.com/products/voice), and [MCP servers](https://www.swfte.com/products/mcp).

Read the full company profile in [ABOUT.md](ABOUT.md), or visit [swfte.com](https://www.swfte.com) to get started for free.

| Resource | Link |
|---|---|
| Product home | [https://www.swfte.com](https://www.swfte.com) |
| Documentation | [swfte.com/resources](https://www.swfte.com/resources) |
| API reference | [swfte.com/developers](https://www.swfte.com/developers) |
| Pricing | [swfte.com/pricing](https://www.swfte.com/pricing) |
| Security | [swfte.com/security](https://www.swfte.com/security) |
| Status | [status.swfte.com](https://status.swfte.com) |
| GitHub org | [github.com/SwfteAI](https://github.com/SwfteAI) |

### Other official Swfte SDKs

- [swfte-python](https://github.com/SwfteAI/swfte-python) — Python SDK ([PyPI](https://pypi.org/project/swfte/))
- [swfte-node](https://github.com/SwfteAI/swfte-node) — Node.js / TypeScript SDK ([npm](https://www.npmjs.com/package/@swfte/sdk))
- [swfte-java](https://github.com/SwfteAI/swfte-java) — Java SDK ([Maven Central](https://search.maven.org/artifact/com.swfte/swfte-sdk))
- [swfte-chat-widget](https://github.com/SwfteAI/swfte-chat-widget) — embeddable chat widget ([npm](https://www.npmjs.com/package/@swfte/chat-widget))
- [swfte-chatflow-widget](https://github.com/SwfteAI/swfte-chatflow-widget) — embeddable conversational form widget ([npm](https://www.npmjs.com/package/@swfte/chatflow-widget))

---

## What is a ChatFlow?

A **ChatFlow** is a server-side conversational form runtime. Where a traditional web form gives you a stack of inputs, a ChatFlow gives you a short, branching dialogue that:

1. **Asks** for one piece of information at a time, in natural language.
2. **Extracts** the structured field value from the user's free-text reply (with type coercion, validation, and confidence scoring).
3. **Branches** based on what it has collected so far — skipping fields, looping, or asking follow-ups.
4. **Completes** when every required field has a validated value, then hands back a clean JSON object to your app.

ChatFlows are a category, not a single product. People use them for **user onboarding**, **B2B lead qualification**, **inbound support triage**, **NPS and customer-satisfaction surveys**, **booking and intake**, **voice phone-call data collection**, and more. Anything that today is a multi-step form, a calendly link plus a Notion form, or a 10-question intake — can be replaced by a ChatFlow that completes in a fraction of the time, with higher completion rates and structured output ready for your CRM or database.

This widget renders a ChatFlow defined in your [Swfte](https://www.swfte.com) workspace, talks to the [ChatFlow runtime API](https://www.swfte.com/products/chatflows), and emits the final structured payload via a callback or hook.

---

## Features

- **Drop-in React component** — `<ChatFlowChat />` renders a fully-themed, accessible chat surface in one line.
- **Headless hooks** — `useChatFlow()` exposes state and actions if you want to build your own UI.
- **Framework-agnostic core** — `ChatFlowClient` works in vanilla JS, Vue, Svelte, Solid, web components — anything.
- **Next.js App Router handler** — `createChatFlowHandler()` keeps your API key server-side with a single import.
- **Voice-ready** — built-in WebRTC and WebSocket voice clients with cold-start readiness UX baked in.
- **Themeable** — every color, radius, font and spacing exposed as a typed theme object or CSS variable.
- **Stable browser identity** — emits a persisted `browserId` so server-side voiceprint matching works across sessions.
- **TypeScript-first** — exhaustive types, no `any` in the public surface.
- **Tree-shakeable, ESM + CJS** — pulls in only what you import.
- **MIT-licensed** — use it anywhere, fork it, embed it.

---

## Installation

```bash
# npm
npm install @swfte/chatflow-widget

# yarn
yarn add @swfte/chatflow-widget

# pnpm
pnpm add @swfte/chatflow-widget
```

React and React DOM are optional peer dependencies — only required if you import from `@swfte/chatflow-widget/react` or `@swfte/chatflow-widget/next`.

---

## Quick start

### React

The widget talks to a small **proxy endpoint** in your own backend that holds the [Swfte](https://www.swfte.com) API key. On Next.js you get this proxy with a one-liner; for everything else, use the [proxy pattern](docs/proxy-pattern.md).

```tsx
import { ChatFlowProvider, ChatFlowChat } from '@swfte/chatflow-widget/react';

function OnboardingChat() {
  return (
    <ChatFlowProvider
      config={{
        endpoint: '/api/chatflow',
        greeting: "Hey! I'm Zara from Workzil. Ready to set up your profile?",
        onComplete: (data) => console.log('Collected:', data),
      }}
    >
      <ChatFlowChat
        agentName="Zara"
        agentSubtitle="Workzil onboarding"
        placeholder="Type your response..."
      />
    </ChatFlowProvider>
  );
}
```

On Next.js (App Router), expose the proxy in `app/api/chatflow/[...path]/route.ts`:

```ts
import { createChatFlowHandler } from '@swfte/chatflow-widget/next';

export const { GET, POST } = createChatFlowHandler({
  apiKey: process.env.SWFTE_API_KEY!,
  chatFlowId: process.env.SWFTE_CHATFLOW_ID!,
  workspaceId: process.env.SWFTE_WORKSPACE_ID!,
});
```

That's it. The browser bundle never sees your API key. See [`docs/integrations/nextjs.md`](docs/integrations/nextjs.md) for the full walkthrough.

### Custom UI with hooks

Build your own chat interface using the `useChatFlow` hook:

```tsx
import { ChatFlowProvider, useChatFlow } from '@swfte/chatflow-widget/react';
import { useState } from 'react';

function CustomChat() {
  const { state, send } = useChatFlow();
  const [input, setInput] = useState('');

  return (
    <div>
      {state.messages.map((msg) => (
        <div key={msg.id} className={msg.role}>
          {msg.content}
        </div>
      ))}

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            send(input);
            setInput('');
          }
        }}
      />

      <div>Progress: {state.progressPercent}%</div>
      <div>Collected: {JSON.stringify(state.collectedData)}</div>
    </div>
  );
}
```

### Framework-agnostic (no React)

The core `ChatFlowClient` is a tiny, dependency-free class. Drive any UI off it.

```ts
import { ChatFlowClient } from '@swfte/chatflow-widget';

const client = new ChatFlowClient({
  endpoint: '/api/chatflow',
  onComplete: (data) => saveProfile(data),
});

await client.start();

client.subscribe(() => {
  const { messages, collectedData, progressPercent } = client.state;
  renderUI(messages, collectedData, progressPercent);
});

await client.send('My name is Yuki, I am a product designer from Tokyo');
```

See [`docs/integrations/vue.md`](docs/integrations/vue.md), [`docs/integrations/svelte.md`](docs/integrations/svelte.md) and [`docs/integrations/vanilla-html.md`](docs/integrations/vanilla-html.md) for framework-specific recipes.

---

## Configuration

Two configs to know: **client config** (for `ChatFlowProvider` / `ChatFlowClient`, runs in the browser, never holds secrets) and **server config** (for `createChatFlowHandler`, runs in your backend, holds the API key).

### Client config — `ChatFlowConfig`

| Prop | Type | Default | Description |
|---|---|---|---|
| `endpoint` | `string` | **required** | URL path to your mounted proxy handler, e.g. `/api/chatflow`. |
| `greeting` | `string` | — | Optional greeting shown if the engine doesn't return one. |
| `prefilledData` | `Record<string, unknown>` | `{}` | Field values pre-populated when the session starts (e.g. `userId`). |
| `timeout` | `number` | `30000` | Per-request timeout in ms. |
| `headers` | `Record<string, string>` | `{}` | Extra headers forwarded to your proxy (e.g. `X-Tenant-Id`). |
| `voiceRuntimeVersion` | `'V1' \| 'V2'` | server-resolved | Pin a voice runtime; default is whatever the server returns from `/config`. |
| `voiceEndpoint` | `string` | server-resolved | Override the voice transport base URL. |
| `chatFlowId` | `string` | server-resolved | Needed by voice clients to attach to the right flow. |
| `workspaceId` | `string` | server-resolved | Needed by voice clients for GPU routing. |
| `voiceReadinessPollerEnabled` | `boolean` | `true` | Toggle the cold-start readiness poller. |
| `onComplete` | `(data) => void` | — | Fires when the session reports `sessionComplete`. |
| `onFieldExtracted` | `(fieldId, value, all) => void` | — | Fires every time a new field appears in `collectedData`. |
| `onMessage` | `(message) => void` | — | Fires on every assistant message. |
| `onError` | `(error) => void` | — | Fires on errors from the proxy. |

### Server config — `ChatFlowServerConfig`

| Prop | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | **required** | Swfte API key. Keep on the server. |
| `chatFlowId` | `string` | **required** | The deployed ChatFlow id. |
| `workspaceId` | `string` | — | Workspace scoping. |
| `baseUrl` | `string` | `https://api.swfte.com/agents` | Override for self-hosted Swfte. |
| `channel` | `'WEB_CHAT' \| 'VOICE' \| 'SMS' \| 'API'` | `'WEB_CHAT'` | Channel for the session. |
| `language` | `string` | `'en-US'` | BCP-47 language tag. |
| `voiceRuntimeVersion` | `'V1' \| 'V2'` | `'V1'` | Voice transport version. |
| `voiceEndpoint` | `string` | derived from `baseUrl` | Public voice endpoint. |
| `greeting` | `string` | — | Greeting forwarded to the client via `GET /config`. |

### `ChatFlowChat` props

| Prop | Type | Default | Description |
|---|---|---|---|
| `theme` | `ChatFlowTheme` | default theme | Visual customization (see [Theming](#theming)). |
| `showHeader` | `boolean` | `true` | Show the agent header. |
| `agentName` | `string` | `'Assistant'` | Name in the header. |
| `agentSubtitle` | `string` | — | Subtitle under the name. |
| `showProgress` | `boolean` | `true` | Show the progress bar. |
| `placeholder` | `string` | `'Type your response...'` | Input placeholder. |
| `className` | `string` | — | Wrapper CSS class. |
| `style` | `CSSProperties` | — | Inline styles on the wrapper. |

---

## Theming

Every visual aspect is customizable through the `theme` prop:

```tsx
<ChatFlowChat
  theme={{
    colors: {
      primary: '#6366f1',
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
    },
    typography: {
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      fontSize: '15px',
      lineHeight: '1.5',
    },
    radius: {
      container: '16px',
      bubble: '20px',
      input: '12px',
      button: '12px',
    },
    spacing: {
      messagePadding: '12px 16px',
      containerPadding: '16px',
    },
  }}
/>
```

Every theme value is also exposed as a CSS variable (`--swfte-cf-color-primary`, `--swfte-cf-radius-bubble`, …) so you can override styles from a stylesheet without touching JS. Full reference at [`docs/theming.md`](docs/theming.md).

---

## Callbacks

```tsx
<ChatFlowProvider
  config={{
    endpoint: '/api/chatflow',
    onComplete: (data) => {
      // All required fields collected — save profile, redirect, fire analytics.
      console.log('Final data:', data);
    },
    onFieldExtracted: (fieldId, value, allData) => {
      // Called every time a new field is extracted.
      console.log(`${fieldId} = ${value}`);
    },
    onMessage: (message) => {
      // Called on every agent message.
      console.log('Agent:', message.content);
    },
    onError: (error) => {
      console.error(error.code, error.message);
    },
  }}
>
  ...
</ChatFlowProvider>
```

---

## Voice ChatFlows

The widget ships with both [Swfte Voice](https://www.swfte.com/products/voice) transports built in: a legacy WebSocket/PCM client (`V1`) and a Rust voice-runtime + WebRTC/WHIP client (`V2`). Your server picks the runtime; the browser auto-resolves.

```tsx
import { ChatFlowProvider, useVoice, useVoiceReadinessStatus } from '@swfte/chatflow-widget/react';
import { useRef } from 'react';

function VoiceUI() {
  const voice = useVoice();
  const readiness = useVoiceReadinessStatus();
  const audioRef = useRef<HTMLAudioElement>(null);

  return (
    <>
      <audio ref={audioRef} autoPlay />
      <button onClick={() => voice.start(audioRef.current!)}>Talk</button>
      <button onClick={voice.stop}>Stop</button>
      <p>{readiness.copy}</p>
    </>
  );
}
```

The provider polls `GET {endpoint}/v2/gpu/readiness` during the cold-start window and surfaces a `copy` string ready to render as a loader caption ("warming up", "connected via cloud", "connected"). See [`docs/use-cases/voice-onboarding.md`](docs/use-cases/voice-onboarding.md).

---

## Security

**Never** ship your Swfte API key to the browser. The widget is designed for a small server-side proxy that holds the key and forwards a narrow set of routes:

- `POST /start` — create session
- `POST /input` — send user message
- `POST /prewarm` — fire-and-forget GPU warm-up
- `GET  /session/:id` — read state
- `GET  /config` — public runtime config

On Next.js, `createChatFlowHandler` builds this proxy for you. On any other stack, [`docs/proxy-pattern.md`](docs/proxy-pattern.md) shows the request/response shapes — it's a 40-line implementation in any language.

Other recommendations:

- Bind the proxy to authenticated users only.
- Issue short-lived signed URLs for any media.
- Rate-limit `POST /input` per session.
- Lock CORS to your own origins.

For full posture details, see [swfte.com/security](https://www.swfte.com/security) and [SECURITY.md](SECURITY.md).

---

## API

### `ChatFlowClient`

| Member | Type | Description |
|---|---|---|
| `start()` | `Promise<void>` | Create the session and emit the greeting. |
| `send(text)` | `Promise<void>` | Send user input, append the assistant reply. |
| `reset()` | `void` | Reset the store back to `idle`. |
| `subscribe(fn)` | `() => void` | Subscribe to state changes; returns an unsubscribe. |
| `state` | `Readonly<ChatFlowState>` | Current state snapshot. |
| `messages` | `readonly ChatFlowMessage[]` | Convenience getter. |
| `collectedData` | `Readonly<Record<string, unknown>>` | Convenience getter. |
| `isComplete` | `boolean` | True when status is `completed`. |

### `createChatFlowClient(config)`

Functional alternative to `new ChatFlowClient(config)`. Same return type.

### React exports — `@swfte/chatflow-widget/react`

| Export | Kind | Description |
|---|---|---|
| `ChatFlowProvider` | component | Wires a `ChatFlowClient` into context, owns voice. |
| `ChatFlowChat` | component | Drop-in chat surface. |
| `useChatFlow` | hook | `{ client, state, send, start, reset, voice, voiceReadiness }`. |
| `useChatFlowMessages` | hook | Subscribe to just the messages array. |
| `useVoice` | hook | The voice sub-controller. |
| `useVoiceReadinessStatus` | hook | Cold-start readiness with renderable copy. |

### Next.js exports — `@swfte/chatflow-widget/next`

| Export | Kind | Description |
|---|---|---|
| `createChatFlowHandler(config)` | factory | Returns `{ GET, POST }` for App Router. |

### Top-level re-exports — `@swfte/chatflow-widget`

| Export | Kind | Description |
|---|---|---|
| `ChatFlowClient`, `createChatFlowClient` | class / fn | Framework-agnostic core. |
| `ChatFlowApi` | class | Lower-level HTTP client (rarely needed directly). |
| `ChatFlowStore` | class | Reducer-style store backing the client. |
| `prepareSelfHostedModels`, `pollUntilReady` | fn | Self-hosted model warm-up helpers. |
| `startReadinessPoller`, `useVoiceReadiness` | fn / hook | GPU readiness polling. |
| `VERSION` | constant | Package version string. |

Full per-symbol reference at [`docs/api-reference.md`](docs/api-reference.md) and [swfte.com/developers](https://www.swfte.com/developers).

---

## Examples

Minimal, runnable starters live in [`examples/`](examples/):

- [`examples/01-react-onboarding`](examples/01-react-onboarding) — Vite + React onboarding flow.
- [`examples/02-nextjs-lead-capture`](examples/02-nextjs-lead-capture) — Next.js App Router with the proxy route fully wired.
- [`examples/03-vue-survey`](examples/03-vue-survey) — Vue 3 + Vite, NPS-style survey.
- [`examples/04-vanilla-html`](examples/04-vanilla-html) — Single-file `index.html` with the framework-agnostic client.

Cookbooks for common use-cases live in [`docs/`](docs/):

- [Onboarding](docs/use-cases/onboarding.md)
- [Lead qualification](docs/use-cases/lead-qualification.md)
- [Support triage](docs/use-cases/support-triage.md)
- [NPS / customer-satisfaction surveys](docs/use-cases/survey.md)
- [Voice phone-call onboarding](docs/use-cases/voice-onboarding.md)

---

## Other Swfte SDKs

- [swfte-python](https://github.com/SwfteAI/swfte-python) — Python SDK ([PyPI](https://pypi.org/project/swfte/))
- [swfte-node](https://github.com/SwfteAI/swfte-node) — Node.js / TypeScript SDK ([npm](https://www.npmjs.com/package/@swfte/sdk))
- [swfte-java](https://github.com/SwfteAI/swfte-java) — Java SDK ([Maven Central](https://search.maven.org/artifact/com.swfte/swfte-sdk))
- [swfte-chat-widget](https://github.com/SwfteAI/swfte-chat-widget) — embeddable chat widget ([npm](https://www.npmjs.com/package/@swfte/chat-widget))

---

## Resources

- [swfte.com](https://www.swfte.com) — product home.
- [swfte.com/products/chatflows](https://www.swfte.com/products/chatflows) — ChatFlows product page.
- [swfte.com/products/voice](https://www.swfte.com/products/voice) — Swfte Voice.
- [swfte.com/products/agents](https://www.swfte.com/products/agents) — Swfte Agents.
- [swfte.com/resources](https://www.swfte.com/resources) — guides and cookbooks.
- [swfte.com/developers](https://www.swfte.com/developers) — full API reference.
- [swfte.com/pricing](https://www.swfte.com/pricing) — pay-as-you-go pricing.
- [swfte.com/security](https://www.swfte.com/security) — security and compliance posture.
- [status.swfte.com](https://status.swfte.com) — service status.
- [github.com/SwfteAI](https://github.com/SwfteAI) — open-source SDKs and examples.

---

## Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Significant contributions require a signed CLA at [cla.swfte.com](https://cla.swfte.com).

## Security disclosure

Disclose vulnerabilities to [security@swfte.com](mailto:security@swfte.com); details in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Swfte, Inc. 2024-2026. See also [swfte.com](https://www.swfte.com).
