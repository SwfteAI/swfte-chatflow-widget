import type { ChatFlowServerConfig, CollectedFieldValue } from '../types';

// ---------------------------------------------------------------------------
// Swfte API helpers (server-side only)
// ---------------------------------------------------------------------------

function swfteHeaders(config: ChatFlowServerConfig): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };
  if (config.workspaceId) h['X-Workspace-Id'] = config.workspaceId;
  return h;
}

function swfteBase(config: ChatFlowServerConfig): string {
  return (config.baseUrl || 'https://api.swfte.com/agents').replace(/\/+$/, '');
}

/** Flatten { fieldId: { value: x } } → { fieldId: x } */
function flattenCollectedData(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    out[key] =
      typeof val === 'object' && val !== null && 'value' in (val as object)
        ? (val as CollectedFieldValue).value
        : val;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Next.js handler factory
// ---------------------------------------------------------------------------

/**
 * Creates Next.js App Router GET & POST handlers for ChatFlow.
 *
 * Mount at `app/api/chatflow/[...path]/route.ts` with the host's verified user
 * identity and session ownership store. Configure a separate prewarm policy
 * only when the host allows GPU prewarm.
 *
 * The handler exposes these sub-routes:
 * - `POST /start`           — create a new ChatFlow session
 * - `POST /input`           — send user message to session
 * - `POST /prewarm`         — fire-and-forget GPU scale-up
 * - `GET  /session/:id`     — get session state & collected data
 * - `GET  /config`          — public runtime config (voice version, endpoints)
 */
export function createChatFlowHandler(config: ChatFlowServerConfig) {
  const base = swfteBase(config);
  const headers = swfteHeaders(config);
  const upstream = (url: string, init?: RequestInit) =>
    fetch(url, { ...init, headers, redirect: 'error', cache: 'no-store' });

  async function requireUser(request: Request): Promise<string | Response> {
    try {
      const userId = await config.getUserId?.(request);
      return typeof userId === 'string' && userId.trim()
        ? userId
        : jsonResponse({ error: 'Authentication required' }, 401);
    } catch {
      return jsonResponse({ error: 'Authentication unavailable' }, 503);
    }
  }

  async function requireOwner(sessionId: string, userId: string): Promise<Response | undefined> {
    try {
      if (config.sessionOwnership) {
        if (await config.sessionOwnership.getOwner(sessionId) === userId) return undefined;
        return jsonResponse({ error: 'Session not found' }, 404);
      }
    } catch {
      // An unavailable ownership store must never allow access.
    }
    return jsonResponse({ error: 'Session ownership unavailable' }, 503);
  }

  async function resolveParams(ctx: { params: Promise<{ path?: string[] }> }): Promise<string[]> {
    const resolved = await ctx.params;
    return resolved.path ?? [];
  }

  // ── POST handler ────────────────────────────────────────────────────

  async function POST(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
    const path = await resolveParams(ctx);
    const action = path[0];
    if (!['start', 'input', 'prewarm'].includes(action)) {
      return jsonResponse({ error: 'Unknown action' }, 404);
    }

    const userId = await requireUser(req);
    if (typeof userId !== 'string') return userId;

    // POST /start — create session
    if (action === 'start') {
      const ownership = config.sessionOwnership;
      if (!ownership) return jsonResponse({ error: 'Session ownership unavailable' }, 503);
      const body = (await req.json().catch(() => null)) as { prefilledData?: Record<string, unknown> } | null;

      const res = await upstream(`${base}/v2/chatflows/${encodeURIComponent(config.chatFlowId)}/sessions`, {
        method: 'POST',
        body: JSON.stringify({
          channel: config.channel ?? 'WEB_CHAT',
          language: config.language ?? 'en-US',
          prefilledData: body?.prefilledData,
        }),
      });

      if (!res.ok) {
        return jsonResponse({ error: 'Failed to create session' }, res.status);
      }

      const session = await res.json();
      const sessionId = session.sessionId || session.id;
      if (!isSessionId(sessionId)) return jsonResponse({ error: 'Invalid upstream session' }, 502);

      try {
        if (await ownership.bind(sessionId, userId) !== true) {
          return jsonResponse({ error: 'Failed to bind session' }, 502);
        }
      } catch {
        return jsonResponse({ error: 'Session ownership unavailable' }, 503);
      }

      // Send SESSION_START to get the engine's opening greeting aligned with the
      // first field. This avoids the client showing a greeting that's out of sync
      // with the engine's state.
      let greeting = '';
      try {
        const startRes = await upstream(`${base}/v2/chatflows/sessions/${sessionId}/input`, {
          method: 'POST',
          body: JSON.stringify({ input: '', inputType: 'SESSION_START' }),
        });
        if (startRes.ok) {
          const startData = await startRes.json();
          greeting = startData.message || '';
        }
      } catch {
        // Non-critical — client can show its own greeting as fallback
      }

      return jsonResponse({ sessionId, greeting });
    }

    // POST /input — send message
    if (action === 'input') {
      const body = (await req.json().catch(() => null)) as { sessionId?: unknown; input?: unknown } | null;
      const sessionId = body?.sessionId;
      const input = typeof body?.input === 'string' ? body.input.trim() : '';

      if (!isSessionId(sessionId) || !input) {
        return jsonResponse({ error: 'sessionId and input are required' }, 400);
      }

      const denied = await requireOwner(sessionId, userId);
      if (denied) return denied;

      const inputRes = await upstream(`${base}/v2/chatflows/sessions/${sessionId}/input`, {
        method: 'POST',
        body: JSON.stringify({ input, inputType: 'TEXT' }),
      });

      if (!inputRes.ok) {
        return jsonResponse({ error: 'Input failed' }, inputRes.status >= 500 ? 502 : inputRes.status);
      }

      const result = await inputRes.json();

      // Fetch session state for collected data (per-turn extractedData is often empty)
      let collectedData: Record<string, unknown> = {};
      try {
        const stateRes = await upstream(`${base}/v2/chatflows/sessions/${sessionId}`);
        if (stateRes.ok) {
          const session = await stateRes.json();
          if (session.collectedData) {
            collectedData = flattenCollectedData(session.collectedData);
          }
        }
      } catch { /* non-critical */ }

      return jsonResponse({
        sessionId: result.sessionId,
        message: result.message || '',
        collectedData,
        currentFieldId: result.currentFieldId || null,
        progressPercent: result.progressPercent || null,
        sessionComplete: result.sessionComplete === true,
        nextAction: result.nextAction || 'CONTINUE',
      });
    }

    // POST /prewarm — the host may spend capacity only after a separate policy check.
    let decision;
    try {
      decision = await config.authorizePrewarm?.(req, userId);
    } catch {
      return jsonResponse({ error: 'Prewarm authorization unavailable' }, 503);
    }
    if (decision === 'rate_limited') {
      return jsonResponse({ error: 'Prewarm rate limit exceeded' }, 429);
    }
    if (decision !== 'allowed') return jsonResponse({ error: 'Prewarm forbidden' }, 403);

    const ws = config.workspaceId;
    if (!ws) return jsonResponse({ prewarmed: false, reason: 'no-workspace-id' });
    try {
      const res = await upstream(`${base}/v2/voice/prewarm/${encodeURIComponent(ws)}`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
      });
      const body = res.ok ? await res.json().catch(() => ({})) : null;
      return jsonResponse({ prewarmed: res.ok, status: res.status, detail: body });
    } catch {
      return jsonResponse({ prewarmed: false, error: 'Prewarm request failed' });
    }
  }

  // ── GET handler ─────────────────────────────────────────────────────

  async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
    const path = await resolveParams(ctx);

    // GET /config — public config the browser provider needs at mount.
    // The server owns voiceRuntimeVersion so we can flip the whole deployment
    // V1<->V2 without a widget release. No secrets leak — apiKey stays server-side.
    if (path[0] === 'config') {
      return jsonResponse({
        voiceRuntimeVersion: config.voiceRuntimeVersion ?? 'V1',
        voiceEndpoint: config.voiceEndpoint ?? config.baseUrl ?? null,
        chatFlowId: config.chatFlowId,
        workspaceId: config.workspaceId ?? null,
        channel: config.channel ?? 'WEB_CHAT',
        language: config.language ?? 'en-US',
        greeting: config.greeting ?? null,
      });
    }

    if (path[0] !== 'readiness' && !(path[0] === 'session' && isSessionId(path[1]))) {
      return jsonResponse({ error: 'Not found' }, 404);
    }

    const userId = await requireUser(req);
    if (typeof userId !== 'string') return userId;

    // GET /readiness — proxy to agents-service /v2/gpu/readiness so the
    // browser-side VoiceReadinessPoller can poll without exposing the
    // upstream URL or apiKey. Aggregates across all configured GPU stacks
    // (Gemma + VU + FBTts). Returns the same shape (ready, etaSeconds,
    // mode, fallbackActive, targets[]).
    if (path[0] === 'readiness') {
      const ws = config.workspaceId;
      const url = ws
        ? `${base}/v2/gpu/readiness?workspace=${encodeURIComponent(ws)}`
        : `${base}/v2/gpu/readiness`;
      try {
        const res = await upstream(url, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) {
          // Treat upstream failure as "not ready, keep polling" rather than
          // bubbling 5xx — the poller's retry loop handles transient errors.
          return jsonResponse({
            ready: false, etaSeconds: 60, mode: 'COLD',
            fallbackActive: false, reason: `upstream-${res.status}`, targets: [],
          });
        }
        return jsonResponse(await res.json());
      } catch {
        return jsonResponse({
          ready: false, etaSeconds: 60, mode: 'COLD',
          fallbackActive: false, reason: 'upstream-unavailable', targets: [],
        });
      }
    }

    // GET /session/:id — get session state
    if (path[0] === 'session' && path[1]) {
      const sessionId = path[1];
      const denied = await requireOwner(sessionId, userId);
      if (denied) return denied;

      const res = await upstream(`${base}/v2/chatflows/sessions/${sessionId}`);

      if (!res.ok) {
        return jsonResponse({ error: 'Session not found' }, res.status);
      }

      const session = await res.json();
      const collectedData = session.collectedData
        ? flattenCollectedData(session.collectedData)
        : {};

      return jsonResponse({
        sessionId: session.sessionId,
        state: session.state,
        collectedData,
        currentFieldId: session.currentFieldId || null,
        fieldsCollected: session.fieldsCollected || Object.keys(collectedData).length,
        progressPercent: session.progressPercent || null,
      });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  }

  return { GET, POST };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
}
