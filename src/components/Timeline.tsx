import { Icon } from './Icon';

export function Timeline() {
  return <div className="timeline-shell" aria-label="Timeline replay available in Phase 4"><div className="timeline-label"><Icon name="clock" size={14}/><span>HISTORY</span><span className="phase-label">PHASE 4</span></div><div className="timeline-track" aria-hidden="true"><div className="timeline-ticks"/>{['−60m', '−45m', '−30m', '−15m', 'NOW'].map(label => <span key={label} className="mono">{label}</span>)}</div><div className="timeline-mode"><span className="health-dot pending"/> REPLAY UNAVAILABLE</div></div>;
}
