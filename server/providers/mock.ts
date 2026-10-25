import type { Entity, TransportLayer } from '../../shared/schema.js';
import type { EntityProvider } from './provider.js';

type Point = readonly [number, number];
type Route = { origin: string; destination: string; points: readonly Point[] };
interface MockOptions { seed: number; counts: Record<TransportLayer, number>; epoch: number }
interface SeedEntity { entity: Entity; route: Route; offset: number; duration: number }

// Synthetic routes only: these are not observations or freight-volume estimates.
const routes: Record<TransportLayer, Route[]> = {
  air: [
    { origin: 'JFK', destination: 'LHR', points: [[-73.78, 40.64], [-45, 52], [-0.45, 51.47]] },
    { origin: 'LAX', destination: 'ORD', points: [[-118.41, 33.94], [-104, 40], [-87.90, 41.98]] },
    { origin: 'CDG', destination: 'DXB', points: [[2.55, 49.01], [22, 43], [55.36, 25.25]] },
    { origin: 'SIN', destination: 'HND', points: [[103.99, 1.36], [121, 19], [139.78, 35.55]] },
    { origin: 'SFO', destination: 'NRT', points: [[-122.38, 37.62], [-170, 49], [140.39, 35.77]] },
  ],
  sea: [
    { origin: 'Rotterdam', destination: 'New York', points: [[4, 52], [-5, 49], [-35, 43], [-74, 40.5]] },
    { origin: 'Singapore', destination: 'Shanghai', points: [[104, 1], [112, 8], [121.8, 22], [122.3, 31]] },
    { origin: 'Los Angeles', destination: 'Yokohama', points: [[-118.5, 33.5], [-155, 32], [178, 33], [140, 34.6]] },
    { origin: 'Suez', destination: 'Singapore', points: [[32.5, 29.8], [43, 12], [65, 8], [95, 6], [104, 1]] },
  ],
  truck: [
    { origin: 'Los Angeles', destination: 'Dallas', points: [[-118.24, 34.05], [-112.07, 33.45], [-106.49, 31.76], [-96.80, 32.78]] },
    { origin: 'Chicago', destination: 'New York', points: [[-87.63, 41.88], [-83.05, 41.45], [-80, 41], [-74.01, 40.71]] },
    { origin: 'Seattle', destination: 'Chicago', points: [[-122.33, 47.61], [-116, 47], [-104, 46], [-93, 44.9], [-87.63, 41.88]] },
    { origin: 'Laredo', destination: 'Kansas City', points: [[-99.51, 27.51], [-98.49, 29.42], [-97.74, 30.27], [-97.5, 35.47], [-94.58, 39.1]] },
  ],
};

function randomGenerator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function longitudeDelta(from: number, to: number) { return ((to - from + 540) % 360) - 180; }
function distance(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const h = Math.sin((b[1] - a[1]) * rad / 2) ** 2
    + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(longitudeDelta(a[0], b[0]) * rad / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export class MockProvider implements EntityProvider {
  readonly id = 'mock';
  readonly provenance = 'MODELED' as const;
  readonly layers = ['air', 'sea', 'truck'] as const;
  private readonly seeds: SeedEntity[] = [];
  private readonly epoch: number;

  constructor(options: MockOptions) {
    this.epoch = options.epoch;
    const random = randomGenerator(options.seed);
    for (const layer of this.layers) {
      for (let index = 0; index < options.counts[layer]; index++) {
        const route = routes[layer][index % routes[layer].length];
        const speed = layer === 'air' ? 380 + random() * 140 : layer === 'sea' ? 8 + random() * 15 : 35 + random() * 20;
        const subtypes = layer === 'air' ? ['A320', 'B738', 'B789', 'A359'] : layer === 'sea' ? ['cargo', 'tanker', 'passenger', 'fishing', 'other'] : ['semi-trailer'];
        const length = route.points.slice(1).reduce((sum, point, i) => sum + distance(route.points[i], point), 0);
        this.seeds.push({
          route, offset: random(), duration: length / (speed * 1.852) * 3_600_000,
          entity: {
            id: `mock-${layer}-${index.toString().padStart(5, '0')}`,
            layer, lat: 0, lon: 0, heading: 0, speed: Math.round(speed),
            altitude: layer === 'air' ? 28000 + Math.floor(random() * 13) * 1000 : 0,
            label: `${layer === 'air' ? 'SIM' : layer === 'sea' ? 'SYNTH VESSEL' : 'SYNTH TRUCK'} ${String(index + 1).padStart(4, '0')}`,
            subtype: subtypes[index % subtypes.length],
            origin: route.origin, destination: route.destination,
            source: `mock-${layer}`, ts: options.epoch, provenance: 'MODELED',
            meta: { synthetic: true, seed: options.seed, speedUnit: 'knots', altitudeUnit: 'feet', routeModel: 'synthetic piecewise-linear loop' },
          },
        });
      }
    }
  }

  poll(now: number): Entity[] {
    return this.seeds.map(({ entity, route, offset, duration }) => {
      const progress = ((offset + (now - this.epoch) / duration) % 1 + 1) % 1;
      const segment = progress * (route.points.length - 1);
      const index = Math.floor(segment);
      const fraction = segment - index;
      const a = route.points[index];
      const b = route.points[index + 1];
      const delta = longitudeDelta(a[0], b[0]);
      const lon = ((a[0] + delta * fraction + 540) % 360) - 180;
      const lat = a[1] + (b[1] - a[1]) * fraction;
      const heading = (Math.atan2(delta * Math.cos(lat * Math.PI / 180), b[1] - a[1]) * 180 / Math.PI + 360) % 360;
      return { ...entity, lat, lon, heading, ts: now };
    });
  }
}
