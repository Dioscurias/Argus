import type { LayerDefinition } from './types';
export const seaLayer: LayerDefinition = { id: 'sea', name: 'Sea traffic', description: 'Synthetic vessels · buffered only', icon: 'sea', color: '#2DD4BF', provenance: 'MODELED', phase: 2, defaultVisible: true, transport: 'sea', filters: ['Ship type', 'Flag', 'Speed'] };
