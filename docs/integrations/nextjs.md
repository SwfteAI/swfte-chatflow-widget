# Next.js Integration

The widget runs in the browser and needs an API key. In Next.js, the safest pattern is a thin App Router proxy that holds the key server-side.

## App Router proxy + client widget

`app/api/chatflow/[...path]/route.ts`:

```ts
const SWFTE_BASE = 'https://api.swfte.com/agents';
const KEY = process.env.SWFTE_API_KEY!;

async function forward(req: Request, params: { path: string[] }) {
  const url = `${SWFTE_BASE}/${params.path.join('/')}${new URL(req.url).search}`;
  const init: RequestInit = {
    method: req.method,
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'X-API-Key': KEY,
      'X-Workspace-ID': process.env.SWFTE_WORKSPACE_ID ?? '',
      'Content-Type': req.headers.get('content-type') ?? 'application/json',
    },
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text(),
  };
  return fetch(url, init);
}

export const GET = (req: Request, { params }: any) => forward(req, params);
export const POST = (req: Request, { params }: any) => forward(req, params);
export const PUT = (req: Request, { params }: any) => forward(req, params);
export const PATCH = (req: Request, { params }: any) => forward(req, params);
export const DELETE = (req: Request, { params }: any) => forward(req, params);
```

`app/onboarding/page.tsx`:

```tsx
'use client';
import { ChatFlowProvider, ChatFlowChat } from '@swfte/chatflow-widget/react';

export default function OnboardingPage() {
  return (
    <ChatFlowProvider
      config={{
        baseUrl: '/api/chatflow',
        chatFlowId: process.env.NEXT_PUBLIC_CHATFLOW_ID!,
        apiKey: '',
        proxyUrl: '/api/chatflow',
        greeting: "Hey! Let's get you set up.",
        onComplete: (data) => fetch('/api/profile', { method: 'POST', body: JSON.stringify(data) }),
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
NEXT_PUBLIC_CHATFLOW_ID=cf_yourchatflowid
```

Manage these via `vercel env pull` if deploying on Vercel.

## Caching / streaming

The proxy intentionally has no Next.js cache — each ChatFlow turn is unique. Add `export const dynamic = 'force-dynamic'` to the proxy if you suspect Next.js is caching too aggressively.

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
