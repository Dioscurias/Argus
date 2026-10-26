import { Button } from '@blueprintjs/core';
import type { Snapshot } from '../../shared/schema';
import type { ConnectionState } from '../hooks/useFeed';
import { formatCount, utcTime } from '../hooks/useClock';
import { Badge } from './Badge';
import { Icon } from './Icon';

interface Props { snapshot: Snapshot | null; connection: ConnectionState; retry: () => void }
export function Inspector({ snapshot, connection, retry }: Props) {
  const mixed = snapshot?.mode === 'mixed';
  const air = snapshot?.feeds.find(feed => feed.layer === 'air');
  return <aside className="inspector panel" aria-label="Entity inspector">
    <div className="panel-heading"><span><Icon name="crosshair"/> INSPECTOR</span><span className="inspector-id mono">—</span></div>
    <div className="inspector-empty"><div className="selection-symbol"><Icon name="air" size={42}/><span className="symbol-corner top-left"/><span className="symbol-corner bottom-right"/></div><h2>Aircraft layer available</h2><p>Hover an aircraft for its callsign, altitude, route, and provenance. Use the air filters to narrow the view.</p><span className="phase-label">FULL ENTITY INSPECTION · PHASE 4</span></div>
    <section className="feed-section"><div className="section-heading"><span>DATA ENVIRONMENT</span><Badge value={air?.provenance}/></div><div className="environment-title"><span className={`health-dot ${connection === 'connected' ? air?.health ?? 'healthy' : connection === 'offline' ? 'offline' : 'degraded'}`}/><strong>{mixed ? 'Air provider mode' : 'Mock data mode'}</strong><span className="mono">ON</span></div><p className="section-copy">{mixed ? air?.message ?? 'Awaiting provider.' : 'Synthetic aircraft. No API keys. No live provider connections.'}</p>
      <div className="feed-cards">{(['air', 'sea', 'truck'] as const).map(layer => {
        const feed = snapshot?.feeds.find(item => item.layer === layer);
        const color = layer === 'air' ? 'var(--air)' : layer === 'sea' ? 'var(--sea)' : 'var(--truck)';
        return <div className="feed-card" key={layer}><div className="feed-card-title"><Icon name={layer} size={15} style={{ color }}/><span>{layer === 'air' ? 'Air' : layer === 'sea' ? 'Sea · Phase 2' : 'Trucks · Phase 3'}</span><span className="mono feed-count">{feed ? formatCount(feed.count) : '—'}</span></div><div className="feed-card-meta"><span>{feed?.id ?? 'Awaiting stream'}</span><Badge value={feed?.provenance}/></div></div>;
      })}</div>
      <div className="stream-state" role="status"><span className={`health-dot ${connection === 'connected' ? 'healthy' : connection === 'offline' ? 'offline' : 'degraded'}`}/><span>{connection === 'connected' ? `Receiving every ${(snapshot?.intervalMs ?? 2000) / 1000}s` : connection === 'stale' ? 'Updates delayed · retaining buffer' : connection === 'offline' ? 'Disconnected · reconnecting' : 'Connecting to local feed…'}</span>{connection !== 'connected' && <Button small minimal onClick={retry} aria-label="Retry feed connection"><Icon name="reset" size={12}/></Button>}</div>
      <div className="feed-timestamp"><span>LAST SNAPSHOT</span><span className="mono">{snapshot ? `${utcTime(snapshot.generatedAt)}Z` : '—'}</span></div>
    </section>
    <section className="note-section"><Icon name="info" size={14}/><p>Air and airports are available now. Sea, trucks, search, and timeline replay remain in later phases.</p></section>
    <section className="build-stage"><div className="section-heading"><span>WORKSPACE STAGE</span><span className="mono">01 / 05</span></div><div className="stage-track"><span className="complete"/><span className="complete"/><span/><span/><span/><span/></div><strong>Air traffic & airports</strong><p>Aircraft, airports & working air filters</p><div className="up-next"><span>NEXT</span> Sea traffic & ports <Icon name="arrow" size={13}/></div></section>
  </aside>;
}
