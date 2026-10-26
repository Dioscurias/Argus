import type { TransportLayer } from '../../shared/schema';
import type { AirFilters } from './air-filters';

export type LayerId = 'basemap' | 'graticule' | 'terminator' | 'airports' | 'air' | 'ports' | 'sea' | 'corridors' | 'truck';
export interface LayerDefinition {
  id: LayerId;
  name: string;
  description: string;
  icon: 'map' | 'grid' | 'moon' | 'pin' | 'air' | 'anchor' | 'sea' | 'route' | 'truck';
  color: string;
  provenance: 'REFERENCE' | 'MODELED' | 'COMPUTED';
  phase: 0 | 1 | 2 | 3;
  defaultVisible: boolean;
  transport?: TransportLayer;
  filters?: readonly string[];
}
export interface LayerState extends LayerDefinition { visible: boolean; opacity: number }
export interface LayerStack { layers: LayerState[]; soloId: LayerId | null; airFilters?: AirFilters }
