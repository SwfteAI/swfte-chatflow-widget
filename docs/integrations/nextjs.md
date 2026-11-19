# Next.js Integration

Configure the App Router handler with your host’s verified user identity and durable session ownership. Use the [route example in the README](../../README.md#quick-start).

- Resolve the caller from the authenticated host session, with the host’s CSRF checks for POST requests. Use a user ID that distinguishes accounts across tenants. Return `null` if the request is unauthenticated.
- Store bindings in a shared database scoped to the workspace and ChatFlow. Use a unique key on the scope and session ID. Implement `bind` with an insert-if-absent operation and return whether it inserted a row. Keep bindings for the duration of resumability. Backfill existing sessions only from trusted records of their owners before upgrading.
- To enable prewarm, set `authorizePrewarm(request, userId)`. Return `forbidden` for callers without prewarm permission, `rate_limited` when a shared quota is exhausted, and `allowed` only after both the permission check and atomic quota consumption succeed. Apply limits per user and workspace.
- Keep `SWFTE_API_KEY` in server-only configuration. The browser points to the same-origin route.

`app/onboarding/page.tsx`:

```tsx
'use client';
import { ChatFlowProvider, ChatFlowChat } from '@swfte/chatflow-widget/react';

export default function OnboardingPage() {
  return (
    <ChatFlowProvider
      config={{
        endpoint: '/api/chatflow',
        greeting: "Hey! Let's get you set up.",
      }}
    >
      <ChatFlowChat agentName="Onboarding" />
    </ChatFlowProvider>
  );
}
```

## Environment variables

```
SWFTE_API_KEY=sk-swfte-...
SWFTE_WORKSPACE_ID=226
SWFTE_CHATFLOW_ID=cf_yourchatflowid
```

Manage these via `vercel env pull` if deploying on Vercel.

## Caching / streaming

The handler marks proxied responses private and sends upstream requests with caching disabled.

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
