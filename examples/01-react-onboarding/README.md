# Example: React Onboarding

Minimal React + Vite app embedding a Swfte ChatFlow for user onboarding.

## Run

```bash
npm install
SWFTE_API_KEY=sk-swfte-... \
SWFTE_WORKSPACE_ID=226 \
SWFTE_CHATFLOW_ID=cf_yourchatflowid \
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The widget will mount and start the ChatFlow.

> ⚠️ This example puts the API key into the browser via `import.meta.env.VITE_*`. **Do not** ship that to production. See [proxy-pattern.md](../../docs/proxy-pattern.md).

## What this shows

- `ChatFlowProvider` + `ChatFlowChat` mount.
- `onComplete` handler that logs collected data.
- Minimal Tailwind-style styling using CSS variables.

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
