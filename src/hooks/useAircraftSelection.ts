import { useEffect, useRef, useState } from 'react';
import type { Entity } from '../../shared/schema';
import type { AircraftDetails } from '../../shared/aircraft-details';
import { recordPositions, type TrackHistory, type TrackPoint } from '../map/flight-path';

export function useAircraftSelection(entities: Entity[]) {
  const [selection, setSelection] = useState<Entity | null>(null);
  const selected = entities.find(entity => entity.id === selection?.id) ?? selection;
  const history = useRef<TrackHistory>(new Map());
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [information, setInformation] = useState<{ key: string; data: AircraftDetails | null; loading: boolean; error: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = selected ? `${selected.id}:${selected.label}` : '';
  useEffect(() => {
    recordPositions(history.current, entities, Date.now());
    setSelection(previous => previous ? entities.find(entity => entity.id === previous.id) ?? previous : null);
    setTrack(selection ? history.current.get(selection.id) ?? [] : []);
  }, [entities, selection?.id]);
  useEffect(() => {
    if (!selected) { setInformation(null); return; }
    const hex = /^(?:adsblol|opensky)-([a-f0-9]{6})$/i.exec(selected.id)?.[1];
    if (!hex) { setInformation({ key, data: null, loading: false, error: false }); return; }
    const controller = new AbortController();
    const callsign = /^[a-z0-9]{2,10}$/i.test(selected.label) ? selected.label : '';
    setInformation({ key, data: null, loading: true, error: false });
    void fetch(`/api/aircraft/${hex}?callsign=${encodeURIComponent(callsign)}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Aircraft information unavailable');
        const data = await response.json() as AircraftDetails;
        if (!controller.signal.aborted) setInformation({ key, data, loading: false, error: false });
      }).catch(() => { if (!controller.signal.aborted) setInformation({ key, data: null, loading: false, error: true }); });
    return () => controller.abort();
  }, [key, attempt]);
  return { selected, select: setSelection, track, details: information?.key === key ? information.data : null, loading: information?.key === key ? information.loading : Boolean(selected), error: information?.key === key && information.error, retry: () => setAttempt(value => value + 1) };
}
