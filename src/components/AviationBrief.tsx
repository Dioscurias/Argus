import { useRef } from 'react';
import { ADVISORY_STALE_MS, advisoryStatus } from '../../shared/aviation-brief';
import { useAviationBrief } from '../hooks/useAviationBrief';

const advisorySource = 'https://www.fly.faa.gov/adv/advAdvisoryForm';
const newsSource = 'https://www.faa.gov/newsroom/press_releases';
const day = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });

export function AviationBrief({ now }: { now: number }) {
  const { brief, failed } = useAviationBrief();
  const dialog = useRef<HTMLDialogElement>(null);
  const advisory = brief?.advisory;
  const status = advisory ? advisoryStatus(advisory, brief.advisoryCheckedAt, now) : null;
  const checkedAt = brief?.advisoryCheckedAt;
  const stale = checkedAt == null || now - checkedAt >= ADVISORY_STALE_MS;

  return <div className="aviation-brief">
    {status === 'active' && <a className="aviation-alert" href={advisory?.url} target="_blank" rel="noreferrer"><strong>FAA nationwide ground stop</strong><span>View advisory ↗</span></a>}
    {status === 'unverified' && <a className="aviation-alert uncertain" href={advisory?.url} target="_blank" rel="noreferrer"><strong>Nationwide ground stop status unverified</strong><span>View FAA advisory ↗</span></a>}
    <button type="button" className="aviation-news-button" onClick={() => dialog.current?.showModal()}>News</button>
    <dialog ref={dialog} className="aviation-news" aria-labelledby="aviation-news-title">
      <header><h2 id="aviation-news-title">Aviation news</h2><form method="dialog"><button type="submit">Close</button></form></header>
      <section aria-label="FAA nationwide ground stops">
        <h3>FAA nationwide ground stops</h3>
        {advisory && <article>
          <strong>{status === 'active' ? 'Ground stop in effect' : status === 'lifted' ? 'Ground stop lifted' : status === 'past' ? 'Advisory window ended' : 'Current status unverified'}</strong>
          <a href={advisory.url} target="_blank" rel="noreferrer">{advisory.title}</a>
          <small>{day.format(advisory.publishedAt)} · {time.format(advisory.publishedAt)} UTC · FAA ATCSCC</small>
        </article>}
        <p>{stale ? brief || failed ? 'Current advisory checks are unavailable.' : 'Checking FAA advisories…' : advisory ? `Checked at ${time.format(checkedAt)} UTC` : 'No nationwide ground-stop advisory found in the last two UTC dates.'}</p>
        <a href={advisorySource} target="_blank" rel="noreferrer">FAA advisory database ↗</a>
      </section>
      <section aria-label="FAA headlines">
        <h3>FAA headlines</h3>
        {(!brief?.newsCheckedAt || now - brief.newsCheckedAt > 10 * 60_000) && <p>{brief || failed ? 'Headline updates are unavailable.' : 'Loading FAA headlines…'}</p>}
        {brief?.headlines.map(item => <article key={item.url}>
          <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
          <small>{item.publishedAt !== null && `${day.format(item.publishedAt)} · `}FAA Newsroom</small>
        </article>)}
        <a href={newsSource} target="_blank" rel="noreferrer">FAA Newsroom ↗</a>
      </section>
    </dialog>
  </div>;
}
