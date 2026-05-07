# Example: Vue 3 NPS Survey

Minimal Vue 3 + Vite app showing the framework-agnostic `ChatFlowClient` driving an NPS survey UI.

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## What this shows

- `ChatFlowClient` (no React) wired into a Vue 3 component via the composition API.
- Manual rendering of messages and progress.

> ⚠️ Production deployments should use a server-side proxy. See [proxy-pattern.md](../../docs/proxy-pattern.md).

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
