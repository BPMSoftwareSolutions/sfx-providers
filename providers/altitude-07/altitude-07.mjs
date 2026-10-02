import { createHash } from 'node:crypto';
import { payloadFromSlices, requestContract, validateAltitudeRequest } from '../../src/request-contract.mjs';

export const altitude = 7;
export const altitudeId = 'altitude-7-execution-authorities-ports';
export const altitudeName = 'Execution authorities and ports';
export const providerId = 'sfx-authoring-altitude-07';
export const toolId = 'authority.author';
export const foldedTools = ['port.bind'];

export const modelPrompt =
  'You are the local model provider at authoring altitude 7 (execution authorities/ports). ' +
  'Author the execution authority version, its ordered operations and each operation port binding or nested scenario invocation for the declared altitude output contract.';

export const inputShape = {
  ...requestContract,
  toolInputContract: { contractId: 'execution-authority-change.v1', status: 'PROPOSED' },
};

export const outputShape = {
  contractId: 'altitude-7-execution-authorities-ports-output.v1',
  status: 'EXISTING',
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://schemas.agentic-harness.local/contracts/altitude-7-execution-authorities-ports-output.v1.schema.json',
    type: 'object',
    additionalProperties: true,
    required: ['contractId', 'altitude', 'altitudeId', 'altitudeName', 'stub', 'shapeSource', 'canned'],
    properties: {
      contractId: { const: 'altitude-7-execution-authorities-ports-output.v1' },
      altitude: { const: 7 },
      altitudeId: { const: 'altitude-7-execution-authorities-ports' },
      altitudeName: { type: 'string' },
      stub: { const: true },
      shapeSource: { type: 'string' },
      canned: { type: 'object' },
    },
  },
  toolOutputContract: { contractId: 'execution-authority-change-installed.v1', status: 'PROPOSED' },
};

const OPERATION_KINDS = ['invoke-port', 'invoke-scenario'];
const ZERO_DIGEST = 'sha256:' + '0'.repeat(63) + '7';

const DECLARED_CANNED = {
  authority_id: 'altitude-7-execution-authorities-ports.v1',
  definition_digest: ZERO_DIGEST,
  operation_count: 1,
  operations: [{ operationId: 'altitude-7-execution-authorities-ports.stub', kind: 'invoke-port' }],
  portBindings: [{ portId: 'altitude-7-execution-authorities-ports-stub-port' }],
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
    operations: DECLARED_CANNED.operations.map((operation) => ({ ...operation })),
    portBindings: DECLARED_CANNED.portBindings.map((binding) => ({ ...binding })),
  };
  if (typeof payload.authorityId === 'string' && payload.authorityId.length > 0) canned.authority_id = payload.authorityId;
  if (Array.isArray(payload.operations)) {
    canned.operations = payload.operations.map((operation) => ({ ...operation }));
    canned.operation_count = canned.operations.length;
  }
  if (Array.isArray(payload.portBindings)) canned.portBindings = payload.portBindings.map((binding) => ({ ...binding }));
  canned.definition_digest = digestOf({ authority_id: canned.authority_id, operations: canned.operations, portBindings: canned.portBindings });
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
    if (payload.authorityId !== undefined && typeof payload.authorityId !== 'string') {
      findings.push({ code: 'INPUT_AUTHORITY_ID_INVALID', path: '$.payload.authorityId', message: 'authorityId must be a string when present' });
    }
    if (payload.operations !== undefined) {
      if (!Array.isArray(payload.operations)) {
        findings.push({ code: 'INPUT_OPERATIONS_INVALID', path: '$.payload.operations', message: 'operations must be an array when present' });
      } else {
        payload.operations.forEach((operation, index) => {
          if (!isObject(operation) || typeof operation.operationId !== 'string' || !OPERATION_KINDS.includes(operation.kind)) {
            findings.push({
              code: 'INPUT_OPERATION_INVALID',
              path: `$.payload.operations[${index}]`,
              message: `each operation must carry operationId and kind in ${OPERATION_KINDS.join('|')}`,
            });
            return;
          }
          if (operation.kind === 'invoke-port' && typeof operation.portId !== 'string') {
            findings.push({ code: 'INPUT_OPERATION_PORT_MISSING', path: `$.payload.operations[${index}].portId`, message: 'invoke-port operations require portId' });
          }
          if (operation.kind === 'invoke-scenario' && typeof operation.targetScenarioId !== 'string') {
            findings.push({
              code: 'INPUT_OPERATION_TARGET_MISSING',
              path: `$.payload.operations[${index}].targetScenarioId`,
              message: 'invoke-scenario operations require targetScenarioId',
            });
          }
        });
      }
    }
    if (payload.portBindings !== undefined) {
      if (!Array.isArray(payload.portBindings)) {
        findings.push({ code: 'INPUT_PORT_BINDINGS_INVALID', path: '$.payload.portBindings', message: 'portBindings must be an array when present' });
      } else {
        payload.portBindings.forEach((binding, index) => {
          if (!isObject(binding) || typeof binding.portId !== 'string' || binding.portId.length === 0) {
            findings.push({
              code: 'INPUT_PORT_BINDING_INVALID',
              path: `$.payload.portBindings[${index}]`,
              message: 'each port binding must be an object with a non-empty portId string',
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

