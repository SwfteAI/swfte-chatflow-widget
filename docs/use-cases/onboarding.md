# Use Case: User Onboarding

Replace a multi-step signup form with a single ChatFlow that captures profile data through natural conversation. Field extraction, validation, branching, and re-prompting are all handled by the [Swfte ChatFlows](https://www.swfte.com/products/chatflows) runtime.

## Why a ChatFlow

- **Higher completion** — conversational interfaces consistently out-complete long forms.
- **Validation built in** — email, phone, country, and free-text validators run on the backend.
- **Branching** — ask follow-ups based on prior answers without writing branching logic in the front-end.
- **Multi-channel** — the same ChatFlow can run on web, WhatsApp, Telegram, or as a phone call. See the [voice onboarding use case](./voice-onboarding.md).

## Reference shape

Author the ChatFlow at [swfte.com/products/chatflows](https://www.swfte.com/products/chatflows) with these fields:

| Field id | Type | Required | Notes |
|---|---|---|---|
| `firstName` | STRING | yes | Capitalised, minimum 2 chars. |
| `lastName`  | STRING | yes | |
| `email`     | EMAIL  | yes | Validates against MX records. |
| `role`      | ENUM   | yes | (Founder, Engineer, Designer, Other). |
| `companyName` | STRING | yes | |
| `companySize` | ENUM | yes | (1-10, 11-50, 51-200, 201+). |
| `useCase`   | TEXT   | no  | Free-text — used to seed routing. |

## Mount on signup

```tsx
import { ChatFlowProvider, ChatFlowChat } from '@swfte/chatflow-widget/react';

export default function OnboardingPage({ userId }: { userId: string }) {
  return (
    <ChatFlowProvider
      config={{
        baseUrl: '/api/chatflow', // proxy
        chatFlowId: process.env.NEXT_PUBLIC_ONBOARDING_ID!,
        apiKey: '',
        proxyUrl: '/api/chatflow',
        sessionVariables: { userId }, // injected into prompts and tools
        greeting: "Welcome to Acme! Let's set up your profile in 60 seconds.",
        onComplete: async (data) => {
          await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, ...data }),
          });
          window.location.href = '/dashboard';
        },
        onFieldExtracted: (id, value) => track('onboarding.field', { id, value }),
      }}
    >
      <ChatFlowChat agentName="Acme Setup" />
    </ChatFlowProvider>
  );
}
```

## Drop-off & retry

ChatFlows persist state server-side. If the user closes the tab mid-flow:

1. Store the `sessionId` from the first `onMessage` callback in your DB against the userId.
2. On their next visit, pass `sessionId` to the provider — the SDK syncs `collectedData` and resumes the conversation where it left off.

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
