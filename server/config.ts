export interface ServerConfig {
  host: string;
  port: number;
  mockMode: boolean;
  seed: number;
  counts: { air: number; sea: number; truck: number };
  pollIntervalMs: number;
  cacheTtlMs: number;
  clientOrigin?: string;
  air: { provider: 'fr24' | 'opensky' | 'adsblol'; fallback: 'opensky' | 'adsblol' | 'none'; bounds: string; point: string; intervalMs: number; fr24Key: string; clientId: string; clientSecret: string; proxyUrl: string; proxyToken: string };
}

export function readConfig(env: Record<string, string | undefined>): ServerConfig {
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const value = env[key] === undefined || env[key] === '' ? fallback : Number(env[key]);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key} must be an integer between ${min} and ${max}.`);
    return value;
  };
  const mode = env.MOCK_DATA_MODE ?? 'true';
  if (!['true', 'false'].includes(mode)) throw new Error('MOCK_DATA_MODE must be true or false.');
  const airProvider = env.AIR_PROVIDER || 'fr24';
  const fallback = env.AIR_FALLBACK_PROVIDER || 'opensky';
  if (!['fr24', 'opensky', 'adsblol'].includes(airProvider)) throw new Error('Invalid AIR_PROVIDER');
  if (!['opensky', 'adsblol', 'none'].includes(fallback)) throw new Error('Invalid AIR_FALLBACK_PROVIDER');
  const bounds = env.AIR_BOUNDS || '90,-90,-180,180';
  const [north, south, west, east] = bounds.split(',').map(Number);
  if (bounds.split(',').length !== 4 || ![north, south, west, east].every(Number.isFinite) || north > 90 || south < -90 || north <= south || west < -180 || east > 180 || west >= east) throw new Error('AIR_BOUNDS must be north,south,west,east within WGS84 bounds.');
  const point = env.ADSB_POINT || '39,-98,250';
  const [lat, lon, radius] = point.split(',').map(Number);
  if (point.split(',').length !== 3 || ![lat, lon, radius].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || radius < 1 || radius > 250) throw new Error('ADSB_POINT must be latitude,longitude,radius (1–250 nautical miles).');
  return {
    host: env.HOST || '127.0.0.1', port: integer('PORT', 3001, 1, 65535), mockMode: mode === 'true',
    seed: integer('MOCK_SEED', 42, 0, 4294967295),
    counts: { air: integer('MOCK_AIR_COUNT', 640, 0, 20000), sea: integer('MOCK_SEA_COUNT', 420, 0, 50000), truck: integer('MOCK_TRUCK_COUNT', 180, 0, 10000) },
    pollIntervalMs: integer('POLL_INTERVAL_MS', 2000, 500, 60000),
    cacheTtlMs: integer('CACHE_TTL_MS', 1500, 100, 60000),
    clientOrigin: env.CLIENT_ORIGIN || undefined,
    air: { provider: airProvider as ServerConfig['air']['provider'], fallback: fallback as ServerConfig['air']['fallback'], bounds, point, intervalMs: integer('AIR_POLL_INTERVAL_MS', 90000, 60000, 3600000), fr24Key: env.FR24_API_KEY || '', clientId: env.OPENSKY_CLIENT_ID || '', clientSecret: env.OPENSKY_CLIENT_SECRET || '', proxyUrl: env.OPENSKY_PROXY_URL || '', proxyToken: env.OPENSKY_PROXY_TOKEN || '' },
  };
}
