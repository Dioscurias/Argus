# ARGUS

Layered global traffic intelligence. **Phase 0: foundation.**

A runnable Vite + React + TypeScript application with Blueprint's dark UI, MapLibre GL, a deck.gl overlay, and a Node/Express/WebSocket backend. All movement in this phase is **synthetic and labeled MODELED**. No API keys are required.

## Run

Use Node.js 22.12+ within the Node 22 release line and npm. In this directory:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Vite serves the client and proxies `/api` and `/ws` to Express on port 3001. Both processes start and stop together.

You do not need an `.env` file. To change the mock counts, seed, refresh interval, or backend port, copy `.env.example` to `.env` and edit it. Restart `npm run dev` after changing environment values. All API credentials are reserved for server-side use; never prefix credentials with `VITE_`.

For a production build served by Express:

```sh
npm run build
npm start
```

Open **http://127.0.0.1:3001**. Run these commands from the project root. The server binds to loopback by default. `HOST` can change that for an intentional deployment; authentication and shared-host hardening are outside Phase 0.

## Vercel deployment

`vercel.json` builds the Vite client and deploys `api/server.ts` as the HTTP/WebSocket backend. `/ws`, `/api/health`, and `/api/snapshot` route to that server. No provider keys are required. The production runtime is pinned to Node 22.

Vercel WebSocket connections end at the function's configured maximum duration (300 seconds); the client reconnects automatically. Synthetic positions use a fixed epoch so reconnecting to a different function instance does not reset routes. Polling and heartbeat timers run only while clients are connected. In-memory snapshots are per instance; future live providers and durable replay require shared external storage.

Reference: [Vercel WebSockets](https://vercel.com/docs/functions/websockets).

## What Phase 0 includes

- The specified dark palette, Inter UI type, JetBrains Mono data type, Blueprint controls, command bar, layer stack, inspector shell, timeline shell, and status bar.
- A pan/zoom reference map with 2D Mercator and globe projections, north reset, and world-view reset. Natural Earth country geometry and all fonts are bundled locally: there are no runtime tile, glyph, or font service calls.
- Nine modular layer definitions. Toggle visibility, set opacity, solo a layer, drag it to reorder, or focus its drag handle and use the up/down keys. Solo keeps the enabled basemap as geographic context and restores the previous visibility state when cleared. Explicit visibility changes exit solo. Reset restores the default layer stack. MapLibre layer draw order follows the stack from top to bottom; later layers draw above earlier layers.
- Working basemap, 15° graticule, and approximate day/night mask. Static geography uses a REF badge; computed/synthetic layers use MODELED. The terminator refreshes every 60 seconds and is a visual approximation, not a navigation ephemeris.
- Deterministic mock generation: by default, 640 aircraft, 420 vessels, and 180 trucks move along synthetic routes. Positions update every two seconds, normalize to one typed schema, and stream over WebSocket.
- Short-TTL server caching, reconnect with bounded backoff, stale/offline feed states, WebSocket heartbeat and backpressure handling, and same-origin browser connection checks. The client retains the last buffer when disconnected; the local reference map stays available.
- Responsive panels: at narrower sizes, use the layer/inspector buttons in the command bar.

**The transport map is intentionally empty in Phase 0.** The client receives mock entities and shows their buffered counts, but transport markers do not render yet. `0 RENDERED / 1,240 BUFFERED` is intentional. The deck.gl overlay is initialized with an empty layer array. Enabling future layers stores their settings; it does not add markers. Transport opacity controls likewise store values for later renderers.

Green feed dots mean the **local synthetic stream** is healthy, never that a live provider is connected. Pending reference sources have hollow dots. On disconnect, counts and timestamps refer to the retained buffer. FPS is measured from actual map frames and displays `RENDER IDLE` when the map is not drawing; it is not a simulated performance counter.

## Staged delivery

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Scaffold, design system, shell, empty map, layer controls, mock stream | Implemented |
| 1 | Air rendering, airports, official FR24 provider, OpenSky/adsb.lol fallback | Next |
| 2 | Sea rendering, AISstream provider, ports, shipping lanes | Pending |
| 3 | Modeled freight corridors and truck flows; U.S. then global | Pending |
| 4 | Search, entity inspector, regions, saved views, timeline replay | Pending |
| 5 | High-volume rendering optimizations, full error-state pass, provider/license documentation | Pending |

Upcoming controls are visibly disabled and carry their phase number. Phase 0 does not implement search, selection, track history, region filters, saved views, replay, H3 bins, live providers, or provider-specific filters. `MOCK_DATA_MODE=false` fails with an explicit startup message rather than implying a live connection. No 70,000-entity or 60 FPS performance claim is made yet.

Truck records are synthetic development fixtures, **not** FHWA/FAF5 estimates and not observations. No public live global truck feed exists. `TruckProvider` is an extension point for a later telematics/HERE/TomTom integration.

## Structure

```text
shared/schema.ts             Unified entity and WebSocket protocol
server/index.ts              Environment loading, startup, shutdown
server/config.ts             Validated server-only configuration
server/app.ts                Express routes, WebSocket lifecycle, cache usage
server/cache.ts              Short-TTL cache
server/providers/provider.ts Provider and truck-feed contracts
server/providers/mock.ts     Seeded synthetic routes and entity generator
src/App.tsx                  Shell composition and layer/projection state
src/components/              Command bar, panels, badges, timeline/status shells
src/hooks/useFeed.ts          Validated socket frames, retry and stale detection
src/layers/                  One descriptor per layer, reducer and shared types
src/map/                     MapLibre/deck integration, style, labels, geography
src/styles.css               Design tokens, Blueprint overrides, responsive layout
public/data/                 Bundled country geometry and attribution
tests/                      Core/server tests and Chromium interaction checks
docs/plans/                  Phase 0 scope and implementation plan
```

## Data contract

Each entity has `id`, `layer` (`air | sea | truck`), `lat`, `lon`, `heading`, `speed`, `altitude`, `label`, `subtype`, `origin`, `destination`, `source`, `ts`, `provenance` (`LIVE | DELAYED | MODELED`), and `meta`.

- Coordinates: WGS84 degrees. Heading: clockwise degrees from north.
- Speed: knots for all providers. Altitude: feet. Timestamp: Unix milliseconds.
- Synthetic IDs/labels use `mock-`, `SIM`, or `SYNTH` prefixes. `meta.synthetic` is always true.
- Synthetic route interpolation is piecewise linear and loops at its destination; it is not a physically faithful simulator or dead-reckoning implementation.

`GET /api/health` returns current mock feed health. `GET /api/snapshot` returns the cached normalized snapshot. `WS /ws` immediately sends a versioned snapshot and broadcasts new snapshots at the configured interval. Configuration and credentials never appear in those responses. HTTP snapshot caching and upstream provider caching share the same server boundary; real provider rate limits are addressed when their integrations are added.

## Verify

```sh
npm test
npm run build
```

For browser checks, start `npm run dev` in another terminal, then:

```sh
npm run test:browser
```

The browser test uses installed Google Chrome on macOS, `CHROME_PATH` if supplied, or Playwright Chromium. On systems without either browser, install Chromium with `npx playwright install chromium`. `TEST_URL` can point the checks at a production Express instance instead. Browser tests expect the default mock counts and 2-second update interval. Screenshots are written to `artifacts/`.

Tests cover deterministic provenance and valid movement, cache expiration, layer state behavior, configuration errors, HTTP/WebSocket agreement and origin checks, map controls and actual pixel changes, local-only assets, keyboard/drag layer reordering, disconnect recovery, and narrow screens.

## Attribution and licenses

- [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) country geometry is public domain. The bundled dataset is Natural Earth 1:110m Admin 0 Countries; boundaries are cartographic reference, not a statement of sovereignty. See `public/data/README.md` for the exact upstream source.
- [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) uses BSD-3-Clause; [deck.gl](https://github.com/visgl/deck.gl) uses MIT; [Blueprint](https://github.com/palantir/blueprint) uses Apache-2.0. Package licenses remain in `node_modules` after installation.
- Inter and JetBrains Mono are bundled through Fontsource under their SIL Open Font Licenses.
- UI styling follows the requested analytical design language. ARGUS is not affiliated with or endorsed by Palantir.
- No `fr24-3d-models` assets are included. That optional library is GPL-2.0; using it later requires reviewing the distribution/license implications first. Default future aircraft rendering will use simple SVG sprites.
- Real air/AIS/airport/port/freight sources are not bundled or contacted in Phase 0. Provider acquisition instructions, terms, rate limits, and fuller source attribution belong with their implementation phases and the Phase 5 documentation pass.

The initial production build includes substantial mapping/UI dependencies. Bundle-size optimization and high-volume binary rendering are deferred to the performance phase.
