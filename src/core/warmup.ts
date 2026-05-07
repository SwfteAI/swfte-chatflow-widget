/**
 * Self-hosted model warmup client for the Swfte SDK.
 *
 * A chatflow or embedding process that wants to use self-hosted models
 * (Gemma for Fast Brain, Voxtral for STT/TTS) calls
 * {@link prepareSelfHostedModels} before the first real request. The
 * server-side {@code POST /v2/gpu/prepare} endpoint:
 *   1. Records usage so the idle-scale-down loop defers.
 *   2. Calls {@code GpuProvisioningService.ensureCapacity}, which scales
 *      the GPU ASG up if it's currently at zero.
 *   3. Returns a {@link WarmupStatus} — {@code ready=true} means the path
 *      is hot now; {@code ready=false} gives an {@code etaSeconds} the UI
 *      can show in a loader.
 *
 * The SDK also exposes {@link pollUntilReady} — a simple polling helper
 * callers can await while showing a "Preparing your assistant..." modal.
 * Both functions are flag-respecting: if the server's GPU path is
 * disabled, {@link prepareSelfHostedModels} returns immediately with
 * {@code ready=true, mode=CLOUD_FALLBACK}.
 *
 * Usage
 * -----
 *
 *     import { prepareSelfHostedModels, pollUntilReady } from '@swfte/chatflow-widget';
 *
 *     // In your onboarding / session-start flow:
 *     const status = await prepareSelfHostedModels({
 *       baseUrl:     'https://api.swfte.com',
 *       workspaceId: '226',
 *       flowId:      'intake-v2',
 *       models:      ['gemma-2-2b-it', 'voxtral-stt'],
 *     });
 *     if (!status.ready) {
 *       showLoader(status.etaSeconds);
 *       await pollUntilReady({ baseUrl, workspaceId: '226', timeoutSeconds: 180 });
 *     }
 *     // Proceed into the real chatflow session.
 */

export interface WarmupRequest {
  /** Base URL of agents-service (or the Next.js proxy). */
  baseUrl: string;
  /** Workspace requesting warmup. */
  workspaceId: string;
  /** Optional — used for server-side metrics + future flow-scoped warmup. */
  flowId?: string;
  /** Which self-hosted models the flow will use. Today: informational. */
  models?: string[];
  /** Optional — 'session-start' | 'pre-roll' | 'admin' — goes into server logs. */
  reason?: string;
  /** Optional — extra HTTP headers (auth tokens, etc.). */
  headers?: Record<string, string>;
  /** Optional — fetch timeout in ms (default 10 000). */
  timeoutMs?: number;
}

export interface WarmupStatus {
  /** True iff the GPU path is already serving requests. */
  ready: boolean;
  /** When ready=false, seconds the client should wait before re-polling. */
  etaSeconds: number;
  /** vLLM endpoint the client will use once warm. */
  endpoint: string;
  /** SPOT | ON_DEMAND | COLD | CLOUD_FALLBACK. */
  mode: 'SPOT' | 'ON_DEMAND' | 'COLD' | 'CLOUD_FALLBACK';
  /** UUID you can pass back for idempotency; the server echoes this. */
  warmupToken: string;
  /** Echo of the models[] passed in. */
  models: string[];
}

export interface PollUntilReadyOptions {
  baseUrl: string;
  workspaceId: string;
  /** Max wall-time to wait before giving up (default 180 s). */
  timeoutSeconds?: number;
  /** Poll interval (default 2 s). */
  intervalSeconds?: number;
  /** Callback fired on every poll so the UI can update progress text. */
  onProgress?: (status: Partial<WarmupStatus> & { elapsedSeconds: number }) => void;
  headers?: Record<string, string>;
}

/**
 * Ask the Swfte platform to prepare self-hosted model capacity.
 *
 * <p>Never throws — network failures return {@code ready=true, mode=
 * CLOUD_FALLBACK} on the assumption that the backend's own fallback chain
 * handles the slow path. The UI should proceed either way.</p>
 */
export async function prepareSelfHostedModels(req: WarmupRequest): Promise<WarmupStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), req.timeoutMs ?? 10_000);
  try {
    const res = await fetch(`${req.baseUrl.replace(/\/$/, '')}/v2/gpu/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(req.headers ?? {}) },
      body: JSON.stringify({
        workspaceId: req.workspaceId,
        flowId: req.flowId,
        models: req.models ?? [],
        reason: req.reason ?? 'session-start',
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return fallbackStatus(req.models);
    }
    const body = await res.json();
    return {
      ready: !!body.ready,
      etaSeconds: Number(body.etaSeconds ?? 0),
      endpoint: String(body.endpoint ?? ''),
      mode: (body.mode as WarmupStatus['mode']) ?? 'COLD',
      warmupToken: String(body.warmupToken ?? ''),
      models: Array.isArray(body.models) ? body.models : (req.models ?? []),
    };
  } catch {
    return fallbackStatus(req.models);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Poll {@code GET /v2/gpu/readiness} until {@code ready=true} or timeout.
 * Resolves with the final status. Use after
 * {@link prepareSelfHostedModels} when {@code ready=false}.
 */
export async function pollUntilReady(opts: PollUntilReadyOptions): Promise<WarmupStatus> {
  const timeout = (opts.timeoutSeconds ?? 180) * 1000;
  const interval = (opts.intervalSeconds ?? 2) * 1000;
  const start = Date.now();
  let last: WarmupStatus = fallbackStatus([]);
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(
        `${opts.baseUrl.replace(/\/$/, '')}/v2/gpu/readiness?workspace=${encodeURIComponent(opts.workspaceId)}`,
        { headers: opts.headers ?? {} }
      );
      if (res.ok) {
        const body = await res.json();
        last = {
          ready: !!body.ready,
          etaSeconds: Number(body.etaSeconds ?? 0),
          endpoint: String(body.endpoint ?? ''),
          mode: (body.mode as WarmupStatus['mode']) ?? 'COLD',
          warmupToken: '',
          models: [],
        };
        opts.onProgress?.({ ...last, elapsedSeconds: Math.round((Date.now() - start) / 1000) });
        if (last.ready) return last;
      }
    } catch {
      // Transient — retry on the next interval.
    }
    await sleep(interval);
  }
  return last;
}

function fallbackStatus(models: string[] | undefined): WarmupStatus {
  return {
    ready: true,
    etaSeconds: 0,
    endpoint: '',
    mode: 'CLOUD_FALLBACK',
    warmupToken: '',
    models: models ?? [],
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
