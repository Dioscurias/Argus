import { BRIEF_REFRESH_MS, type Advisory, type AviationBrief, type AviationHeadline } from '../shared/aviation-brief.js';

const advisoryOrigin = 'https://www.fly.faa.gov';
const newsUrl = 'https://www.faa.gov/newsroom/press_releases/rss';
const dayMs = 86_400_000;

function plain(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#x[\da-f]+|#\d+);/gi, (entity, code: string) => {
      const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
      if (code in named) return named[code];
      const number = code.startsWith('#x') ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
    }).replace(/\s+/g, ' ').trim();
}

function publicFaaUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname === 'www.faa.gov' && url.pathname.startsWith('/newsroom/')) return url.href;
  } catch { /* skip malformed links */ }
  return null;
}

export function parseFaaNews(xml: string): AviationHeadline[] {
  if (!/<rss[\s>]/i.test(xml)) throw new Error('Unexpected FAA news format');
  const byUrl = new Map<string, AviationHeadline>();
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const field = (name: string) => plain(item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i'))?.[1] ?? '');
    const url = publicFaaUrl(field('link'));
    const title = field('title');
    const date = field('pubDate');
    const timestamp = date ? Date.parse(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(date) ? date + ' UTC' : date) : NaN;
    if (url && title && !byUrl.has(url)) byUrl.set(url, { url, title, publishedAt: Number.isFinite(timestamp) ? timestamp : null });
    if (byUrl.size >= 18) break;
  }
  if (!byUrl.size) throw new Error('FAA news contained no usable headlines');
  return [...byUrl.values()];
}

export function parseNationalAdvisories(html: string): Advisory[] {
  if (!/ATCSCC ADVISORIES FOR|NO ADVISOR(?:Y|IES) AVAILABLE|NO ADVISORIES FOUND|NO ADVISORIES MATCH/i.test(plain(html))) throw new Error('Unexpected FAA advisory index');
  const items: Advisory[] = [];
  for (const [, row] of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = Array.from(row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi), match => plain(match[1]));
    const title = cells[3];
    const link = row.match(/href="(\/adv\/adv_otherdis\?adv_date=\d{8}&(?:amp;)?advn=\d+)"/i)?.[1];
    const time = cells[4]?.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4}) (\d{2}):(\d{2})$/);
    if (!title || !link || !time || !/\bNATION(?:AL|WIDE)\s+GROUND\s*STOP\b/i.test(title)) continue;
    if (/\b(PROPOSED|POSSIBLE|PLANNED|EXPECTED)\b/i.test(title)) continue;
    const [, month, day, year, hour, minute] = time;
    const status = /\b(CNX|CANCEL\w*|LIFT\w*|RESCIND\w*)\b/i.test(title) ? 'lifted' : 'issued';
    items.push({
      title, status, expiresAt: null, url: new URL(plain(link), advisoryOrigin).href,
      publishedAt: Date.UTC(Number(year) + (year.length === 2 ? 2000 : 0), Number(month) - 1, Number(day), Number(hour), Number(minute)),
    });
  }
  return items;
}

export function advisoryExpiry(html: string, publishedAt: number): number | null {
  const match = plain(html).match(/EFFECTIVE TIME:\s*\d{6}\s*-\s*(\d{2})(\d{2})(\d{2})/i);
  if (!match) return null;
  const [, day, hour, minute] = match;
  if (+day < 1 || +day > 31 || +hour > 23 || +minute > 59) return null;
  const issued = new Date(publishedAt);
  for (const month of [issued.getUTCMonth(), issued.getUTCMonth() + 1]) {
    const end = Date.UTC(issued.getUTCFullYear(), month, +day, +hour, +minute);
    if (end >= publishedAt && end - publishedAt <= dayMs) return end;
  }
  return null;
}

function createCachedSource<T>(load: (now: number) => Promise<T>, refreshMs = BRIEF_REFRESH_MS) {
  type Result = { data: T; checkedAt: number } | null;
  let last: Result = null;
  let next = 0;
  let pending: Promise<Result> | null = null;
  return (now: number) => {
    if (pending) return pending;
    if (now < next) return Promise.resolve(last);
    next = now + refreshMs;
    pending = load(now).then(data => last = { data, checkedAt: now }).catch(() => last).finally(() => { pending = null; });
    return pending;
  };
}

export function createAviationBrief(fetcher: typeof fetch = fetch) {
  async function read(url: string) {
    const response = await fetcher(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`FAA feed returned ${response.status}`);
    return response.text();
  }
  const getNews = createCachedSource(async () => parseFaaNews(await read(newsUrl)), 5 * BRIEF_REFRESH_MS);
  const getAdvisory = createCachedSource(async now => {
    const entries = await Promise.all([now, now - dayMs].map(async day => {
      const date = new Date(day).toISOString().slice(0, 10);
      const query = new URLSearchParams({ _other: 'on', advisoryCategory: 'All', date, other: 'true', whichAdvisories: 'ATCSCC' });
      return parseNationalAdvisories(await read(`${advisoryOrigin}/adv/adv_list?${query}`));
    }));
    const latest = entries.flat().filter(item => item.publishedAt <= now).sort((a, b) => b.publishedAt - a.publishedAt)[0];
    if (!latest || latest.status === 'lifted') return latest ?? null;
    return { ...latest, expiresAt: advisoryExpiry(await read(latest.url), latest.publishedAt) };
  });
  return async (now = Date.now()): Promise<AviationBrief> => {
    const [advisory, news] = await Promise.all([getAdvisory(now), getNews(now)]);
    return {
      advisory: advisory?.data ?? null, advisoryCheckedAt: advisory?.checkedAt ?? null,
      headlines: news?.data ?? [], newsCheckedAt: news?.checkedAt ?? null,
    };
  };
}
