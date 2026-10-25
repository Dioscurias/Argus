# Phase 0 verification

Verified on 2026-10-25 with Node.js 25.8.1, npm 11.12.1, and installed Google Chrome via Playwright. The declared runtime minimum is Node.js 22.12.

## Results

- `npm test`: **9 tests passed**, zero failures. Covers deterministic MODELED entities, valid coordinates and movement, TTL expiry, layer isolation/reorder, explicit visibility during solo, malformed-frame rejection, configuration validation, and HTTP/WebSocket agreement with origin rejection.
- `npm run build`: **passed**. Strict client/server TypeScript checks, Vite production client, and compiled Node server completed.
- `npm run test:browser`: **passed** against the development app.
- `TEST_URL=http://127.0.0.1:3002 npm run test:browser`: **passed** against the compiled production app served by Express.
- `GET /api/health` on the production server: healthy mock air/sea/truck feeds, with MODELED provenance and expected counts.

Browser checks exercised actual WebGL map pixels for visibility, the night mask and globe projection; keyboard opacity, layer solo, drag/keyboard reordering, zoom/reset, cursor coordinates, malformed-frame recovery, socket disconnect/reconnect with retained buffers, and mobile panel access. No unexpected browser errors or external runtime asset requests were observed. Desktop, globe, and narrow-screen screenshots were inspected.

A read-only code review identified solo/visibility and malformed-frame issues; both were reproduced in failing regression tests, corrected, and reviewed again.

## Limits

This verifies the Phase 0 foundation with 1,240 synthetic buffered entities and zero rendered transport entities. It does not verify live providers, later-phase interactions, or the eventual 70,000-entity performance target. Chrome was tested; other browser engines were not. Vite reports large mapping/UI dependency chunks; bundle optimization belongs to the performance pass.

Mock routes are synthetic fixtures, not estimates from FHWA/FAF5 or live observations. Static country boundaries and labels are local cartographic references. The day/night mask is approximate.
