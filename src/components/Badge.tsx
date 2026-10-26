export function Badge({ value = 'MODELED' }: { value?: 'LIVE' | 'DELAYED' | 'MODELED' | 'REFERENCE' | 'COMPUTED' }) {
  const descriptions = { MODELED: 'Synthetic data. Not live observations.', COMPUTED: 'Calculated locally from time and geometry.', REFERENCE: 'Static geographic reference data.', LIVE: 'Recent provider observations.', DELAYED: 'Old or retained provider observations.' };
  return <span className={`provenance provenance-${value.toLowerCase()}`} title={descriptions[value]}>{value === 'REFERENCE' ? 'REF' : value}</span>;
}
