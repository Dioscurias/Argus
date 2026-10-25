export function Badge({ value = 'MODELED' }: { value?: 'MODELED' | 'REFERENCE' }) {
  return <span className={`provenance provenance-${value.toLowerCase()}`} title={value === 'MODELED' ? 'Synthetic or computed data. Not live observations.' : 'Static geographic reference data.'}>{value === 'REFERENCE' ? 'REF' : value}</span>;
}
