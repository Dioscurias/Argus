import type { LayerDefinition } from './types';
export const airLayer: LayerDefinition = { id: 'air', name: 'Air traffic', description: 'Synthetic aircraft · buffered only', icon: 'air', color: '#4C90F0', provenance: 'MODELED', phase: 1, defaultVisible: true, transport: 'air', filters: ['Altitude band', 'Airline', 'Aircraft type'] };
