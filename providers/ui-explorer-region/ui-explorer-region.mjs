import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const providerId = 'sfx-ui-explorer-region';
export const toolId = 'ui.region.load';

export const MAX_REQUEST_BYTES = 16384;
export const REQUEST_CONTRACT_ID = 'ui-region-request.v1';
export const OUTPUT_CONTRACT_ID = 'ui-region-content.v1';
export const MANIFEST_CONTRACT_ID = 'ui-content-manifest.v1';
export const MANIFEST_ID = 'explorer.v1';
export const REGION_IDS = ['header', 'left-sidebar', 'middle', 'right-sidebar'];

export const descriptor = {
  moduleContractId: 'ui-runtime-provider.v1',
  providerId,
  package: 'providers/ui-explorer-region',
  version: '0.1.0',
  runtime: 'node',
  type: 'ui-runtime',
  method: 'in-process',
  executionLocation: 'browser-runtime',
  declarationProfile: 'sfx-provider-catalog.v1',
  nativeShape: 'candidate',
  bindingState: 'UNBOUND',
  readiness: { declaration: 'REVIEWABLE', execution: 'HELD' },
  contractStatus: { input: 'PROPOSED', output: 'PROPOSED' },
  operations: [
    {
      operationId: toolId,
      inputContractId: REQUEST_CONTRACT_ID,
      outputContractId: OUTPUT_CONTRACT_ID,
      effect: 'READ_ONLY',
    },
  ],
};

const REGION_DEFINITIONS = [
  {
    regionId: 'header',
    regionProviderId: 'sfx-ui-explorer-region-header',
    capabilityId: 'load-explorer-region-header',
    platformCapabilityId: 'sda-ui-explorer-region-header-port.v1',
    role: 'shell-chrome',
    place: 1,
    basis: 'ui-circuit-blueprint-strategy.md:67; live-circuit/circuit/explorer.html:180-186',
  },
  {
    regionId: 'left-sidebar',
    regionProviderId: 'sfx-ui-explorer-region-left-sidebar',
    capabilityId: 'load-explorer-region-left-sidebar',
    platformCapabilityId: 'sda-ui-explorer-region-left-sidebar-port.v1',
    role: 'navigate-and-select',
    place: 2,
    basis: 'ui-circuit-blueprint-strategy.md:68; live-circuit/circuit/explorer.html:188-191',
  },
  {
    regionId: 'middle',
    regionProviderId: 'sfx-ui-explorer-region-middle',
    capabilityId: 'load-explorer-region-middle',
    platformCapabilityId: 'sda-ui-explorer-region-middle-port.v1',
    role: 'scenario-circuit-canvas-and-execution',
    place: 3,
    basis: 'ui-circuit-blueprint-strategy.md:69; live-circuit/circuit/explorer.html:193-257,302',
  },
  {
    regionId: 'right-sidebar',
    regionProviderId: 'sfx-ui-explorer-region-right-sidebar',
    capabilityId: 'load-explorer-region-right-sidebar',
    platformCapabilityId: 'sda-ui-explorer-region-right-sidebar-port.v1',
    role: 'context-inspection-and-evidence',
    place: 4,
    basis: 'ui-circuit-blueprint-strategy.md:70; live-circuit/circuit/explorer.html:259-300',
  },
];

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
  const content = readFileSync(new URL(path, import.meta.url), 'utf8');
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

export const regions = REGION_DEFINITIONS.map((definition) => ({
  ...definition,
  bindingState: 'UNBOUND',
  readiness: { declaration: 'REVIEWABLE', execution: 'HELD' },
  assets: ASSET_SPECS.map((spec) => declaredAsset(definition.regionId, spec)),
}));

export const capabilities = regions.map((region) => ({
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
  manifestId: MANIFEST_ID,
  providerId,
  derivedFrom: 'live-circuit/circuit/explorer.html:180-302',
  capturedAt: '2026-10-08',
  regions: regions.map(manifestRegion),
};

export const contentManifest = { ...MANIFEST_BODY, digest: digestOf(MANIFEST_BODY) };

export const inputShape = {
  contractId: REQUEST_CONTRACT_ID,
  status: 'PROPOSED',
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://schemas.agentic-harness.local/contracts/ui-region-request.v1.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['contractId', 'regionId'],
    properties: {
      contractId: { const: REQUEST_CONTRACT_ID },
      regionId: { enum: REGION_IDS },
    },
  },
};

const ASSET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['assetId', 'kind', 'mediaType', 'role', 'path', 'bytes', 'digest'],
  properties: {
    assetId: { type: 'string' },
    kind: { enum: ['css', 'html', 'svg'] },
    mediaType: { enum: ['text/css', 'text/html', 'image/svg+xml'] },
    role: { enum: ['style', 'structure', 'figure'] },
    path: { type: 'string', pattern: '^assets/[a-z-]+\\.(css|html|svg)$' },
    bytes: { type: 'integer', minimum: 1 },
    digest: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' },
  },
};

export const outputShape = {
  contractId: OUTPUT_CONTRACT_ID,
  status: 'PROPOSED',
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://schemas.agentic-harness.local/contracts/ui-region-content.v1.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['contractId', 'providerId', 'regionProviderId', 'regionId', 'role', 'place', 'basis', 'assets', 'digest'],
    properties: {
      contractId: { const: OUTPUT_CONTRACT_ID },
      providerId: { const: providerId },
      regionProviderId: { type: 'string' },
      regionId: { enum: REGION_IDS },
      role: { type: 'string' },
      place: { type: 'integer', minimum: 1, maximum: 4 },
      basis: { type: 'string' },
      assets: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          ...ASSET_SCHEMA,
          required: [...ASSET_SCHEMA.required, 'content'],
          properties: { ...ASSET_SCHEMA.properties, content: { type: 'string', minLength: 1 } },
        },
      },
      digest: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' },
    },
  },
};

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

export function invoke(input, options = {}) {
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

export { invoke as handle };
