import type { Entity, FeedStatus } from '../shared/schema.js';
import { ProviderError, type AirProvider } from './providers/air-provider.js';

export class AirFeed {
  private records: Entity[] = [];
  private updatedAt = 0;
  private nextPoll = 0;
  private pending: Promise<void> | null = null;
  private source: string;
  private health: FeedStatus['health'] = 'degraded';
  private message = 'Awaiting first provider response.';
  constructor(private primary: AirProvider, private fallback: AirProvider | null, private interval: number) { this.source = primary.id; }
  refresh(now: number): Promise<void> {
    if (this.pending) return this.pending;
    if (now < this.nextPoll) return Promise.resolve();
    this.pending = this.update(now).finally(() => { this.pending = null; });
    return this.pending;
  }
  private async update(now: number) {
    let wait = Math.max(this.interval, this.primary.minIntervalMs);
    let primaryStatus: number | undefined;
    let primaryMessage = '';
    for (const [index, provider] of [this.primary, this.fallback].entries()) {
      if (!provider) continue;
      wait = Math.max(wait, provider.minIntervalMs);
      try {
        this.records = await provider.poll(now);
        wait = Math.max(wait, provider.minIntervalMs);
        this.source = provider.id;
        this.updatedAt = now;
        this.health = index === 0 ? 'healthy' : 'degraded';
        this.message = index === 0 ? `Observed air traffic from ${provider.id}.` : `${this.primary.id} unavailable${primaryStatus ? ` (HTTP ${primaryStatus})` : primaryMessage ? ` (${primaryMessage})` : ''}; using ${provider.id} fallback.`;
        this.nextPoll = now + wait;
        return;
      } catch (error) {
        console.warn('Air provider request failed', { provider: provider.id, status: error instanceof ProviderError ? error.status : undefined, message: error instanceof Error ? error.message : 'Unknown error' });
        if (index === 0) {
          if (error instanceof ProviderError) primaryStatus = error.status;
          else primaryMessage = error instanceof Error ? error.message.slice(0, 120) : 'unknown error';
        }
        if (error instanceof ProviderError) wait = Math.max(wait, error.retryAfterMs);
      }
    }
    this.health = 'offline';
    this.message = this.records.length ? 'Provider unavailable. Retaining last observations as DELAYED.' : 'Provider unavailable. No observations received; reference map remains available.';
    this.nextPoll = now + Math.max(wait, 60000);
  }
  entities(now: number) {
    return this.records.map(entity => ({ ...entity, provenance: entity.provenance === 'MODELED' ? 'MODELED' as const : this.health === 'offline' || now - entity.ts > 60000 ? 'DELAYED' as const : entity.provenance }));
  }
  status(now: number): FeedStatus {
    const entities = this.entities(now);
    const delayed = this.health === 'offline' || !entities.length || entities.some(entity => entity.provenance === 'DELAYED');
    return { id: this.source, layer: 'air', name: this.source, health: this.health, count: entities.length, updatedAt: this.updatedAt || now, provenance: delayed ? 'DELAYED' : entities.every(entity => entity.provenance === 'MODELED') ? 'MODELED' : 'LIVE', message: this.message };
  }
  pollIntervalMs() { return Math.max(this.interval, this.primary.minIntervalMs); }
  dispose() { this.primary.dispose?.(); this.fallback?.dispose?.(); }
}
