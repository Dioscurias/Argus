import type { Map, GeoJSONSource } from 'maplibre-gl';
import type { Entity } from '../../shared/schema';
import type { RouteAirport } from '../../shared/aircraft-details';
import { lineFeatures, routeLines, splitDateline, trackLines, type TrackPoint } from './flight-path';
import type { AircraftPosition } from './aircraft-motion';

export function addAircraftLayers(map: Map) {
  // Native symbols use MapLibre's globe projection and horizon clipping.
  for (const [name, color] of [['aircraft-blue', '#4c90f0'], ['aircraft-muted', '#8498b0'], ['aircraft-selected', '#65f3cd']]) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d')!;
    context.fillStyle = color;
    context.fill(new Path2D('M30 3h4l3 22 23 15v5l-23-8-1 15 8 7v3l-12-4-12 4v-3l8-7-1-15-23 8v-5l23-15z'));
    map.addImage(name, context.getImageData(0, 0, 64, 64));
  }
  for (const id of ['aircraft', 'flight-trail', 'flight-estimate', 'flight-route', 'route-airports']) map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'flight-route', type: 'line', source: 'flight-route', paint: { 'line-color': '#d8b56d', 'line-width': 2, 'line-dasharray': [3, 3] } });
  map.addLayer({ id: 'flight-trail', type: 'line', source: 'flight-trail', paint: { 'line-color': '#65f3cd', 'line-width': 3 } });
  map.addLayer({ id: 'flight-estimate', type: 'line', source: 'flight-estimate', paint: { 'line-color': '#65f3cd', 'line-width': 2, 'line-dasharray': [1, 2] } });
  map.addLayer({ id: 'route-airports', type: 'circle', source: 'route-airports', paint: { 'circle-color': '#d8b56d', 'circle-radius': 5, 'circle-stroke-color': '#0a0e13', 'circle-stroke-width': 2 } });
  map.addLayer({ id: 'selected-halo', type: 'circle', source: 'aircraft', filter: ['==', ['get', 'selected'], true], paint: { 'circle-radius': 17, 'circle-color': '#65f3cd', 'circle-opacity': 0.12, 'circle-stroke-color': '#65f3cd', 'circle-stroke-width': 1 } });
  map.addLayer({ id: 'aircraft', type: 'symbol', source: 'aircraft', layout: {
    'icon-image': ['case', ['get', 'selected'], 'aircraft-selected', ['==', ['get', 'provenance'], 'DELAYED'], 'aircraft-muted', 'aircraft-blue'],
    'icon-size': ['case', ['get', 'selected'], 0.4, 0.23], 'icon-rotate': ['get', 'heading'],
    'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'viewport', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
  } });
}

export function updateAircraft(map: Map, aircraft: Entity[], selectedId: string | null, positions: AircraftPosition[]) {
  const byId = new globalThis.Map(positions.map(position => [position.id, position]));
  (map.getSource('aircraft') as GeoJSONSource).setData({ type: 'FeatureCollection', features: aircraft.map(entity => {
    const position = byId.get(entity.id) ?? entity;
    return { type: 'Feature', id: entity.id, properties: { id: entity.id, heading: position.heading, provenance: entity.provenance, selected: entity.id === selectedId }, geometry: { type: 'Point', coordinates: [position.lon, position.lat] } };
  }) });
}

export function updateAircraftMotion(map: Map, positions: AircraftPosition[]) {
  (map.getSource('aircraft') as GeoJSONSource).updateData({ update: positions.map(position => ({ id: position.id, newGeometry: { type: 'Point', coordinates: [position.lon, position.lat] }, addOrUpdateProperties: [{ key: 'heading', value: position.heading }] })) });
}

export function updateEstimatedPath(map: Map, selected: Entity | null, position?: AircraftPosition) {
  const lines = selected && position?.estimated ? splitDateline([[selected.lon, selected.lat], [position.lon, position.lat]]) : [];
  (map.getSource('flight-estimate') as GeoJSONSource).setData(lineFeatures(lines));
}

export function updateFlightPath(map: Map, points: TrackPoint[], airports: RouteAirport[]) {
  (map.getSource('flight-trail') as GeoJSONSource).setData(lineFeatures(trackLines(points)));
  (map.getSource('flight-route') as GeoJSONSource).setData(lineFeatures(routeLines(airports)));
  (map.getSource('route-airports') as GeoJSONSource).setData({ type: 'FeatureCollection', features: airports.map(airport => ({ type: 'Feature', properties: { code: airport.code }, geometry: { type: 'Point', coordinates: [airport.lon, airport.lat] } })) });
}
