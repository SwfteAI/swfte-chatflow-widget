# Proxy Pattern (Don't Expose Your API Key)

The widget runs in the browser and needs a Swfte API key. **Do not** ship that key as a public environment variable. Run a thin proxy on your own backend that holds the key server-side, and point the widget at the proxy.

## What the proxy does

For every request the widget makes (e.g. `POST /v2/chatflows/{id}/sessions`), the proxy:

1. Receives the call from the browser without an API key.
2. Adds the `Authorization` and `X-API-Key` headers from a server-side environment variable.
3. Optionally adds a `X-Workspace-ID` header.
4. Forwards to `https://api.swfte.com/agents`.
5. Streams the response back to the browser.

## Next.js (App Router)

```ts
// app/api/chatflow/[...path]/route.ts
const SWFTE_BASE = 'https://api.swfte.com/agents';

async function forward(req: Request, { params }: { params: { path: string[] } }) {
  const url = `${SWFTE_BASE}/${params.path.join('/')}${new URL(req.url).search}`;
  const r = await fetch(url, {
    method: req.method,
    headers: {
      'Authorization': `Bearer ${process.env.SWFTE_API_KEY}`,
      'X-API-Key': process.env.SWFTE_API_KEY!,
      'X-Workspace-ID': process.env.SWFTE_WORKSPACE_ID ?? '',
      'Content-Type': req.headers.get('content-type') ?? 'application/json',
    },
    body: ['GET','HEAD'].includes(req.method) ? undefined : await req.text(),
  });
  return new Response(r.body, {
    status: r.status,
    headers: { 'Content-Type': r.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
```

## Express

```ts
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

app.use('/api/chatflow', createProxyMiddleware({
  target: 'https://api.swfte.com/agents',
  pathRewrite: { '^/api/chatflow': '' },
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq) => {
      proxyReq.setHeader('Authorization', `Bearer ${process.env.SWFTE_API_KEY}`);
      proxyReq.setHeader('X-API-Key', process.env.SWFTE_API_KEY!);
      proxyReq.setHeader('X-Workspace-ID', process.env.SWFTE_WORKSPACE_ID ?? '');
    },
  },
}));
```

## Cloudflare Worker

```ts
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const target = `https://api.swfte.com/agents${url.pathname.replace('/api/chatflow', '')}${url.search}`;
    const headers = new Headers(req.headers);
    headers.set('Authorization', `Bearer ${env.SWFTE_API_KEY}`);
    headers.set('X-API-Key', env.SWFTE_API_KEY);
    headers.set('X-Workspace-ID', env.SWFTE_WORKSPACE_ID);
    return fetch(target, { method: req.method, headers, body: req.body });
  },
};
```

## Point the widget at the proxy

```tsx
<ChatFlowProvider
  config={{
    baseUrl: '/api/chatflow',
    proxyUrl: '/api/chatflow',
    apiKey: '', // not used when proxy handles auth
    chatFlowId: 'cf_yourchatflowid',
  }}
/>
```

## Rate-limiting at the proxy

The Swfte API enforces per-workspace and per-key rate limits, but you may want an additional per-IP limit at your edge to prevent a single bad actor from burning through your quota. A simple Cloudflare Rule or middleware token-bucket per `cf-connecting-ip` is typically enough.

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
