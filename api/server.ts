import { createArgusServer } from '../server/app.js';
import { readConfig } from '../server/config.js';

// Vercel owns the listener. Export the HTTP server to preserve WebSocket upgrades.
const { server } = createArgusServer(readConfig(process.env));
export default server;
