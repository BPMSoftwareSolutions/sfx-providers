import { createHash } from 'node:crypto';
import { payloadFromSlices, requestContract, validateAltitudeRequest } from '../../src/request-contract.mjs';

export const altitude = 3;
export const altitudeId = 'altitude-3-scenario-io';
export const altitudeName = 'Scenario inputs/events/outcomes';
export const providerId = 'sfx-authoring-altitude-03';
export const toolId = 'scenario.author';
export const foldedTools = [];

export const modelPrompt =
  'You are the local model provider at authoring altitude 3 (scenario I/E/O). ' +
  'Author one scenario version with input, event, outcome faces and port bindings for the declared altitude output contract.';

export const inputShape = {
  ...requestContract,
  toolInputContract: { contractId: 'scenario-authoring-change.v1', status: 'PROPOSED' },
};

export const outputShape = {
  contractId: 'altitude-3-scenario-io-output.v1',
  status: 'EXISTING',
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://schemas.agentic-harness.local/contracts/altitude-3-scenario-io-output.v1.schema.json',
    type: 'object',
    additionalProperties: true,
    required: ['contractId', 'altitude', 'altitudeId', 'altitudeName', 'stub', 'shapeSource', 'canned'],
    properties: {
      contractId: { const: 'altitude-3-scenario-io-output.v1' },
      altitude: { const: 3 },
      altitudeId: { const: 'altitude-3-scenario-io' },
      altitudeName: { type: 'string' },
      stub: { const: true },
      shapeSource: { type: 'string' },
      canned: { type: 'object' },
    },
  },
  toolOutputContract: { contractId: 'scenario-change-installed.v1', status: 'EXISTING' },
};

const FACES = ['input', 'event', 'outcome'];

const DECLARED_CANNED = {
  result_set: 'scenario_change_installed',
  capability_id: 'authoring-altitude-model-stubs',
  scenario_id: 'altitude-3-scenario-io',
  faces: [...FACES],
  portBindings: [{ portId: 'altitude-3-scenario-io-stub-port' }],
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
  const canned = { ...DECLARED_CANNED, faces: [...DECLARED_CANNED.faces], portBindings: [...DECLARED_CANNED.portBindings] };
  if (typeof payload.capabilityId === 'string' && payload.capabilityId.length > 0) canned.capability_id = payload.capabilityId;
  if (typeof payload.scenarioId === 'string' && payload.scenarioId.length > 0) canned.scenario_id = payload.scenarioId;
  if (isObject(payload.scenario) && typeof payload.scenario.scenarioId === 'string' && payload.scenario.scenarioId.length > 0) {
    canned.scenario_id = payload.scenario.scenarioId;
  }
  if (Array.isArray(payload.faces)) canned.faces = [...payload.faces];
  if (Array.isArray(payload.portBindings)) {
    canned.portBindings = payload.portBindings.map((binding) => ({ portId: binding.portId }));
  }
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
    if (payload.capabilityId !== undefined && typeof payload.capabilityId !== 'string') {
      findings.push({ code: 'INPUT_CAPABILITY_ID_INVALID', path: '$.payload.capabilityId', message: 'capabilityId must be a string when present' });
    }
    if (payload.scenario !== undefined && !isObject(payload.scenario)) {
      findings.push({ code: 'INPUT_SCENARIO_INVALID', path: '$.payload.scenario', message: 'scenario must be an object when present' });
    }
    if (isObject(payload.scenario) && payload.scenario.scenarioId !== undefined && typeof payload.scenario.scenarioId !== 'string') {
      findings.push({ code: 'INPUT_SCENARIO_ID_INVALID', path: '$.payload.scenario.scenarioId', message: 'scenario.scenarioId must be a string when present' });
    }
    if (payload.faces !== undefined && (!Array.isArray(payload.faces) || payload.faces.some((face) => typeof face !== 'string'))) {
      findings.push({ code: 'INPUT_FACES_INVALID', path: '$.payload.faces', message: 'faces must be an array of strings when present' });
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

