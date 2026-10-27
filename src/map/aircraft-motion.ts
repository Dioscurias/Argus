import type { Entity } from '../../shared/schema';

export const MAX_ESTIMATE_MS = 5 * 60 * 1000;
const RECONCILE_MS = 2000;
const rad = Math.PI / 180;
const wrapLongitude = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;
export interface AircraftPosition { id: string; lon: number; lat: number; heading: number; estimated: boolean }

/** Dead reckoning from the last measured ground speed/track, never a new observation. */
export function estimatePosition(report: Entity, now: number): AircraftPosition {
  const base = { id: report.id, lon: report.lon, lat: report.lat, heading: report.heading, estimated: false };
  const missing = Array.isArray(report.meta.missingFields) ? report.meta.missingFields : [];
  if (report.meta.onGround || ['speed', 'heading', 'timestamp'].some(field => missing.includes(field)) || !Number.isFinite(report.heading) || !Number.isFinite(report.speed) || report.speed < 1 || !Number.isFinite(report.ts)) return base;
  const elapsed = Math.max(0, Math.min(MAX_ESTIMATE_MS, now - report.ts));
  if (!elapsed) return base;
  const distance = report.speed * 1852 * elapsed / 3600000 / 6371008.8;
  const lat = report.lat * rad, lon = report.lon * rad, bearing = report.heading * rad;
  const destinationLat = Math.asin(Math.max(-1, Math.min(1, Math.sin(lat) * Math.cos(distance) + Math.cos(lat) * Math.sin(distance) * Math.cos(bearing))));
  const destinationLon = lon + Math.atan2(Math.sin(bearing) * Math.sin(distance) * Math.cos(lat), Math.cos(distance) - Math.sin(lat) * Math.sin(destinationLat));
  return { ...base, lat: destinationLat / rad, lon: wrapLongitude(destinationLon / rad), estimated: true };
}

interface MotionState { report: Entity; from: AircraftPosition | null; receivedAt: number }
function positionAt(state: MotionState, now: number): AircraftPosition {
  const target = estimatePosition(state.report, now);
  if (!state.from || now - state.receivedAt >= RECONCILE_MS) return target;
  const fraction = Math.max(0, Math.min(1, (now - state.receivedAt) / RECONCILE_MS));
  const t = fraction * fraction * (3 - 2 * fraction);
  return { ...target, estimated: true,
    lat: state.from.lat + (target.lat - state.from.lat) * t,
    lon: wrapLongitude(state.from.lon + wrapLongitude(target.lon - state.from.lon) * t),
    heading: (state.from.heading + wrapLongitude(target.heading - state.from.heading) * t + 360) % 360,
  };
}

export class AircraftMotion {
  private states = new Map<string, MotionState>();
  sync(reports: Entity[], now: number) {
    const ids = new Set(reports.map(report => report.id));
    for (const id of this.states.keys()) if (!ids.has(id)) this.states.delete(id);
    for (const report of reports) {
      const previous = this.states.get(report.id);
      if (!previous) { this.states.set(report.id, { report, from: null, receivedAt: now }); continue; }
      if (report.ts < previous.report.ts) continue;
      if (report.ts === previous.report.ts && report.lat === previous.report.lat && report.lon === previous.report.lon && report.heading === previous.report.heading && report.speed === previous.report.speed && report.meta.onGround === previous.report.meta.onGround) continue;
      this.states.set(report.id, { report, from: positionAt(previous, now), receivedAt: now });
    }
  }
  positions(now: number) { return [...this.states.values()].map(state => positionAt(state, now)); }
}
