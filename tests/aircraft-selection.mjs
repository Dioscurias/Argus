import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const browser = await chromium.launch({ headless: true, executablePath: existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined });
const page = await browser.newPage({ viewport: { width: 1512, height: 982 }, reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = process.env.TEST_URL || 'http://127.0.0.1:5173';
const live = process.env.TEST_LIVE_DATA === 'true';
let liveEntities = [];
if (live) page.on('response', async response => {
  if (response.url().includes('/api/snapshot?') && response.ok()) liveEntities = (await response.json()).entities;
});
if (!live) {
  let sequence = 0;
  await page.route('**/api/snapshot?*', route => {
    const now = Date.now();
    sequence++;
    const entities = [{ id: 'adsblol-406b21', layer: 'air', lat: 39, lon: -98, heading: 90, speed: 430, altitude: 34000, label: 'BAW3G', subtype: 'A388', origin: 'Unknown', destination: 'Unknown', source: 'adsblol', ts: now, provenance: 'LIVE', meta: { missingFields: [] } }, { id: 'adsblol-4010ee', layer: 'air', lat: 35, lon: -90, heading: 45, speed: 400, altitude: 30000, label: 'EZY123', subtype: 'A319', origin: 'Unknown', destination: 'Unknown', source: 'adsblol', ts: now, provenance: 'LIVE', meta: { missingFields: [] } }];
    if (sequence > 2) entities[0].lon += (sequence - 2) * 0.4;
    return route.fulfill({ json: { type: 'snapshot', version: 1, mode: 'mixed', sequence, generatedAt: now, intervalMs: 1000, counts: { air: 2, sea: 0, truck: 0 }, entities, feeds: ['air','sea','truck'].map(layer => ({ id: layer === 'air' ? 'adsblol' : `unavailable-${layer}`, layer, name: layer, health: 'healthy', provenance: 'LIVE', count: layer === 'air' ? 2 : 0, updatedAt: now, message: 'Test observations' })) } });
  });
  await page.route('**/api/aircraft/*', route => route.fulfill({ json: {
    hex: '406b21', registration: 'G-XLEH', aircraft: 'Airbus A380 841', operator: 'British Airways', metadataStatus: 'available', routeStatus: 'available',
    photo: { url: '/aircraft.svg', source: 'https://hexdb.io', credit: 'Fixture image' },
    route: { airports: [{ code: 'LHR', name: 'Heathrow Airport', lat: 51.47, lon: -0.46 }, { code: 'MIA', name: 'Miami International Airport', lat: 25.79, lon: -80.29 }], updatedAt: '2025-05-18' },
  } }));
}

// Locate actual aircraft-colored pixels, then verify canvas picking with the tooltip.
async function selectVisiblePlane() {
  const canvas = page.locator('canvas.maplibregl-canvas');
  const box = await canvas.boundingBox();
  const png = (await canvas.screenshot()).toString('base64');
  const candidates = await page.evaluate(async data => {
    const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0); const pixels = ctx.getImageData(0, 0, img.width, img.height).data;
    const points = [], cells = new Set();
    for (let y = 160; y < img.height - 130; y++) for (let x = 55; x < img.width - 55; x++) {
      const i = (y * img.width + x) * 4;
      if (pixels[i + 2] > 210 && pixels[i] < 105 && pixels[i + 1] > 115 && pixels[i + 1] < 175) {
        const key = `${Math.floor(x / 18)},${Math.floor(y / 18)}`;
        if (!cells.has(key)) { cells.add(key); points.push([x, y]); }
      }
    }
    return points.sort((a, b) => Math.hypot(a[0] - img.width * 0.58, a[1] - img.height * 0.4) - Math.hypot(b[0] - img.width * 0.58, b[1] - img.height * 0.4));
  }, png);
  for (const [x, y] of candidates.slice(0, 80)) {
    await page.mouse.move(box.x + x, box.y + y);
    if (await page.locator('.map-tooltip strong.mono').isVisible()) {
      if (live) {
        const callsign = await page.locator('.map-tooltip strong.mono').innerText();
        const entity = liveEntities.find(entity => entity.label === callsign);
        const hex = entity?.id.match(/-([a-f0-9]{6})$/)?.[1];
        if (!hex) continue;
        const response = await page.request.get(`${base}/api/aircraft/${hex}?callsign=${encodeURIComponent(callsign)}`);
        const details = response.ok() ? await response.json() : null;
        if (!details?.photo || !details?.route) continue;
        console.log(`Verifying live ${callsign} / ${details.registration} with ${details.route.airports.map(airport => airport.code).join(' → ')}`);
      }
      await page.mouse.click(box.x + x, box.y + y); return;
    }
  }
  throw new Error(`No pickable plane among ${candidates.length} aircraft pixel candidates`);
}
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-map-ready="true"]');
  await page.waitForFunction(() => Number(document.querySelector('[data-aircraft-count]')?.dataset.aircraftCount) > 0);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'artifacts/argus-selection-before.png', fullPage: true });
  const initialCount = Number(await page.locator('[data-aircraft-count]').getAttribute('data-aircraft-count'));
  await page.getByRole('button', { name: 'Globe projection', exact: true }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'artifacts/argus-selection-globe.png', fullPage: true });
  await selectVisiblePlane();
  await page.getByRole('button', { name: 'Show all aircraft', exact: true }).first().waitFor({ timeout: 5000 });
  assert.equal(await page.locator('[data-aircraft-count]').getAttribute('data-aircraft-count'), '1');
  await page.waitForFunction(() => { const img = document.querySelector('.aircraft-photo img'); return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0; }, undefined, { timeout: 15000 });
  await page.locator('.route-codes').waitFor({ timeout: 15000 });
  if (!live) await page.getByText(/\d+ positions collected in this session/).waitFor();
  await page.getByRole('button', { name: '2D projection', exact: true }).click();
  await page.getByRole('button', { name: 'Fit flight path', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'artifacts/argus-selection.png', fullPage: true });
  const selectedId = await page.locator('[data-selected-aircraft]').getAttribute('data-selected-aircraft');
  await page.getByRole('button', { name: 'Globe projection', exact: true }).click();
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('[data-selected-aircraft]').getAttribute('data-selected-aircraft'), selectedId);
  await page.screenshot({ path: 'artifacts/argus-selected-globe.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  assert.equal(await page.getByRole('region', { name: 'Selected aircraft' }).isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'artifacts/argus-selected-mobile.png', fullPage: true });
  await page.keyboard.press('Escape');
  assert.ok(Number(await page.locator('[data-aircraft-count]').getAttribute('data-aircraft-count')) >= (live ? 2 : initialCount));
  assert.equal(await page.locator('[data-selected-aircraft]').getAttribute('data-selected-aircraft'), '');
  assert.deepEqual(errors, []);
  console.log(`PASS (${live ? 'LIVE' : 'fixtures'}): globe canvas picking, isolation, photo loaded, reference route, projection switching, mobile details, Escape restores traffic.`);
} catch (error) { console.error(errors); await page.screenshot({ path: 'artifacts/argus-selection-failure.png', fullPage: true }); throw error; }
finally { await browser.close(); }
