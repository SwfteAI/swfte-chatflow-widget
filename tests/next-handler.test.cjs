const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const { createChatFlowHandler } = require('../dist/next/index.js');

const baseUrl = 'https://swfte.example.test';
const config = { apiKey: 'fixture-server-key', chatFlowId: 'flow-1', workspaceId: 'workspace-1', baseUrl };
const path = (...segments) => ({ params: Promise.resolve({ path: segments }) });

function request(route, { headers, body, method = 'GET' } = {}) {
  return new Request(`https://app.example.test/api/chatflow/${route}`, {
    method, headers, body: JSON.stringify(body),
  });
}

function authConfig(owners = new Map()) {
  return {
    ...config,
    // This header stands in for a verified host identity in this local fixture only.
    getUserId: req => req.headers.get('x-test-verified-user'),
    sessionOwnership: {
      getOwner: id => owners.get(id),
      bind: (id, owner) => {
        if (owners.has(id)) return false;
        owners.set(id, owner);
        return true;
      },
    },
  };
}

let calls;
function mockUpstream(handler = () => Response.json({})) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
}

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('missing identity configuration and anonymous requests make no upstream calls', async () => {
  mockUpstream();
  const oldConfig = createChatFlowHandler(config);
  const authenticated = createChatFlowHandler(authConfig());
  for (const handlers of [oldConfig, authenticated]) {
    assert.equal((await handlers.GET(request('session/session-1'), path('session', 'session-1'))).status, 401);
    assert.equal((await handlers.GET(request('readiness'), path('readiness'))).status, 401);
    for (const action of ['start', 'input', 'prewarm']) {
      assert.equal((await handlers.POST(request(action, {
        method: 'POST', body: { sessionId: 'session-1', input: 'hi' },
      }), path(action))).status, 401);
    }
    assert.equal((await handlers.GET(request('config'), path('config'))).status, 200);
  }
  assert.equal(calls.length, 0);
});

test('binds new sessions before the greeting and enforces ownership on resume and input', async () => {
  const owners = new Map();
  const owner = { 'x-test-verified-user': 'owner-1' };
  const other = { 'x-test-verified-user': 'other-user' };
  mockUpstream((url, init) => {
    assert.equal(init.redirect, 'error');
    if (url === baseUrl + '/v2/chatflows/flow-1/sessions') return Response.json({ sessionId: 'session-1' });
    assert.equal(owners.get('session-1'), 'owner-1');
    if (url.endsWith('/input')) return Response.json({ sessionId: 'session-1', message: 'Hello' });
    return Response.json({ sessionId: 'session-1', collectedData: { answer: { value: 'fixture' } } });
  });
  const first = createChatFlowHandler(authConfig(owners));
  const start = await first.POST(request('start', { headers: owner, method: 'POST', body: {} }), path('start'));
  assert.deepEqual(await start.json(), { sessionId: 'session-1', greeting: 'Hello' });

  const freshInstance = createChatFlowHandler(authConfig(owners));
  const deniedState = await freshInstance.GET(request('session/session-1', { headers: other }), path('session', 'session-1'));
  const deniedInput = await freshInstance.POST(request('input', {
    headers: other, method: 'POST', body: { sessionId: 'session-1', input: 'bye' },
  }), path('input'));
  assert.equal(deniedState.status, 404);
  assert.equal(deniedInput.status, 404);
  assert.equal(calls.length, 2);

  const resumed = await freshInstance.GET(request('session/session-1', { headers: owner }), path('session', 'session-1'));
  assert.equal(resumed.status, 200);
  assert.equal(resumed.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual((await resumed.json()).collectedData, { answer: 'fixture' });
  const input = await freshInstance.POST(request('input', {
    headers: owner, method: 'POST', body: { sessionId: 'session-1', input: 'hi' },
  }), path('input'));
  assert.equal(input.status, 200);
  assert.equal(calls.length, 5);
});

test('missing or unavailable ownership fails closed before a read', async () => {
  mockUpstream();
  for (const sessionOwnership of [undefined, {
    getOwner() { throw new Error('fixture db outage'); },
    bind() { throw new Error('fixture db outage'); },
  }]) {
    const handlers = createChatFlowHandler({ ...authConfig(), sessionOwnership });
    const r = await handlers.GET(request('session/session-1', {
      headers: { 'x-test-verified-user': 'owner-1' },
    }), path('session', 'session-1'));
    assert.equal(r.status, 503);
  }
  assert.equal(calls.length, 0);
});

test('prewarm requires a separate authorization and rate limit before upstream', async () => {
  mockUpstream();
  const send = handlers => handlers.POST(request('prewarm', {
    headers: { 'x-test-verified-user': 'owner-1' }, method: 'POST',
  }), path('prewarm'));

  assert.equal((await send(createChatFlowHandler(authConfig()))).status, 403);
  const limited = createChatFlowHandler({
    ...authConfig(),
    authorizePrewarm: (_req, userId) => {
      assert.equal(userId, 'owner-1');
      return 'rate_limited';
    },
  });
  assert.equal((await send(limited)).status, 429);
  assert.equal(calls.length, 0);
  const allowed = createChatFlowHandler({ ...authConfig(), authorizePrewarm: () => 'allowed' });
  assert.equal((await send(allowed)).status, 200);
  assert.equal(calls.length, 1);
});
