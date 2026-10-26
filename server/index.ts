import 'dotenv/config';
import { createArgusServer } from './app.js';
import { readConfig } from './config.js';

try {
  const config = readConfig(process.env);
  const app = createArgusServer(config);
  await app.listen();
  console.log(`ARGUS API  http://${config.host}:${config.port}  |  PHASE 1 · ${config.mockMode ? 'MODELED DATA ONLY' : 'OBSERVED AIR / MODELED SEA & TRUCKS'}`);
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'ARGUS could not start.');
  process.exit(1);
}
