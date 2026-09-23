import { createHash } from 'node:crypto';
import { payloadFromSlices, requestContract, validateAltitudeRequest } from '../src/request-contract.mjs';

export const altitude = 4;
export const altitudeId = 'altitude-4-contracts-schemas';
export const altitudeName = 'Contracts and schemas';
export const providerId = 'sfx-authoring-altitude-04';
export const toolId = 'contract.author';
export const foldedTools = ['contract.validate'];

export const modelPrompt =
  'You are the local model provider at authoring altitude 4 (contracts/schemas). ' +
  'Author one JSON Schema 2020-12 contract {id, schema} and its face bindings for the declared altitude output contract.';

export const inputShape = {
  ...requestContract,
  toolInputContract: { contractId: 'contract-change.v1', status: 'PROPOSED' },
};

export const outputShape = {
  contractId: 'altitude-4-contracts-schemas-output.v1',
  status: 'EXISTING',
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://schemas.agentic-harness.local/contracts/altitude-4-contracts-schemas-output.v1.schema.json',
    type: 'object',
    additionalProperties: true,
    required: ['contractId', 'altitude', 'altitudeId', 'altitudeName', 'stub', 'shapeSource', 'canned'],
    properties: {
      contractId: { const: 'altitude-4-contracts-schemas-output.v1' },
      altitude: { const: 4 },
      altitudeId: { const: 'altitude-4-contracts-schemas' },
      altitudeName: { type: 'string' },
      stub: { const: true },
      shapeSource: { type: 'string' },
      canned: { type: 'object' },
    },
  },
  toolOutputContract: { contractId: 'contract-change-installed.v1', status: 'PROPOSED' },
};

const ZERO_DIGEST = 'sha256:' + '0'.repeat(63) + '4';
const FACES = ['input', 'outcome'];

const DECLARED_CANNED = {
  contract_id: 'altitude-4-contracts-schemas-output.v1',
  definition_digest: ZERO_DIGEST,
  schema_digest: ZERO_DIGEST,
  faceBindings: [{ scenarioId: 'altitude-4-contracts-schemas', face: 'input' }],
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
    faceBindings: DECLARED_CANNED.faceBindings.map((binding) => ({ ...binding })),
  };
  if (typeof payload.contractId === 'string' && payload.contractId.length > 0) canned.contract_id = payload.contractId;
  if (isObject(payload.schema)) {
    const schemaDigest = digestOf(payload.schema);
    canned.schema_digest = schemaDigest;
    canned.definition_digest = schemaDigest;
    canned.schema = payload.schema;
  }
  if (Array.isArray(payload.faceBindings)) canned.faceBindings = payload.faceBindings.map((binding) => ({ ...binding }));
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
    if (payload.contractId !== undefined && typeof payload.contractId !== 'string') {
      findings.push({ code: 'INPUT_CONTRACT_ID_INVALID', path: '$.payload.contractId', message: 'contractId must be a string when present' });
    }
    if (payload.schema !== undefined) {
      if (!isObject(payload.schema)) {
        findings.push({ code: 'INPUT_SCHEMA_INVALID', path: '$.payload.schema', message: 'schema must be a JSON Schema object when present' });
      } else {
        if (typeof payload.schema.$schema !== 'string') {
          findings.push({ code: 'INPUT_SCHEMA_META_MISSING', path: '$.payload.schema.$schema', message: 'schema.$schema must be a string' });
        }
        if (typeof payload.schema.$id !== 'string') {
          findings.push({ code: 'INPUT_SCHEMA_ID_MISSING', path: '$.payload.schema.$id', message: 'schema.$id must be a string' });
        }
      }
    }
    if (payload.faceBindings !== undefined) {
      if (!Array.isArray(payload.faceBindings)) {
        findings.push({ code: 'INPUT_FACE_BINDINGS_INVALID', path: '$.payload.faceBindings', message: 'faceBindings must be an array when present' });
      } else {
        payload.faceBindings.forEach((binding, index) => {
          if (!isObject(binding) || typeof binding.scenarioId !== 'string' || !FACES.includes(binding.face)) {
            findings.push({
              code: 'INPUT_FACE_BINDING_INVALID',
              path: `$.payload.faceBindings[${index}]`,
              message: `each face binding must carry scenarioId and face in ${FACES.join('|')}`,
            });
          }
        });
      }
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
