/** Normalized transport units: WGS84 degrees, knots, feet, Unix milliseconds. */
export type TransportLayer = 'air' | 'sea' | 'truck';
export type Provenance = 'LIVE' | 'DELAYED' | 'MODELED';
export type FeedHealth = 'healthy' | 'degraded' | 'offline';

export interface Entity {
  id: string;
  layer: TransportLayer;
  lat: number;
  lon: number;
  heading: number;
  speed: number;
  altitude: number;
  label: string;
  subtype: string;
  origin: string;
  destination: string;
  source: string;
  ts: number;
  provenance: Provenance;
  meta: Record<string, unknown>;
}

export interface FeedStatus {
  id: string;
  layer: TransportLayer;
  name: string;
  health: FeedHealth;
  provenance: Provenance;
  count: number;
  updatedAt: number;
  message: string;
}

export interface Snapshot {
  type: 'snapshot';
  version: 1;
  mode: 'mock' | 'mixed';
  sequence: number;
  generatedAt: number;
  intervalMs: number;
  counts: Record<TransportLayer, number>;
  feeds: FeedStatus[];
  entities: Entity[];
}

/** Reject malformed or falsely live frames at the mock-mode boundary. */
export function isSnapshot(value: unknown): value is Snapshot {
  const record = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item);
  const finite = (item: unknown): item is number => typeof item === 'number' && Number.isFinite(item);
  const count = (item: unknown): item is number => finite(item) && Number.isSafeInteger(item) && item >= 0;
  const timestamp = (item: unknown): item is number => count(item) && item <= 8.64e15;
  const text = (item: unknown): item is string => typeof item === 'string' && item.length > 0;
  const layerName = (item: unknown): item is TransportLayer => item === 'air' || item === 'sea' || item === 'truck';
  const provenance = (item: unknown) => item === 'MODELED' || (record(value) && value.mode === 'mixed' && (item === 'LIVE' || item === 'DELAYED'));
  if (!record(value) || value.type !== 'snapshot' || value.version !== 1 || !['mock', 'mixed'].includes(String(value.mode))
    || !timestamp(value.generatedAt) || !count(value.sequence)
    || !finite(value.intervalMs) || value.intervalMs < 500 || value.intervalMs > 60000
    || !record(value.counts) || !Array.isArray(value.feeds) || value.feeds.length !== 3
    || !Array.isArray(value.entities)) return false;
  const counts = value.counts;
  if (!count(counts.air) || !count(counts.sea) || !count(counts.truck)) return false;
  const seenLayers = new Set<TransportLayer>();
  for (const feed of value.feeds) {
    if (!record(feed) || !layerName(feed.layer) || seenLayers.has(feed.layer)
      || !text(feed.id) || !text(feed.name) || typeof feed.message !== 'string'
      || !['healthy', 'degraded', 'offline'].includes(String(feed.health))
      || !provenance(feed.provenance) || !timestamp(feed.updatedAt)
      || !count(feed.count) || feed.count !== counts[feed.layer]) return false;
    seenLayers.add(feed.layer);
  }
  const actual = { air: 0, sea: 0, truck: 0 };
  const ids = new Set<string>();
  for (const entity of value.entities) {
    if (!record(entity) || !text(entity.id) || ids.has(entity.id) || !layerName(entity.layer)
      || !provenance(entity.provenance) || !timestamp(entity.ts)
      || !finite(entity.lat) || Math.abs(entity.lat) > 90
      || !finite(entity.lon) || Math.abs(entity.lon) > 180
      || !finite(entity.heading) || entity.heading < 0 || entity.heading >= 360
      || !finite(entity.speed) || entity.speed < 0 || !finite(entity.altitude)
      || !text(entity.label) || !text(entity.subtype) || !text(entity.origin)
      || !text(entity.destination) || !text(entity.source) || !record(entity.meta)) return false;
    actual[entity.layer]++;
    ids.add(entity.id);
  }
  return actual.air === counts.air && actual.sea === counts.sea && actual.truck === counts.truck;
}
