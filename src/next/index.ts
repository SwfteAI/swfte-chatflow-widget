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
 * Mount at `app/api/chatflow/[...path]/route.ts`:
 * ```ts
 * import { createChatFlowHandler } from '@swfte/chatflow-widget/next';
 *
 * export const { GET, POST } = createChatFlowHandler({
 *   apiKey: process.env.SWFTE_API_KEY!,
 *   chatFlowId: process.env.SWFTE_ONBOARDING_CHATFLOW_ID!,
 *   workspaceId: process.env.SWFTE_WORKSPACE_ID,
 * });
 * ```
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

  async function resolveParams(ctx: { params: Promise<{ path?: string[] }> }): Promise<string[]> {
    const resolved = await ctx.params;
    return resolved.path ?? [];
  }

  // ── POST handler ────────────────────────────────────────────────────

  async function POST(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
    const path = await resolveParams(ctx);
    const action = path[0];

    // POST /start — create session
    if (action === 'start') {
      const body = (await req.json()) as { prefilledData?: Record<string, unknown> } | null;

      const res = await fetch(`${base}/v2/chatflows/${config.chatFlowId}/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          channel: config.channel ?? 'WEB_CHAT',
          language: config.language ?? 'en-US',
          prefilledData: body?.prefilledData,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return jsonResponse({ error: `Failed to create session: ${errText}` }, res.status);
      }

      const session = await res.json();
      const sessionId = session.sessionId || session.id;

      // Send SESSION_START to get the engine's opening greeting aligned with the
      // first field. This avoids the client showing a greeting that's out of sync
      // with the engine's state.
      let greeting = '';
      try {
        const startRes = await fetch(`${base}/v2/chatflows/sessions/${sessionId}/input`, {
          method: 'POST',
          headers,
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
      const body = (await req.json()) as { sessionId?: string; input?: string } | null;
      const sessionId = body?.sessionId;
      const input = body?.input?.trim();

      if (!sessionId || !input) {
        return jsonResponse({ error: 'sessionId and input are required' }, 400);
      }

      // Send to ChatFlow
      const inputRes = await fetch(`${base}/v2/chatflows/sessions/${sessionId}/input`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ input, inputType: 'TEXT' }),
      });

      if (!inputRes.ok) {
        const errText = await inputRes.text().catch(() => '');
        return jsonResponse({ error: `Input failed: ${errText}` }, inputRes.status >= 500 ? 502 : inputRes.status);
      }

      const result = await inputRes.json();

      // Fetch session state for collected data (per-turn extractedData is often empty)
      let collectedData: Record<string, unknown> = {};
      try {
        const stateRes = await fetch(`${base}/v2/chatflows/sessions/${sessionId}`, { headers });
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

    // POST /prewarm — fire-and-forget GPU scale-up. Relayed to agents-service
    // /v2/voice/prewarm/{workspaceId} which scales up BOTH the Gemma and
    // VoiceUtilities ASGs in parallel. Widget fires this on mount so by the
    // time the user clicks "Start" the GPUs have had ~10-30s of head-start
    // on the ~5 min cold-boot from baked AMIs.
    if (action === 'prewarm') {
      const ws = config.workspaceId;
      if (!ws) {
        // Nothing to prewarm when no workspace is configured — no-op success
        // so the widget's mount flow doesn't log errors in dev setups.
        return jsonResponse({ prewarmed: false, reason: 'no-workspace-id' });
      }
      // Don't await — widget shouldn't wait on scale-up.
      try {
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(`${base}/v2/voice/prewarm/${encodeURIComponent(ws)}`, {
          method: 'POST',
          headers,
          signal: ctrl.signal,
        });
        clearTimeout(timeoutId);
        const body = res.ok ? await res.json().catch(() => ({})) : null;
        return jsonResponse({ prewarmed: res.ok, status: res.status, detail: body });
      } catch (e) {
        // Never surface a prewarm failure to the UX — just log it.
        return jsonResponse({ prewarmed: false, error: String(e) });
      }
    }

    return jsonResponse({ error: 'Unknown action' }, 404);
  }

  // ── GET handler ─────────────────────────────────────────────────────

  async function GET(_req: unknown, ctx: { params: Promise<{ path?: string[] }> }) {
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
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(url, { headers, signal: ctrl.signal });
        clearTimeout(timeoutId);
        if (!res.ok) {
          // Treat upstream failure as "not ready, keep polling" rather than
          // bubbling 5xx — the poller's retry loop handles transient errors.
          return jsonResponse({
            ready: false, etaSeconds: 60, mode: 'COLD',
            fallbackActive: false, reason: `upstream-${res.status}`, targets: [],
          });
        }
        return jsonResponse(await res.json());
      } catch (e) {
        return jsonResponse({
          ready: false, etaSeconds: 60, mode: 'COLD',
          fallbackActive: false, reason: String(e), targets: [],
        });
      }
    }

    // GET /session/:id — get session state
    if (path[0] === 'session' && path[1]) {
      const sessionId = path[1];
      const res = await fetch(`${base}/v2/chatflows/sessions/${sessionId}`, { headers });

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

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
