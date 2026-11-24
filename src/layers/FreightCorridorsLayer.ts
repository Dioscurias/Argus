import type { LayerDefinition } from './types';
export const freightCorridorsLayer: LayerDefinition = { id: 'corridors', name: 'Freight corridors', description: 'Modeled network · Phase 3', icon: 'route', color: '#FFFFFF', provenance: 'MODELED', phase: 3, defaultVisible: false, filters: ['Corridor', 'Volume threshold'] };
