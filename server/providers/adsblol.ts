import { getJson, ProviderError, type AirProvider } from './air-provider.js';
import { normalizeAdsb } from './normalize-air.js';

// The public type endpoint has no catch-all. Keep common airliners, rotorcraft,
// general aviation and business aircraft in a single request.
const GLOBAL_TYPES = [
  'A119', 'A139', 'A169', 'A19N', 'A20N', 'A21N', 'A225', 'A306', 'A30B', 'A310', 'A318', 'A319', 'A320',
  'A321', 'A332', 'A333', 'A338', 'A339', 'A342', 'A343', 'A345', 'A346', 'A359', 'A35K', 'A388', 'AC11',
  'AC50', 'AEST', 'AJ27', 'AP22', 'AS50', 'ASTR', 'AT43', 'AT44', 'AT45', 'AT46', 'AT72', 'AT73', 'AT75',
  'AT76', 'AURA', 'B06', 'B190', 'B214', 'B350', 'B37M', 'B38M', 'B39M', 'B407', 'B412', 'B429', 'B461',
  'B462', 'B463', 'B47T', 'B505', 'B712', 'B720', 'B721', 'B722', 'B732', 'B733', 'B734', 'B735', 'B736',
  'B737', 'B738', 'B739', 'B741', 'B742', 'B743', 'B744', 'B748', 'B74R', 'B74S', 'B752', 'B753', 'B762',
  'B763', 'B764', 'B772', 'B773', 'B778', 'B779', 'B77L', 'B77W', 'B788', 'B789', 'B78X', 'BALL', 'BCS1',
  'BCS3', 'BE20', 'BE30', 'BE35', 'BE36', 'BE40', 'BE55', 'BE58', 'BE9L', 'BL8', 'C130', 'C150', 'C152',
  'C17', 'C172', 'C180', 'C182', 'C206', 'C208', 'C25A', 'C25B', 'C25C', 'C25M', 'C295', 'C30J', 'C310',
  'C340', 'C402', 'C404', 'C5', 'C525', 'C550', 'C560', 'C56X', 'C5M', 'C650', 'C680', 'C68A', 'C700',
  'C750', 'C82R', 'C82T', 'C919', 'CA25', 'CJ6', 'CL30', 'CL35', 'CL60', 'CRJ1', 'CRJ2', 'CRJ7', 'CRJ9',
  'CRJX', 'CRUZ', 'DA40', 'DA42', 'DA62', 'DC10', 'DH8A', 'DH8B', 'DH8C', 'DH8D', 'DV20', 'E110', 'E120',
  'E135', 'E145', 'E170', 'E175', 'E190', 'E195', 'E290', 'E295', 'E35L', 'E50P', 'E545', 'E550', 'E55P',
  'E75L', 'E75S', 'EC20', 'EC30', 'EC35', 'EC45', 'EFOX', 'F100', 'F2TH', 'F900', 'FA50', 'FA7X', 'FA8X',
  'G109', 'G150', 'G222', 'G280', 'GA5C', 'GA6C', 'GA7C', 'GA8', 'GA8C', 'GALX', 'GL5T', 'GL7T', 'GLAS',
  'GLEX', 'GLF4', 'GLF5', 'GLF6', 'GLID', 'GOLF', 'H160', 'H25B', 'H500', 'H60', 'HA4T', 'HDJT', 'IL76',
  'L39', 'LJ35', 'LJ40', 'LJ45', 'LJ60', 'M20P', 'MD11', 'MD80', 'MD81', 'MD82', 'MD83', 'MD87', 'MD88',
  'MD90', 'NG5', 'P1', 'P180', 'P208', 'P28A', 'P66P', 'P68', 'P750', 'PA23', 'PA24', 'PA28', 'PA31',
  'PA32', 'PA38', 'PA44', 'PAY3', 'PC12', 'PC24', 'PIVI', 'PRM1', 'PULS', 'R22', 'R44', 'S22T', 'SB20',
  'SF25', 'SF34', 'SIRA', 'SLG2', 'SLG4', 'SR20', 'SR22', 'SU95', 'T206', 'T210',
].join(',');
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
  private bulkRetryAt = 0;

  constructor(private readonly bulkKey = '') {}

  async poll(now: number) {
    if (this.bulkKey && now >= this.bulkRetryAt) {
      try {
        const payload = await getJson('https://api.adsb.lol/v2?all', {
          headers: { ...headers, 'x-api-key': this.bulkKey },
        }) as { aircraft?: unknown; now?: unknown } | null;
        return normalizeAdsb({ ac: payload?.aircraft, now: payload?.now }, now, false);
      } catch (error) {
        // Retry the bulk endpoint separately and keep the public feeds available.
        const retryAfter = error instanceof ProviderError ? error.retryAfterMs : 0;
        this.bulkRetryAt = now + Math.max(15 * 60_000, retryAfter);
      }
    }
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
