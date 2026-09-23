import { createHash } from 'node:crypto';
import { payloadFromSlices, requestContract, validateAltitudeRequest } from '../src/request-contract.mjs';

export const altitude = 9;
export const altitudeId = 'altitude-9-interface-cli-display';
export const altitudeName = 'Interface and CLI display';
export const providerId = 'sfx-authoring-altitude-09';
export const toolId = 'interface.author';
export const foldedTools = [];

export const modelPrompt =
  'You are the local model provider at authoring altitude 9 (interface/CLI display). ' +
  'Author the declared CLI/display mapping $.semantics.cli {input {type, contract, path}, display {select, as}, defaults} for the declared altitude output contract.';

export const inputShape = {
  ...requestContract,
  toolInputContract: { contractId: 'interface-change.v1', status: 'PROPOSED' },
};

export const outputShape = {
  contractId: 'altitude-9-interface-cli-display-output.v1',
  status: 'EXISTING',
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://schemas.agentic-harness.local/contracts/altitude-9-interface-cli-display-output.v1.schema.json',
    type: 'object',
    additionalProperties: true,
    required: ['contractId', 'altitude', 'altitudeId', 'altitudeName', 'stub', 'shapeSource', 'canned'],
    properties: {
      contractId: { const: 'altitude-9-interface-cli-display-output.v1' },
      altitude: { const: 9 },
      altitudeId: { const: 'altitude-9-interface-cli-display' },
      altitudeName: { type: 'string' },
      stub: { const: true },
      shapeSource: { type: 'string' },
      canned: { type: 'object' },
    },
  },
  toolOutputContract: { contractId: 'interface-configured.v1', status: 'PROPOSED' },
};

const INPUT_TYPES = ['json', 'text'];

const DECLARED_CANNED = {
  capabilityId: 'authoring-altitude-model-stubs',
  interfaceId: 'altitude-9-interface-cli-display-cli',
  cli: {
    input: { type: 'text', contract: requestContract.contractId, path: 'objective' },
    display: { select: 'outcome.canned', as: 'json' },
  },
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
    cli: {
      ...DECLARED_CANNED.cli,
      input: { ...DECLARED_CANNED.cli.input },
      display: { ...DECLARED_CANNED.cli.display },
    },
  };
  if (typeof payload.capabilityId === 'string' && payload.capabilityId.length > 0) canned.capabilityId = payload.capabilityId;
  if (typeof payload.interfaceId === 'string' && payload.interfaceId.length > 0) canned.interfaceId = payload.interfaceId;
  if (isObject(payload.cli)) {
    canned.cli = {
      ...canned.cli,
      ...payload.cli,
      input: isObject(payload.cli.input) ? { ...canned.cli.input, ...payload.cli.input } : canned.cli.input,
      display: isObject(payload.cli.display) ? { ...canned.cli.display, ...payload.cli.display } : canned.cli.display,
    };
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
    if (payload.cli !== undefined) {
      if (!isObject(payload.cli)) {
        findings.push({ code: 'INPUT_CLI_INVALID', path: '$.payload.cli', message: 'cli must be an object when present' });
      } else {
        if (payload.cli.input !== undefined && !isObject(payload.cli.input)) {
          findings.push({ code: 'INPUT_CLI_INPUT_INVALID', path: '$.payload.cli.input', message: 'cli.input must be an object when present' });
        }
        if (isObject(payload.cli.input)) {
          if (payload.cli.input.type !== undefined && !INPUT_TYPES.includes(payload.cli.input.type)) {
            findings.push({
              code: 'INPUT_CLI_INPUT_TYPE_INVALID',
              path: '$.payload.cli.input.type',
              message: `cli.input.type must be one of ${INPUT_TYPES.join('|')} when present`,
            });
          }
          if (payload.cli.input.contract !== undefined && typeof payload.cli.input.contract !== 'string') {
            findings.push({ code: 'INPUT_CLI_CONTRACT_INVALID', path: '$.payload.cli.input.contract', message: 'cli.input.contract must be a string when present' });
          }
          if (payload.cli.input.path !== undefined && typeof payload.cli.input.path !== 'string') {
            findings.push({ code: 'INPUT_CLI_PATH_INVALID', path: '$.payload.cli.input.path', message: 'cli.input.path must be a string when present' });
          }
        }
        if (payload.cli.display !== undefined && !isObject(payload.cli.display)) {
          findings.push({ code: 'INPUT_CLI_DISPLAY_INVALID', path: '$.payload.cli.display', message: 'cli.display must be an object when present' });
        }
        if (payload.cli.defaults !== undefined && !isObject(payload.cli.defaults)) {
          findings.push({ code: 'INPUT_CLI_DEFAULTS_INVALID', path: '$.payload.cli.defaults', message: 'cli.defaults must be an object when present' });
        }
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
