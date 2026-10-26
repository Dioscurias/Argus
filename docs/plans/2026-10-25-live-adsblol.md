# Live adsb.lol Aircraft Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Serve observed adsb.lol aircraft for the active 250-NM map region and expose only functional application controls.

**Architecture:** Add validated viewport coordinates to the snapshot HTTP boundary and use an adsb.lol feed keyed by rounded region. Replace the browser WebSocket connection with controlled HTTP polling and map-center updates. Remove unavailable phase placeholders and all synthetic non-air entities.

**Tech Stack:** TypeScript, Express, React, MapLibre GL, deck.gl, Node test runner, Playwright, Vercel Functions.

---

### Task 1: Viewport-aware observed snapshots

**Files:**
- Modify: `server/config.ts`
- Modify: `server/app.ts`
- Modify: `server/providers/adsblol.ts`
- Test: `tests/core.test.ts`
- Test: `tests/server.test.ts`

1. Write failing tests for Vercel live configuration, coordinate validation, observed-only snapshots, and provider failure behavior.
2. Run `npm test` and confirm the new assertions fail for the missing behavior.
3. Add a validated snapshot-region parser and inject region-specific adsb.lol providers into the server.
4. Ensure live snapshots contain observed air plus reference metadata, never mock air/sea/truck entities.
5. Run `npm test` and confirm the server tests pass.

### Task 2: HTTP polling and viewport updates

**Files:**
- Modify: `src/hooks/useFeed.ts`
- Modify: `src/App.tsx`
- Modify: `src/map/MapViewport.tsx`
- Test: `tests/browser-check.mjs`

1. Extend the browser test with intercepted regional snapshot requests and assertions for initial/changed coordinates.
2. Run the browser test and confirm it fails because the app still uses WebSockets.
3. Implement abortable HTTP polling, retry, stale-state handling, and debounced map-center updates.
4. Run the browser test and confirm live aircraft update after map movement.

### Task 3: Remove unavailable interface

**Files:**
- Modify: `src/components/CommandBar.tsx`
- Modify: `src/components/LayerPanel.tsx`
- Modify: `src/components/Inspector.tsx`
- Modify: `src/components/Timeline.tsx`
- Modify: `src/components/StatusBar.tsx`
- Modify: `src/layers/state.ts`
- Modify: `src/styles.css`
- Test: `tests/browser-check.mjs`

1. Add browser assertions that search, timeline, unavailable transport layers, and disabled future map tools do not exist.
2. Run the browser test and confirm those assertions fail.
3. Remove those controls and revise live coverage, attribution, environment, and status copy.
4. Verify every remaining control through browser interactions at desktop and mobile widths.

### Task 4: Documentation and production verification

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

1. Document adsb.lol attribution, ODbL terms, 250-NM viewport coverage, refresh behavior, and production-use caveat.
2. Run `npm test`, `npm run build`, and the complete local browser suite.
3. Commit and push the implementation.
4. Configure Vercel for `MOCK_DATA_MODE=false` and `AIR_PROVIDER=adsblol`, then deploy production.
5. Run health, snapshot, and browser acceptance checks against the public URL.

