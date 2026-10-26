import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeFr24, normalizeOpenSky, normalizeAdsb } from '../server/providers/normalize-air.js';
import { filterAircraft } from '../src/layers/air-filters.js';
import { AirFeed } from '../server/air-feed.js';
import { getJson, ProviderError, type AirProvider } from '../server/providers/air-provider.js';
import { AdsbLolProvider } from '../server/providers/adsblol.js';
import { OpenSkyProvider } from '../server/providers/opensky.js';

const now = 1800000000000;
test('FR24 records preserve source identity, units, and old-position provenance', () => {
  const [entity] = normalizeFr24({ data: [{ fr24_id: 'abc', lat: 42, lon: -74, track: 90, gspeed: 410, alt: 35000, callsign: 'TEST1', type: 'A320', operating_as: 'TST', orig_iata: 'JFK', dest_iata: 'LHR', timestamp: new Date(now - 120000).toISOString() }] }, now);
  assert.equal(entity.provenance, 'DELAYED');
  assert.equal(entity.speed, 410);
  assert.equal(entity.altitude, 35000);
  assert.equal(entity.origin, 'JFK');
  assert.equal(entity.meta.airline, 'TST');
  assert.equal(entity.source, 'fr24');
});
test('OpenSky converts units, rejects missing locations, and does not invent route information', () => {
  const input = { states: [['abc123', 'TST123 ', 'US', now / 1000, now / 1000, -74, 42, 10000, false, 200, 95], ['invalid', null, null, null, now / 1000, null, null]] };
  const records = normalizeOpenSky(input, now);
  assert.equal(records.length, 1);
  assert.equal(records[0].provenance, 'LIVE');
  assert.ok(Math.abs(records[0].altitude - 32808.4) < 1);
  assert.ok(Math.abs(records[0].speed - 388.769) < 1);
  assert.equal(records[0].origin, 'Unknown');
  assert.equal(records[0].meta.airline, 'Unknown');
});
test('adsb position age uses seen_pos and excludes non-aircraft records without coordinates', () => {
  const records = normalizeAdsb({ now, ac: [{ hex: 'abc', lat: 40, lon: -75, alt_baro: 'ground', gs: 0, track: 0, seen_pos: 90, flight: 'TST2', t: 'B738' }, { hex: 'bad' }] }, now);
  assert.equal(records.length, 1);
  assert.equal(records[0].provenance, 'DELAYED');
  assert.equal(records[0].altitude, 0);
  assert.equal(records[0].meta.onGround, true);
});
test('air filters combine altitude, airline and aircraft type without admitting missing altitudes', () => {
  const entities = normalizeFr24({ data: [
    { fr24_id: 'a', lat: 1, lon: 2, alt: 35000, type: 'A320', operating_as: 'AAA', timestamp: now / 1000 },
    { fr24_id: 'b', lat: 1, lon: 2, alt: null, type: 'A320', operating_as: 'AAA', timestamp: now / 1000 },
  ] }, now);
  assert.equal(filterAircraft(entities, { altitude: 'high', airline: 'AAA', aircraft: 'A320' }).length, 1);
  assert.equal(filterAircraft(entities, { altitude: 'all', airline: 'BBB', aircraft: 'all' }).length, 0);
});
test('air feed falls back on primary failure, retains delayed observations, and respects next poll', async () => {
  let calls = 0;
  let fail = false;
  const primary: AirProvider = { id: 'fr24', minIntervalMs: 60000, poll: async () => { calls++; throw new Error('unavailable'); } };
  const fallback: AirProvider = { id: 'opensky', minIntervalMs: 900000, poll: async (time) => {
    calls++;
    if (fail) throw new Error('unavailable');
    return normalizeOpenSky({ states: [['abc', 'SIM', 'US', time / 1000, time / 1000, -74, 42, 10000, false, 200, 90]] }, time);
  } };
  const feed = new AirFeed(primary, fallback, 60000);
  await feed.refresh(now);
  assert.equal(feed.status(now).id, 'opensky');
  assert.equal(feed.status(now).health, 'degraded');
  await feed.refresh(now + 1000);
  assert.equal(calls, 2);
  fail = true;
  await feed.refresh(now + 900001);
  assert.equal(feed.entities(now + 900001)[0].provenance, 'DELAYED');
  assert.equal(feed.status(now + 900001).health, 'offline');
});
test('air feed emits a valid timestamp before its first provider response', () => {
  const provider: AirProvider = { id: 'fr24', minIntervalMs: 60000, poll: async () => [] };
  assert.equal(new AirFeed(provider, null, 60000).status(now).updatedAt, now);
});
test('provider HTTP helper honors the largest standard or OpenSky retry delay', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 429, headers: { 'Retry-After': '120', 'X-Rate-Limit-Retry-After-Seconds': '600' } });
  try {
    await assert.rejects(getJson('https://example.invalid'), (error: unknown) => error instanceof ProviderError && error.retryAfterMs === 600000 && error.status === 429);
  } finally { globalThis.fetch = original; }
});
test('adsb.lol requests identify ARGUS with public contact URLs', async () => {
  const original = globalThis.fetch;
  let userAgent = '';
  globalThis.fetch = async (_input, init) => {
    userAgent = String(new Headers(init?.headers).get('User-Agent') ?? '');
    return Response.json({ now: Date.now(), ac: [] });
  };
  try {
    await new AdsbLolProvider('39,-98,250').poll(Date.now());
    assert.match(userAgent, /ARGUS/);
    assert.match(userAgent, /github\.com\/Dioscurias\/Argus/);
  } finally { globalThis.fetch = original; }
});
test('OpenSky falls back to quota-safe anonymous global states when OAuth transport fails', async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith('https://auth.opensky-network.org/')) throw new TypeError('fetch failed');
    return Response.json({ states: [] });
  };
  try {
    const provider = new OpenSkyProvider('90,-90,-180,180', 'client', 'secret');
    await provider.poll(Date.now());
    assert.equal(provider.minIntervalMs, 900000);
    assert.ok(calls.some(url => url.startsWith('https://opensky-network.org/api/states/all')));
  } finally { globalThis.fetch = original; }
});
