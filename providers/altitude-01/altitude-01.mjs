import { createHash } from 'node:crypto';
import { payloadFromSlices, requestContract, validateAltitudeRequest } from '../../src/request-contract.mjs';

export const altitude = 1;
export const altitudeId = 'altitude-1-feature-parse';
export const altitudeName = 'Feature parse';
export const providerId = 'sfx-authoring-altitude-01';
export const toolId = 'feature.resolve';
export const foldedTools = ['intent.parse', 'feature.pin'];

export const modelPrompt =
  'You are the local model provider at authoring altitude 1 (feature parse). ' +
  'Parse the caller objective or feature reference into a canonical capability feature ' +
  '(capability, input, featureReference, classification) for the declared altitude output contract.';

export const inputShape = {
  ...requestContract,
  toolInputContract: { contractId: 'capability-feature-authoring-request.v1', status: 'EXISTING' },
};

export const outputShape = {
  contractId: 'altitude-1-feature-parse-output.v1',
  status: 'EXISTING',
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://schemas.agentic-harness.local/contracts/altitude-1-feature-parse-output.v1.schema.json',
    type: 'object',
    additionalProperties: true,
    required: ['contractId', 'altitude', 'altitudeId', 'altitudeName', 'stub', 'shapeSource', 'canned'],
    properties: {
      contractId: { const: 'altitude-1-feature-parse-output.v1' },
      altitude: { const: 1 },
      altitudeId: { const: 'altitude-1-feature-parse' },
      altitudeName: { type: 'string' },
      stub: { const: true },
      shapeSource: { type: 'string' },
      canned: { type: 'object' },
    },
  },
  toolOutputContract: { contractId: 'canonical-capability-feature.v1', status: 'EXISTING' },
};

const DECLARED_CANNED = {
  capability: 'resolve-equity-market-price-evidence',
  input: 'AVGO',
  featureReference: 'features/authoring-altitude-model-stubs.feature',
  classification: 'AUTHOR_PROFILE',
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
  const canned = { ...DECLARED_CANNED };
  if (typeof input.objective === 'string' && input.objective.length > 0) canned.objective = input.objective;
  if (typeof payload.capabilityId === 'string' && payload.capabilityId.length > 0) canned.capability = payload.capabilityId;
  if (typeof payload.input === 'string' && payload.input.length > 0) canned.input = payload.input;
  if (typeof payload.featureReference === 'string' && payload.featureReference.length > 0) canned.featureReference = payload.featureReference;
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
    if (payload.featureReference !== undefined && typeof payload.featureReference !== 'string') {
      findings.push({ code: 'INPUT_FEATURE_REFERENCE_INVALID', path: '$.payload.featureReference', message: 'featureReference must be a string when present' });
    }
    if (payload.input !== undefined && typeof payload.input !== 'string') {
      findings.push({ code: 'INPUT_FEATURE_INPUT_INVALID', path: '$.payload.input', message: 'input must be a string when present' });
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

