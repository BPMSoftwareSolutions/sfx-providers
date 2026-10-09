// Hosted UI provider API: every discovered ui-runtime-provider.v1 package is
// consumable over HTTP without importing its code.
//   GET  /ui-providers                              index of hosted providers
//   GET  /ui-providers/{providerId}/manifest         identity, version, contracts,
//                                                    entrypoint and asset integrity
//   GET  /ui-providers/{providerId}/assets/{assetId} digest-verified asset bytes;
//                                                    ?digest=sha256:… makes the URL
//                                                    content-addressed and immutable
//   POST /ui-providers/{providerId}/invoke           the provider's operation
// Any route accepts ?version=<semver>: a consumer pinned to a version that is not
// the hosted one is refused, never served another version. Refusals are named.
import { indexOf, readVerifiedAsset } from './registry.mjs';
import {createHash, timingSafeEqual} from 'node:crypto';

export const UI_PROVIDER_PREFIX = '/ui-providers';
// Azure can decode %2F before forwarding. Asset identities may contain slashes;
// resolution still uses the manifest's exact asset map, never a request file path.
const ROUTE = /^\/ui-providers\/([^/]+)\/(manifest|invoke|assets\/(.+))$/;

function sendJson(res, status, body, headers = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(text), 'cache-control': 'no-store', ...headers });
  res.end(text);
}
const refuse = (res, status, code, message, headers) => sendJson(res, status, { error: code, findings: [{ code, path: '$', message }] }, headers);

// A provider's named refusal keeps its meaning over HTTP.
function invokeStatus(result) {
  if (result?.disposition === 'AUTHORED') return 200;
  const code = result?.findings?.[0]?.code ?? '';
  return /_REQUEST_INVALID$/.test(code) ? 400 : /_OVERSIZED$/.test(code) ? 413 : /_UNKNOWN$/.test(code) ? 404 : 422;
}

async function readJson(req, limit) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes <= limit) chunks.push(chunk);
  }
  if (bytes > limit) return { bytes, oversized: true };
  try { return { bytes, input: JSON.parse(Buffer.concat(chunks).toString('utf8')) }; }
  catch { return { bytes, invalid: true }; }
}

export function createUiProviderRequestHandler(providers, {invocationKey} = {}) {
  const expectedKey = invocationKey ? createHash('sha256').update(invocationKey).digest() : null;
  return async (req, res, pathname, searchParams = new URLSearchParams()) => {
    if (pathname !== UI_PROVIDER_PREFIX && !pathname.startsWith(`${UI_PROVIDER_PREFIX}/`)) return false;
    if (pathname === UI_PROVIDER_PREFIX) {
      if (req.method !== 'GET') { req.resume(); refuse(res, 405, 'UI_PROVIDER_METHOD_NOT_ALLOWED', 'Use GET for the provider index.', { allow: 'GET' }); return true; }
      sendJson(res, 200, indexOf(providers));
      return true;
    }
    const match = ROUTE.exec(pathname);
    if (!match) { req.resume(); refuse(res, 404, 'UI_PROVIDER_ROUTE_UNKNOWN', `No hosted provider route ${pathname}.`); return true; }
    const providerId = decodeURIComponent(match[1]), route = match[3] === undefined ? match[2] : 'assets';
    const entry = providers.get(providerId);
    if (!entry) { req.resume(); refuse(res, 404, 'UI_PROVIDER_UNKNOWN', `No hosted provider ${providerId}.`); return true; }
    const { manifest } = entry, served = manifest.version.version;
    const identity = { 'x-ui-provider': `${providerId}@${served}`, 'x-ui-provider-manifest-digest': manifest.digest };
    const allowed = route === 'invoke' ? 'POST' : 'GET';
    if (req.method !== allowed) { req.resume(); refuse(res, 405, 'UI_PROVIDER_METHOD_NOT_ALLOWED', `Use ${allowed} for ${route}.`, { allow: allowed }); return true; }
    const pinned = searchParams.get('version');
    if (pinned !== null && pinned !== served) {
      req.resume();
      refuse(res, 409, 'UI_PROVIDER_VERSION_UNAVAILABLE', `${providerId}@${pinned} is not hosted; the hosted version is ${served}.`, identity);
      return true;
    }

    if (route === 'manifest') { sendJson(res, 200, manifest, identity); return true; }

    if (route === 'assets') {
      const asset = entry.assets.get(decodeURIComponent(match[3]));
      if (!asset) { refuse(res, 404, 'UI_PROVIDER_ASSET_UNKNOWN', `${providerId} declares no asset ${decodeURIComponent(match[3])}.`, identity); return true; }
      const requested = searchParams.get('digest');
      if (requested !== null && requested !== asset.digest) {
        refuse(res, 409, 'UI_PROVIDER_ASSET_DIGEST_STALE', `${asset.assetId} is ${asset.digest} at ${providerId}@${served}, not ${requested}.`, identity);
        return true;
      }
      const bytes = readVerifiedAsset(entry, asset);
      if (!bytes) { refuse(res, 500, 'UI_PROVIDER_ASSET_DIGEST_MISMATCH', `${asset.assetId} no longer matches its declared digest; it is not served.`, identity); return true; }
      const headers = { ...identity, 'content-type': /^text\/|\+xml$/.test(asset.mediaType) ? `${asset.mediaType}; charset=utf-8` : asset.mediaType,
        'x-content-digest': asset.digest, etag: `"${asset.digest}"`, 'x-content-type-options': 'nosniff',
        'cache-control': requested === null ? 'no-cache' : 'public, max-age=31536000, immutable' };
      if (req.headers['if-none-match'] === headers.etag) { res.writeHead(304, headers); res.end(); return true; }
      res.writeHead(200, { ...headers, 'content-length': bytes.length });
      res.end(bytes);
      return true;
    }

    const operations = manifest.entrypoint.operations, requestedOperation = searchParams.get('operation');
    if (expectedKey) {
      const supplied = req.headers['x-sfx-provider-key'];
      if (typeof supplied !== 'string' || !timingSafeEqual(expectedKey, createHash('sha256').update(supplied).digest())) {
        req.resume(); refuse(res, 401, 'UI_PROVIDER_CREDENTIAL_REQUIRED', 'An authorized provider credential is required.', identity); return true;
      }
    }
    const operationId = requestedOperation ?? (operations.length === 1 ? operations[0] : null);
    if (!operations.includes(operationId)) {
      req.resume();
      refuse(res, 400, 'UI_PROVIDER_OPERATION_UNKNOWN', `Name one of ${providerId}'s operations: ${operations.join(', ')}.`, identity);
      return true;
    }
    // The declared operation always consumes JSON. The governed HTTP carrier
    // can deliver raw body bytes without a Content-Type header; parse those by
    // this operation's contract, while refusing explicitly different formats.
    const contentType = req.headers['content-type']?.split(';')[0].trim().toLowerCase();
    if (contentType && contentType !== 'application/json' && contentType !== 'application/octet-stream') {
      req.resume(); refuse(res, 415, 'UI_PROVIDER_CONTENT_TYPE_INVALID', 'Send the operation input as application/json.', identity); return true;
    }
    const body = await readJson(req, manifest.entrypoint.maxRequestBytes);
    if (body.oversized) { refuse(res, 413, 'UI_PROVIDER_REQUEST_OVERSIZED', `The request exceeds ${manifest.entrypoint.maxRequestBytes} bytes.`, identity); return true; }
    if (body.invalid) { refuse(res, 400, 'UI_PROVIDER_REQUEST_INVALID', 'The request body is not JSON.', identity); return true; }
    const result = await entry.module.invoke(body.input, { requestBytes: body.bytes, operationId });
    sendJson(res, invokeStatus(result), { ...result, servedBy: { providerId, version: served, operationId, manifestDigest: manifest.digest } }, identity);
    return true;
  };
}
