# Worker Status Page Design

## Goal

Make the public root URL of `argus-opensky-proxy` visibly confirm that the service is online instead of returning `Not found`.

## Design

`GET /` returns a minimal static HTML status page with the service name, an operational message, and a note that the protected aircraft endpoint is consumed by ARGUS. The response does not expose credentials, upstream data, configuration, or internal diagnostics.

The existing `GET /states` route and bearer-token authentication are unchanged. Unsupported paths and non-GET requests continue returning `404`.

## Verification

Add a Worker test asserting that `GET /` returns `200`, HTML content, and the operational message without authentication. Run the full test and build suites, deploy with Wrangler, and verify the production root URL returns the expected content.
