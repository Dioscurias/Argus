import { useState, type Dispatch, type KeyboardEvent } from 'react';
import { Button, HTMLSelect, Slider } from '@blueprintjs/core';
import type { Snapshot } from '../../shared/schema';
import type { LayerAction } from '../layers/state';
import { isLayerVisible } from '../layers/state';
import type { LayerId, LayerStack } from '../layers/types';
import type { ConnectionState } from '../hooks/useFeed';
import { formatCount, utcTime } from '../hooks/useClock';
import { Icon } from './Icon';
import { Badge } from './Badge';
import { AIRPORT_COUNT } from '../layers/airport-count';
import { defaultAirFilters, type AirFilters } from '../layers/air-filters';

interface Props { stack: LayerStack; dispatch: Dispatch<LayerAction>; snapshot: Snapshot | null; connection: ConnectionState }

export function LayerPanel({ stack, dispatch, snapshot, connection }: Props) {
  const [expanded, setExpanded] = useState<LayerId | null>('air');
  const [dragging, setDragging] = useState<LayerId | null>(null);
  const [dragOver, setDragOver] = useState<LayerId | null>(null);
  const visibleCount = stack.layers.filter(layer => isLayerVisible(stack, layer.id)).length;
  const filters = stack.airFilters ?? defaultAirFilters;
  const aircraft = snapshot?.entities.filter(entity => entity.layer === 'air') ?? [];
  const filterOptions: Record<keyof AirFilters, { label: string; value: string }[]> = {
    altitude: [{ label: 'All altitudes', value: 'all' }, { label: '< 10,000 ft', value: 'low' }, { label: '10–30,000 ft', value: 'mid' }, { label: '≥ 30,000 ft', value: 'high' }],
    airline: [{ label: 'All airlines', value: 'all' }, ...[...new Set(aircraft.map(entity => String(entity.meta.airline ?? 'Unknown')))].sort().map(value => ({ label: value, value }))],
    aircraft: [{ label: 'All types', value: 'all' }, ...[...new Set(aircraft.map(entity => entity.subtype))].sort().map(value => ({ label: value, value }))],
  };
  const moveByKey = (event: KeyboardEvent, id: LayerId, index: number) => {
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const target = stack.layers[index + (event.key === 'ArrowUp' ? -1 : 1)];
    if (target) dispatch({ type: 'move', id, targetId: target.id });
  };
  return <aside className="layer-panel panel" aria-label="Map layers">
    <div className="panel-heading"><span><Icon name="layers"/> LAYERS</span><span className="counter">{String(stack.layers.length).padStart(2, '0')}</span></div>
    <div className="layer-toolbar"><span>{visibleCount} enabled <span className="muted">/ {stack.layers.length} layers</span></span><Button minimal small title="Reset layers" aria-label="Reset layers" onClick={() => dispatch({ type: 'reset' })}><Icon name="reset" size={13}/></Button></div>
    <div className="layer-list">
      {stack.layers.map((layer, index) => {
        const active = isLayerVisible(stack, layer.id);
        const isExpanded = expanded === layer.id;
        const feed = layer.transport ? snapshot?.feeds.find(item => item.layer === layer.transport) : undefined;
        const health = layer.phase === 0 || layer.id === 'airports' ? 'healthy' : feed ? connection === 'connected' ? feed.health : connection === 'stale' || connection === 'connecting' ? 'degraded' : 'offline' : 'pending';
        return <section key={layer.id} data-layer={layer.id} className={`layer-item ${isExpanded ? 'expanded' : ''} ${active ? '' : 'layer-hidden'} ${dragOver === layer.id ? 'drag-over' : ''}`}
          onDragOver={event => { event.preventDefault(); setDragOver(layer.id); }}
          onDrop={event => { event.preventDefault(); if (dragging) dispatch({ type: 'move', id: dragging, targetId: layer.id }); setDragging(null); setDragOver(null); }}>
          <div className="layer-row">
            <button className="drag-handle" draggable aria-label={`Reorder ${layer.name}; use up and down arrows`} title="Drag to reorder · or use arrow keys" onKeyDown={event => moveByKey(event, layer.id, index)} onDragStart={event => { event.dataTransfer.setData('text/plain', layer.id); event.dataTransfer.effectAllowed = 'move'; setDragging(layer.id); }} onDragEnd={() => { setDragging(null); setDragOver(null); }}>⠿</button>
            <Button minimal small className="visibility-button" aria-label={`${active ? 'Hide' : 'Show'} ${layer.name}`} aria-pressed={active} onClick={() => dispatch({ type: 'toggle', id: layer.id })}><Icon name={active ? 'eye' : 'eyeOff'} size={13}/></Button>
            <button className="layer-name" aria-expanded={isExpanded} aria-controls={`details-${layer.id}`} onClick={() => setExpanded(isExpanded ? null : layer.id)}><Icon name={layer.icon} size={15} style={{ color: layer.color }}/><span>{layer.name}</span></button>
            <span className={`health-dot ${health}`} title={feed ? `Aircraft updates: ${connection}` : layer.phase === 0 ? 'Local layer available' : `Available in Phase ${layer.phase}`}/>
            <Button minimal small className={`solo-button ${stack.soloId === layer.id ? 'is-solo' : ''}`} aria-label={`Solo ${layer.name}`} aria-pressed={stack.soloId === layer.id} title="Isolate layer (keep basemap)" onClick={() => dispatch({ type: 'solo', id: layer.id })}>S</Button>
          </div>
          <div className="layer-meta"><Badge value={feed?.provenance ?? layer.provenance}/><span className="mono">{feed ? `${formatCount(feed.count)} ${layer.id === 'air' ? 'aircraft' : 'buffered'}` : layer.id === 'airports' ? `${formatCount(AIRPORT_COUNT)} airports` : layer.phase === 0 ? 'LOCAL' : `PHASE ${layer.phase}`}</span><button className={`expand-button ${isExpanded ? 'open' : ''}`} aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${layer.name}`} onClick={() => setExpanded(isExpanded ? null : layer.id)}><Icon name="chevron" size={10}/></button></div>
          {isExpanded && <div className="layer-details" id={`details-${layer.id}`}>
            <div className="opacity-label"><label id={`opacity-${layer.id}`}>OPACITY</label><span className="mono">{Math.round(layer.opacity * 100)}%</span></div>
            <Slider min={0} max={100} stepSize={1} labelRenderer={false} value={Math.round(layer.opacity * 100)} onChange={value => dispatch({ type: 'opacity', id: layer.id, value: value / 100 })} handleHtmlProps={{ 'aria-label': `${layer.name} opacity` }}/>
            <p className="layer-description">{layer.description}</p>
            {layer.filters && <div className="layer-filters"><div className="eyebrow">FILTERS <span>{layer.id === 'air' ? 'ACTIVE' : `PHASE ${layer.phase}`}</span></div>{layer.filters.map(filter => {
              const key: keyof AirFilters = filter === 'Altitude band' ? 'altitude' : filter === 'Aircraft type' ? 'aircraft' : 'airline';
              return <label className="filter-row" key={filter}><span>{filter}</span><HTMLSelect disabled={layer.id !== 'air'} aria-label={`${layer.name} ${filter}`} value={layer.id === 'air' ? filters[key] : 'all'} onChange={event => dispatch({ type: 'air-filter', key, value: event.target.value })} options={layer.id === 'air' ? filterOptions[key] : [{ label: 'All', value: 'all' }]}/></label>;
            })}{layer.id === 'air' && <Button minimal small onClick={() => (Object.keys(defaultAirFilters) as (keyof AirFilters)[]).forEach(key => dispatch({ type: 'air-filter', key, value: 'all' }))}>Clear air filters</Button>}</div>}
            <div className="layer-update"><span>LAST UPDATE</span><span className="mono">{feed ? `${utcTime(feed.updatedAt)}Z` : layer.phase === 0 ? layer.id === 'terminator' ? 'COMPUTED / 60s' : 'BUNDLED' : '—'}</span></div>
          </div>}
        </section>;
      })}
    </div>
    <div className="panel-footer"><Icon name="info" size={13}/><span>Drag layers to set draw order.<br/>Solo retains the geographic basemap.</span></div>
    <div className="workspace-tag"><span className="health-dot healthy"/> LOCAL WORKSPACE <span className="mono">v0.0</span></div>
  </aside>;
}
