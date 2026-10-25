import type { CSSProperties } from 'react';

const paths: Record<string, React.ReactNode> = {
  map: <><path d="m3 5 5-2 8 2 5-2v16l-5 2-8-2-5 2Z"/><path d="M8 3v16M16 5v16"/></>,
  grid: <><rect x="3" y="3" width="18" height="18"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></>,
  moon: <path d="M20.5 14A8.8 8.8 0 0 1 10 3.5 8.8 8.8 0 1 0 20.5 14Z"/>,
  pin: <><path d="M18 9c0 5-6 12-6 12S6 14 6 9a6 6 0 0 1 12 0Z"/><circle cx="12" cy="9" r="2"/></>,
  air: <path d="m21 3-6 18-3-8-8-3 17-7ZM12 13l9-10"/>,
  anchor: <><circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 10h8M4 14c0 9 16 9 16 0M2 16l2-2 2 2M18 16l2-2 2 2"/></>,
  sea: <><path d="M4 12 12 9l8 3-2 6M6 18l-2-6M8 10V5h8v5M10 5V3h4v2M12 10v8M2 20c3-3 5 3 8 0s5 3 8 0 4 0 4 0"/></>,
  route: <><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h9"/></>,
  truck: <><path d="M3 5h11v12H3ZM14 9h4l3 4v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></>,
  layers: <><path d="m12 3 10 5-10 5L2 8ZM2 12l10 5 10-5M2 16l10 5 10-5"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>,
  crosshair: <><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  minus: <path d="M5 12h14"/>,
  reset: <><path d="M3 10a9 9 0 1 1 1 7M3 4v6h6"/></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff: <><path d="m3 3 18 18M9 5.5A10 10 0 0 1 12 5c6 0 10 7 10 7a19 19 0 0 1-4 4M6 6C3 8 2 12 2 12s4 7 10 7c2 0 3-.5 4-1M10 10a3 3 0 0 0 4 4"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
  activity: <path d="M2 12h5l3-8 4 16 3-8h5"/>,
  box: <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/>,
  cursor: <path d="m5 3 14 10-7 1-3 7L5 3Z"/>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4V3Z"/>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  pause: <><path d="M8 5v14M16 5v14"/></>,
};

export function Icon({ name, size = 16, style, className = '' }: { name: string; size?: number; style?: CSSProperties; className?: string }) {
  return <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" style={style}>{paths[name] ?? paths.box}</svg>;
}
