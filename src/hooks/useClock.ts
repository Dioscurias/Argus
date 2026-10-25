import { useEffect, useState } from 'react';

export function useClock(interval = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), interval); return () => clearInterval(timer); }, [interval]);
  return now;
}
export const utcTime = (timestamp: number) => new Date(timestamp).toISOString().slice(11, 19);
export const formatCount = (value: number) => new Intl.NumberFormat('en-US').format(value);
