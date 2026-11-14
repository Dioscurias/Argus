import { useEffect, useState } from 'react';
import { BRIEF_REFRESH_MS, type AviationBrief } from '../../shared/aviation-brief';

export function useAviationBrief() {
  const [brief, setBrief] = useState<AviationBrief | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let request: AbortController | undefined;
    async function refresh() {
      if (request) return;
      const controller = new AbortController();
      request = controller;
      try {
        const response = await fetch('/api/aviation-brief', { signal: controller.signal });
        if (!response.ok) throw new Error('Aviation brief unavailable');
        const data: AviationBrief = await response.json();
        if (!controller.signal.aborted) { setBrief(data); setFailed(false); }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        request = undefined;
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, BRIEF_REFRESH_MS);
    return () => { window.clearInterval(timer); request?.abort(); };
  }, []);
  return { brief, failed };
}
