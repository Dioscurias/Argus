export function Badge({ value = 'MODELED' }: { value?: 'LIVE' | 'DELAYED' | 'MODELED' | 'REFERENCE' }) {
  const descriptions = { MODELED: 'Synthetic or computed data. Not live observations.', REFERENCE: 'Static geographic reference data.', LIVE: 'Recent provider observations.', DELAYED: 'Old or retained provider observations.' };
  return <span className={`provenance provenance-${value.toLowerCase()}`} title={descriptions[value]}>{value === 'REFERENCE' ? 'REF' : value}</span>;
}
