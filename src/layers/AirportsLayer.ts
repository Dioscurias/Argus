import type { LayerDefinition } from './types';
import type { ExpressionSpecification } from 'maplibre-gl';
export const airportsLayer: LayerDefinition = { id: 'airports', name: 'Airports', description: 'Large and medium airports', icon: 'pin', color: '#4C90F0', provenance: 'REFERENCE', phase: 1, defaultVisible: true };
export function airportOpacity(opacity: number): ExpressionSpecification {
  return ['step', ['zoom'], ['case', ['==', ['get', 'type'], 'large_airport'], opacity * 0.8, 0], 3, ['case', ['==', ['get', 'type'], 'large_airport'], opacity * 0.8, opacity * 0.6]];
}
