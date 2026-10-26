import { useEffect, useRef, useState } from 'react';
import { Button } from '@blueprintjs/core';
import { Map, type GeoJSONSource } from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { Icon } from '../components/Icon';
import { createMapStyle, mapLayerIds } from './style';
import { addReferenceLabels } from './labels';
import { makeNightMask } from './geography';
import { isLayerVisible } from '../layers/state';
import type { LayerStack } from '../layers/types';
import type { Entity } from '../../shared/schema';
import { createAircraftLayer } from '../layers/AirLayer';
import { airportOpacity } from '../layers/AirportsLayer';
import { Badge } from '../components/Badge';
import { formatCount, utcTime } from '../hooks/useClock';

export type Projection = 'mercator' | 'globe';
interface Props {
  projection: Projection;
  stack: LayerStack;
  aircraft: Entity[];
  onCursor: (coordinates: [number, number]) => void;
  onFps: (fps: number | null) => void;
  onRegion: (region: { lat: number; lon: number }) => void;
  globalCoverage: boolean;
}

function overviewZoom(map: Map, projection: Projection) {
  if (projection === 'mercator') return 1.05;
  const container = map.getContainer();
  const diameter = Math.min(container.clientWidth, container.clientHeight) * 0.78;
  return Math.max(0, Math.log2(diameter * Math.PI / 512));
}

function applyStack(map: Map, stack: LayerStack) {
  for (const layer of stack.layers) {
    for (const id of mapLayerIds[layer.id] ?? []) {
      if (!map.getLayer(id)) continue;
      map.setLayoutProperty(id, 'visibility', isLayerVisible(stack, layer.id) ? 'visible' : 'none');
      const type = map.getLayer(id)?.type;
      if (type === 'line') map.setPaintProperty(id, 'line-opacity', layer.opacity * (id === 'countries-outline' ? 0.7 : 1));
      if (type === 'fill') map.setPaintProperty(id, 'fill-opacity', layer.opacity);
      if (type === 'symbol') map.setPaintProperty(id, 'icon-opacity', layer.opacity);
      if (type === 'circle') {
        map.setPaintProperty(id, 'circle-opacity', airportOpacity(layer.opacity));
        map.setPaintProperty(id, 'circle-stroke-opacity', layer.opacity);
      }
      map.moveLayer(id);
    }
  }
}

export function MapViewport({ projection, stack, aircraft, onCursor, onFps, onRegion, globalCoverage }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const deckRef = useRef<MapboxOverlay | null>(null);
  const stackRef = useRef(stack);
  const projectionRef = useRef(projection);
  const callbacks = useRef({ onCursor, onFps, onRegion });
  stackRef.current = stack;
  projectionRef.current = projection;
  callbacks.current = { onCursor, onFps, onRegion };
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(1.05);
  const [bearing, setBearing] = useState(0);
  const [hover, setHover] = useState<{ entity: Entity; x: number; y: number } | null>(null);
  const [airportHover, setAirportHover] = useState<{ name: string; code: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!container.current) return;
    let disposed = false;
    let map: Map;
    setLoaded(false);
    setError(null);
    try {
      map = new Map({
        container: container.current,
        style: createMapStyle(), center: [-98, 39], zoom: 3, minZoom: 0, maxZoom: 9,
        attributionControl: false, renderWorldCopies: false, canvasContextAttributes: { antialias: true },
      });
    } catch {
      setError('Map rendering is unavailable. Enable WebGL in your browser, then retry.');
      return;
    }
    mapRef.current = map;
    const deck = new MapboxOverlay({ interleaved: true, layers: [], onError: error => { console.error(error); setError('The aircraft renderer could not initialize. Retry to restore the map.'); } });
    deckRef.current = deck;
    let lastFrame = 0;
    const samples: number[] = [];
    map.on('load', async () => {
      await document.fonts.ready;
      if (disposed) return;
      map.setProjection({ type: projectionRef.current });
      map.jumpTo({ zoom: 3 });
      addReferenceLabels(map);
      map.addControl(deck);
      applyStack(map, stackRef.current);
      setLoaded(true);
    });
    map.on('mousemove', event => {
      callbacks.current.onCursor([event.lngLat.lng, event.lngLat.lat]);
      const airport = map.getLayer('airport-points') ? map.queryRenderedFeatures(event.point, { layers: ['airport-points'] })[0] : undefined;
      setAirportHover(airport ? { name: String(airport.properties.name), code: String(airport.properties.iata || airport.properties.id), x: event.point.x, y: event.point.y } : null);
    });
    map.on('mouseout', () => { setHover(null); setAirportHover(null); });
    map.on('move', () => { setZoom(map.getZoom()); setBearing(map.getBearing()); });
    map.on('moveend', () => { const center = map.getCenter(); callbacks.current.onRegion({ lat: center.lat, lon: center.lng }); });
    map.on('error', event => { console.error('Map error:', event.error.message); setError('Local map data could not load. Retry to restore the reference map.'); });
    map.on('render', () => {
      const now = performance.now();
      if (lastFrame && now - lastFrame < 150) {
        samples.push(now - lastFrame);
        if (samples.length > 30) samples.shift();
      }
      lastFrame = now;
    });
    const statsTimer = setInterval(() => {
      const fps = performance.now() - lastFrame < 250 && samples.length >= 3 ? Math.round(1000 / (samples.reduce((sum, sample) => sum + sample, 0) / samples.length)) : null;
      callbacks.current.onFps(fps);
    }, 1000);
    const nightTimer = setInterval(() => (map.getSource('night') as GeoJSONSource | undefined)?.setData(makeNightMask(Date.now())), 60000);
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    return () => {
      disposed = true;
      observer.disconnect();
      clearInterval(statsTimer);
      clearInterval(nightTimer);
      map.remove();
      mapRef.current = null;
      deckRef.current = null;
    };
  }, [attempt]);

  useEffect(() => { if (loaded && mapRef.current) applyStack(mapRef.current, stack); }, [stack, loaded]);
  useEffect(() => {
    if (!loaded || !deckRef.current) return;
    const air = stack.layers.find(layer => layer.id === 'air');
    deckRef.current.setProps({ layers: [createAircraftLayer(aircraft, isLayerVisible(stack, 'air'), air?.opacity ?? 1, info => setHover(info.object ? { entity: info.object, x: info.x, y: info.y } : null))] });
    setHover(previous => {
      if (!previous || !isLayerVisible(stack, 'air')) return null;
      const updated = aircraft.find(entity => entity.id === previous.entity.id);
      return updated ? { ...previous, entity: updated } : null;
    });
  }, [loaded, stack, aircraft]);
  useEffect(() => {
    if (loaded && mapRef.current) {
      const map = mapRef.current;
      map.setProjection({ type: projection });
      if (map.getZoom() < 3) map.jumpTo({ zoom: overviewZoom(map, projection) });
    }
  }, [projection, loaded]);
  useEffect(() => {
    if (loaded && globalCoverage && mapRef.current) mapRef.current.jumpTo({ center: [0, 22], zoom: overviewZoom(mapRef.current, projection) });
  }, [globalCoverage, loaded]);

  const reset = () => {
    const map = mapRef.current;
    map?.flyTo({ center: globalCoverage ? [0, 22] : [-98, 39], zoom: globalCoverage ? overviewZoom(map, projection) : 3, bearing: 0, pitch: 0, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600 });
  };
  return <section className="map-viewport" aria-label="Global reference map" data-projection={projection} data-map-ready={loaded} data-aircraft-count={isLayerVisible(stack, 'air') ? aircraft.length : 0}>
    <div className="map-canvas" ref={container}/>
    <div className="map-context"><span className="eyebrow">LIVE OPERATING PICTURE</span><div>{globalCoverage ? 'Global coverage' : 'Regional coverage'} <span>/</span> <span className="muted">{projection === 'globe' ? 'Globe' : 'Mercator'}</span></div></div>
    <div className="map-top-right"><span className="map-reference-tag"><span className="health-dot healthy"/> LOCAL BASEMAP</span></div>
    <div className="map-toolrail" aria-label="Map tools"><Button minimal title="Pan map" aria-label="Pan map" active><Icon name="cursor"/></Button></div>
    <div className="map-navigation"><Button minimal aria-label="Reset north" title="Reset north" className="north-button" onClick={() => mapRef.current?.resetNorth()}><span>N</span><svg width="16" height="18" viewBox="0 0 16 18" style={{ transform: `rotate(${-bearing}deg)` }} aria-hidden="true"><path d="m8 1 6 15-6-4-6 4Z" fill="none" stroke="currentColor"/></svg></Button><div className="zoom-buttons"><Button minimal aria-label="Zoom in" title="Zoom in" onClick={() => mapRef.current?.zoomIn()}><Icon name="plus"/></Button><Button minimal aria-label="Zoom out" title="Zoom out" onClick={() => mapRef.current?.zoomOut()}><Icon name="minus"/></Button></div><Button minimal aria-label="Reset map view" title="Reset world overview" onClick={reset}><Icon name="globe"/></Button></div>
    <div className="map-bottom-left"><span className="coordinate-tick"/><span className="mono">WGS84</span><span className="map-coordinate-divider">/</span><span className="mono">ZOOM {zoom.toFixed(2)}</span></div>
    <div className="map-phase-note"><span className="phase-index"><Icon name="air" size={20}/></span><div><strong>{isLayerVisible(stack, 'air') ? `${formatCount(aircraft.length)} observed aircraft` : 'Air layer hidden'}</strong><span>{globalCoverage ? 'OpenSky network state vectors worldwide.' : 'Pan the map to load a new 250-NM live region.'}</span></div></div>
    {hover && isLayerVisible(stack, 'air') && <div className="map-tooltip" style={{ left: Math.max(8, Math.min(hover.x + 15, (container.current?.clientWidth ?? 300) - 260)), top: Math.max(8, Math.min(hover.y + 15, (container.current?.clientHeight ?? 300) - 145)) }}>
      <div><strong className="mono">{hover.entity.label}</strong><Badge value={hover.entity.provenance}/></div>
      <span>{hover.entity.subtype} · {String(hover.entity.meta.airline ?? 'Unknown')}</span>
      <span>{hover.entity.origin} → {hover.entity.destination}</span>
      <span className="mono">{Array.isArray(hover.entity.meta.missingFields) && hover.entity.meta.missingFields.includes('altitude') ? 'ALT —' : `${formatCount(Math.round(hover.entity.altitude))} FT`} · {Array.isArray(hover.entity.meta.missingFields) && hover.entity.meta.missingFields.includes('speed') ? 'SPD —' : `${Math.round(hover.entity.speed)} KT`}</span>
      <small>{hover.entity.source} · {utcTime(hover.entity.ts)}Z</small>
    </div>}
    {!hover && airportHover && <div className="map-tooltip" style={{ left: Math.max(8, Math.min(airportHover.x + 15, (container.current?.clientWidth ?? 300) - 260)), top: Math.max(8, Math.min(airportHover.y + 15, (container.current?.clientHeight ?? 300) - 90)) }}><div><strong>{airportHover.code}</strong><Badge value="REFERENCE"/></div><span>{airportHover.name}</span><small>OurAirports · bundled reference</small></div>}
    {!loaded && !error && <div className="map-state-message"><Icon name="globe" size={24}/><span>Initializing reference map…</span></div>}
    {error && <div className="map-state-message error" role="alert"><Icon name="info" size={24}/><p>{error}</p><Button small onClick={() => setAttempt(value => value + 1)}>Retry map</Button></div>}
  </section>;
}
