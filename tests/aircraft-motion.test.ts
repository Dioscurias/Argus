import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeAdsb } from '../server/providers/normalize-air.js';
import { AircraftMotion, estimatePosition, MAX_ESTIMATE_MS } from '../src/map/aircraft-motion.js';

const now = 1800000000000;
const plane = () => normalizeAdsb({ now, ac: [{ hex: 'abc123', lat: 0, lon: 0, track: 90, gs: 360, seen_pos: 0, flight: 'ABC123' }] }, now)[0];
test('360 knots advances six nautical miles in one minute without altering the observation', () => {
  const report = plane();
  const position = estimatePosition(report, now + 60000);
  assert.ok(Math.abs(position.lon - 0.0999326) < 0.00001);
  assert.ok(Math.abs(position.lat) < 0.00001);
  assert.equal(position.estimated, true);
  assert.equal(report.lon, 0);
  assert.equal(report.ts, now);
});
test('northbound motion and antimeridian crossing stay in WGS84 bounds', () => {
  const north = estimatePosition({ ...plane(), heading: 0 }, now + 60000);
  assert.ok(north.lat > 0.099 && north.lat < 0.101);
  const crossing = estimatePosition({ ...plane(), lon: 179.99 }, now + 60000);
  assert.ok(crossing.lon < -179 && crossing.lon >= -180);
});
test('missing motion data, future reports and ground traffic do not invent movement; stale estimates are bounded', () => {
  for (const entity of [{ ...plane(), meta: { missingFields: ['heading'] } }, { ...plane(), meta: { onGround: true } }, { ...plane(), speed: 0 }]) {
    assert.equal(estimatePosition(entity, now + 60000).lon, 0);
  }
  assert.equal(estimatePosition(plane(), now - 1000).lon, 0);
  assert.deepEqual(estimatePosition(plane(), now + MAX_ESTIMATE_MS), estimatePosition(plane(), now + 86400000));
});
test('new observations reconcile smoothly, repeated reports never restart motion and old reports cannot rewind it', () => {
  const motion = new AircraftMotion();
  motion.sync([plane()], now);
  const before = motion.positions(now + 60000)[0];
  motion.sync([{ ...plane(), lon: 0.08, heading: 0, ts: now + 60000 }], now + 60000);
  assert.equal(motion.positions(now + 60000)[0].lon, before.lon);
  const reconciled = motion.positions(now + 63000)[0];
  assert.ok(Math.abs(reconciled.lon - 0.08) < 0.000001);
  assert.ok(reconciled.lat > 0);
  motion.sync([plane()], now + 64000);
  assert.ok(motion.positions(now + 64000)[0].lat > reconciled.lat);
  motion.sync([], now + 65000);
  assert.equal(motion.positions(now + 65000).length, 0);
});
