import type { Map } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';

const labels: [string, number, number, 'land' | 'water'][] = [
  ['UNITED STATES', -101, 38, 'land'], ['CANADA', -106, 58, 'land'],
  ['MEXICO', -103, 24, 'land'], ['BRAZIL', -52, -10, 'land'], ['ARGENTINA', -64, -36, 'land'],
  ['GREENLAND', -42, 73, 'land'], ['RUSSIA', 95, 61, 'land'], ['CHINA', 104, 35, 'land'],
  ['INDIA', 79, 23, 'land'], ['AUSTRALIA', 134, -26, 'land'], ['ALGERIA', 3, 28, 'land'],
  ['SOUTH AFRICA', 25, -29, 'land'], ['SAUDI ARABIA', 44, 24, 'land'], ['IRAN', 54, 33, 'land'],
  ['FRANCE', 2, 47, 'land'], ['UNITED KINGDOM', -3, 56, 'land'], ['SPAIN', -4, 39, 'land'],
  ['JAPAN', 141, 37, 'land'], ['INDONESIA', 117, -5, 'land'],
  ['NORTH ATLANTIC OCEAN', -39, 31, 'water'], ['SOUTH ATLANTIC OCEAN', -15, -30, 'water'],
  ['PACIFIC OCEAN', -148, 6, 'water'], ['INDIAN OCEAN', 76, -20, 'water'],
];

export function addReferenceLabels(map: Map) {
  const data: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };
  labels.forEach(([label, lon, lat, kind], index) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    const font = `${kind === 'water' ? 400 : 500} ${kind === 'water' ? 18 : 19}px Inter, sans-serif`;
    context.font = font;
    const spacing = kind === 'water' ? 3.5 : 2;
    canvas.width = Math.ceil(context.measureText(label).width + label.length * spacing + 8);
    canvas.height = 32;
    context.font = font;
    context.fillStyle = kind === 'water' ? '#485969' : '#6f7e8c';
    context.textBaseline = 'middle';
    let x = 4;
    for (const character of label) { context.fillText(character, x, 16); x += context.measureText(character).width + spacing; }
    const id = `reference-label-${index}`;
    map.addImage(id, context.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio: 2 });
    data.features.push({ type: 'Feature', properties: { image: id }, geometry: { type: 'Point', coordinates: [lon, lat] } });
  });
  map.addSource('labels', { type: 'geojson', data });
  map.addLayer({ id: 'reference-labels', type: 'symbol', source: 'labels', layout: { 'icon-image': ['get', 'image'], 'icon-allow-overlap': false, 'icon-padding': 15, 'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 3, 1.1] } });
}
