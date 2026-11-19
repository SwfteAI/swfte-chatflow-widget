# Authenticated ChatFlow Proxy

The browser calls your host proxy at `/api/chatflow`. The host keeps the Swfte API key server-side and resolves a verified caller before any credentialed upstream request. The [Next.js handler](integrations/nextjs.md) implements this contract.

| Browser request | Host authorization and upstream request |
|---|---|
| `GET /config` | Return the runtime configuration locally. Include only public fields. |
| `POST /start` | Verify the caller. Create a session at `POST /v2/chatflows/{chatFlowId}/sessions`. Persist its ID and owner atomically before returning the session or requesting its greeting. |
| `POST /input` | Verify the caller owns the requested session before forwarding to `POST /v2/chatflows/sessions/{sessionId}/input`. |
| `GET /session/:id` | Verify the caller owns the requested session before fetching `GET /v2/chatflows/sessions/{sessionId}`. |
| `GET /readiness` | Verify the caller before forwarding a readiness request to the configured Swfte upstream. |
| `POST /prewarm` | Verify the caller, require specific prewarm permission and consume a host rate-limit allowance before any upstream request. |

Use fixed upstream routes and reject redirects on credentialed calls. Return 401 when the caller is unauthenticated and 404 for absent or non-owned sessions. Keep session bindings in a shared store and disable response caching for session data. Protect cookie-backed POST routes with your host’s CSRF checks.

See the [README quickstart](../README.md#quick-start) for the browser configuration.
