import type { Snapshot } from '../../shared/schema';
import type { ConnectionState } from '../hooks/useFeed';
import { formatCount } from '../hooks/useClock';

export function StatusBar({ snapshot, connection, fps, rendered }: { snapshot: Snapshot | null; connection: ConnectionState; fps: number | null; rendered: number }) {
  const health = connection === 'connected' ? 'healthy' : connection === 'offline' ? 'offline' : 'degraded';
  return <footer className="status-bar"><div className="status-feeds">{(['air', 'sea', 'truck'] as const).map(name => {
    const feed = snapshot?.feeds.find(item => item.layer === name);
    return <span key={name}><span className={`health-dot ${connection === 'connected' ? feed?.health ?? health : health}`}/>{name.toUpperCase()} <span className="muted">{feed?.id.startsWith('mock-') ? 'MOCK' : feed?.id.toUpperCase() ?? '—'}</span></span>;
  })}</div><span className="status-divider"/><span className="rendered-count"><strong className="mono">{formatCount(rendered)}</strong> AIR DRAWN <span className="muted">/</span> <strong className="mono">{formatCount(snapshot?.entities.length ?? 0)}</strong> BUFFERED</span><span className="status-fps mono">{fps === null ? 'RENDER IDLE' : `${fps} FPS`}</span><a href="https://ourairports.com/data/" target="_blank" rel="noreferrer">OurAirports <span>·</span> Natural Earth</a><span className="build-status">PHASE 1</span></footer>;
}
