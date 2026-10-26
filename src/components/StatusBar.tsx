import type { Snapshot } from '../../shared/schema';
import type { ConnectionState } from '../hooks/useFeed';
import { formatCount } from '../hooks/useClock';

export function StatusBar({ snapshot, connection, fps, rendered }: { snapshot: Snapshot | null; connection: ConnectionState; fps: number | null; rendered: number }) {
  const health = connection === 'connected' ? 'healthy' : connection === 'offline' ? 'offline' : 'degraded';
  const feed = snapshot?.feeds.find(item => item.layer === 'air');
  const openSky = feed?.id === 'opensky';
  return <footer className="status-bar"><div className="status-feeds"><span><span className={`health-dot ${connection === 'connected' ? feed?.health ?? health : health}`}/>AIR <span className="muted">{openSky ? 'OPENSKY' : 'ADSB.LOL'}</span></span></div><span className="status-divider"/><span className="rendered-count"><strong className="mono">{formatCount(rendered)}</strong> AIR DRAWN <span className="muted">/</span> <strong className="mono">{formatCount(snapshot?.counts.air ?? 0)}</strong> OBSERVED</span><span className="status-fps mono">{fps === null ? 'RENDER IDLE' : `${fps} FPS`}</span><a href={openSky ? 'https://opensky-network.org/' : 'https://www.adsb.lol/docs/open-data/'} target="_blank" rel="noreferrer">{openSky ? 'OpenSky Network' : 'adsb.lol · ODbL'}</a><span className="build-status">LIVE AIR</span></footer>;
}
