import { Button, ButtonGroup } from '@blueprintjs/core';
import type { Projection } from '../map/MapViewport';
import { utcTime } from '../hooks/useClock';
import { Icon } from './Icon';

interface Props { projection: Projection; onProjection: (projection: Projection) => void; cursor: [number, number] | null; now: number; globalCoverage: boolean; onLayers: () => void; onInspector: () => void }
export function CommandBar({ projection, onProjection, cursor, now, globalCoverage, onLayers, onInspector }: Props) {
  const coordinate = (value: number, positive: string, negative: string) => `${Math.abs(value).toFixed(3)}° ${value < 0 ? negative : positive}`;
  return <header className="command-bar">
    <a className="brand" href="/" aria-label="ARGUS home"><img src="/argus.svg" alt="" width="33" height="33"/><div><strong>ARGUS</strong><span>GLOBAL TRAFFIC INTELLIGENCE</span></div></a>
    <div className="command-workspace"><span className="workspace-slash">/</span><Icon name="globe" size={14}/><span>Operations</span><span className="workspace-version">00</span></div>
    <div className="global-search"><span className="eyebrow">{globalCoverage ? 'LIVE GLOBAL COVERAGE' : 'LIVE REGIONAL COVERAGE'}</span></div>
    <div className="cursor-coordinates mono"><Icon name="crosshair" size={13}/><span>{cursor ? `${coordinate(cursor[1], 'N', 'S')}  ${coordinate(cursor[0], 'E', 'W')}` : '— LAT  /  — LON'}</span></div>
    <div className="utc-clock"><Icon name="clock" size={13}/><span className="mono">{utcTime(now)}</span><span>UTC</span></div>
    <ButtonGroup className="projection-switch"><Button small active={projection === 'mercator'} aria-pressed={projection === 'mercator'} onClick={() => onProjection('mercator')} aria-label="2D projection"><Icon name="map" size={13}/>2D</Button><Button small active={projection === 'globe'} aria-pressed={projection === 'globe'} onClick={() => onProjection('globe')} aria-label="Globe projection"><Icon name="globe" size={13}/>Globe</Button></ButtonGroup>
    <Button minimal className="mobile-panel-toggle" aria-label="Toggle layer panel" onClick={onLayers}><Icon name="layers"/></Button>
    <Button minimal className="mobile-panel-toggle" aria-label="Toggle inspector panel" onClick={onInspector}><Icon name="info"/></Button>
  </header>;
}
