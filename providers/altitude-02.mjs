import { createHash } from 'node:crypto';
import { payloadFromSlices, requestContract, validateAltitudeRequest } from '../src/request-contract.mjs';

export const altitude = 2;
export const altitudeId = 'altitude-2-capability-meaning';
export const altitudeName = 'Capability meaning';
export const providerId = 'sfx-authoring-altitude-02';
export const toolId = 'meaning.author';
export const foldedTools = [];

export const modelPrompt =
  'You are the local model provider at authoring altitude 2 (capability meaning). ' +
  'Author the capability meaning: name, userStory {actor, intent, outcome} and ' +
  'experience {experienceId, actor, promise, observableConditions[]} for the declared altitude output contract.';

export const inputShape = {
  ...requestContract,
  toolInputContract: { contractId: 'bounded-scenario-meaning-request.v1', status: 'EXISTING' },
};

export const outputShape = {
  contractId: 'altitude-2-capability-meaning-output.v1',
  status: 'EXISTING',
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://schemas.agentic-harness.local/contracts/altitude-2-capability-meaning-output.v1.schema.json',
    type: 'object',
    additionalProperties: true,
    required: ['contractId', 'altitude', 'altitudeId', 'altitudeName', 'stub', 'shapeSource', 'canned'],
    properties: {
      contractId: { const: 'altitude-2-capability-meaning-output.v1' },
      altitude: { const: 2 },
      altitudeId: { const: 'altitude-2-capability-meaning' },
      altitudeName: { type: 'string' },
      stub: { const: true },
      shapeSource: { type: 'string' },
      canned: { type: 'object' },
    },
  },
  toolOutputContract: { contractId: 'scenario-authoring-outcome.v1', status: 'EXISTING' },
};

const ZERO_DIGEST = 'sha256:' + '0'.repeat(63) + '2';

const DECLARED_CANNED = {
  capabilityId: 'authoring-altitude-model-stubs',
  meaning: {
    name: 'Declared model stubs at every authoring altitude',
    userStory: { actor: 'caller', intent: 'author capability meaning', outcome: 'meaning observable' },
    experience: { promise: 'stub', observableConditions: ['stub-condition'] },
  },
  definitionDigest: ZERO_DIGEST,
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
  const canned = { ...DECLARED_CANNED, meaning: { ...DECLARED_CANNED.meaning } };
  if (typeof payload.capabilityId === 'string' && payload.capabilityId.length > 0) canned.capabilityId = payload.capabilityId;
  if (isObject(payload.meaning)) {
    canned.meaning = { ...canned.meaning, ...payload.meaning };
    canned.definitionDigest = digestOf(canned.meaning);
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
    if (payload.meaning !== undefined && !isObject(payload.meaning)) {
      findings.push({ code: 'INPUT_MEANING_INVALID', path: '$.payload.meaning', message: 'meaning must be an object when present' });
    }
    if (isObject(payload.meaning) && payload.meaning.name !== undefined && typeof payload.meaning.name !== 'string') {
      findings.push({ code: 'INPUT_MEANING_NAME_INVALID', path: '$.payload.meaning.name', message: 'meaning.name must be a string when present' });
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
