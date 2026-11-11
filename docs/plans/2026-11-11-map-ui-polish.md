# Argus Map UI Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve aircraft visual hierarchy, explain layer and motion-path symbology, and improve map-interface accessibility without changing any existing application behavior.

**Architecture:** Add a presentational `MapLegend` component that receives the existing `LayerStack`, uses configured colors, and lists layers visible under the existing solo/visibility rules. Render it in the map overlay and adjust existing aircraft symbol sizing and CSS only; do not add application state, controls, requests, or data transformations.

**Tech Stack:** React, TypeScript, MapLibre GL, CSS, Playwright browser checks, Node test runner, Vite.

---

### Task 1: Specify the legend behavior in browser tests

**Files:**
- Modify: `tests/browser-check.mjs`

**Step 1: Add failing desktop assertions**

After the map-ready and initial-aircraft checks, add:

```js
const legend = page.getByRole('region', { name: 'Map legend', exact: true });
await legend.waitFor();
assert.equal(
  await legend.locator('[data-legend-layer]').count(),
  await page.locator('[data-layer]:not(.layer-hidden)').count(),
);
assert.match(await legend.innerText(), /Observed trail/);
assert.match(await legend.innerText(), /Estimated motion/);
assert.match(await legend.innerText(), /Route/);
```

After the existing air-layer hide/show assertions, add:

```js
assert.equal(await legend.locator('[data-legend-layer="air"]').count(), 0);
await page.getByRole('button', { name: 'Show Air traffic', exact: true }).click();
assert.equal(await legend.locator('[data-legend-layer="air"]').count(), 1);
```

Place the zero-row assertion immediately after the existing hide click and the one-row assertion immediately after the existing show click; do not add duplicate hide/show interactions.

**Step 2: Run the browser test and verify it fails for the missing legend**

Run the app with `npm run dev` in a separate terminal, then run:

```bash
npm run test:browser
```

Expected: FAIL because the `Map legend` region does not exist yet. Existing test setup requires the local app at `http://127.0.0.1:5173`.

### Task 2: Implement the presentation-only map legend and aircraft hierarchy

**Files:**
- Create: `src/components/MapLegend.tsx`
- Modify: `src/map/MapViewport.tsx`
- Modify: `src/map/aircraft-renderer.ts`
- Test: `tests/browser-check.mjs`

**Step 1: Create a typed, presentational legend**

Implement `MapLegend` with a `stack: LayerStack` prop. Derive layer rows from `stack.layers.filter(layer => isLayerVisible(stack, layer.id))`. Render a `<section aria-label="Map legend">` with:

- One `[data-legend-layer="<layer id>"]` row per visible layer, using the layer’s configured `color` and `name`.
- Three always-present path keys with readable text and stable `data-path-style` values: `observed` / “Observed trail” (solid teal), `estimated` / “Estimated motion” (dotted teal), and `route` / “Route” (dashed amber).
- Text labels alongside color swatches and line styles, so the legend does not rely on color alone.

Import `LayerStack` and `isLayerVisible` from the existing layer modules. Keep this component free of state and event handlers.

**Step 2: Render the legend inside the map viewport**

Import `MapLegend` into `src/map/MapViewport.tsx` and render `<MapLegend stack={stack} />` alongside the existing map overlay elements. Do not change map callbacks, selection behavior, viewport state, or controls.

**Step 3: Make aircraft symbol hierarchy modestly clearer**

In the existing `aircraft` symbol layer’s `icon-size` expression in `src/map/aircraft-renderer.ts`, retain the selected distinction and increase normal aircraft symbols slightly from `0.23` to `0.26`; increase selected symbols slightly from `0.4` to `0.44`. Leave icon images, colors, hit testing, rotation, and geometry unchanged.

**Step 4: Run the browser test**

Run:

```bash
npm run test:browser
```

Expected: PASS for legend presence, configured visible-layer count, path labels, layer hide/show synchronization, and all pre-existing browser checks.

### Task 3: Finish responsive and accessibility styling

**Files:**
- Modify: `src/styles.css`
- Modify: `tests/browser-check.mjs`

**Step 1: Add failing mobile and keyboard-focus checks**

In the browser test’s mobile section, after setting the 390×844 viewport, assert:

```js
assert.equal(await legend.isVisible(), true);
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
```

At desktop, test that a keyboard-focused control receives the visible focus treatment:

```js
await page.keyboard.press('Tab');
assert.equal(await page.evaluate(() => document.activeElement?.matches(':focus-visible')), true);
assert.equal(
  await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth),
  '2px',
);
```

Run `npm run test:browser` and verify the new focus-width check fails before implementing the corresponding styles.

**Step 2: Style the legend and focus states**

In `src/styles.css`, add compact panel styling for `.map-legend`, its heading, layer rows, color swatches, and the solid/dotted/dashed path keys. Position the overlay beneath the existing top-right basemap badge with a solid translucent backing for text contrast. At `max-width: 760px`, reduce padding/gaps and constrain its width so it remains visible without horizontal page overflow or collision with bottom-right navigation.

Strengthen the existing global `:focus-visible` outline to a clearly visible 2px treatment while retaining the current air-color focus token. Keep existing responsive panel rules and interaction states unchanged.

**Step 3: Run targeted browser checks**

Run:

```bash
npm run test:browser
```

Expected: PASS at desktop and mobile widths, including the persistent compact legend, no horizontal overflow, keyboard focus visibility, and existing map controls.

### Task 4: Verify the full regression surface

**Files:**
- Verify: `src/components/MapLegend.tsx`
- Verify: `src/map/MapViewport.tsx`
- Verify: `src/map/aircraft-renderer.ts`
- Verify: `src/styles.css`
- Verify: `tests/browser-check.mjs`

**Step 1: Run typecheck and production build**

Run:

```bash
npm run build
```

Expected: TypeScript checks and Vite production build succeed. Existing chunk-size advisory warnings are acceptable if unchanged.

**Step 2: Run the full automated suite**

Run:

```bash
npm test
```

Expected: all tests pass, including existing layer reducer, aircraft selection, feed, motion, and server behavior tests.

**Step 3: Review the patch**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and only the planned component, map presentation, stylesheet, and browser-test files changed.
