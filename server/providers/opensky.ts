import { getJson, ProviderError, type AirProvider } from './air-provider.js';
import { normalizeOpenSky } from './normalize-air.js';

export class OpenSkyProvider implements AirProvider {
  readonly id = 'opensky' as const;
  minIntervalMs: number;
  private token = '';
  private expiresAt = 0;
  constructor(private readonly bounds: string, private readonly clientId = '', private readonly clientSecret = '') {
    // Conservative daily budgets: up to 4 credits per request, 400 anonymous / 4000 authenticated.
    this.minIntervalMs = clientId && clientSecret ? 90000 : 900000;
  }
  async poll(now: number) {
    if (this.clientId && this.clientSecret && now >= this.expiresAt) {
      try {
        const result = await getJson('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'client_credentials', client_id: this.clientId, client_secret: this.clientSecret }).toString(),
        }) as { access_token?: string; expires_in?: number };
        if (!result.access_token) throw new ProviderError(900000, 401);
        this.token = result.access_token;
        this.expiresAt = now + Math.max(0, (result.expires_in ?? 1800) - 60) * 1000;
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        this.token = '';
        this.expiresAt = now + 900000;
        this.minIntervalMs = 900000;
      }
    }
    const [north, south, west, east] = this.bounds.split(',');
    const params = new URLSearchParams({ lamin: south, lamax: north, lomin: west, lomax: east });
    try { return normalizeOpenSky(await getJson(`https://opensky-network.org/api/states/all?${params}`, this.token ? { headers: { Authorization: `Bearer ${this.token}` } } : undefined), now); }
    catch (error) { if (error instanceof ProviderError && error.status === 401) this.expiresAt = 0; throw error; }
  }
}
