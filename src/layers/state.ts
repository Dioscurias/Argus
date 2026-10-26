import { basemapLayer } from './BasemapLayer';
import { graticuleLayer } from './GraticuleLayer';
import { terminatorLayer } from './TerminatorLayer';
import { airportsLayer } from './AirportsLayer';
import { airLayer } from './AirLayer';
import { portsLayer } from './PortsLayer';
import { seaLayer } from './SeaLayer';
import { freightCorridorsLayer } from './FreightCorridorsLayer';
import { truckLayer } from './TruckLayer';
import type { LayerId, LayerStack, LayerState } from './types';
import { defaultAirFilters, type AirFilters } from './air-filters';

const definitions = [basemapLayer, graticuleLayer, terminatorLayer, airportsLayer, airLayer, portsLayer, seaLayer, freightCorridorsLayer, truckLayer];
export const initialLayers = (): LayerState[] => definitions.map(layer => ({ ...layer, visible: layer.defaultVisible, opacity: layer.id === 'graticule' ? 0.35 : layer.id === 'terminator' ? 0.45 : 1 }));
export type LayerAction =
  | { type: 'toggle'; id: LayerId }
  | { type: 'solo'; id: LayerId }
  | { type: 'opacity'; id: LayerId; value: number }
  | { type: 'move'; id: LayerId; targetId: LayerId }
  | { type: 'air-filter'; key: keyof AirFilters; value: string }
  | { type: 'reset' };

export function isLayerVisible(stack: LayerStack, id: LayerId): boolean {
  const layer = stack.layers.find(item => item.id === id);
  if (!layer) return false;
  // Retain the geographic reference when isolating an operational layer.
  return stack.soloId ? id === stack.soloId || (id === 'basemap' && layer.visible) : layer.visible;
}

export function layerReducer(state: LayerStack, action: LayerAction): LayerStack {
  if (action.type === 'air-filter') return { ...state, airFilters: { ...defaultAirFilters, ...state.airFilters, [action.key]: action.value } };
  if (action.type === 'reset') return { layers: initialLayers(), soloId: null };
  if (action.type === 'solo') return { ...state, soloId: state.soloId === action.id ? null : action.id };
  if (action.type === 'move') {
    const from = state.layers.findIndex(layer => layer.id === action.id);
    const to = state.layers.findIndex(layer => layer.id === action.targetId);
    if (from < 0 || to < 0 || from === to) return state;
    const layers = [...state.layers];
    const [layer] = layers.splice(from, 1);
    layers.splice(to, 0, layer);
    return { ...state, layers };
  }
  return {
    ...state,
    soloId: action.type === 'toggle' ? null : state.soloId,
    layers: state.layers.map(layer => layer.id !== action.id ? layer : action.type === 'toggle'
      ? { ...layer, visible: !isLayerVisible(state, layer.id) }
      : { ...layer, opacity: Number.isFinite(action.value) ? Math.max(0, Math.min(1, action.value)) : layer.opacity }),
  };
}
