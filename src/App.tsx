import { useReducer, useState } from 'react';
import { CommandBar } from './components/CommandBar';
import { LayerPanel } from './components/LayerPanel';
import { Inspector } from './components/Inspector';
import { StatusBar } from './components/StatusBar';
import { Timeline } from './components/Timeline';
import { Icon } from './components/Icon';
import { MapViewport, type Projection } from './map/MapViewport';
import { initialLayers, layerReducer } from './layers/state';
import { useFeed } from './hooks/useFeed';

export function App() {
  const [stack, dispatch] = useReducer(layerReducer, { layers: initialLayers(), soloId: null });
  const [projection, setProjection] = useState<Projection>('mercator');
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'layers' | 'inspector' | null>(null);
  const feed = useFeed();

  return <div className={`app-shell ${mobilePanel ? `show-${mobilePanel}` : ''}`}>
    <CommandBar projection={projection} onProjection={setProjection} cursor={cursor} now={feed.now} onLayers={() => setMobilePanel(value => value === 'layers' ? null : 'layers')} onInspector={() => setMobilePanel(value => value === 'inspector' ? null : 'inspector')}/>
    <div className="environment-bar"><div><span className="environment-marker"/><span>DEVELOPMENT ENVIRONMENT</span><span className="environment-divider">/</span><span className="environment-detail">Mock data only. All movement is synthetic.</span></div><span className="environment-right"><Icon name="layers" size={12}/> FOUNDATION <span className="mono">00</span></span></div>
    <main className="workspace">
      <LayerPanel stack={stack} dispatch={dispatch} snapshot={feed.snapshot} connection={feed.state}/>
      <div className="map-workspace"><MapViewport projection={projection} stack={stack} onCursor={setCursor} onFps={setFps}/><Timeline/></div>
      <Inspector snapshot={feed.snapshot} connection={feed.state} retry={feed.retry}/>
    </main>
    <StatusBar snapshot={feed.snapshot} connection={feed.state} fps={fps}/>
  </div>;
}
