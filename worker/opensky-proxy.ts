async function accessToken(env: Env) {
  const response = await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.OPENSKY_CLIENT_ID, client_secret: env.OPENSKY_CLIENT_SECRET }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    console.error(JSON.stringify({ message: 'OpenSky OAuth rejected', status: response.status, upstreamError: result.error ?? 'unknown' }));
    return null;
  }
  const result = await response.json() as { access_token?: string; expires_in?: number };
  if (!result.access_token) return null;
  return result.access_token;
}

async function authorized(request: Request, expected: string) {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(request.headers.get('Authorization') ?? '')),
    crypto.subtle.digest('SHA-256', encoder.encode(`Bearer ${expected}`)),
  ]);
  const provided = new Uint8Array(providedHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index++) difference |= provided[index] ^ expectedBytes[index];
  return difference === 0;
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ARGUS OpenSky Proxy</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#071018;color:#d7f9ef;font:16px system-ui,sans-serif}main{max-width:38rem;padding:2rem;text-align:center}h1{font-size:clamp(1.75rem,5vw,3rem);margin:0 0 1rem;color:#63f5c8}p{color:#9db8b0}</style><main><h1>ARGUS OpenSky Proxy is operational</h1><p>The protected aircraft data endpoint is connected to the ARGUS application.</p></main></html>', {
        headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'public, max-age=300' },
      });
    }
    if (request.method !== 'GET' || url.pathname !== '/states') return new Response('Not found', { status: 404 });
    if (!(await authorized(request, env.ARGUS_PROXY_TOKEN))) return new Response('Unauthorized', { status: 401 });
    try {
      const bearer = await accessToken(env);
      if (!bearer) return Response.json({ error: 'OpenSky authentication failed' }, { status: 502 });
      const upstream = await fetch('https://opensky-network.org/api/states/all', { headers: { Authorization: `Bearer ${bearer}` } });
      if (!upstream.ok) return Response.json({ error: 'OpenSky request failed', status: upstream.status }, { status: 502 });
      return new Response(upstream.body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
    } catch (error) {
      console.error(JSON.stringify({ message: 'OpenSky proxy failure', error: error instanceof Error ? error.message : 'Unknown error' }));
      return Response.json({ error: 'OpenSky proxy unavailable' }, { status: 502 });
    }
  },
};

