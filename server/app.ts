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

  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', phase: 1, mode: config.mockMode ? 'mock' : 'mixed', feeds: snapshot().feeds }));
  app.get('/api/snapshot', async (_req, res) => { if (airFeed) { await airFeed.refresh(Date.now()); cache.clear(); } res.json(snapshot()); });
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
      for (const socket of wss.clients) socket.terminate();
      await new Promise<void>(resolveClose => wss.close(() => resolveClose()));
      await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
    },
  };
}
