import type { AircraftDetails, RouteAirport } from '../shared/aircraft-details.js';

const cache = new Map<string, { expires: number; result: Promise<AircraftDetails> }>();
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : null;
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};

async function lookup(path: string, fetcher: typeof fetch) {
  const response = await fetcher(`https://hexdb.io/api/v2/${path}`, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Aircraft information provider unavailable');
  return record(await response.json());
}

export async function loadAircraftDetails(hex: string, callsign: string, fetcher: typeof fetch = fetch): Promise<AircraftDetails> {
  const [metadata, route] = await Promise.allSettled([
    lookup(`aircraft/${encodeURIComponent(hex)}`, fetcher),
    callsign ? lookup(`routes/${encodeURIComponent(callsign)}`, fetcher) : Promise.resolve(null),
  ]);
  const info = metadata.status === 'fulfilled' ? metadata.value : null;
  const routing = route.status === 'fulfilled' ? route.value : null;
  const images = record(info?.images);
  const photoUrl = text(images.full) ?? text(images.thumbnail);
  const safePhoto = photoUrl && /^https:\/\/hexdb\.io\/static\/aircraft-images\/[A-Za-z0-9_.-]+$/.test(photoUrl) ? photoUrl : null;
  const airports: RouteAirport[] = Array.isArray(routing?.airports) ? routing.airports.slice(0, 16).flatMap(value => {
    const airport = record(value);
    return typeof airport.latitude === 'number' && Number.isFinite(airport.latitude) && Math.abs(airport.latitude) <= 90 && typeof airport.longitude === 'number' && Number.isFinite(airport.longitude) && Math.abs(airport.longitude) <= 180 && text(airport.icao)
      ? [{ code: text(airport.iata) ?? text(airport.icao)!, name: text(airport.name) ?? 'Unknown airport', lat: airport.latitude, lon: airport.longitude }] : [];
  }) : [];
  const validRoute = airports.length >= 2 && airports.length === (routing?.airports as unknown[])?.length;
  return {
    hex, registration: text(info?.registration), aircraft: [text(info?.manufacturer), text(info?.type)].filter(Boolean).join(' ') || null,
    operator: text(info?.registered_owner), photo: safePhoto ? { url: safePhoto, source: 'https://hexdb.io', credit: 'Photo via hexdb.io' } : null,
    route: validRoute ? { airports, updatedAt: text(routing?.updated_at) } : null,
    metadataStatus: metadata.status === 'rejected' ? 'error' : info ? 'available' : 'unavailable',
    routeStatus: route.status === 'rejected' ? 'error' : validRoute ? 'available' : 'unavailable',
  };
}

export function aircraftDetails(hex: string, callsign: string) {
  const key = `${hex}:${callsign}`;
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.result;
  const result = loadAircraftDetails(hex, callsign);
  cache.set(key, { expires: Date.now() + 300000, result });
  void result.then(value => {
    if ((value.metadataStatus === 'error' || value.routeStatus === 'error') && cache.get(key)?.result === result) cache.delete(key);
  });
  if (cache.size > 256) cache.delete(cache.keys().next().value!);
  return result;
}
