# Example: Next.js Lead Capture (App Router + Proxy)

Demonstrates the recommended **proxy pattern** — the API key lives in `SWFTE_API_KEY` server-side, the widget calls `/api/chatflow/...`, the proxy forwards to `https://api.swfte.com/agents` with auth headers.

## Run

```bash
npm install
cp .env.example .env.local
# fill SWFTE_API_KEY, SWFTE_WORKSPACE_ID, NEXT_PUBLIC_CHATFLOW_ID
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Structure

- `app/api/chatflow/[...path]/route.ts` — server-side proxy
- `app/page.tsx` — public landing page that mounts the widget against `/api/chatflow`
- `.env.example` — environment template

## Why this pattern

- The browser never sees the API key.
- You can add per-IP rate limits, request validation, and audit logs in the proxy.
- Multi-tenant apps can scope the workspace per-request based on the authenticated user.

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
