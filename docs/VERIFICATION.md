# Phase 1 verification

Verified on 2026-10-25 with Node.js 25.8.1, npm 11.12.1, and installed Google Chrome via Playwright. The declared runtime minimum is Node.js 22.12.

## Results

- `npm test`: **17 tests passed**, zero failures. Covers normalized FR24/OpenSky/adsb.lol records, unit conversion, delayed provenance, filters, fallback/retention, preflight status timestamps, provider retry headers, deterministic MODELED entities, cache/layer state, malformed-frame rejection, configuration validation, and HTTP/WebSocket agreement.
- `npm run build`: **passed**. Strict client/server TypeScript checks, Vite production client, and compiled Node server completed.
- `npm run test:browser`: **passed** against the development app.
- `TEST_URL=http://127.0.0.1:3002 npm run test:browser`: **passed** against the compiled production app served by Express.
- `GET /api/health` on the production server: healthy mock air/sea/truck feeds, with MODELED provenance and expected counts.

Browser checks exercised 640 deck.gl aircraft and 5,280 bundled airport references in Mercator and globe projections; air filters, layer visibility/opacity, the night mask, layer solo, drag/keyboard reordering, malformed-frame recovery, socket disconnect/reconnect, and mobile panels. No unexpected browser errors or external runtime asset requests were observed. Desktop, globe, and narrow-screen screenshots were inspected.

A read-only code review identified solo/visibility and malformed-frame issues; both were reproduced in failing regression tests, corrected, and reviewed again.

## Limits

This verifies Phase 1 with 640 rendered synthetic aircraft and 1,240 total buffered entities. Live-provider adapters were tested with representative normalized payloads, but no real credentials were available for an end-to-end FR24/OpenSky call. Sea/truck rendering, later-phase interactions, and the eventual 70,000-entity target are not verified. Chrome was tested; other browser engines were not.

Mock routes are synthetic fixtures, not estimates from FHWA/FAF5 or live observations. Static country boundaries and labels are local cartographic references. The day/night mask is approximate.
