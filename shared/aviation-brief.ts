export interface Advisory {
  title: string;
  url: string;
  publishedAt: number;
  status: 'issued' | 'lifted';
  expiresAt: number | null;
}

export interface AviationHeadline {
  title: string;
  url: string;
  publishedAt: number | null;
}

export interface AviationBrief {
  advisory: Advisory | null;
  advisoryCheckedAt: number | null;
  headlines: AviationHeadline[];
  newsCheckedAt: number | null;
}

export const BRIEF_REFRESH_MS = 60_000;
export const ADVISORY_STALE_MS = 3 * BRIEF_REFRESH_MS;

export function advisoryStatus(advisory: Advisory, checkedAt: number | null, now: number) {
  if (advisory.status === 'lifted') return 'lifted';
  if (advisory.expiresAt !== null && advisory.expiresAt <= now) return 'past';
  if (checkedAt === null || now - checkedAt >= ADVISORY_STALE_MS || advisory.expiresAt === null) return 'unverified';
  return 'active';
}
