import type { FeatureCollection, LineString } from 'geojson';

export function makeGraticule(): FeatureCollection<LineString> {
  const features: FeatureCollection<LineString>['features'] = [];
  for (let lon = -180; lon <= 180; lon += 15) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: Array.from({ length: 85 }, (_, i) => [lon, -84 + i * 2]) } });
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: Array.from({ length: 181 }, (_, i) => [-180 + i * 2, lat]) } });
  }
  return { type: 'FeatureCollection', features };
}
