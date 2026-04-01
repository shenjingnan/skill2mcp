import { resolveConfig } from './config.js';
import { startServer } from './server.js';

const config = resolveConfig();
startServer(config).catch((err: unknown) => {
  console.error('Fatal:', err);
  process.exit(1);
});
