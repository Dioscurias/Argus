import type { Entity } from '../../shared/schema.js';
export interface AirProvider {
  readonly id: 'fr24' | 'opensky' | 'adsblol';
  readonly minIntervalMs: number;
  poll(now: number): Promise<Entity[]>;
  dispose?(): void;
}
export class ProviderError extends Error {
  constructor(readonly retryAfterMs = 60000, readonly status = 503) { super(`Provider unavailable (${status})`); }
}
export async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12000) });
  if (!response.ok) {
    const retry = response.headers.get('retry-after');
    const openSkyRetry = Number(response.headers.get('x-rate-limit-retry-after-seconds'));
    const seconds = Number(retry);
    const delay = retry ? Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retry) - Date.now() : 60000;
    throw new ProviderError(Math.max(60000, Number.isFinite(delay) ? delay : 60000, Number.isFinite(openSkyRetry) ? openSkyRetry * 1000 : 0), response.status);
  }
  return response.json();
}
