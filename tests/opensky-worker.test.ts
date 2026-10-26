import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../worker/opensky-proxy.js';

test('OpenSky proxy serves a public status page at the root', async () => {
  const response = await worker.fetch(new Request('https://proxy.example/'), { ARGUS_PROXY_TOKEN: 'proxy', OPENSKY_CLIENT_ID: 'client', OPENSKY_CLIENT_SECRET: 'secret' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^text\/html/);
  assert.match(await response.text(), /ARGUS OpenSky Proxy is operational/);
});

test('OpenSky proxy rejects unauthenticated requests', async () => {
  const response = await worker.fetch(new Request('https://proxy.example/states'), { ARGUS_PROXY_TOKEN: 'proxy', OPENSKY_CLIENT_ID: 'client', OPENSKY_CLIENT_SECRET: 'secret' });
  assert.equal(response.status, 401);
});

test('OpenSky proxy logs safe OAuth failure metadata', async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logs: string[] = [];
  globalThis.fetch = async () => Response.json({ error: 'invalid_client' }, { status: 401 });
  console.error = (message) => logs.push(String(message));
  try {
    const response = await worker.fetch(new Request('https://proxy.example/states', { headers: { Authorization: 'Bearer proxy' } }), { ARGUS_PROXY_TOKEN: 'proxy', OPENSKY_CLIENT_ID: 'client', OPENSKY_CLIENT_SECRET: 'secret' });
    assert.equal(response.status, 502);
    assert.match(logs.join('\n'), /"status":401/);
    assert.match(logs.join('\n'), /"upstreamError":"invalid_client"/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test('OpenSky proxy exchanges OAuth credentials and forwards global states', async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/protocol/openid-connect/token')) {
      assert.equal(init?.method, 'POST');
      return Response.json({ access_token: 'access', expires_in: 1800 });
    }
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer access');
    return Response.json({ time: 1, states: [] });
  };
  try {
    const response = await worker.fetch(new Request('https://proxy.example/states', { headers: { Authorization: 'Bearer proxy' } }), { ARGUS_PROXY_TOKEN: 'proxy', OPENSKY_CLIENT_ID: 'client', OPENSKY_CLIENT_SECRET: 'secret' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { time: 1, states: [] });
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = original; }
});
