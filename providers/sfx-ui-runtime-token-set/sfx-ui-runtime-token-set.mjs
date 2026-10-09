import { createHash } from 'node:crypto';

export const providerId = 'sfx-ui-runtime-token-set';
export const toolId = 'ui.tokens.resolve';

export const MAX_REQUEST_BYTES = 16384;
export const REQUEST_CONTRACT_ID = 'ui-token-request.v1';
export const OUTPUT_CONTRACT_ID = 'ui-token-set.v1';
export const TOKEN_SET_ID = 'site.v1';

export const descriptor = {
  moduleContractId: 'ui-runtime-provider.v1',
  providerId,
  package: 'providers/sfx-ui-runtime-token-set',
  version: '0.1.1',
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

export const capabilities = [
  {
    capabilityId: 'resolve-ui-token-set',
    role: 'PLATFORM',
    platformCapabilityId: 'sda-ui-token-set-port.v1',
    conformanceContractId: OUTPUT_CONTRACT_ID,
    status: 'PROPOSED',
  },
];

export const GROUP_IDS = ['surface', 'text', 'accent', 'signal', 'border', 'geometry', 'typography'];

const TOKENS = [
  { name: '--bg', value: '#06111F', kind: 'color', group: 'surface' },
  { name: '--bar', value: 'rgba(2, 13, 25, .96)', kind: 'color', group: 'surface' },
  { name: '--panel', value: 'rgba(5, 21, 34, .94)', kind: 'color', group: 'surface' },
  { name: '--panel-solid', value: '#0A1C2E', kind: 'color', group: 'surface' },
  { name: '--shade', value: 'rgba(3, 16, 28, .70)', kind: 'color', group: 'surface' },
  { name: '--white', value: '#F4F7FB', kind: 'color', group: 'text' },
  { name: '--muted', value: '#B3C5D8', kind: 'color', group: 'text' },
  { name: '--dim', value: '#829AB2', kind: 'color', group: 'text' },
  { name: '--cyan', value: '#72D7EE', kind: 'color', group: 'accent' },
  { name: '--blue', value: '#45A7FF', kind: 'color', group: 'accent' },
  { name: '--green', value: '#4DE0B0', kind: 'color', group: 'signal' },
  { name: '--amber', value: '#F6B94D', kind: 'color', group: 'signal' },
  { name: '--red', value: '#FF5F70', kind: 'color', group: 'signal' },
  { name: '--line', value: '#29435B', kind: 'color', group: 'border' },
  { name: '--radius', value: '10px', kind: 'length', group: 'geometry' },
  { name: '--gutter', value: 'clamp(16px, 2vw, 40px)', kind: 'length', group: 'geometry' },
  { name: 'font', value: '16px/1.5 Arial, Helvetica, sans-serif', kind: 'shorthand', group: 'typography' },
];

const ALIASES = [
  {
    name: '--observation',
    aliasOf: '--cyan',
    status: 'DECLARED_PENDING_CSS',
    basis: 'implementation-strategy.md section 4.0 D7 / gate G7',
  },
];

export const tokenSet = {
  contractId: OUTPUT_CONTRACT_ID,
  tokenSetId: TOKEN_SET_ID,
  derivedFrom: 'live-circuit/circuit/site.css:4-12',
  capturedAt: '2026-10-07',
  tokens: TOKENS,
  aliases: ALIASES,
};

export const inputShape = {
  contractId: REQUEST_CONTRACT_ID,
  status: 'PROPOSED',
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://schemas.agentic-harness.local/contracts/ui-token-request.v1.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['contractId'],
    properties: {
      contractId: { const: REQUEST_CONTRACT_ID },
      tokenSetId: { const: TOKEN_SET_ID },
      groups: { type: 'array', items: { enum: GROUP_IDS }, uniqueItems: true },
      names: { type: 'array', items: { type: 'string' }, uniqueItems: true },
    },
  },
};

export const outputShape = {
  contractId: OUTPUT_CONTRACT_ID,
  status: 'PROPOSED',
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://schemas.agentic-harness.local/contracts/ui-token-set.v1.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['contractId', 'tokenSetId', 'derivedFrom', 'capturedAt', 'tokens', 'aliases', 'digest'],
    properties: {
      contractId: { const: OUTPUT_CONTRACT_ID },
      tokenSetId: { const: TOKEN_SET_ID },
      derivedFrom: { type: 'string' },
      capturedAt: { type: 'string' },
      tokens: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'value', 'kind', 'group'],
          properties: {
            name: { type: 'string' },
            value: { type: 'string' },
            kind: { enum: ['color', 'length', 'shorthand'] },
            group: { enum: GROUP_IDS },
            aliasOf: { type: 'string' },
          },
        },
      },
      aliases: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'aliasOf', 'status', 'basis'],
          properties: {
            name: { type: 'string' },
            aliasOf: { type: 'string' },
            status: { type: 'string' },
            basis: { type: 'string' },
          },
        },
      },
      digest: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' },
    },
  },
};

const REQUEST_MEMBERS = ['contractId', 'tokenSetId', 'groups', 'names'];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function held(findings) {
  return { disposition: 'HELD', candidate: null, shapeConforms: false, findings };
}

function tokenByName(name) {
  return TOKENS.find((token) => token.name === name) ?? null;
}

function aliasByName(name) {
  return ALIASES.find((alias) => alias.name === name) ?? null;
}

function resolveName(name) {
  const token = tokenByName(name);
  if (token) return { ...token };
  const alias = aliasByName(name);
  if (!alias) return null;
  const target = tokenByName(alias.aliasOf);
  if (!target) return null;
  return { ...target, name: alias.name, aliasOf: alias.aliasOf };
}

function selectTokens(names, groups) {
  if (names.length === 0 && groups.length === 0) return TOKENS.map((token) => ({ ...token }));
  const selected = new Map();
  if (names.length > 0) {
    for (const name of names) selected.set(name, resolveName(name));
  } else {
    for (const token of TOKENS) {
      if (groups.includes(token.group)) selected.set(token.name, { ...token });
    }
  }
  if (names.length > 0 && groups.length > 0) {
    for (const token of TOKENS) {
      if (groups.includes(token.group)) selected.set(token.name, { ...token });
    }
  }
  return [...selected.values()];
}

function digestOf(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function buildCandidate(names, groups) {
  const payload = { ...tokenSet, tokens: selectTokens(names, groups) };
  return { ...payload, digest: digestOf(payload) };
}

function validate(input, options) {
  const findings = [];
  if (!isObject(input)) {
    return [{ code: 'UI_TOKEN_REQUEST_INVALID', path: '$', message: 'input must be a JSON object' }];
  }
  const requestBytes = options.requestBytes ?? Buffer.byteLength(JSON.stringify(input));
  if (requestBytes > MAX_REQUEST_BYTES) {
    return [
      {
        code: 'UI_TOKEN_REQUEST_OVERSIZED',
        path: '$',
        message: `Maximum request size is ${MAX_REQUEST_BYTES} bytes.`,
      },
    ];
  }
  for (const member of Object.keys(input)) {
    if (!REQUEST_MEMBERS.includes(member)) {
      findings.push({
        code: 'UI_TOKEN_REQUEST_INVALID',
        path: `$.${member}`,
        message: `${member} is not a declared ui-token-request.v1 member`,
      });
    }
  }
  if (input.contractId !== REQUEST_CONTRACT_ID) {
    findings.push({
      code: 'UI_TOKEN_REQUEST_INVALID',
      path: '$.contractId',
      message: `contractId must be ${REQUEST_CONTRACT_ID}`,
    });
  }
  if (input.tokenSetId !== undefined && input.tokenSetId !== TOKEN_SET_ID) {
    findings.push({
      code: 'UI_TOKEN_SET_UNKNOWN',
      path: '$.tokenSetId',
      message: `${String(input.tokenSetId)} is not a served token set`,
    });
  }
  const groups = input.groups ?? [];
  if (!Array.isArray(groups) || groups.some((group) => typeof group !== 'string')) {
    findings.push({ code: 'UI_TOKEN_REQUEST_INVALID', path: '$.groups', message: 'groups must be an array of strings' });
  } else {
    for (const group of groups) {
      if (!GROUP_IDS.includes(group)) {
        findings.push({ code: 'UI_TOKEN_GROUP_UNKNOWN', path: '$.groups', message: `${group} is not a declared token group` });
      }
    }
  }
  const names = input.names ?? [];
  if (!Array.isArray(names) || names.some((name) => typeof name !== 'string')) {
    findings.push({ code: 'UI_TOKEN_REQUEST_INVALID', path: '$.names', message: 'names must be an array of strings' });
  } else {
    for (const name of names) {
      if (!resolveName(name)) {
        findings.push({ code: 'UI_TOKEN_NAME_UNKNOWN', path: '$.names', message: `${name} is not a declared token or alias` });
      }
    }
  }
  return findings;
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
  const candidate = buildCandidate(input.names ?? [], input.groups ?? []);
  return envelope({ disposition: 'AUTHORED', candidate, shapeConforms: true, findings: [] });
}

export { invoke as handle };
