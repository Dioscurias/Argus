export function Badge({ value = 'MODELED' }: { value?: 'LIVE' | 'DELAYED' | 'MODELED' | 'REFERENCE' | 'COMPUTED' }) {
  const descriptions = { MODELED: 'Synthetic data. Not live observations.', COMPUTED: 'Calculated locally from time and geometry.', REFERENCE: 'Static geographic reference data.', LIVE: 'Recent position report. Movement between reports is estimated.', DELAYED: 'Older position report. Movement is estimated for up to 5 minutes.' };
  return <span className={`provenance provenance-${value.toLowerCase()}`} title={descriptions[value]}>{value === 'REFERENCE' ? 'REF' : value}</span>;
}
