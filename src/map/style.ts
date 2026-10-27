import type { StyleSpecification } from 'maplibre-gl';
import { makeGraticule, makeNightMask } from './geography';
import { airportOpacity } from '../layers/AirportsLayer';

export const mapLayerIds: Record<string, string[]> = {
  basemap: ['countries-fill', 'countries-outline', 'reference-labels'],
  graticule: ['coordinate-grid'],
  terminator: ['night-mask'],
  airports: ['airport-points'],
  air: ['flight-route', 'flight-trail', 'flight-estimate', 'route-airports', 'selected-halo', 'aircraft'],
};

export function createMapStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'ARGUS / low-contrast reference',
    sources: {
      countries: { type: 'geojson', data: '/data/countries.geojson', attribution: 'Natural Earth · public domain' },
      graticule: { type: 'geojson', data: makeGraticule() },
      night: { type: 'geojson', data: makeNightMask(Date.now()) },
      airports: { type: 'geojson', data: '/data/airports.geojson', attribution: 'OurAirports · public domain' },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0A0E13' } },
      { id: 'countries-fill', type: 'fill', source: 'countries', paint: { 'fill-color': '#151E28', 'fill-opacity': 1 } },
      { id: 'countries-outline', type: 'line', source: 'countries', paint: { 'line-color': '#334353', 'line-width': 0.65, 'line-opacity': 0.7 } },
      { id: 'coordinate-grid', type: 'line', source: 'graticule', paint: { 'line-color': '#364554', 'line-width': 0.5, 'line-opacity': 0.35 } },
      { id: 'night-mask', type: 'fill', source: 'night', layout: { visibility: 'none' }, paint: { 'fill-color': '#000000', 'fill-opacity': 0.45 } },
      { id: 'airport-points', type: 'circle', source: 'airports', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 1.5, 5, 4], 'circle-color': '#7d9bbb', 'circle-stroke-color': '#152334', 'circle-stroke-width': 1, 'circle-opacity': airportOpacity(1) } },
    ],
  };
}
