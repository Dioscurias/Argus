import type { Entity } from '../../shared/schema.js';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const integerFlags = (value: unknown): value is number => numeric(value) && Number.isSafeInteger(value) && value >= 0;
const label = (value: unknown, fallback = 'Unknown') => typeof value === 'string' && value.trim() ? value.trim() : fallback;
function date(value: unknown): number | null {
  const time = numeric(value) ? value < 1e12 ? value * 1000 : value : typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time > 0 && time <= 8.64e15 ? time : null;
}
interface Measurement { id: unknown; lat: unknown; lon: unknown; heading: unknown; speed: unknown; altitude: unknown; ts: unknown; callsign?: unknown; aircraft?: unknown; airline?: unknown; origin?: unknown; destination?: unknown; onGround?: unknown; military?: boolean; modeled?: boolean }
function normalize(source: string, item: Measurement, raw: unknown, now: number): Entity | null {
  if (!numeric(item.lat) || !numeric(item.lon) || Math.abs(item.lat) > 90 || Math.abs(item.lon) > 180 || !label(item.id, '')) return null;
  const ts = date(item.ts);
  const missingFields: string[] = (['heading', 'speed', 'altitude'] as const).filter(key => !numeric(item[key]));
  if (!ts) missingFields.push('timestamp');
  return {
    id: `${source}-${item.id}`, layer: 'air', lat: item.lat, lon: item.lon,
    heading: numeric(item.heading) ? ((item.heading % 360) + 360) % 360 : 0,
    speed: numeric(item.speed) ? Math.max(0, item.speed) : 0,
    altitude: numeric(item.altitude) ? item.altitude : 0,
    label: label(item.callsign, String(item.id)), subtype: label(item.aircraft),
    origin: label(item.origin), destination: label(item.destination), source, ts: ts ?? now,
    provenance: item.modeled ? 'MODELED' : ts && now - ts <= 60000 && ts <= now + 10000 ? 'LIVE' : 'DELAYED',
    meta: { airline: label(item.airline), onGround: item.onGround === true, military: item.military, missingFields, raw, synthetic: false },
  };
}
function compact(entities: (Entity | null)[]) {
  return [...new Map(entities.filter((entity): entity is Entity => entity !== null).map(entity => [entity.id, entity])).values()];
}
export function normalizeFr24(payload: unknown, now: number): Entity[] {
  const data = Array.isArray(payload) ? payload : record(payload).data;
  if (!Array.isArray(data)) throw new Error('Invalid FR24 response');
  return compact(data.map(raw => {
    const r = record(raw);
    return normalize('fr24', { id: r.fr24_id, lat: r.lat, lon: r.lon, heading: r.track, speed: r.gspeed, altitude: r.alt, ts: r.timestamp, callsign: r.callsign ?? r.flight, aircraft: r.type, airline: r.operating_as, origin: r.orig_iata ?? r.orig_icao, destination: r.dest_iata ?? r.dest_icao, onGround: r.on_ground, modeled: String(r.source).toUpperCase().startsWith('EST') }, raw, now);
  }));
}
export function normalizeOpenSky(payload: unknown, now: number): Entity[] {
  const states = record(payload).states;
  if (states === null) return [];
  if (!Array.isArray(states)) throw new Error('Invalid OpenSky response');
  return compact(states.map(raw => {
    if (!Array.isArray(raw)) return null;
    return normalize('opensky', { id: raw[0], lat: raw[6], lon: raw[5], heading: raw[10], speed: numeric(raw[9]) ? raw[9] * 1.943844 : null, altitude: numeric(raw[7]) ? raw[7] * 3.28084 : null, ts: raw[3], callsign: raw[1], onGround: raw[8] }, raw, now);
  }));
}
export function normalizeAdsb(payload: unknown, now: number, includeRaw = true): Entity[] {
  const data = record(payload);
  if (!Array.isArray(data.ac)) throw new Error('Invalid adsb.lol response');
  const observedAt = date(data.now) ?? now;
  const entities = compact(data.ac.map(raw => {
    const r = record(raw);
    // readsb omits zero flags. Registry registration/type indicate a database match.
    const military = integerFlags(r.dbFlags) ? Boolean(r.dbFlags & 1)
      : r.dbFlags === undefined && /^[a-f0-9]{6}$/i.test(label(r.hex, '')) && label(r.r, '') && label(r.t, '') ? false : undefined;
    return normalize('adsblol', { id: r.hex, lat: r.lat, lon: r.lon, heading: r.track, speed: r.gs, altitude: r.alt_baro === 'ground' ? 0 : r.alt_baro, ts: numeric(r.seen_pos) ? observedAt - r.seen_pos * 1000 : null, callsign: r.flight, aircraft: r.t, onGround: r.alt_baro === 'ground', military }, raw, now);
  }));
  if (!includeRaw) for (const entity of entities) delete entity.meta.raw;
  return entities;
}
