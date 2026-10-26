import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.TEST_URL || 'http://127.0.0.1:5173';
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.CHROME_PATH || (existsSync(localChrome) ? localChrome : undefined);
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
const externalRequests = [];
const requestedRegions = [];
const liveData = process.env.TEST_LIVE_DATA === 'true';
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !message.text().includes('WebSocket')) errors.push(message.text()); });
page.on('request', request => {
  if (request.url().includes('/api/snapshot?')) { const url = new URL(request.url()); requestedRegions.push([Number(url.searchParams.get('lat')), Number(url.searchParams.get('lon'))]); }
  if (!request.url().startsWith(base) && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) externalRequests.push(request.url());
});

if (!liveData) await page.route('**/api/snapshot?*', async route => {
  const url = new URL(route.request().url());
  requestedRegions.push([Number(url.searchParams.get('lat')), Number(url.searchParams.get('lon'))]);
  const now = Date.now();
  const entities = [
    { id: 'adsblol-a1', layer: 'air', lat: 39.5, lon: -97.5, heading: 90, speed: 430, altitude: 34000, label: 'LIVE1', subtype: 'A320', origin: 'Unknown', destination: 'Unknown', source: 'adsblol', ts: now - 1000, provenance: 'LIVE', meta: { airline: 'Unknown', missingFields: [] } },
    { id: 'adsblol-a2', layer: 'air', lat: 38.5, lon: -98.5, heading: 180, speed: 390, altitude: 8000, label: 'LIVE2', subtype: 'B738', origin: 'Unknown', destination: 'Unknown', source: 'adsblol', ts: now - 2000, provenance: 'LIVE', meta: { airline: 'Unknown', missingFields: [] } },
  ];
  await route.fulfill({ json: { type: 'snapshot', version: 1, mode: 'mixed', sequence: requestedRegions.length, generatedAt: now, intervalMs: 60000, counts: { air: 2, sea: 0, truck: 0 }, entities, feeds: [
    { id: 'adsblol', layer: 'air', name: 'adsblol', health: 'healthy', provenance: 'LIVE', count: 2, updatedAt: now, message: 'Observed air traffic from adsblol.' },
    { id: 'unavailable-sea', layer: 'sea', name: 'sea unavailable', health: 'offline', provenance: 'DELAYED', count: 0, updatedAt: now, message: 'No observed provider is connected.' },
    { id: 'unavailable-truck', layer: 'truck', name: 'truck unavailable', health: 'offline', provenance: 'DELAYED', count: 0, updatedAt: now, message: 'No observed provider is connected.' },
  ] } });
});

try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-map-ready="true"]', { timeout: 30000 });
  await page.getByText(/(Live region|Global feed) · refreshes every \d+s/, { exact: true }).waitFor();
  if (liveData) await page.waitForFunction(() => Number(document.querySelector('[data-aircraft-count]')?.getAttribute('data-aircraft-count')) > 0);
  const initialAircraft = Number(await page.locator('[data-aircraft-count]').getAttribute('data-aircraft-count'));
  assert.ok(initialAircraft > 0);
  assert.equal(await page.locator('[data-layer]').count(), 4);
  assert.ok((await page.locator('.rendered-count').innerText()).replace(/\s+/g, ' ').includes(`${initialAircraft.toLocaleString()} AIR DRAWN`));
  assert.equal(await page.getByRole('textbox').count(), 0);
  assert.equal(await page.getByText('REPLAY UNAVAILABLE').count(), 0);
  assert.equal(await page.locator('[data-layer="sea"], [data-layer="truck"], [data-layer="ports"], [data-layer="corridors"]').count(), 0);
  if (liveData) {
    await page.getByText('LIVE GLOBAL COVERAGE', { exact: true }).waitFor();
    assert.match(await page.locator('.status-feeds').innerText(), /OPENSKY|ADSB\.LOL GLOBAL/);
  }
  await page.screenshot({ path: 'artifacts/argus-desktop.png', fullPage: true });
  assert.equal(await page.locator('[data-aircraft-count]').getAttribute('data-aircraft-count'), String(initialAircraft));
  const typeFilter = page.getByRole('combobox', { name: 'Air traffic Aircraft type', exact: true });
  const typeValues = await typeFilter.locator('option').evaluateAll(options => options.map(option => option.value));
  if (typeValues.length > 1) await typeFilter.selectOption(typeValues[1]);
  assert.ok(Number(await page.locator('[data-aircraft-count]').getAttribute('data-aircraft-count')) <= initialAircraft);
  await page.getByRole('combobox', { name: 'Air traffic Altitude band', exact: true }).selectOption('low');
  assert.ok(Number(await page.locator('[data-aircraft-count]').getAttribute('data-aircraft-count')) <= initialAircraft);
  await page.getByRole('button', { name: 'Clear air filters', exact: true }).click();
  assert.equal(await page.locator('[data-aircraft-count]').getAttribute('data-aircraft-count'), String(initialAircraft));
  await page.getByRole('button', { name: 'Hide Air traffic', exact: true }).click();
  assert.equal(await page.locator('[data-aircraft-count]').getAttribute('data-aircraft-count'), '0');
  await page.getByRole('button', { name: 'Show Air traffic', exact: true }).click();
  await page.getByRole('button', { name: 'Hide Airports', exact: true }).click();
  await page.getByRole('button', { name: 'Show Airports', exact: true }).click();
  const originalMap = await page.locator('canvas.maplibregl-canvas').screenshot();

  await page.getByRole('button', { name: 'Hide Graticule', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Show Graticule', exact: true }).getAttribute('aria-pressed'), 'false');
  await page.waitForTimeout(250);
  const noGridMap = await page.locator('canvas.maplibregl-canvas').screenshot();
  assert.notDeepEqual(noGridMap, originalMap, 'Graticule visibility must change map pixels');
  await page.getByRole('button', { name: 'Show Graticule', exact: true }).click();

  await page.getByRole('button', { name: 'Basemap', exact: true }).click();
  const opacity = page.getByRole('slider', { name: 'Basemap opacity', exact: true });
  await opacity.focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(Number(await opacity.getAttribute('aria-valuenow')), 99);
  await page.getByRole('button', { name: 'Reset layers', exact: true }).click();

  await page.getByRole('button', { name: 'Solo Air traffic', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Show Airports', exact: true }).getAttribute('aria-pressed'), 'false');
  assert.equal(await page.getByRole('button', { name: 'Hide Basemap', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Solo Air traffic', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Hide Airports', exact: true }).getAttribute('aria-pressed'), 'true');

  const handle = page.getByRole('button', { name: 'Reorder Air traffic; use up and down arrows', exact: true });
  await handle.focus();
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.locator('[data-layer]').nth(2).getAttribute('data-layer'), 'air');
  await handle.dragTo(page.locator('[data-layer="graticule"]'));
  assert.equal(await page.locator('[data-layer]').nth(1).getAttribute('data-layer'), 'air');
  await page.getByRole('button', { name: 'Reset layers', exact: true }).click();

  await page.getByRole('button', { name: 'Globe projection', exact: true }).click();
  assert.equal(await page.locator('[data-projection]').getAttribute('data-projection'), 'globe');
  await page.waitForTimeout(1000);
  const globeMap = await page.locator('canvas.maplibregl-canvas').screenshot();
  assert.notDeepEqual(globeMap, originalMap, 'Projection must change map pixels');
  await page.screenshot({ path: 'artifacts/argus-globe.png', fullPage: true });
  await page.getByRole('button', { name: '2D projection', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.map-bottom-left').textContent.includes('ZOOM 1.05'));
  await page.getByRole('button', { name: 'Reset map view', exact: true }).click();
  await page.mouse.move(800, 350);
  assert.ok((await page.locator('.cursor-coordinates').innerText()).includes('°'));

  assert.ok(requestedRegions.length >= 1);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/argus-mobile.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await page.getByRole('button', { name: 'Toggle layer panel', exact: true }).click();
  assert.equal(await page.getByRole('complementary', { name: 'Map layers', exact: true }).isVisible(), true);
  await page.getByRole('button', { name: 'Toggle inspector panel', exact: true }).click();
  assert.equal(await page.getByRole('complementary', { name: 'Entity inspector', exact: true }).isVisible(), true);
  assert.equal(await page.getByRole('complementary', { name: 'Map layers', exact: true }).isVisible(), false);
  assert.deepEqual(externalRequests, [], 'Runtime assets must be local');
  assert.deepEqual(errors, [], 'No browser exceptions or unexpected console errors');
  console.log('PASS: observed HTTP feed, functional-only UI, desktop/mobile shell, WebGL map, visibility, opacity, solo, keyboard/drag reorder, globe/2D, zoom, and coordinates.');
  console.log('Screenshots: artifacts/argus-{desktop,globe,mobile}.png');
} catch (error) {
  console.error('Browser errors:', errors);
  await page.screenshot({ path: 'artifacts/argus-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
