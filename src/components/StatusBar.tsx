import type { Snapshot } from '../../shared/schema';
import type { ConnectionState } from '../hooks/useFeed';
import { formatCount } from '../hooks/useClock';

export function StatusBar({ snapshot, connection, fps }: { snapshot: Snapshot | null; connection: ConnectionState; fps: number | null }) {
  const health = connection === 'connected' ? 'healthy' : connection === 'offline' ? 'offline' : 'degraded';
  return <footer className="status-bar"><div className="status-feeds">{['AIR', 'SEA', 'TRUCK'].map(name => <span key={name}><span className={`health-dot ${health}`}/>{name} <span className="muted">MOCK</span></span>)}</div><span className="status-divider"/><span className="rendered-count"><strong className="mono">0</strong> RENDERED <span className="muted">/</span> <strong className="mono">{formatCount(snapshot?.entities.length ?? 0)}</strong> BUFFERED</span><span className="status-fps mono">{fps === null ? 'RENDER IDLE' : `${fps} FPS`}</span><a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">© Natural Earth <span>·</span> MapLibre <span>·</span> deck.gl</a><span className="build-status">PHASE 0</span></footer>;
}
