import { useCallback, useEffect, useState } from 'react';
import { isSnapshot, type Snapshot } from '../../shared/schema';
import { useClock } from './useClock';

export type ConnectionState = 'connecting' | 'connected' | 'stale' | 'offline';
export interface FeedRegion { lat: number; lon: number }
export function useFeed(region: FeedRegion) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [receivedAt, setReceivedAt] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const now = useClock();

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      let nextDelay = 60000;
      setConnection(current => current === 'connected' ? 'stale' : 'connecting');
      try {
        const params = new URLSearchParams({ lat: region.lat.toFixed(4), lon: region.lon.toFixed(4) });
        const response = await fetch(`/api/snapshot?${params}`, { signal: controller.signal, cache: 'no-store' });
        const value: unknown = response.ok ? await response.json() : null;
        if (!isSnapshot(value)) throw new Error('Invalid snapshot');
        nextDelay = value.intervalMs;
        if (!disposed) { setSnapshot(value); setReceivedAt(Date.now()); setConnection('connected'); }
      } catch (error) {
        if (!disposed && !(error instanceof DOMException && error.name === 'AbortError')) setConnection(current => snapshot && current !== 'connecting' ? 'stale' : 'offline');
      } finally {
        if (!disposed) timer = setTimeout(load, nextDelay);
      }
    };
    void load();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [region.lat, region.lon, attempt]);

  const state: ConnectionState = connection === 'connected' && now - receivedAt > Math.max(120000, (snapshot?.intervalMs ?? 60000) * 2) ? 'stale' : connection;
  return { snapshot, state, now, retry: useCallback(() => setAttempt(value => value + 1), []) };
}
