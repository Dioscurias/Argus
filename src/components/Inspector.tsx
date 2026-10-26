import { Button } from '@blueprintjs/core';
import type { Snapshot } from '../../shared/schema';
import type { ConnectionState } from '../hooks/useFeed';
import { formatCount, utcTime } from '../hooks/useClock';
import { Badge } from './Badge';
import { Icon } from './Icon';

interface Props { snapshot: Snapshot | null; connection: ConnectionState; retry: () => void; region: { lat: number; lon: number }; globalCoverage: boolean }
export function Inspector({ snapshot, connection, retry, region, globalCoverage }: Props) {
  const mixed = snapshot?.mode === 'mixed';
  const air = snapshot?.feeds.find(feed => feed.layer === 'air');
  return <aside className="inspector panel" aria-label="Entity inspector">
    <div className="panel-heading"><span><Icon name="crosshair"/> INSPECTOR</span><span className="inspector-id mono">—</span></div>
    <div className="inspector-empty"><div className="selection-symbol"><Icon name="air" size={42}/><span className="symbol-corner top-left"/><span className="symbol-corner bottom-right"/></div><h2>Observed aircraft</h2><p>Hover an aircraft for its callsign, altitude, type, and observation age. Use the air filters to narrow the view.</p></div>
    <section className="feed-section"><div className="section-heading"><span>DATA ENVIRONMENT</span><Badge value={air?.provenance}/></div><div className="environment-title"><span className={`health-dot ${connection === 'connected' ? air?.health ?? 'healthy' : connection === 'offline' ? 'offline' : 'degraded'}`}/><strong>{mixed ? 'Air provider mode' : 'Mock data mode'}</strong><span className="mono">ON</span></div><p className="section-copy">{mixed ? air?.message ?? 'Awaiting provider.' : 'Synthetic aircraft. No API keys. No live provider connections.'}</p>
      <div className="feed-cards"><div className="feed-card"><div className="feed-card-title"><Icon name="air" size={15} style={{ color: 'var(--air)' }}/><span>{globalCoverage ? 'Air · Global' : 'Air · 250 NM'}</span><span className="mono feed-count">{air ? formatCount(air.count) : '—'}</span></div><div className="feed-card-meta"><span>{globalCoverage ? 'OpenSky Network' : `adsb.lol · ${region.lat.toFixed(1)}, ${region.lon.toFixed(1)}`}</span><Badge value={air?.provenance}/></div></div></div>
      <div className="stream-state" role="status"><span className={`health-dot ${connection === 'connected' ? 'healthy' : connection === 'offline' ? 'offline' : 'degraded'}`}/><span>{connection === 'connected' ? `${globalCoverage ? 'Global feed' : 'Live region'} · refreshes every ${Math.round((snapshot?.intervalMs ?? 60000) / 1000)}s` : connection === 'stale' ? 'Updates delayed · retaining observations' : connection === 'offline' ? 'Provider unavailable' : 'Loading observed aircraft…'}</span>{connection !== 'connected' && <Button small minimal onClick={retry} aria-label="Retry feed connection"><Icon name="reset" size={12}/></Button>}</div>
      <div className="feed-timestamp"><span>LAST SNAPSHOT</span><span className="mono">{snapshot ? `${utcTime(snapshot.generatedAt)}Z` : '—'}</span></div>
    </section>
    <section className="note-section"><Icon name="info" size={14}/><p>{globalCoverage ? 'Worldwide observations are provided by the OpenSky Network.' : 'Coverage follows the map center. Data is provided by adsb.lol under ODbL 1.0.'}</p></section>
  </aside>;
}
