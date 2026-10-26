import { getJson, type AirProvider } from './air-provider.js';
import { normalizeAdsb } from './normalize-air.js';

export class AdsbLolProvider implements AirProvider {
  readonly id = 'adsblol' as const;
  readonly minIntervalMs = 60000;
  constructor(private readonly point: string) {}
  async poll(now: number) {
    const [lat, lon, radius] = this.point.split(',');
    return normalizeAdsb(await getJson(`https://api.adsb.lol/v2/point/${lat}/${lon}/${radius}`, {
      headers: { 'User-Agent': 'ARGUS/1.0 (+https://github.com/Dioscurias/Argus; https://argus-one-mu.vercel.app)' },
    }), now);
  }
}
