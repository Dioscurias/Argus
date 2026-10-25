export interface ServerConfig {
  host: string;
  port: number;
  mockMode: true;
  seed: number;
  counts: { air: number; sea: number; truck: number };
  pollIntervalMs: number;
  cacheTtlMs: number;
  clientOrigin?: string;
}

export function readConfig(env: Record<string, string | undefined>): ServerConfig {
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const value = env[key] === undefined || env[key] === '' ? fallback : Number(env[key]);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key} must be an integer between ${min} and ${max}.`);
    return value;
  };
  const mode = env.MOCK_DATA_MODE ?? 'true';
  if (!['true', 'false'].includes(mode)) throw new Error('MOCK_DATA_MODE must be true or false.');
  if (mode === 'false') throw new Error('Phase 0 supports MOCK_DATA_MODE=true only. Live providers arrive in Phases 1–3.');
  return {
    host: env.HOST || '127.0.0.1', port: integer('PORT', 3001, 1, 65535), mockMode: true,
    seed: integer('MOCK_SEED', 42, 0, 4294967295),
    counts: { air: integer('MOCK_AIR_COUNT', 640, 0, 20000), sea: integer('MOCK_SEA_COUNT', 420, 0, 50000), truck: integer('MOCK_TRUCK_COUNT', 180, 0, 10000) },
    pollIntervalMs: integer('POLL_INTERVAL_MS', 2000, 500, 60000),
    cacheTtlMs: integer('CACHE_TTL_MS', 1500, 100, 60000),
    clientOrigin: env.CLIENT_ORIGIN || undefined,
  };
}
