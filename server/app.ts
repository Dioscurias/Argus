import express from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import type { Snapshot, TransportLayer } from '../shared/schema.js';
import type { ServerConfig } from './config.js';
import { TTLCache } from './cache.js';
import { MockProvider } from './providers/mock.js';
import { AirFeed } from './air-feed.js';
import { Fr24Provider } from './providers/fr24.js';
import { OpenSkyProvider } from './providers/opensky.js';
import { AdsbLolProvider } from './providers/adsblol.js';
import { ProviderError, type AirProvider } from './providers/air-provider.js';

export function createArgusServer(config: ServerConfig) {
  const app = express();
  app.disable('x-powered-by');
  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  // A fixed epoch keeps synthetic positions consistent across cold starts and instances.
  const provider = new MockProvider({ seed: config.seed, counts: config.counts, epoch: Date.UTC(2026, 0, 1) });
  const makeAirProvider = (name: 'fr24' | 'opensky' | 'adsblol'): AirProvider => name === 'opensky' ? new OpenSkyProvider(config.air.bounds, config.air.clientId, config.air.clientSecret)
    : name === 'adsblol' ? new AdsbLolProvider(config.air.point)
    : config.air.fr24Key ? new Fr24Provider(config.air.fr24Key, config.air.bounds)
    : { id: 'fr24', minIntervalMs: 60000, poll: async () => { throw new ProviderError(); } };
  const airFeed = config.mockMode ? null : new AirFeed(makeAirProvider(config.air.provider), config.air.fallback === 'none' || config.air.fallback === config.air.provider ? null : makeAirProvider(config.air.fallback), config.air.intervalMs);
  const regionalFeeds = new Map<string, AirFeed>();
  const cache = new TTLCache<Snapshot>(config.cacheTtlMs);
  let sequence = 0;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  const alive = new WeakSet<WebSocket>();

  function stopStreaming() {
    clearInterval(pollTimer);
    clearInterval(heartbeatTimer);
    pollTimer = undefined;
    heartbeatTimer = undefined;
  }

  function startStreaming() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      if (airFeed) void airFeed.refresh(Date.now()).then(() => cache.clear());
      cache.clear();
      const payload = JSON.stringify(snapshot());
      for (const socket of wss.clients) {
        if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 4 * 1024 * 1024) socket.send(payload);
      }
    }, config.pollIntervalMs);
    heartbeatTimer = setInterval(() => {
      for (const socket of wss.clients) {
        if (!alive.has(socket)) { socket.terminate(); continue; }
        alive.delete(socket);
        socket.ping();
      }
    }, 30000);
  }

  function snapshot(): Snapshot {
    const cached = cache.get();
    if (cached) return cached;
    const now = Date.now();
    const generated = provider.poll(now);
    const entities = airFeed ? [...generated.filter(entity => entity.layer !== 'air'), ...airFeed.entities(now)] : generated;
    const counts = { air: 0, sea: 0, truck: 0 };
    for (const entity of entities) counts[entity.layer]++;
    const frame: Snapshot = {
      type: 'snapshot', version: 1, mode: config.mockMode ? 'mock' : 'mixed', sequence: ++sequence,
      generatedAt: now, intervalMs: config.pollIntervalMs, counts, entities,
      feeds: (['air', 'sea', 'truck'] as TransportLayer[]).map(layer => layer === 'air' && airFeed ? airFeed.status(now) : ({
        id: `mock-${layer}`, layer, name: `Synthetic ${layer === 'truck' ? 'freight' : layer}`,
        health: 'healthy', provenance: 'MODELED', count: counts[layer], updatedAt: now,
        message: 'Synthetic development data. Not observed traffic.',
      })),
    };
    cache.set(frame);
    return frame;
  }

  function unavailableFeed(layer: 'sea' | 'truck', now: number) {
    return { id: `unavailable-${layer}`, layer, name: `${layer} unavailable`, health: 'offline' as const, provenance: 'DELAYED' as const, count: 0, updatedAt: now, message: 'No observed provider is connected.' };
  }

  function parseRegion(query: Record<string, unknown>) {
    const [defaultLat, defaultLon] = config.air.point.split(',').map(Number);
    const lat = query.lat === undefined ? defaultLat : Number(query.lat);
    const lon = query.lon === undefined ? defaultLon : Number(query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10 };
  }

  async function liveSnapshot(lat: number, lon: number): Promise<Snapshot> {
    let feed = airFeed;
    if (config.air.provider === 'adsblol') {
      const key = `${lat},${lon}`;
      feed = regionalFeeds.get(key) ?? null;
      if (!feed) {
        feed = new AirFeed(new AdsbLolProvider(`${lat},${lon},250`), null, config.air.intervalMs);
        regionalFeeds.set(key, feed);
        if (regionalFeeds.size > 24) {
          const oldest = regionalFeeds.keys().next().value;
          if (oldest) { regionalFeeds.get(oldest)?.dispose(); regionalFeeds.delete(oldest); }
        }
      }
    }
    if (!feed) throw new Error('Live air feed is not configured.');
    const now = Date.now();
    await feed.refresh(now);
    const entities = feed.entities(now);
    return {
      type: 'snapshot', version: 1, mode: 'mixed', sequence: ++sequence, generatedAt: now,
      intervalMs: config.air.intervalMs, counts: { air: entities.length, sea: 0, truck: 0 }, entities,
      feeds: [feed.status(now), unavailableFeed('sea', now), unavailableFeed('truck', now)],
    };
  }

  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', async (_req, res) => {
    if (config.mockMode) return res.json({ status: 'ok', phase: 1, mode: 'mock', feeds: snapshot().feeds });
    const [lat, lon] = config.air.point.split(',').map(Number);
    const frame = await liveSnapshot(lat, lon);
    return res.json({ status: 'ok', phase: 1, mode: 'mixed', feeds: frame.feeds });
  });
  app.get('/api/snapshot', async (req, res) => {
    if (config.mockMode) return res.json(snapshot());
    const region = parseRegion(req.query);
    if (!region) return res.status(400).json({ error: 'lat and lon must be valid WGS84 coordinates.' });
    return res.json(await liveSnapshot(region.lat, region.lon));
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API endpoint' }));
  const dist = resolve(process.cwd(), 'dist');
  if (existsSync(resolve(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get('/', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  }

  server.on('upgrade', (request, socket, head) => {
    const origin = request.headers.origin;
    let allowed = !origin;
    if (origin) {
      try { allowed = new URL(origin).host === request.headers.host || origin === config.clientOrigin; }
      catch { allowed = false; }
    }
    if (request.url !== '/ws' || !allowed) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws));
  });
  wss.on('connection', socket => {
    alive.add(socket);
    socket.on('pong', () => alive.add(socket));
    socket.on('error', () => socket.terminate());
    socket.send(JSON.stringify(snapshot()));
    if (airFeed) void airFeed.refresh(Date.now()).then(() => cache.clear());
    startStreaming();
    socket.on('close', () => { if (wss.clients.size === 0) stopStreaming(); });
  });

  return {
    app, server,
    async listen() {
      await new Promise<void>((resolveListen, reject) => {
        server.once('error', reject);
        server.listen(config.port, config.host, () => { server.off('error', reject); resolveListen(); });
      });
    },
    async close() {
      stopStreaming();
      airFeed?.dispose();
      for (const feed of regionalFeeds.values()) feed.dispose();
      for (const socket of wss.clients) socket.terminate();
      await new Promise<void>(resolveClose => wss.close(() => resolveClose()));
      await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
    },
  };
}
