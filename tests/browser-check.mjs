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
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !message.text().includes('WebSocket')) errors.push(message.text()); });
page.on('request', request => { if (!request.url().startsWith(base) && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) externalRequests.push(request.url()); });

let blockSockets = false;
const sockets = [];
await page.routeWebSocket('**/ws', route => {
  if (blockSockets) { route.close(); return; }
  const server = route.connectToServer();
  sockets.push({ route, server });
});

try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-map-ready="true"]', { timeout: 30000 });
  await page.getByText('Receiving every 2s', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-layer]').count(), 9);
  assert.ok((await page.locator('.rendered-count').innerText()).replace(/\s+/g, ' ').includes('0 RENDERED'));
  assert.ok((await page.locator('.rendered-count').innerText()).includes('1,240'));
  assert.equal(await page.getByRole('textbox', { name: 'Global search available in Phase 4' }).isDisabled(), true);
  await page.screenshot({ path: 'artifacts/argus-desktop.png', fullPage: true });
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
  assert.equal(await page.getByRole('button', { name: 'Show Sea traffic', exact: true }).getAttribute('aria-pressed'), 'false');
  assert.equal(await page.getByRole('button', { name: 'Hide Basemap', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Solo Air traffic', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Hide Sea traffic', exact: true }).getAttribute('aria-pressed'), 'true');

  const handle = page.getByRole('button', { name: 'Reorder Air traffic; use up and down arrows', exact: true });
  await handle.focus();
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.locator('[data-layer]').nth(3).getAttribute('data-layer'), 'air');
  await handle.dragTo(page.locator('[data-layer="graticule"]'));
  assert.equal(await page.locator('[data-layer]').nth(1).getAttribute('data-layer'), 'air');
  await page.getByRole('button', { name: 'Reset layers', exact: true }).click();

  await page.getByRole('button', { name: 'Show Day / Night', exact: true }).click();
  await page.waitForTimeout(250);
  const nightMap = await page.locator('canvas.maplibregl-canvas').screenshot();
  assert.notDeepEqual(nightMap, originalMap, 'Night mask must change map pixels');
  await page.getByRole('button', { name: 'Hide Day / Night', exact: true }).click();

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

  sockets.at(-1).route.send(JSON.stringify({ type: 'snapshot', version: 1, mode: 'mock', feeds: [{ provenance: 'MODELED' }] }));
  await page.getByText('Updates delayed · retaining buffer', { exact: true }).waitFor();
  assert.ok((await page.locator('.rendered-count').innerText()).includes('1,240'), 'Malformed frames must preserve the last valid buffer');
  await page.getByText('Receiving every 2s', { exact: true }).waitFor();

  blockSockets = true;
  for (const socket of sockets) { socket.route.close(); socket.server.close(); }
  await page.getByText('Disconnected · reconnecting', { exact: true }).waitFor();
  assert.ok((await page.locator('.rendered-count').innerText()).includes('1,240'), 'Retain buffered entities after disconnect');
  assert.equal(await page.locator('[data-map-ready]').getAttribute('data-map-ready'), 'true');
  blockSockets = false;
  await page.getByRole('button', { name: 'Retry feed connection', exact: true }).click();
  await page.getByText('Receiving every 2s', { exact: true }).waitFor();

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
  console.log('PASS: desktop/mobile shell, local assets, WebGL map, visibility, opacity, solo, keyboard/drag reorder, night mask, globe/2D, zoom, coordinates, disconnect/reconnect.');
  console.log('Screenshots: artifacts/argus-{desktop,globe,mobile}.png');
} finally {
  await browser.close();
}
