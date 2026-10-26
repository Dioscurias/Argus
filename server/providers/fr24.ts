import SDK from '@flightradar24/fr24sdk';
import { normalizeFr24 } from './normalize-air.js';
import { getJson, ProviderError, type AirProvider } from './air-provider.js';

export class Fr24Provider implements AirProvider {
  readonly id = 'fr24' as const;
  readonly minIntervalMs = 60000;
  private client;
  private failure: ProviderError | null = null;
  constructor(apiKey: string, private readonly bounds: string) {
    this.client = new SDK.Client({ apiToken: apiKey, timeout: 12000, httpClient: {
      // SDK 0.1.1 drops response headers when rethrowing. Preserve Retry-After here.
      request: async ({ url, params }) => {
        const query = new URLSearchParams(Object.entries(params ?? {}).filter(([, value]) => value !== undefined).map(([key, value]): [string, string] => [key, String(value)]));
        try { return { data: await getJson(`https://fr24api.flightradar24.com${url}?${query}`, { headers: { Authorization: `Bearer ${apiKey}`, 'Accept-version': 'v1' } }) }; }
        catch (error) { if (error instanceof ProviderError) this.failure = error; throw error; }
      },
    } });
  }
  async poll(now: number) {
    this.failure = null;
    try { return normalizeFr24(await this.client.live.getFull({ bounds: this.bounds, limit: 1000 }), now); }
    catch { throw this.failure ?? new ProviderError(15 * 60000); }
  }
  dispose() { this.client.close(); }
}
