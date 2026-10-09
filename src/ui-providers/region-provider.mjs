import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const inputSchema = JSON.parse(readFileSync(new URL('./contracts/ui-region-request.v1.json',import.meta.url),'utf8'));
const outputSchema = JSON.parse(readFileSync(new URL('./contracts/ui-region-content.v1.json',import.meta.url),'utf8'));

// Shared mechanics only; each declared provider owns its folder, identity and assets.
export function createRegionProvider({providerId,version,definition,packageUrl}) {
const toolId = 'ui.region.load';

const MAX_REQUEST_BYTES = 16384;
const REQUEST_CONTRACT_ID = 'ui-region-request.v1';
const OUTPUT_CONTRACT_ID = 'ui-region-content.v1';
const MANIFEST_CONTRACT_ID = 'ui-content-manifest.v1';
const MANIFEST_ID = `${definition.regionId}.v1`;
const REGION_IDS = [definition.regionId];

const descriptor = {
  moduleContractId: 'ui-runtime-provider.v1',
  providerId,
  package: `providers/${providerId}`,
  version,
  runtime: 'node',
  type: 'ui-runtime',
  method: 'in-process',
  executionLocation: 'browser-runtime',
  declarationProfile: 'sfx-provider-catalog.v1',
  nativeShape: 'candidate',
  bindingState: 'UNBOUND',
  readiness: { declaration: 'REVIEWABLE', execution: 'HELD' },
  contractStatus: { input: 'DECLARED', output: 'DECLARED' },
  operations: [
    {
      operationId: toolId,
      inputContractId: REQUEST_CONTRACT_ID,
      outputContractId: OUTPUT_CONTRACT_ID,
      effect: 'READ_ONLY',
    },
  ],
};

const REGION_DEFINITIONS = [definition];

const ASSET_SPECS = [
  { kind: 'css', extension: 'css', mediaType: 'text/css', role: 'style' },
  { kind: 'html', extension: 'html', mediaType: 'text/html', role: 'structure' },
  { kind: 'svg', extension: 'svg', mediaType: 'image/svg+xml', role: 'figure' },
];

function digestOf(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function digestOfText(text) {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function declaredAsset(regionId, spec) {
  const path = `assets/${regionId}.${spec.extension}`;
  const content = readFileSync(new URL(path, packageUrl), 'utf8');
  return {
    assetId: `${regionId}.${spec.extension}`,
    kind: spec.kind,
    mediaType: spec.mediaType,
    role: spec.role,
    path,
    bytes: Buffer.byteLength(content, 'utf8'),
    digest: digestOfText(content),
    content,
  };
}

const regions = REGION_DEFINITIONS.map((definition) => ({
  ...definition,
  bindingState: 'UNBOUND',
  readiness: { declaration: 'REVIEWABLE', execution: 'HELD' },
  assets: ASSET_SPECS.map((spec) => declaredAsset(definition.regionId, spec)),
}));

const capabilities = regions.map((region) => ({
  capabilityId: region.capabilityId,
  role: 'PLATFORM',
  platformCapabilityId: region.platformCapabilityId,
  conformanceContractId: OUTPUT_CONTRACT_ID,
  providerId: region.regionProviderId,
  operationId: toolId,
  status: 'PROPOSED',
}));

function manifestRegion(region) {
  const { assets, ...rest } = region;
  return {
    ...rest,
    assets: assets.map(({ content, ...asset }) => asset),
  };
}

const MANIFEST_BODY = {
  contractId: MANIFEST_CONTRACT_ID,
  manifestId: `${definition.regionId}.v1`,
  providerId,
  derivedFrom: 'live-circuit/circuit/explorer.html:180-302',
  capturedAt: '2026-10-08',
  regions: regions.map(manifestRegion),
};

const contentManifest = { ...MANIFEST_BODY, digest: digestOf(MANIFEST_BODY) };

const inputShape = { contractId: REQUEST_CONTRACT_ID, status: 'DECLARED', schema: inputSchema };
const outputShape = { contractId: OUTPUT_CONTRACT_ID, status: 'DECLARED', schema: outputSchema };

const REQUEST_MEMBERS = ['contractId', 'regionId'];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function held(findings) {
  return { disposition: 'HELD', candidate: null, shapeConforms: false, findings };
}

function validate(input, options) {
  const findings = [];
  if (!isObject(input)) {
    return [{ code: 'UI_REGION_REQUEST_INVALID', path: '$', message: 'input must be a JSON object' }];
  }
  const requestBytes = options.requestBytes ?? Buffer.byteLength(JSON.stringify(input));
  if (requestBytes > MAX_REQUEST_BYTES) {
    return [
      {
        code: 'UI_REGION_REQUEST_OVERSIZED',
        path: '$',
        message: `Maximum request size is ${MAX_REQUEST_BYTES} bytes.`,
      },
    ];
  }
  for (const member of Object.keys(input)) {
    if (!REQUEST_MEMBERS.includes(member)) {
      findings.push({
        code: 'UI_REGION_REQUEST_INVALID',
        path: `$.${member}`,
        message: `${member} is not a declared ui-region-request.v1 member`,
      });
    }
  }
  if (input.contractId !== REQUEST_CONTRACT_ID) {
    findings.push({
      code: 'UI_REGION_REQUEST_INVALID',
      path: '$.contractId',
      message: `contractId must be ${REQUEST_CONTRACT_ID}`,
    });
  }
  if (input.regionId === undefined) {
    findings.push({ code: 'UI_REGION_REQUEST_INVALID', path: '$.regionId', message: 'regionId is required' });
  } else if (typeof input.regionId !== 'string') {
    findings.push({ code: 'UI_REGION_REQUEST_INVALID', path: '$.regionId', message: 'regionId must be a string' });
  } else if (!REGION_IDS.includes(input.regionId)) {
    findings.push({
      code: 'UI_REGION_UNKNOWN',
      path: '$.regionId',
      message: `${input.regionId} is not a declared Explorer region`,
    });
  }
  return findings;
}

function buildCandidate(region) {
  const body = {
    contractId: OUTPUT_CONTRACT_ID,
    providerId,
    regionProviderId: region.regionProviderId,
    regionId: region.regionId,
    role: region.role,
    place: region.place,
    basis: region.basis,
    assets: region.assets.map((asset) => ({ ...asset })),
  };
  return { ...body, digest: digestOf(body) };
}

function invoke(input, options = {}) {
  const started = performance.now();
  const requestBytes = options.requestBytes ?? (isObject(input) ? Buffer.byteLength(JSON.stringify(input)) : 0);
  const envelope = (body) => ({
    providerId,
    toolId,
    providerExecution: 'deterministic',
    elapsedMs: Math.round(performance.now() - started),
    requestBytes,
    ...body,
  });
  const findings = validate(input, options);
  if (findings.length > 0) return envelope(held(findings));
  const region = regions.find((candidate) => candidate.regionId === input.regionId);
  return envelope({ disposition: 'AUTHORED', candidate: buildCandidate(region), shapeConforms: true, findings: [] });
}

return {providerId, toolId, MAX_REQUEST_BYTES, REQUEST_CONTRACT_ID, OUTPUT_CONTRACT_ID, MANIFEST_CONTRACT_ID, MANIFEST_ID, REGION_IDS, descriptor, regions, capabilities, contentManifest, inputShape, outputShape, invoke, handle:invoke};

}
