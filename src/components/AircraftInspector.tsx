import { useEffect, useState } from 'react';
import { Button } from '@blueprintjs/core';
import type { useAircraftSelection } from '../hooks/useAircraftSelection';
import { formatCount, utcTime } from '../hooks/useClock';
import { Badge } from './Badge';

export function AircraftInspector({ selection, onClear }: { selection: ReturnType<typeof useAircraftSelection>; onClear: () => void }) {
  const { selected, details, loading, error, track, retry } = selection;
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => setPhotoFailed(false), [selected?.id, details?.photo?.url]);
  if (!selected) return null;
  const measurement = (key: string, value: string) => Array.isArray(selected.meta.missingFields) && selected.meta.missingFields.includes(key) ? 'Unavailable' : value;
  return <section className="aircraft-inspector" aria-label="Selected aircraft">
    <div className="selected-title"><h2 className="mono">{selected.label}</h2><Badge value={selected.provenance}/></div>
    <p className="aircraft-model">{details?.aircraft ?? selected.subtype}</p>
    <Button small onClick={onClear}>Show all aircraft</Button>
    <div className="aircraft-photo" aria-live="polite">
      {details?.photo && !photoFailed ? <><a href={details.photo.url} target="_blank" rel="noreferrer"><img src={details.photo.url} alt={`${details.registration ?? selected.label} aircraft`} onError={() => setPhotoFailed(true)}/></a><a className="photo-credit" href={details.photo.source} target="_blank" rel="noreferrer">{details.photo.credit}</a></> : <p>{loading ? 'Loading aircraft photo…' : error || details?.metadataStatus === 'error' || photoFailed ? 'Aircraft photo temporarily unavailable.' : 'No photo available for this aircraft.'}</p>}
    </div>
    <dl className="aircraft-measurements">
      <div><dt>REGISTRATION</dt><dd>{details?.registration ?? 'Unavailable'}</dd></div>
      <div><dt>OPERATOR / OWNER</dt><dd>{details?.operator ?? 'Unavailable'}</dd></div>
      <div><dt>ALTITUDE</dt><dd>{measurement('altitude', `${formatCount(Math.round(selected.altitude))} ft`)}</dd></div>
      <div><dt>GROUND SPEED</dt><dd>{measurement('speed', `${Math.round(selected.speed)} kt`)}</dd></div>
      <div><dt>OBSERVED AT</dt><dd>{measurement('timestamp', `${utcTime(selected.ts)}Z`)}</dd></div>
    </dl>
    <div className="flight-path-details" aria-live="polite">
      <h3><span className="route-key"/> REFERENCE ROUTE</h3>
      {details?.route ? <><p className="route-codes mono">{details.route.airports.map(airport => airport.code).join(' → ')}</p>{details.route.airports.map((airport, index) => <p key={`${airport.code}-${index}`}><strong>{airport.code}</strong> · {airport.name}</p>)}<p className="muted">Callsign database · dashed great-circle reference. Actual flight may differ.</p>{details.route.updatedAt && <p className="muted">Route record: {details.route.updatedAt.slice(0, 10)}</p>}</> : <p>{loading ? 'Looking up the callsign route…' : error || details?.routeStatus === 'error' ? 'Route lookup temporarily unavailable.' : 'No airport route is available for this callsign.'}</p>}
      <h3><span className="trail-key"/> OBSERVED TRAIL</h3>
      <p>{track.length >= 2 ? `${track.length} positions collected in this session. Solid line shows observed movement.` : 'Collecting positions. The trail appears after the next position update.'}</p>
      <p className="muted">Up to 2 hours while ARGUS is open. Earlier flight history is not provided by this feed.</p>
      {(error || details?.routeStatus === 'error' || details?.metadataStatus === 'error') && <Button small minimal onClick={retry}>Retry aircraft details</Button>}
      <a href="https://hexdb.io" target="_blank" rel="noreferrer">Aircraft and route data · hexdb.io</a>
    </div>
  </section>;
}
