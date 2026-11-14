# ARGUS

Layered global traffic intelligence. **Phase 1: air traffic and airports.**

A runnable Vite + React + TypeScript application with Blueprint's dark UI, native MapLibre GL aircraft layers, and a Node/Express backend. Production displays worldwide adsb.lol observations for a configured set of aircraft types, plus the dedicated military feed, with a regional adsb.lol fallback. Coverage depends on receivers, usable positions and the public type list.

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

`vercel.json` builds the Vite client and deploys `api/server.ts` as the HTTP backend. Production requests the expanded adsb.lol global type feed and supplements it with the dedicated military endpoint. Set the server-only `ADSB_BULK_API_KEY` with [whole-world bulk access](https://www.adsb.lol/sponsor) to use the unfiltered positioned snapshot. If bulk access fails, ARGUS backs off that endpoint and uses the public feeds. The server retains observations as `DELAYED` on transient failures and never substitutes modeled aircraft in live mode. Aircraft details use a separate cached, on-demand hexdb.io lookup.

## What Phase 1 includes

- The specified dark palette, Inter UI type, JetBrains Mono data type, Blueprint controls, command bar, layer stack, aircraft inspector, and status bar.
- A pan/zoom reference map with 2D Mercator and globe projections, north reset, and world-view reset. Natural Earth country geometry, OurAirports large/medium airport points, and all fonts are bundled locally.
- Native aircraft symbols and flight paths follow both projections, including globe horizon clipping. Hover for a summary; click to isolate a plane and see its registration, operator/owner, photo, reference airport route, and observed session trail. Escape or **Show all aircraft** restores traffic. Altitude and aircraft-type filters narrow the unselected view.
- The Aircraft class filter adds All aircraft, Civilian, and Military to the existing altitude and aircraft-type filters. ARGUS uses the ADS-B database flags and the provider’s military feed. When readsb omits a zero flag, ADS-B records with a database registration and type count as civilian. Records without classification evidence appear under All aircraft.
- Photos match the aircraft hex code through hexdb.io. Source details and attribution are kept in this README; provider names are not displayed in the interface. Original photo watermarks remain intact. Missing photos/routes and lookup errors are explicitly displayed; no generic photo or invented route is substituted.
- Between reports, aircraft positions are estimated along the reported ground track at the reported ground speed using spherical dead reckoning. A new observation reconciles the displayed position and heading over 2 seconds. Missing speed/track/timestamps and on-ground aircraft are not extrapolated. Estimates stop 5 minutes after the last observation. A dotted mint extension is estimated movement; it never enters the solid observed trail or changes the report timestamp/provenance.
- Animation uses native MapLibre geometry updates with worker backpressure, up to 10 updates/second for large fleets and 30 for small selections. Hidden tabs/layers pause rendering; resuming recomputes positions from report timestamps rather than accumulating timer drift.
- Dashed gold lines are great-circle references between airports in a callsign database, not a confirmed flight plan or flown path. Solid mint trails contain only observations collected while this browser session is open (up to 2 hours / 240 samples per aircraft). Coverage gaps longer than 5 minutes break the trail; date-line crossings are split correctly. Complete pre-session flight history is unavailable.
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

Search, complete historical tracks, region drawing, saved views, replay, sea traffic, and truck traffic remain unavailable. These controls are absent rather than disabled. No 70,000-entity or 60 FPS performance claim is made.

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
src/map/                     Native MapLibre aircraft, flight paths, style, geography
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

`GET /api/aircraft/:hex?callsign=...` validates identifiers and returns aircraft metadata, photo URLs, and reference airports. Provider lookups have 8-second timeouts, partial failures are independent, and the bounded cache coalesces repeated lookups for 5 minutes.

## Verify

```sh
npm test
npm run build
```

For browser checks, start `npm run dev` in another terminal, then:

```sh
npm run test:browser
npm run test:selection
npm run test:motion
```

The browser tests use installed Google Chrome on macOS or Playwright Chromium. They default to deterministic provider fixtures. Set `TEST_LIVE_DATA=true TEST_URL=https://argus-one-mu.vercel.app` to exercise actual production data, routes, and photos. Selection checks find rendered aircraft pixels and click the canvas, verify isolation and loaded images, switch projections, and check mobile details and Escape. Screenshots are written to `artifacts/`.

Tests cover deterministic provenance and valid movement, cache expiration, layer state behavior, configuration errors, HTTP/WebSocket agreement and origin checks, map controls and actual pixel changes, local-only assets, keyboard/drag layer reordering, disconnect recovery, and narrow screens.

## Attribution and licenses

- [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) country geometry is public domain. The bundled dataset is Natural Earth 1:110m Admin 0 Countries; boundaries are cartographic reference, not a statement of sovereignty. See `public/data/README.md` for the exact upstream source.
- [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) uses BSD-3-Clause; [deck.gl](https://github.com/visgl/deck.gl) uses MIT; [Blueprint](https://github.com/palantir/blueprint) uses Apache-2.0. Package licenses remain in `node_modules` after installation.
- Inter and JetBrains Mono are bundled through Fontsource under their SIL Open Font Licenses.
- [adsb.lol](https://www.adsb.lol/docs/open-data/) observations are licensed under ODbL 1.0. Its public API is free, but adsb.lol asks production consumers to contact the operator so changes do not unexpectedly break an application.
- [hexdb.io](https://hexdb.io/) supplies aircraft metadata, photos, and callsign routes. Its documentation credits PlaneBase/PlanePlotter, Jim Mason, Steve Hibberd, ip2location, and Airport-Data. Route records can be old or unavailable; photo coverage is incomplete.
- [OpenSky Network](https://opensky-network.org/) remains an optional adapter. Credentials must remain server-side.
- UI styling follows the requested analytical design language. ARGUS is not affiliated with or endorsed by Palantir.
- No `fr24-3d-models` assets are included. That optional library is GPL-2.0; using it later requires reviewing the distribution/license implications first. Default future aircraft rendering will use simple SVG sprites.
- Real air/AIS/airport/port/freight sources are not bundled or contacted in Phase 0. Provider acquisition instructions, terms, rate limits, and fuller source attribution belong with their implementation phases and the Phase 5 documentation pass.

The initial production build includes substantial mapping/UI dependencies. Bundle-size optimization and high-volume binary rendering are deferred to the performance phase.
