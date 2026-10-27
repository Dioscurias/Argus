import { useMemo, useReducer, useState } from 'react';
import { CommandBar } from './components/CommandBar';
import { LayerPanel } from './components/LayerPanel';
import { Inspector } from './components/Inspector';
import { StatusBar } from './components/StatusBar';
import { Icon } from './components/Icon';
import { MapViewport, type Projection } from './map/MapViewport';
import { initialLayers, layerReducer, isLayerVisible } from './layers/state';
import { useFeed } from './hooks/useFeed';
import { defaultAirFilters, filterAircraft } from './layers/air-filters';
import { useAircraftSelection } from './hooks/useAircraftSelection';
import type { Entity } from '../shared/schema';

const emptyEntities: Entity[] = [];
const emptyRoute: [] = [];

export function App() {
  const [stack, dispatch] = useReducer(layerReducer, { layers: initialLayers(), soloId: null });
  const [projection, setProjection] = useState<Projection>('mercator');
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [region, setRegion] = useState({ lat: 39, lon: -98 });
  const [mobilePanel, setMobilePanel] = useState<'layers' | 'inspector' | null>(null);
  const feed = useFeed(region);
  const airSource = feed.snapshot?.feeds.find(item => item.layer === 'air')?.id;
  const globalCoverage = airSource === 'opensky' || airSource === 'adsblol-global';
  const aircraft = useMemo(() => filterAircraft(feed.snapshot?.entities ?? [], stack.airFilters ?? defaultAirFilters), [feed.snapshot, stack.airFilters]);
  const selection = useAircraftSelection(feed.snapshot?.entities ?? emptyEntities);
  const visibleAircraft = useMemo(() => selection.selected ? [selection.selected] : aircraft, [selection.selected, aircraft]);
  const selectAircraft = (entity: Entity | null) => { selection.select(entity); if (entity) setMobilePanel('inspector'); else setMobilePanel(null); };
  const rendered = isLayerVisible(stack, 'air') && (stack.layers.find(layer => layer.id === 'air')?.opacity ?? 0) > 0 ? visibleAircraft.length : 0;

  return <div className={`app-shell ${mobilePanel ? `show-${mobilePanel}` : ''}`}>
    <CommandBar projection={projection} onProjection={setProjection} cursor={cursor} now={feed.now} globalCoverage={globalCoverage} onLayers={() => setMobilePanel(value => value === 'layers' ? null : 'layers')} onInspector={() => setMobilePanel(value => value === 'inspector' ? null : 'inspector')}/>
    <div className="environment-bar"><div><span className="environment-marker"/><span>AIR TRAFFIC</span><span className="environment-divider">/</span><span className="environment-detail">{globalCoverage ? 'Global coverage' : '250 NM around map center'} · motion estimated between updates</span></div><span className="environment-right"><Icon name="layers" size={12}/> AIR OPERATIONS <span className="mono">LIVE</span></span></div>
    <main className="workspace">
      <LayerPanel stack={stack} dispatch={dispatch} snapshot={feed.snapshot} connection={feed.state}/>
      <div className="map-workspace"><MapViewport projection={projection} stack={stack} aircraft={visibleAircraft} onCursor={setCursor} onFps={setFps} onRegion={setRegion} globalCoverage={globalCoverage} selected={selection.selected} onSelect={selectAircraft} track={selection.track} route={selection.details?.route?.airports ?? emptyRoute}/></div>
      <Inspector snapshot={feed.snapshot} connection={feed.state} retry={feed.retry} region={region} globalCoverage={globalCoverage} selection={selection} onClear={() => selectAircraft(null)}/>
    </main>
    <StatusBar snapshot={feed.snapshot} connection={feed.state} fps={fps} rendered={rendered}/>
  </div>;
}
