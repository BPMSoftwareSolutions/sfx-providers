import { createHash } from 'node:crypto';
import { payloadFromSlices, requestContract, validateAltitudeRequest } from '../../src/request-contract.mjs';

export const altitude = 5;
export const altitudeId = 'altitude-5-semantic-authority-envelope';
export const altitudeName = 'Semantic authority envelope';
export const providerId = 'sfx-authoring-altitude-05';
export const toolId = 'semantics.author';
export const foldedTools = [];

export const modelPrompt =
  'You are the local model provider at authoring altitude 5 (semantic authority envelope). ' +
  'Produce the $.semantics envelope object {address {id, kind, namespace}, format, semantics} for the declared altitude output contract.';

export const inputShape = {
  ...requestContract,
  toolInputContract: { contractId: 'governed-model-response-evidence.v1', status: 'EXISTING' },
};

export const outputShape = {
  contractId: 'altitude-5-semantic-authority-envelope-output.v1',
  status: 'EXISTING',
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://schemas.agentic-harness.local/contracts/altitude-5-semantic-authority-envelope-output.v1.schema.json',
    type: 'object',
    additionalProperties: true,
    required: ['contractId', 'altitude', 'altitudeId', 'altitudeName', 'stub', 'shapeSource', 'canned'],
    properties: {
      contractId: { const: 'altitude-5-semantic-authority-envelope-output.v1' },
      altitude: { const: 5 },
      altitudeId: { const: 'altitude-5-semantic-authority-envelope' },
      altitudeName: { type: 'string' },
      stub: { const: true },
      shapeSource: { type: 'string' },
      canned: { type: 'object' },
    },
  },
  toolOutputContract: { contractId: 'sidefx-semantic-definition.v1', status: 'EXISTING' },
};

const DECLARED_CANNED = {
  address: { id: 'altitude-5-semantic-authority-envelope', kind: 'AUTHORITY', namespace: 'sidefx:stubs' },
  format: 'sidefx-semantic-definition.v1',
  semantics: { envelope: 'stub', altitude: 5 },
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function digestOf(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function held(findings) {
  return { disposition: 'HELD', candidate: null, findings };
}

function buildCanned(input) {
  const payload = payloadFromSlices(input);
  const canned = {
    ...DECLARED_CANNED,
    address: { ...DECLARED_CANNED.address },
    semantics: { ...DECLARED_CANNED.semantics },
  };
  if (isObject(payload.address)) canned.address = { ...canned.address, ...payload.address };
  if (isObject(payload.semantics)) canned.semantics = { ...canned.semantics, ...payload.semantics };
  if (typeof payload.id === 'string' && payload.id.length > 0) canned.address = { ...canned.address, id: payload.id };
  if (typeof payload.kind === 'string' && payload.kind.length > 0) canned.address = { ...canned.address, kind: payload.kind };
  if (typeof payload.namespace === 'string' && payload.namespace.length > 0) canned.address = { ...canned.address, namespace: payload.namespace };
  return { ...canned, documentDigest: digestOf(canned) };
}

export function handle(input, options = {}) {
  const findings = [];
  if (!isObject(input)) {
    return held([{ code: 'INPUT_NOT_OBJECT', path: '$', message: 'input must be a JSON object' }]);
  }
  findings.push(
    ...validateAltitudeRequest(input, {
      altitude,
      toolId,
      knownTools: [toolId, ...foldedTools],
      requestBytes: options.requestBytes,
    }),
  );
  const payload = payloadFromSlices(input);
  if (isObject(payload)) {
    if (payload.address !== undefined && !isObject(payload.address)) {
      findings.push({ code: 'INPUT_ADDRESS_INVALID', path: '$.payload.address', message: 'address must be an object when present' });
    }
    if (isObject(payload.address)) {
      for (const member of ['id', 'kind', 'namespace']) {
        if (payload.address[member] !== undefined && typeof payload.address[member] !== 'string') {
          findings.push({ code: 'INPUT_ADDRESS_MEMBER_INVALID', path: `$.payload.address.${member}`, message: `${member} must be a string when present` });
        }
      }
    }
    if (payload.semantics !== undefined && !isObject(payload.semantics)) {
      findings.push({ code: 'INPUT_SEMANTICS_INVALID', path: '$.payload.semantics', message: 'semantics must be an object when present' });
    }
  }
  if (findings.length > 0) return held(findings);
  return {
    disposition: 'AUTHORED',
    candidate: {
      contractId: outputShape.contractId,
      altitude,
      altitudeId,
      altitudeName,
      stub: true,
      shapeSource: `tool-to-altitude.v1.json#${toolId}`,
      canned: buildCanned(input),
    },
    findings: [],
  };
}

