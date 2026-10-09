#!/usr/bin/env node
// Deployable host for the UI runtime providers only: the read-only provider index,
// manifests, digest-verified assets and invoke (src/ui-providers/http.mjs). It
// serves none of server.mjs's altitude, audio or presentation providers and
// makes no model calls. Invocations, manifests and assets are public. It speaks plain HTTP on PORT
// (default 8080) for a TLS-terminating platform; HOST defaults to 0.0.0.0. A
// packaged bundle's deployment.json (scripts/package-ui-providers.mjs) is reported
// on /health; robots.txt disallows indexing.
//   node ui-providers-host.mjs
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadUiProviders } from './src/ui-providers/registry.mjs';
import { createUiProviderRequestHandler } from './src/ui-providers/http.mjs';

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(text), 'cache-control': 'no-store' });
  res.end(text);
}

export async function startUiProviderHost({ port = Number.parseInt(process.env.PORT ?? '8080', 10), host = process.env.HOST ?? '0.0.0.0', directory } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`PORT must be a TCP port; received ${process.env.PORT}`);
  const providers = await loadUiProviders(directory);
  const handle = createUiProviderRequestHandler(providers);
  const served = [...providers.values()].map(({ manifest }) => `${manifest.identity.providerId}@${manifest.version.version}`);
  const deploymentFile = fileURLToPath(new URL('./deployment.json', import.meta.url));
  const deployment = existsSync(deploymentFile) ? JSON.parse(readFileSync(deploymentFile, 'utf8')) : null;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (await handle(req, res, url.pathname, url.searchParams)) return;
      if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/healthz'))
        return sendJson(res, 200, { status: 'ok', service: 'sfx-ui-providers', uiProviders: served, deployment });
      if (req.method === 'GET' && url.pathname === '/robots.txt') {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
        return res.end('User-agent: *\nDisallow: /\n');
      }
      req.resume();
      sendJson(res, 404, { error: 'UI_PROVIDER_ROUTE_UNKNOWN', findings: [{ code: 'UI_PROVIDER_ROUTE_UNKNOWN', path: '$', message: `No route ${url.pathname}.` }] });
    } catch {
      if (!res.headersSent && !res.destroyed) sendJson(res, 500, { error: 'UI_PROVIDER_REQUEST_FAILED', findings: [{ code: 'UI_PROVIDER_REQUEST_FAILED', path: '$', message: 'The request could not be completed.' }] });
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => { server.removeListener('error', reject); resolve(); }); });
  return { server, port: server.address().port, providers: served };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const { server, port, providers } = await startUiProviderHost();
    console.log(`UI_PROVIDERS_READY port=${port} providers=${providers.join(',')}`);
    const shutdown = () => server.close(() => process.exit(0));
    process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error(`UI_PROVIDERS_FAILED ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
