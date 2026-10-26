import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recordPositions, routeLines, trackLines, type TrackHistory } from '../src/map/flight-path.js';
import { normalizeAdsb } from '../server/providers/normalize-air.js';
import { loadAircraftDetails } from '../server/aircraft-details.js';

test('trail keeps actual observations, rejects duplicate/old positions and resets for a new callsign', () => {
  const history: TrackHistory = new Map();
  const now = Date.now();
  const entity = normalizeAdsb({ now, ac: [{ hex: 'abc123', lat: 40, lon: -70, seen_pos: 0, flight: 'ABC123' }] }, now)[0];
  recordPositions(history, [entity], now);
  recordPositions(history, [entity, { ...entity, ts: now - 1000 }], now);
  assert.equal(history.get(entity.id)?.length, 1);
  recordPositions(history, [{ ...entity, lon: -69, ts: now + 90000 }], now + 90000);
  assert.deepEqual(trackLines(history.get(entity.id)!), [[[-70, 40], [-69, 40]]]);
  recordPositions(history, [{ ...entity, label: 'ABC456', ts: now + 180000 }], now + 180000);
  assert.equal(history.get(entity.id)?.length, 1);
  recordPositions(history, [], now + 3 * 3600000);
  assert.equal(history.size, 0);
});

test('trails split coverage gaps and date-line crossings without drawing false world-spanning paths', () => {
  const points = [{ lon: 179, lat: 30, ts: 1000, label: 'TEST' }, { lon: -179, lat: 32, ts: 91000, label: 'TEST' }, { lon: -160, lat: 33, ts: 500000, label: 'TEST' }];
  assert.deepEqual(trackLines(points), [[[179, 30], [180, 31]], [[-180, 31], [-179, 32]]]);
});

test('reference airport routes follow great circles and split at the date line', () => {
  const route = routeLines([{ code: 'A', name: 'A', lat: 35, lon: 140 }, { code: 'B', name: 'B', lat: 40, lon: -120 }]);
  assert.equal(route.length, 2);
  assert.ok(route.flat().every(point => point.every(Number.isFinite)));
  assert.ok(Math.max(...route.flat().map(point => point[1])) > 45);
  for (const line of route) for (let i = 1; i < line.length; i++) assert.ok(Math.abs(line[i][0] - line[i - 1][0]) <= 180);
});

test('aircraft details preserve exact-airframe photo and distinguish reference route from missing data', async () => {
  const result = await loadAircraftDetails('4010ee', 'EIN17A', async input => new Response(JSON.stringify(String(input).includes('/aircraft/') ? {
    registration: 'G-EZBZ', manufacturer: 'Airbus', type: 'A319', registered_owner: 'easyJet', images: { full: 'https://hexdb.io/static/aircraft-images/G-EZBZ.jpg' },
  } : { airports: [{ icao: 'EIDW', iata: 'DUB', latitude: 53, longitude: -6 }, { icao: 'EGLL', iata: 'LHR', latitude: 51, longitude: 0 }], updated_at: '2025-01-01' })));
  assert.equal(result.registration, 'G-EZBZ');
  assert.match(result.photo!.url, /G-EZBZ.jpg$/);
  assert.equal(result.route?.airports.length, 2);
  assert.equal(result.routeStatus, 'available');
  const missing = await loadAircraftDetails('000000', 'ABC123', async () => new Response('', { status: 404 }));
  assert.equal(missing.photo, null);
  assert.equal(missing.route, null);
  assert.equal(missing.routeStatus, 'unavailable');
});

test('metadata failure does not discard route and malformed provider URLs/coordinates are rejected', async () => {
  const invalid = await loadAircraftDetails('4010ee', 'EIN17A', async input => new Response(JSON.stringify(String(input).includes('/aircraft/') ? { images: { full: 'https://untrusted.example/a.jpg' } } : { airports: [{ icao: 'BAD', latitude: 999, longitude: 0 }, { icao: 'EGLL', latitude: 51, longitude: 0 }] })));
  assert.equal(invalid.photo, null);
  assert.equal(invalid.route, null);
  const unavailable = await loadAircraftDetails('4010ee', 'EIN17A', async () => { throw new Error('offline'); });
  assert.equal(unavailable.metadataStatus, 'error');
  assert.equal(unavailable.routeStatus, 'error');
  const partial = await loadAircraftDetails('4010ee', 'EIN17A', async input => {
    if (String(input).includes('/aircraft/')) throw new Error('offline');
    return new Response(JSON.stringify({ airports: [{ icao: 'EIDW', latitude: 53, longitude: -6 }, { icao: 'EGLL', latitude: 51, longitude: 0 }] }));
  });
  assert.equal(partial.metadataStatus, 'error');
  assert.equal(partial.route?.airports.length, 2);
  assert.equal(partial.routeStatus, 'available');
});
