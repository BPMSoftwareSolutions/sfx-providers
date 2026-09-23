#!/usr/bin/env node
import { startServer } from './server.mjs';

try {
  const { port, providerCount } = await startServer();
  console.log(`PROVIDER_PORT ${port}`);
  console.log(`PROVIDERS_READY port=${port} providers=${providerCount}`);
} catch (error) {
  console.error(`PROVIDERS_FAILED ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
