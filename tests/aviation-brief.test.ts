import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAviationBrief, parseFaaNews, parseNationalAdvisories } from '../server/aviation-brief.js';
import { advisoryStatus } from '../shared/aviation-brief.js';

const issue = '<tr><td><a href="/adv/adv_otherdis?adv_date=11132026&advn=111">111</a></td><td>DCC</td><td>11/13/26</td><td>NATIONAL GROUND STOP</td><td>11/13/26 20:54</td></tr>';
const lifted = '<tr><td><a href="/adv/adv_otherdis?adv_date=11142026&advn=5">005</a></td><td>DCC</td><td>11/14/26</td><td>CNX NATIONWIDE GROUND STOP</td><td>11/14/26 01:19</td></tr>';
const index = (rows: string) => 'ATCSCC ADVISORIES FOR <table>' + rows + '</table>';
const rss = '<rss><channel><item><title>FAA update &amp; safety bulletin</title><link>https://www.faa.gov/newsroom/update</link><pubDate>November 13, 2026</pubDate></item></channel></rss>';

test('the advisory feed distinguishes a national ground stop from forecasts and airport advisories', () => {
  assert.equal(parseNationalAdvisories(index(issue + issue.replace('NATIONAL', 'LGA') + issue.replace('NATIONAL', 'PROPOSED NATIONAL'))).length, 1);
  assert.equal(parseFaaNews(rss)[0].title, 'FAA update & safety bulletin');
  assert.throws(() => parseFaaNews('<html>Service unavailable</html>'));
});

test('a nationwide stop is active during the FAA window and its next-day cancellation supersedes it', async () => {
  let fail = false;
  const brief = createAviationBrief(async input => {
    if (fail) return new Response('', { status: 503 });
    const url = String(input);
    if (url.includes('/rss')) return new Response(rss);
    if (url.includes('date=2026-11-14')) return new Response(index(lifted));
    if (url.includes('date=2026-11-13')) return new Response(index(issue));
    if (url.includes('advn=111')) return new Response('EFFECTIVE TIME: 132054-140430');
    return new Response(index(''));
  });
  const first = Date.parse('2026-11-13T21:00:00Z');
  const active = await brief(first);
  assert.ok(active.advisory);
  assert.equal(advisoryStatus(active.advisory, active.advisoryCheckedAt, first), 'active');
  fail = true;
  const stale = await brief(first + 240_000);
  assert.ok(stale.advisory);
  assert.equal(advisoryStatus(stale.advisory, stale.advisoryCheckedAt, first + 240_000), 'unverified');
  fail = false;
  const next = await brief(Date.parse('2026-11-14T01:20:00Z'));
  assert.equal(next.advisory?.status, 'lifted');
  assert.equal(next.headlines.length, 1);
});
