import type { FeatureCollection, LineString } from 'geojson';
import type { Entity } from '../../shared/schema';
import type { RouteAirport } from '../../shared/aircraft-details';

export interface TrackPoint { lon: number; lat: number; ts: number; label: string }
export type TrackHistory = Map<string, TrackPoint[]>;
export function recordPositions(history: TrackHistory, entities: Entity[], now: number) {
  const cutoff = now - 2 * 60 * 60 * 1000;
  for (const [id, points] of history) if (points.at(-1)!.ts < cutoff) history.delete(id);
  for (const entity of entities) {
    if (entity.ts < cutoff || entity.ts > now + 10000) continue;
    const points = (history.get(entity.id) ?? []).filter(point => point.ts >= cutoff);
    const last = points.at(-1);
    if (last && entity.ts <= last.ts) continue;
    if (last && last.label !== entity.label) points.length = 0;
    points.push({ lon: entity.lon, lat: entity.lat, ts: entity.ts, label: entity.label });
    history.set(entity.id, points.slice(-240));
  }
  // Bound memory even during prolonged sessions or providers with rotating IDs.
  while (history.size > 30000) history.delete(history.keys().next().value!);
}

/** Split lines at the date line instead of drawing across the entire flat map. */
export function splitDateline(points: number[][]): number[][][] {
  if (points.length < 2) return [];
  const lines: number[][][] = [[points[0]]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (Math.abs(b[0] - a[0]) > 180) {
      const adjusted = b[0] + (a[0] > 0 ? 360 : -360);
      const edge = a[0] > 0 ? 180 : -180;
      const lat = a[1] + (b[1] - a[1]) * (edge - a[0]) / (adjusted - a[0]);
      lines.at(-1)!.push([edge, lat]);
      lines.push([[-edge, lat], b]);
    } else lines.at(-1)!.push(b);
  }
  return lines.filter(line => line.length >= 2);
}

export function trackLines(points: TrackPoint[]): number[][][] {
  const segments: number[][][] = [];
  let segment: number[][] = [];
  for (let i = 0; i < points.length; i++) {
    if (i && points[i].ts - points[i - 1].ts > 300000) { segments.push(segment); segment = []; }
    segment.push([points[i].lon, points[i].lat]);
  }
  segments.push(segment);
  return segments.flatMap(splitDateline);
}

/** Great-circle reference between known airports; not an observed flight track. */
export function routeLines(airports: RouteAirport[]): number[][][] {
  const rad = Math.PI / 180;
  const vector = (p: RouteAirport) => [Math.cos(p.lat * rad) * Math.cos(p.lon * rad), Math.cos(p.lat * rad) * Math.sin(p.lon * rad), Math.sin(p.lat * rad)];
  const lines: number[][][] = [];
  for (let leg = 1; leg < airports.length; leg++) {
    const a = vector(airports[leg - 1]), b = vector(airports[leg]);
    const omega = Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, v, i) => sum + v * b[i], 0))));
    if (omega < 1e-8 || Math.PI - omega < 1e-8) continue;
    const steps = Math.max(2, Math.ceil(omega / rad));
    const points = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const v = a.map((x, k) => (x * Math.sin((1 - t) * omega) + b[k] * Math.sin(t * omega)) / Math.sin(omega));
      return [Math.atan2(v[1], v[0]) / rad, Math.atan2(v[2], Math.hypot(v[0], v[1])) / rad];
    });
    lines.push(...splitDateline(points));
  }
  return lines;
}

export function lineFeatures(lines: number[][][]): FeatureCollection<LineString> {
  return { type: 'FeatureCollection', features: lines.map(coordinates => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })) };
}
