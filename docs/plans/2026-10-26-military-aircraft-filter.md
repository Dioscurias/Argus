# Military Aircraft Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an aircraft-class filter that works alongside the existing altitude and aircraft-type filters.

**Architecture:** Preserve the feed's database classification as a compact `meta.military` boolean during normalization. Add an `all | civilian | military` filter to the existing client-side filter state and render it as the third Air traffic selector. Unknown classifications remain visible under All and are excluded from both classified subsets.

**Tech Stack:** TypeScript, React, Blueprint HTMLSelect, Node test runner, Playwright.

---

### Task 1: Preserve classification and filter it

**Files:**
- Modify: `server/providers/normalize-air.ts`
- Modify: `src/layers/air-filters.ts`
- Test: `tests/air.test.ts`

1. Add failing tests for the ADS-B `dbFlags` military bit and combined class/type/altitude filtering.
2. Run `npm test` and confirm the new assertions fail.
3. Store `meta.military` as `true` or `false` when `dbFlags` is numeric, otherwise leave it unknown.
4. Add `classification: 'all' | 'civilian' | 'military'` to `AirFilters` and apply it without changing the existing filters.
5. Run `npm test` and confirm all tests pass.

### Task 2: Add the selector

**Files:**
- Modify: `src/layers/AirLayer.ts`
- Modify: `src/components/LayerPanel.tsx`
- Modify: `tests/browser-check.mjs`

1. Add a failing browser assertion for an `Air traffic Aircraft class` selector.
2. Add Aircraft class to the Air traffic definition and map it explicitly to the classification filter.
3. Offer All aircraft, Civilian, and Military; keep Altitude band and Aircraft type unchanged.
4. Verify the military option narrows the visible count and Clear air filters restores all aircraft.

### Task 3: Verify and release

**Files:**
- Modify: `README.md`

1. Document classification behavior and unknown handling in the README.
2. Run `npm test`, `npm run build`, `npm run test:browser`, and the live production check.
3. Commit, push `main`, deploy to Vercel, and repeat the browser check on production.
