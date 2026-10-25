import type { FeatureCollection, LineString, Polygon } from 'geojson';

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

/** Approximate solar position; visual reference, not a navigation ephemeris. */
export function makeNightMask(now: number): FeatureCollection<Polygon> {
  const rad = Math.PI / 180;
  const days = now / 86400000 + 2440587.5 - 2451545;
  const meanLongitude = (280.46 + 0.9856474 * days) * rad;
  const anomaly = (357.528 + 0.9856003 * days) * rad;
  const longitude = meanLongitude + (1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * rad;
  const obliquity = (23.439 - 0.0000004 * days) * rad;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(longitude));
  const ascension = Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude)) / rad;
  const sidereal = 280.46061837 + 360.98564736629 * days;
  const sunLongitude = ((ascension - sidereal) % 360 + 540) % 360 - 180;
  const edge = Array.from({ length: 181 }, (_, i) => {
    const lon = -180 + i * 2;
    const lat = Math.atan(-Math.cos((lon - sunLongitude) * rad) / (Math.tan(declination) || 1e-8)) / rad;
    return [lon, Math.max(-85, Math.min(85, lat))];
  });
  const pole = declination >= 0 ? -85.051129 : 85.051129;
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { provenance: 'MODELED' }, geometry: { type: 'Polygon', coordinates: [[...edge, [180, pole], [-180, pole], edge[0]]] } }] };
}
