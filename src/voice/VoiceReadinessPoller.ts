// Polls GPU readiness while the cold-start window is open and surfaces
// a status object the widget can render against. Stops polling once any
// terminal condition fires:
//   - all stacks ready (`ready: true`)
//   - cloud fallback has committed (`fallbackActive: true`) — the user is
//     served, no point waiting on GPU
//   - the consumer signals stop via the returned `cancel()` (e.g., session
//     ended before warmup finished)
//
// Hits `${endpoint}/readiness` — the Next.js relay (sdks/chatflow-widget/
// src/next/index.ts) proxies that to agents-service /v2/gpu/readiness so
// the browser doesn't see the upstream URL or apiKey. The Java endpoint
// already aggregates across all configured stacks (Gemma + VU + FBTts).
//
// This is a pure-fetch poller with no React deps so it can be unit-tested
// without a DOM. The React hook in this same file wraps it.

import { useEffect, useRef, useState } from 'react';

export interface ReadinessTarget {
  name: string;
  ready: boolean;
  etaSeconds: number;
  mode: 'SPOT' | 'ON_DEMAND' | 'COLD' | 'CLOUD_FALLBACK';
  reason: string;
}

export interface ReadinessSnapshot {
  ready: boolean;
  etaSeconds: number;
  mode: 'SPOT' | 'ON_DEMAND' | 'COLD' | 'CLOUD_FALLBACK';
  reason: string;
  fallbackActive: boolean;
  targets: ReadinessTarget[];
}

export type ReadinessPhase =
  | 'idle'
  | 'connecting'   // 0-10s elapsed
  | 'warming'      // 10-60s elapsed, cold
  | 'cloud'        // fallback committed
  | 'ready';

export interface ReadinessStatus {
  phase: ReadinessPhase;
  /** Seconds since polling started — drives copy transitions. */
  elapsedSeconds: number;
  snapshot: ReadinessSnapshot | null;
  /** Display copy chosen from the phase. */
  copy: string;
  /** True iff the poller is still running (not stopped on a terminal). */
  polling: boolean;
}

export interface PollerOptions {
  endpoint: string;
  workspaceId?: string;
  intervalMs?: number;        // default 1500
  /** When false, the poller does nothing (used to gate behind a feature flag). */
  enabled?: boolean;
  /** Polling stops automatically when phase enters 'cloud' or 'ready'. */
  onSnapshot?: (s: ReadinessSnapshot) => void;
  /** Custom fetch (for tests). */
  fetchImpl?: typeof fetch;
}

const COPY_BY_PHASE: Record<ReadinessPhase, string> = {
  idle: '',
  connecting: 'Connecting…',
  warming: 'Spinning up your assistant…',
  cloud: 'Connected via cloud',
  ready: 'Connected',
};

/**
 * Pure (non-React) poller. Returns a control object with `cancel()`.
 * Use this directly in non-React contexts; React consumers should use the
 * `useVoiceReadiness` hook below.
 */
export function startReadinessPoller(opts: PollerOptions): {
  cancel: () => void;
  /** Resolves when polling stops (terminal state or cancel()). */
  done: Promise<void>;
} {
  const intervalMs = opts.intervalMs ?? 1500;
  const fetchFn = opts.fetchImpl ?? fetch;
  // The relay reads workspaceId from server config (apiKey-scoped), so the
  // query param is optional — kept for direct-to-backend testing setups.
  const ws = opts.workspaceId ? `?workspace=${encodeURIComponent(opts.workspaceId)}` : '';
  const url = opts.endpoint.replace(/\/+$/, '') + '/readiness' + ws;

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const stop = () => {
    if (cancelled) return;
    cancelled = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    resolveDone();
  };

  const tick = async () => {
    if (cancelled) return;
    try {
      const resp = await fetchFn(url, { method: 'GET' });
      if (resp.ok) {
        const snap = (await resp.json()) as ReadinessSnapshot;
        opts.onSnapshot?.(snap);
        if (snap.ready || snap.fallbackActive) {
          stop();
          return;
        }
      }
    } catch {
      // Swallow — transient network errors keep us polling.
    }
    if (!cancelled) {
      timer = setTimeout(tick, intervalMs);
    }
  };

  if (opts.enabled === false) {
    stop();
  } else {
    // First tick immediate so the consumer gets initial state quickly.
    void tick();
  }

  return { cancel: stop, done };
}

/**
 * React hook. Polls readiness while `enabled` is true. Returns the latest
 * status + copy + phase the widget can render.
 *
 * Phase transitions:
 *   - idle       → enabled=false (no polling)
 *   - connecting → first 0–10 s of polling
 *   - warming    → 10–60 s of polling while still cold
 *   - cloud      → fallbackActive observed; terminal
 *   - ready      → ready=true observed; terminal
 *
 * The hook never re-starts after a terminal phase for the same mount —
 * a session reset (different workspaceId) creates a new poll cycle.
 */
export function useVoiceReadiness(opts: PollerOptions): ReadinessStatus {
  const [status, setStatus] = useState<ReadinessStatus>({
    phase: opts.enabled === false ? 'idle' : 'connecting',
    elapsedSeconds: 0,
    snapshot: null,
    copy: COPY_BY_PHASE[opts.enabled === false ? 'idle' : 'connecting'],
    polling: opts.enabled !== false,
  });
  const startedAt = useRef<number>(0);

  useEffect(() => {
    if (opts.enabled === false) {
      setStatus({
        phase: 'idle',
        elapsedSeconds: 0,
        snapshot: null,
        copy: COPY_BY_PHASE.idle,
        polling: false,
      });
      return;
    }
    startedAt.current = Date.now();

    const handle = startReadinessPoller({
      ...opts,
      onSnapshot: (snap) => {
        const elapsedSec = Math.floor((Date.now() - startedAt.current) / 1000);
        let phase: ReadinessPhase;
        if (snap.ready) phase = 'ready';
        else if (snap.fallbackActive) phase = 'cloud';
        else if (elapsedSec < 10) phase = 'connecting';
        else phase = 'warming';
        setStatus({
          phase,
          elapsedSeconds: elapsedSec,
          snapshot: snap,
          copy: phase === 'warming' && snap.etaSeconds > 0
            ? `Spinning up your assistant (~${snap.etaSeconds}s)…`
            : COPY_BY_PHASE[phase],
          polling: phase !== 'cloud' && phase !== 'ready',
        });
        opts.onSnapshot?.(snap);
      },
    });

    // Tick every second to advance "connecting → warming" copy even when
    // the server snapshot doesn't change.
    const elapsedTimer = setInterval(() => {
      setStatus((prev) => {
        if (prev.phase === 'cloud' || prev.phase === 'ready') return prev;
        const elapsedSec = Math.floor((Date.now() - startedAt.current) / 1000);
        let nextPhase = prev.phase;
        if (elapsedSec >= 10 && prev.phase === 'connecting') nextPhase = 'warming';
        return {
          ...prev,
          elapsedSeconds: elapsedSec,
          phase: nextPhase,
          copy: nextPhase === 'warming' && prev.snapshot?.etaSeconds
            ? `Spinning up your assistant (~${prev.snapshot.etaSeconds}s)…`
            : COPY_BY_PHASE[nextPhase],
        };
      });
    }, 1000);

    return () => {
      handle.cancel();
      clearInterval(elapsedTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.endpoint, opts.workspaceId, opts.enabled, opts.intervalMs]);

  return status;
}
