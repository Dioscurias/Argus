import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createArgusServer } from '../server/app.js';
import { readConfig } from '../server/config.js';
import type { Snapshot } from '../shared/schema.js';

test('platform-managed HTTP servers stream updates without calling the CLI listen wrapper', async () => {
  const config = readConfig({ MOCK_AIR_COUNT: '1', MOCK_SEA_COUNT: '0', MOCK_TRUCK_COUNT: '0', POLL_INTERVAL_MS: '500' });
  const app = createArgusServer(config);
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
  try {
    const [first] = await once(socket, 'message');
    const [second] = await once(socket, 'message', { signal: AbortSignal.timeout(1800) });
    const a = JSON.parse(first.toString()) as Snapshot;
    const b = JSON.parse(second.toString()) as Snapshot;
    assert.ok(b.generatedAt > a.generatedAt);
    assert.notEqual(b.entities[0].lon, a.entities[0].lon);
  } finally {
    socket.terminate();
    await app.close();
  }
});

test('HTTP and WebSocket expose modeled snapshots without secrets and reject other origins', async () => {
  const config = readConfig({ MOCK_AIR_COUNT: '3', MOCK_SEA_COUNT: '2', MOCK_TRUCK_COUNT: '1' });
  const app = createArgusServer({ ...config, port: 0 });
  await app.listen();
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const socket = new WebSocket(base.replace('http', 'ws') + '/ws');
  try {
    const [message] = await once(socket, 'message');
    const streamed = JSON.parse(message.toString()) as Snapshot;
    assert.equal(streamed.type, 'snapshot');
    assert.equal(streamed.mode, 'mock');
    assert.equal(streamed.entities.length, 6);
    assert.ok(streamed.entities.every(e => e.provenance === 'MODELED'));
    const response = await fetch(base + '/api/snapshot');
    const snapshot = await response.json() as Snapshot;
    assert.equal(snapshot.sequence, streamed.sequence);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(snapshot.counts, { air: 3, sea: 2, truck: 1 });
    assert.ok(!JSON.stringify(snapshot).includes('API_KEY'));
    const health = await (await fetch(base + '/api/health')).json();
    assert.equal(health.mode, 'mock');
    assert.equal((await fetch(base + '/api/missing')).status, 404);
    assert.equal((await fetch(base + '/api/aircraft/not-a-hex')).status, 400);
    assert.equal((await fetch(base + '/api/aircraft/4010ee?callsign=INVALID%2FURL')).status, 400);
    const rejected = new WebSocket(base.replace('http', 'ws') + '/ws', { origin: 'https://untrusted.example' });
    const [error] = await once(rejected, 'error');
    assert.match(error.message, /403/);
  } finally {
    socket.terminate();
    await app.close();
  }
});

test('live snapshot validates viewport and returns only observed adsb.lol aircraft', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.startsWith('https://api.adsb.lol/')) return Response.json({ now: Date.now(), ac: [{ hex: 'abc123', lat: 40, lon: -97, alt_baro: 32000, gs: 440, track: 90, seen_pos: 2, flight: 'LIVE1', t: 'A320' }] });
    return originalFetch(input);
  };
  const app = createArgusServer({ ...readConfig({ MOCK_DATA_MODE: 'false', AIR_PROVIDER: 'adsblol', AIR_FALLBACK_PROVIDER: 'none' }), port: 0 });
  await app.listen();
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(`${base}/api/snapshot?lat=999&lon=-98`)).status, 400);
    const response = await fetch(`${base}/api/snapshot?lat=39&lon=-98`);
    const snapshot = await response.json() as Snapshot;
    assert.equal(snapshot.mode, 'mixed');
    assert.deepEqual(snapshot.counts, { air: 1, sea: 0, truck: 0 });
    assert.equal(snapshot.entities[0].provenance, 'LIVE');
    assert.equal(snapshot.entities[0].source, 'adsblol');
    assert.ok(snapshot.entities.every(entity => entity.provenance !== 'MODELED'));
  } finally {
    await app.close();
    globalThis.fetch = originalFetch;
  }
});

test('OpenSky mode serves the configured global provider instead of the viewport provider', async () => {
  const originalFetch = globalThis.fetch;
  const upstream: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('http://127.0.0.1:')) return originalFetch(input, init);
    if (url.startsWith('https://auth.opensky-network.org/')) return Response.json({ access_token: 'test-token', expires_in: 1800 });
    if (url.startsWith('https://opensky-network.org/api/states/all')) {
      upstream.push(url);
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-token');
      const seconds = Date.now() / 1000;
      return Response.json({ states: [['abc123', 'GLOBAL1 ', 'US', seconds, seconds, -1, 51, 10000, false, 200, 90]] });
    }
    throw new Error(`Unexpected upstream ${url}`);
  };
  const config = readConfig({ MOCK_DATA_MODE: 'false', AIR_PROVIDER: 'opensky', AIR_FALLBACK_PROVIDER: 'none', AIR_BOUNDS: '90,-90,-180,180', OPENSKY_CLIENT_ID: 'client', OPENSKY_CLIENT_SECRET: 'secret', AIR_POLL_INTERVAL_MS: '90000' });
  const app = createArgusServer({ ...config, port: 0 });
  await app.listen();
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const snapshot = await (await fetch(`http://127.0.0.1:${address.port}/api/snapshot?lat=39&lon=-98`)).json() as Snapshot;
    assert.equal(snapshot.feeds[0].id, 'opensky');
    assert.equal(snapshot.counts.air, 1);
    assert.equal(snapshot.entities[0].label, 'GLOBAL1');
    assert.equal(upstream.length, 1);
  } finally {
    await app.close();
    globalThis.fetch = originalFetch;
  }
});
