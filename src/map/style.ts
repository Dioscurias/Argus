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
    name: 'ARGUS / monochrome reference',
    sources: {
      countries: { type: 'geojson', data: '/data/countries.geojson', attribution: 'Natural Earth · public domain' },
      graticule: { type: 'geojson', data: makeGraticule() },
      night: { type: 'geojson', data: makeNightMask(Date.now()) },
      airports: { type: 'geojson', data: '/data/airports.geojson', attribution: 'OurAirports · public domain' },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#000000' } },
      { id: 'countries-fill', type: 'fill', source: 'countries', paint: { 'fill-color': '#0d0d0d', 'fill-opacity': 1 } },
      { id: 'countries-outline', type: 'line', source: 'countries', paint: { 'line-color': 'rgba(255,255,255,0.4)', 'line-width': 0.65, 'line-opacity': 0.7 } },
      { id: 'coordinate-grid', type: 'line', source: 'graticule', paint: { 'line-color': 'rgba(255,255,255,0.35)', 'line-width': 0.5, 'line-opacity': 0.35 } },
      { id: 'night-mask', type: 'fill', source: 'night', layout: { visibility: 'none' }, paint: { 'fill-color': 'rgba(255,255,255,0.16)', 'fill-opacity': 0.45 } },
      { id: 'airport-points', type: 'circle', source: 'airports', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 1.5, 5, 4], 'circle-color': '#8c8c8c', 'circle-stroke-color': '#000000', 'circle-stroke-width': 1, 'circle-opacity': airportOpacity(1) } },
    ],
  };
}
