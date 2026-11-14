import { getJson, ProviderError, type AirProvider } from './air-provider.js';
import { normalizeAdsb } from './normalize-air.js';

const GLOBAL_TYPES = 'A19N,A20N,A21N,A225,A306,A30B,A310,A318,A319,A320,A321,A332,A333,A338,A339,A342,A343,A345,A346,A359,A35K,A388,AT43,AT44,AT45,AT46,AT72,AT73,AT75,AT76,B190,B350,B38M,B39M,B461,B462,B463,B712,B720,B721,B722,B732,B733,B734,B735,B736,B737,B738,B739,B741,B742,B743,B744,B748,B74R,B74S,B752,B753,B762,B763,B764,B772,B773,B778,B779,B77L,B77W,B788,B789,B78X,BCS1,BCS3,BE20,BE35,BE36,C130,C17,C172,C182,C208,C25A,C25B,C25C,C295,C30J,C5,C56X,CL30,CL35,CL60,CRJ1,CRJ2,CRJ7,CRJ9,CRJX,DC10,DH8A,DH8B,DH8C,DH8D,E120,E135,E145,E170,E175,E190,E195,E290,E295,E50P,E55P,F2TH,F900,FA50,FA7X,FA8X,GL5T,GLF4,GLF5,GLF6,HDJT,IL76,LJ35,LJ45,LJ60,MD11,MD80,MD81,MD82,MD83,MD87,MD88,MD90,P180,PA28,PC12,SF34,SR20,SR22,SU95';
const headers = { 'User-Agent': 'ARGUS/1.0 (+https://github.com/Dioscurias/Argus; https://argus-one-mu.vercel.app)' };

export class AdsbLolProvider implements AirProvider {
  readonly id = 'adsblol' as const;
  readonly minIntervalMs = 60000;
  constructor(private readonly point: string) {}
  async poll(now: number) {
    const [lat, lon, radius] = this.point.split(',');
    return normalizeAdsb(await getJson(`https://api.adsb.lol/v2/point/${lat}/${lon}/${radius}`, {
      headers,
    }), now);
  }
}

export class AdsbLolGlobalProvider implements AirProvider {
  readonly id = 'adsblol-global' as const;
  readonly minIntervalMs = 90000;
  private military: ReturnType<typeof normalizeAdsb> = [];
  private militaryRetryAt = 0;

  async poll(now: number) {
    const traffic = getJson(`https://api.adsb.lol/v2/type/${GLOBAL_TYPES}`, { headers });
    const [, payload] = await Promise.all([this.refreshMilitary(now), traffic]);
    const merged = new Map(normalizeAdsb(payload, now, false).map(entity => [entity.id, entity]));
    for (const entity of this.military) {
      if (now - entity.ts > 5 * 60_000) continue;
      const observed = merged.get(entity.id);
      if (observed && observed.ts >= entity.ts) observed.meta.military = true;
      else merged.set(entity.id, entity);
    }
    return [...merged.values()];
  }

  private async refreshMilitary(now: number) {
    if (now < this.militaryRetryAt) return;
    const interval = 3 * 60_000;
    this.militaryRetryAt = now + interval;
    try {
      const records = normalizeAdsb(await getJson('https://api.adsb.lol/v2/mil', { headers }), now, false);
      this.military = records.map(entity => ({ ...entity, meta: { ...entity.meta, military: true } }));
    } catch (error) {
      if (error instanceof ProviderError) this.militaryRetryAt = now + Math.max(interval, error.retryAfterMs);
    }
  }
}
