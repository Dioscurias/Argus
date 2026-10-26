import type { Entity } from '../../shared/schema';
export interface AirFilters { altitude: 'all' | 'low' | 'mid' | 'high'; airline: string; aircraft: string }
export const defaultAirFilters: AirFilters = { altitude: 'all', airline: 'all', aircraft: 'all' };
export function filterAircraft(entities: Entity[], filters: AirFilters) {
  return entities.filter(entity => entity.layer === 'air'
    && (filters.airline === 'all' || entity.meta.airline === filters.airline)
    && (filters.aircraft === 'all' || entity.subtype === filters.aircraft)
    && (filters.altitude === 'all' || (!Array.isArray(entity.meta.missingFields) || !entity.meta.missingFields.includes('altitude'))
      && (filters.altitude === 'low' ? entity.altitude < 10000 : filters.altitude === 'mid' ? entity.altitude >= 10000 && entity.altitude < 30000 : entity.altitude >= 30000)));
}
