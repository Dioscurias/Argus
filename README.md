# ARGUS

Layered global traffic intelligence. **Phase 1: air traffic and airports.**

A runnable Vite + React + TypeScript application with Blueprint's dark UI, MapLibre GL, a deck.gl overlay, and a Node/Express backend. Production displays worldwide observed aircraft state vectors from the authenticated OpenSky Network API, with adsb.lol available as a regional fallback.

## Run

Use Node.js 22.12+ within the Node 22 release line and npm. In this directory:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Vite serves the client and proxies `/api` and `/ws` to Express on port 3001. Both processes start and stop together.

Local development defaults to deterministic mock mode. To use observations locally, copy `.env.example` to `.env`, set `MOCK_DATA_MODE=false`, and restart `npm run dev`. All provider configuration is server-side; never prefix credentials with `VITE_`.

For a production build served by Express:

```sh
npm run build
npm start
```

Open **http://127.0.0.1:3001**. Run these commands from the project root. The server binds to loopback by default. `HOST` can change that for an intentional deployment; authentication and shared-host hardening are outside Phase 0.

## Vercel deployment

`vercel.json` builds the Vite client and deploys `api/server.ts` as the HTTP backend. Production requests authenticated OpenSky state vectors every 90 seconds, refreshes OAuth tokens before expiry, and honors provider retry limits. The server retains observations as `DELAYED` on transient failures and never substitutes modeled aircraft in live mode.

## What Phase 1 includes

- The specified dark palette, Inter UI type, JetBrains Mono data type, Blueprint controls, command bar, layer stack, inspector shell, timeline shell, and status bar.
- A pan/zoom reference map with 2D Mercator and globe projections, north reset, and world-view reset. Natural Earth country geometry, OurAirports large/medium airport points, and all fonts are bundled locally.
- Aircraft icons rendered with deck.gl in both projections, hover details with provenance/source, and working altitude, airline, and aircraft-type filters.
- Separate server-side adapters for the official Flightradar24 SDK, OpenSky OAuth/anonymous REST, and adsb.lol point API. Observations are normalized to knots/feet/WGS84, old or retained positions are labeled DELAYED, and failures retain the reference map.
- Five functional layer definitions: basemap, graticule, day/night, airports, and observed aircraft. Toggle visibility, set opacity, solo a layer, drag it to reorder, or use its drag handle with the arrow keys.
- Working basemap, 15° graticule, and approximate day/night mask. Static geography uses a REF badge; computed/synthetic layers use MODELED. The terminator refreshes every 60 seconds and is a visual approximation, not a navigation ephemeris.
- Abortable HTTP polling, OAuth token reuse, provider backoff, stale/offline feed states, and retained observations on provider failure. The local reference map stays available.
- Responsive panels: at narrower sizes, use the layer/inspector buttons in the command bar.

Unavailable features are not shown. Search, region-drawing tools, saved views, timeline replay, sea traffic, ports, freight corridors, and truck traffic were removed until real implementations exist. FPS is measured from actual map frames and displays `RENDER IDLE` when the map is not drawing.

## Staged delivery

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Scaffold, design system, shell, empty map, layer controls, mock stream | Implemented |
| 1 | Air rendering, airports, official FR24 provider, OpenSky/adsb.lol fallback | Implemented |
| 2 | Sea rendering, AISstream provider, ports, shipping lanes | Pending |
| 3 | Modeled freight corridors and truck flows; U.S. then global | Pending |
| 4 | Search, entity inspector, regions, saved views, timeline replay | Pending |
| 5 | High-volume rendering optimizations, full error-state pass, provider/license documentation | Pending |

Phase 1 does not implement search, selection, track history, region drawing, saved views, replay, sea traffic, or truck traffic. These controls are absent rather than disabled. No 70,000-entity or 60 FPS performance claim is made.

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

`GET /api/health` returns feed health. `GET /api/snapshot` returns normalized observed state vectors. The browser polls over HTTP because a Vercel Function is not a durable shared WebSocket poller. Credentials and configuration never appear in responses.

## Verify

```sh
npm test
npm run build
```

For browser checks, start `npm run dev` in another terminal, then:

```sh
npm run test:browser
```

The browser test uses installed Google Chrome on macOS, `CHROME_PATH` if supplied, or Playwright Chromium. It intercepts the provider snapshot with deterministic observed fixtures while exercising the browser. `TEST_URL` can point the checks at production. Screenshots are written to `artifacts/`.

Tests cover deterministic provenance and valid movement, cache expiration, layer state behavior, configuration errors, HTTP/WebSocket agreement and origin checks, map controls and actual pixel changes, local-only assets, keyboard/drag layer reordering, disconnect recovery, and narrow screens.

## Attribution and licenses

- [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) country geometry is public domain. The bundled dataset is Natural Earth 1:110m Admin 0 Countries; boundaries are cartographic reference, not a statement of sovereignty. See `public/data/README.md` for the exact upstream source.
- [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) uses BSD-3-Clause; [deck.gl](https://github.com/visgl/deck.gl) uses MIT; [Blueprint](https://github.com/palantir/blueprint) uses Apache-2.0. Package licenses remain in `node_modules` after installation.
- Inter and JetBrains Mono are bundled through Fontsource under their SIL Open Font Licenses.
- [adsb.lol](https://www.adsb.lol/docs/open-data/) observations are licensed under ODbL 1.0. Its public API is free, but adsb.lol asks production consumers to contact the operator so changes do not unexpectedly break an application.
- [OpenSky Network](https://opensky-network.org/) provides the production state vectors. Operational/public application use requires written permission under OpenSky's terms; OAuth credentials must remain server-side.
- UI styling follows the requested analytical design language. ARGUS is not affiliated with or endorsed by Palantir.
- No `fr24-3d-models` assets are included. That optional library is GPL-2.0; using it later requires reviewing the distribution/license implications first. Default future aircraft rendering will use simple SVG sprites.
- Real air/AIS/airport/port/freight sources are not bundled or contacted in Phase 0. Provider acquisition instructions, terms, rate limits, and fuller source attribution belong with their implementation phases and the Phase 5 documentation pass.

The initial production build includes substantial mapping/UI dependencies. Bundle-size optimization and high-volume binary rendering are deferred to the performance phase.
