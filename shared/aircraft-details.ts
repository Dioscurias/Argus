export interface RouteAirport { code: string; name: string; lat: number; lon: number }
export interface AircraftDetails {
  hex: string;
  registration: string | null;
  aircraft: string | null;
  operator: string | null;
  photo: { url: string; source: string; credit: string } | null;
  route: { airports: RouteAirport[]; updatedAt: string | null } | null;
  metadataStatus: 'available' | 'unavailable' | 'error';
  routeStatus: 'available' | 'unavailable' | 'error';
}
