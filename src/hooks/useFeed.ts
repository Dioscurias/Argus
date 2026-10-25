import { useCallback, useEffect, useRef, useState } from 'react';
import { isSnapshot, type Snapshot } from '../../shared/schema';
import { useClock } from './useClock';

export type ConnectionState = 'connecting' | 'connected' | 'stale' | 'offline';
export function useFeed() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [receivedAt, setReceivedAt] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const now = useClock();

  useEffect(() => {
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout>;
    let timeoutTimer: ReturnType<typeof setTimeout>;
    let retries = 0;
    const connect = () => {
      if (disposed) return;
      setConnection('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
      socketRef.current = socket;
      timeoutTimer = setTimeout(() => socket.close(), 10000);
      socket.onmessage = event => {
        if (disposed) return;
        try {
          const value: unknown = JSON.parse(event.data);
          if (!isSnapshot(value)) { setConnection('stale'); return; }
          clearTimeout(timeoutTimer);
          retries = 0;
          setSnapshot(value);
          setReceivedAt(Date.now());
          setConnection('connected');
        } catch { setConnection('stale'); }
      };
      socket.onerror = () => { if (!disposed) setConnection('offline'); };
      socket.onclose = () => {
        clearTimeout(timeoutTimer);
        if (disposed) return;
        setConnection('offline');
        retryTimer = setTimeout(connect, Math.min(1000 * 2 ** retries++, 15000));
      };
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      clearTimeout(timeoutTimer);
      socketRef.current?.close();
    };
  }, [attempt]);

  const state: ConnectionState = connection === 'connected' && now - receivedAt > Math.max(6000, (snapshot?.intervalMs ?? 2000) * 3) ? 'stale' : connection;
  return { snapshot, state, now, retry: useCallback(() => setAttempt(value => value + 1), []) };
}
