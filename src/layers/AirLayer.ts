import type { LayerDefinition } from './types';
export const airLayer: LayerDefinition = { id: 'air', name: 'Air traffic', description: 'Click a plane for its route and photo', icon: 'air', color: '#4C90F0', provenance: 'LIVE', phase: 1, defaultVisible: true, transport: 'air', filters: ['Altitude band', 'Aircraft type', 'Aircraft class'] };
