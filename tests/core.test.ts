import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MockProvider } from '../server/providers/mock.js';
import { TTLCache } from '../server/cache.js';
import { readConfig } from '../server/config.js';
import { initialLayers, layerReducer, isLayerVisible } from '../src/layers/state.js';
import { isSnapshot, type Snapshot } from '../shared/schema.js';

const now = 1_800_000_000_000;

test('mock generation is deterministic, typed, bounded, and always MODELED', () => {
  const a = new MockProvider({ seed: 42, counts: { air: 200, sea: 150, truck: 80 }, epoch: now });
  const b = new MockProvider({ seed: 42, counts: { air: 200, sea: 150, truck: 80 }, epoch: now });
  const entities = a.poll(now);
  assert.deepEqual(entities, b.poll(now));
  assert.equal(entities.length, 430);
  assert.equal(new Set(entities.map(e => e.id)).size, entities.length);
  for (const entity of entities) {
    assert.equal(entity.provenance, 'MODELED');
    assert.equal(entity.ts, now);
    assert.ok(entity.lat >= -90 && entity.lat <= 90);
    assert.ok(entity.lon >= -180 && entity.lon <= 180);
    assert.ok(entity.heading >= 0 && entity.heading < 360);
    assert.ok(entity.speed > 0);
    assert.equal(entity.meta.synthetic, true);
    assert.ok(entity.source.startsWith('mock-'));
    assert.ok(entity.label && entity.origin && entity.destination && entity.subtype);
  }
});

test('mock positions progress with elapsed time while identities stay stable', () => {
  const provider = new MockProvider({ seed: 7, counts: { air: 2, sea: 2, truck: 2 }, epoch: now });
  const first = provider.poll(now);
  const later = provider.poll(now + 60_000);
  assert.deepEqual(first.map(e => e.id), later.map(e => e.id));
  for (let i = 0; i < first.length; i++) {
    assert.notDeepEqual([first[i].lat, first[i].lon], [later[i].lat, later[i].lon]);
    assert.equal(later[i].provenance, 'MODELED');
  }
});

test('short TTL cache expires and can be invalidated', () => {
  let clock = 0;
  const cache = new TTLCache<number>(100, () => clock);
  cache.set(8);
  assert.equal(cache.get(), 8);
  clock = 99;
  assert.equal(cache.get(), 8);
  clock = 100;
  assert.equal(cache.get(), undefined);
  cache.set(12);
  cache.clear();
  assert.equal(cache.get(), undefined);
});

test('solo temporarily isolates a layer and restores previous visibility', () => {
  const initial = { layers: initialLayers(), soloId: null };
  const solo = layerReducer(initial, { type: 'solo', id: 'air' });
  assert.ok(isLayerVisible(solo, 'air'));
  assert.ok(!isLayerVisible(solo, 'airports'));
  assert.ok(isLayerVisible(solo, 'basemap'));
  const restored = layerReducer(solo, { type: 'solo', id: 'air' });
  assert.deepEqual(restored, initial);
});

test('reorder keeps every layer once, and opacity stays within bounds', () => {
  const initial = { layers: initialLayers(), soloId: null };
  const next = layerReducer(initial, { type: 'move', id: 'air', targetId: 'graticule' });
  assert.equal(next.layers[1].id, 'air');
  assert.equal(new Set(next.layers.map(l => l.id)).size, initial.layers.length);
  assert.equal(initial.layers[1].id, 'graticule');
  const opacity = layerReducer(next, { type: 'opacity', id: 'air', value: 4 });
  assert.equal(opacity.layers.find(l => l.id === 'air')?.opacity, 1);
});

test('explicit visibility controls exit solo and apply the visible action', () => {
  const initial = { layers: initialLayers(), soloId: null };
  const solo = layerReducer(initial, { type: 'solo', id: 'graticule' });
  const hidden = layerReducer(solo, { type: 'toggle', id: 'graticule' });
  assert.equal(isLayerVisible(hidden, 'graticule'), false);
  assert.equal(hidden.soloId, null);
  const shown = layerReducer(solo, { type: 'toggle', id: 'airports' });
  assert.equal(isLayerVisible(shown, 'airports'), true);
  assert.equal(shown.soloId, null);
});

test('stream validation rejects malformed feed fields, invalid dates, and incomplete entities', () => {
  const valid: Snapshot = {
    type: 'snapshot', version: 1, mode: 'mock', sequence: 1, generatedAt: now, intervalMs: 2000,
    counts: { air: 1, sea: 1, truck: 1 },
    entities: new MockProvider({ seed: 42, counts: { air: 1, sea: 1, truck: 1 }, epoch: now }).poll(now),
    feeds: (['air', 'sea', 'truck'] as const).map(layer => ({ id: `mock-${layer}`, name: `Synthetic ${layer}`, layer, count: 1, updatedAt: now, health: 'healthy', provenance: 'MODELED', message: 'Synthetic' })),
  };
  assert.equal(isSnapshot(valid), true);
  assert.equal(isSnapshot({ ...valid, feeds: valid.feeds.map(feed => ({ layer: feed.layer, provenance: 'MODELED' })) }), false);
  assert.equal(isSnapshot({ ...valid, generatedAt: 9e15 }), false);
  assert.equal(isSnapshot({ ...valid, feeds: [null, null, null] }), false);
  assert.equal(isSnapshot({ ...valid, counts: { air: -1, sea: 1, truck: 1 } }), false);
  assert.equal(isSnapshot({ ...valid, entities: valid.entities.map(entity => ({ ...entity, heading: undefined })) }), false);
  assert.equal(isSnapshot({ ...valid, entities: valid.entities.map(entity => ({ ...entity, provenance: 'LIVE' })) }), false);
  assert.equal(isSnapshot({ ...valid, entities: [] }), false);
});

test('configuration defaults to mock and validates live provider settings', () => {
  const config = readConfig({});
  assert.equal(config.mockMode, true);
  assert.equal(config.port, 3001);
  assert.equal(readConfig({ MOCK_DATA_MODE: 'false' }).mockMode, false);
  const vercelLive = readConfig({ MOCK_DATA_MODE: 'false', VERCEL: '1', AIR_PROVIDER: 'adsblol' });
  assert.equal(vercelLive.mockMode, false);
  assert.equal(vercelLive.air.provider, 'adsblol');
  assert.equal(readConfig({ MOCK_DATA_MODE: 'false', AIR_PROVIDER: 'adsblol-global' }).air.provider, 'adsblol-global');
  assert.throws(() => readConfig({ AIR_BOUNDS: '100,0,0,10' }), /AIR_BOUNDS/);
  assert.throws(() => readConfig({ MOCK_DATA_MODE: 'oops' }), /MOCK_DATA_MODE/);
  assert.throws(() => readConfig({ PORT: 'oops' }), /PORT/);
  assert.throws(() => readConfig({ MOCK_AIR_COUNT: '-1' }), /MOCK_AIR_COUNT/);
  assert.throws(() => readConfig({ POLL_INTERVAL_MS: '10' }), /POLL_INTERVAL_MS/);
});
