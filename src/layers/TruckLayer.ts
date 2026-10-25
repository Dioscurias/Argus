import type { LayerDefinition } from './types';
export const truckLayer: LayerDefinition = { id: 'truck', name: 'Truck movement', description: 'Synthetic freight · buffered only', icon: 'truck', color: '#FBB360', provenance: 'MODELED', phase: 3, defaultVisible: true, transport: 'truck', filters: ['Corridor', 'Volume threshold'] };
