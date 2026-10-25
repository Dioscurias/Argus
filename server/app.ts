import express from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import type { Snapshot, TransportLayer } from '../shared/schema.js';
import type { ServerConfig } from './config.js';
import { TTLCache } from './cache.js';
import { MockProvider } from './providers/mock.js';

export function createArgusServer(config: ServerConfig) {
  const app = express();
  app.disable('x-powered-by');
  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  // A fixed epoch keeps synthetic positions consistent across cold starts and instances.
  const provider = new MockProvider({ seed: config.seed, counts: config.counts, epoch: Date.UTC(2026, 0, 1) });
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
    const entities = provider.poll(now);
    const counts = { air: 0, sea: 0, truck: 0 };
    for (const entity of entities) counts[entity.layer]++;
    const frame: Snapshot = {
      type: 'snapshot', version: 1, mode: 'mock', sequence: ++sequence,
      generatedAt: now, intervalMs: config.pollIntervalMs, counts, entities,
      feeds: (['air', 'sea', 'truck'] as TransportLayer[]).map(layer => ({
        id: `mock-${layer}`, layer, name: `Synthetic ${layer === 'truck' ? 'freight' : layer}`,
        health: 'healthy', provenance: 'MODELED', count: counts[layer], updatedAt: now,
        message: 'Synthetic development data. Not observed traffic.',
      })),
    };
    cache.set(frame);
    return frame;
  }

  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', phase: 0, mode: 'mock', feeds: snapshot().feeds }));
  app.get('/api/snapshot', (_req, res) => res.json(snapshot()));
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
      for (const socket of wss.clients) socket.terminate();
      await new Promise<void>(resolveClose => wss.close(() => resolveClose()));
      await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
    },
  };
}
