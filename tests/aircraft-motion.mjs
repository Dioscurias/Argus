import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, executablePath: existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined });
const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const now = Date.now();
const entity = { id: 'adsblol-abc123', layer: 'air', lat: 39, lon: -98, heading: 90, speed: 900, altitude: 34000, label: 'MOTION1', subtype: 'A320', origin: 'Unknown', destination: 'Unknown', source: 'adsblol', ts: now, provenance: 'LIVE', meta: { missingFields: [] } };
await page.route('**/api/snapshot?*', route => route.fulfill({ json: { type: 'snapshot', version: 1, mode: 'mixed', sequence: 1, generatedAt: now, intervalMs: 60000, counts: { air: 1, sea: 0, truck: 0 }, entities: [entity], feeds: ['air', 'sea', 'truck'].map(layer => ({ id: layer === 'air' ? 'adsblol' : `unavailable-${layer}`, layer, name: layer, health: 'healthy', provenance: 'LIVE', count: layer === 'air' ? 1 : 0, updatedAt: now, message: 'Observed air traffic from adsblol.' })) } }));
async function aircraftPixelCenter() {
  const png = (await page.locator('canvas.maplibregl-canvas').screenshot()).toString('base64');
  return page.evaluate(async data => {
    const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let total = 0, xSum = 0;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      if (pixels[i] < 105 && pixels[i + 1] > 115 && pixels[i + 1] < 175 && pixels[i + 2] > 210) { xSum += x; total++; }
    }
    return { x: xSum / total, total };
  }, png);
}
try {
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-map-ready="true"]');
  for (let i = 0; i < 5; i++) { await page.getByRole('button', { name: 'Zoom in', exact: true }).click(); await page.waitForTimeout(350); }
  await page.waitForTimeout(700);
  const before = await aircraftPixelCenter();
  await page.waitForTimeout(2500);
  const after = await aircraftPixelCenter();
  assert.ok(before.total > 5 && after.total > 5, 'Aircraft is actually drawn');
  assert.ok(after.x > before.x + 2, `Aircraft must move east without new data: ${before.x} → ${after.x}`);
  assert.doesNotMatch(await page.locator('body').innerText(), /adsb\.lol|adsblol|opensky|hexdb|ourairports|natural earth/i);
  assert.deepEqual(errors, []);
  console.log(`PASS: frozen report moves ${Math.round((after.x - before.x) * 10) / 10}px east; provider names absent.`);
} finally { await browser.close(); }
