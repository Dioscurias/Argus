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
    const rejected = new WebSocket(base.replace('http', 'ws') + '/ws', { origin: 'https://untrusted.example' });
    const [error] = await once(rejected, 'error');
    assert.match(error.message, /403/);
  } finally {
    socket.terminate();
    await app.close();
  }
});
