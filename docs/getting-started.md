# Getting Started

`@swfte/chatflow-widget` is the official embeddable conversational form widget for the [Swfte](https://www.swfte.com) platform. It runs ChatFlows — conversational onboarding, lead-qualification, surveys, support triage, and voice flows — designed and authored on [swfte.com](https://www.swfte.com/products/chatflows).

## Install

```bash
npm install @swfte/chatflow-widget
# or
yarn add @swfte/chatflow-widget
# or
pnpm add @swfte/chatflow-widget
```

## Pre-requisites

You will need:

1. A Swfte workspace — sign up at [swfte.com](https://www.swfte.com).
2. A published ChatFlow — design and publish one at [swfte.com/products/chatflows](https://www.swfte.com/products/chatflows).
3. A Swfte API key — generate one in your workspace settings, or via the [Swfte API](https://www.swfte.com/developers).

## Mount your first widget (React)

```tsx
import { ChatFlowProvider, ChatFlowChat } from '@swfte/chatflow-widget/react';

export function Onboarding() {
  return (
    <ChatFlowProvider
      config={{
        endpoint: 'https://api.swfte.com/agents',
        chatFlowId: 'cf_xxxxxxxxxxxxxxxxxxx',
        apiKey: process.env.NEXT_PUBLIC_SWFTE_API_KEY,
        workspaceId: '226',
        greeting: "Hi! Let's set up your account.",
        onComplete: (data) => console.log('Collected:', data),
      }}
    >
      <ChatFlowChat agentName="Onboarding" />
    </ChatFlowProvider>
  );
}
```

> ⚠️ Don't expose your API key in the browser. Use the [proxy pattern](./proxy-pattern.md) for any production deployment.

## Framework guides

- [React](./integrations/react.md)
- [Next.js (App Router)](./integrations/nextjs.md)
- [Vue 3 / Nuxt](./integrations/vue.md)
- [SvelteKit](./integrations/svelte.md)
- [Vanilla HTML / CDN](./integrations/vanilla-html.md)

## Use cases

- [User onboarding](./use-cases/onboarding.md)
- [B2B lead qualification](./use-cases/lead-qualification.md)
- [Support request triage](./use-cases/support-triage.md)
- [NPS / customer surveys](./use-cases/survey.md)
- [Voice phone-call onboarding](./use-cases/voice-onboarding.md)

## Reference

- [Configuration & API](./api-reference.md)
- [Theming](./theming.md)
- [Proxy pattern](./proxy-pattern.md)

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
