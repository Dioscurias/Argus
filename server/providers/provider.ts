import type { Entity, Provenance, TransportLayer } from '../../shared/schema.js';

/** Future live providers normalize upstream data before crossing this boundary. */
export interface EntityProvider {
  readonly id: string;
  readonly provenance: Provenance;
  readonly layers: readonly TransportLayer[];
  poll(now: number, signal?: AbortSignal): Entity[] | Promise<Entity[]>;
  dispose?(): void | Promise<void>;
}

/** Telematics, HERE, or TomTom can implement this in a later phase. */
export interface TruckProvider extends EntityProvider {
  readonly layers: readonly ['truck'];
}
