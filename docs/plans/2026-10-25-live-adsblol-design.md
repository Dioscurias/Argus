# Live adsb.lol Aircraft Design

## Goal

Replace modeled aircraft in the Vercel deployment with observed adsb.lol aircraft around the current map viewport, and remove interface elements that advertise unavailable behavior.

## Architecture

The browser sends the map center to `GET /api/snapshot?lat=…&lon=…`. The server validates and rounds that center, fetches the adsb.lol 250-NM point endpoint, normalizes observations into the existing snapshot schema, and returns no modeled aircraft. A short process-local cache and the existing `AirFeed` backoff protect the provider; the client polls every 60 seconds and immediately refreshes after a settled map movement.

The HTTP polling transport is the production path because Vercel Functions do not provide a durable shared WebSocket poller. The existing WebSocket transport remains available for the standalone Node server but is not used by the browser. Sea and truck entities are removed from production snapshots until observed providers exist.

## Interface

The environment banner and feed cards identify adsb.lol as observed data and show the 250-NM coverage center. Aircraft observation timestamps and provenance remain visible. Search, region-selection tools, timeline replay, sea traffic, truck traffic, ports, and freight corridors are removed because they are not functional. Basemap, graticule, day/night, airports, aircraft, filters, opacity, ordering, solo mode, projections, navigation, tooltips, retry, responsive panels, and status reporting remain.

## Failure behavior

Failed provider requests preserve the most recent observations and mark them delayed. If no valid observations have ever arrived, the air feed reports unavailable and renders zero aircraft. It never substitutes modeled aircraft.

## Validation

Unit tests cover viewport validation, request-specific provider selection, observed-only snapshots, caching/backoff, and stale retention. Browser tests verify polling, map-driven region refresh, all retained controls, attribution, responsive layout, and the absence of removed placeholders. Production is checked through the health/snapshot endpoints and the browser suite.

