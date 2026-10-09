// Discovers every UI runtime provider package and projects its hosted manifest.
// A package is hosted when providers/<name>/<name>.mjs exports a descriptor with
// moduleContractId ui-runtime-provider.v1 and an invoke function. Nothing here
// names a specific provider: identity, version, contracts and assets all come
// from the package's own exports, and the manifest is a projection of them, not
// a new source of truth.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SHARED_BROWSER_ROOT } from './browser-assets.mjs';

export const MODULE_CONTRACT_ID = 'ui-runtime-provider.v1';
export const MANIFEST_CONTRACT_ID = 'ui-provider-manifest.v1';
export const INDEX_CONTRACT_ID = 'ui-provider-index.v1';
export const DEFAULT_MAX_REQUEST_BYTES = 16384;

const DEFAULT_PROVIDERS = fileURLToPath(new URL('../../providers/', import.meta.url));
const sha256 = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const digestOf = (value) => sha256(JSON.stringify(value));

function declaredAssets(module) {
  const regions = Array.isArray(module.contentManifest?.regions) ? module.contentManifest.regions : [];
  const content = regions.flatMap((region) => (Array.isArray(region.assets) ? region.assets : []).map((asset) => ({
    assetId: asset.assetId,
    regionId: region.regionId ?? null,
    kind: asset.kind,
    mediaType: asset.mediaType,
    role: asset.role,
    path: asset.path,
    bytes: asset.bytes,
    digest: asset.digest,
  })));
  return [...content, ...(module.browser?.assets ?? [])];
}

function projectManifest(module, entry) {
  const { descriptor } = module;
  const assets = declaredAssets(module);
  const base = `/ui-providers/${encodeURIComponent(descriptor.providerId)}`;
  const body = {
    contractId: MANIFEST_CONTRACT_ID,
    identity: {
      providerId: descriptor.providerId,
      package: descriptor.package ?? null,
      declarationProfile: descriptor.declarationProfile ?? null,
      runtime: descriptor.runtime ?? null,
      type: descriptor.type ?? null,
      method: descriptor.method ?? null,
      executionLocation: descriptor.executionLocation ?? null,
    },
    version: {
      version: descriptor.version,
      bindingState: descriptor.bindingState ?? null,
      readiness: descriptor.readiness ?? null,
    },
    contracts: (descriptor.operations ?? []).map((operation) => ({
      operationId: operation.operationId,
      effect: operation.effect ?? null,
      inputContractId: operation.inputContractId ?? null,
      outputContractId: operation.outputContractId ?? null,
      status: descriptor.contractStatus ?? null,
      inputSchemaDigest: module.inputShape?.schema ? digestOf(module.inputShape.schema) : null,
      outputSchemaDigest: module.outputShape?.schema ? digestOf(module.outputShape.schema) : null,
    })),
    capabilities: Array.isArray(module.capabilities) ? module.capabilities : [],
    entrypoint: {
      module: entry.relativeModule,
      operations: (descriptor.operations ?? []).map((operation) => operation.operationId),
      invoke: `${base}/invoke`,
      maxRequestBytes: Number.isInteger(module.MAX_REQUEST_BYTES) ? module.MAX_REQUEST_BYTES : DEFAULT_MAX_REQUEST_BYTES,
      ...(module.browser ? { browser: { assetId: module.browser.entrypoint, exports: module.browser.exports, styles: module.browser.styles, dependencies: module.browser.dependencies } } : {}),
    },
    integrity: {
      algorithm: 'sha256',
      contentManifest: module.contentManifest
        ? { contractId: module.contentManifest.contractId ?? null, manifestId: module.contentManifest.manifestId ?? null, digest: module.contentManifest.digest ?? null }
        : null,
      assets: assets.map((asset) => ({ ...asset, url: `${base}/assets/${encodeURIComponent(asset.assetId)}?version=${encodeURIComponent(descriptor.version)}&digest=${encodeURIComponent(asset.digest)}` })),
    },
  };
  return { ...body, digest: digestOf(body) };
}

// Loads the hosted set once. A package that claims the module contract but is
// incomplete, or two packages claiming one providerId, refuses the whole host:
// a partially hosted set is never served.
export async function loadUiProviders(directory = DEFAULT_PROVIDERS) {
  const root = path.resolve(directory);
  const providers = new Map();
  for (const name of readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
    const modulePath = path.join(root, name, `${name}.mjs`);
    if (!existsSync(modulePath) || !readFileSync(modulePath, 'utf8').includes(MODULE_CONTRACT_ID)) continue;
    const module = await import(pathToFileURL(modulePath).href);
    if (module.descriptor?.moduleContractId !== MODULE_CONTRACT_ID) continue;
    const { providerId, version } = module.descriptor;
    if (typeof providerId !== 'string' || !providerId || typeof version !== 'string' || !version || typeof module.invoke !== 'function'
      || !Array.isArray(module.descriptor.operations) || module.descriptor.operations.length === 0)
      throw new Error(`UI_PROVIDER_PACKAGE_INVALID: ${name} must export a descriptor with providerId, version and operations, and invoke`);
    if (providers.has(providerId)) throw new Error(`UI_PROVIDER_DUPLICATE: ${providerId} is declared by more than one package`);
    if (name !== providerId || module.descriptor.package !== `providers/${providerId}`)
      throw new Error(`UI_PROVIDER_IDENTITY_MISMATCH: folder ${name}, package and declared providerId ${providerId} must be identical`);
    const packageRoot = path.join(root, name);
    const entry = { name, module, packageRoot, relativeModule: `providers/${name}/${name}.mjs` };
    entry.manifest = projectManifest(module, entry);
    entry.assets = new Map(entry.manifest.integrity.assets.map((asset) => [asset.assetId, asset]));
    if (entry.assets.size !== entry.manifest.integrity.assets.length)
      throw new Error(`UI_PROVIDER_PACKAGE_INVALID: ${providerId} declares an assetId more than once`);
    providers.set(providerId, entry);
  }
  return providers;
}

// Asset bytes are read from the package and served only when they still match
// their declared digest; unverified bytes are never served.
export function readVerifiedAsset(entry, asset) {
  const shared = asset.path.startsWith('shared/');
  const root = shared ? SHARED_BROWSER_ROOT : entry.packageRoot;
  const file = path.resolve(root, shared ? asset.path.slice(7) : asset.path);
  if (!file.startsWith(root + path.sep)) return null;
  const bytes = readFileSync(file);
  return sha256(bytes) === asset.digest && bytes.length === asset.bytes ? bytes : null;
}

export function indexOf(providers) {
  const body = {
    contractId: INDEX_CONTRACT_ID,
    providers: [...providers.values()].map(({ manifest }) => ({
      providerId: manifest.identity.providerId,
      version: manifest.version.version,
      operations: manifest.entrypoint.operations,
      manifest: `/ui-providers/${encodeURIComponent(manifest.identity.providerId)}/manifest`,
      manifestDigest: manifest.digest,
    })),
  };
  return { ...body, digest: digestOf(body) };
}
