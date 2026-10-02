import { createHash } from 'node:crypto';
import { payloadFromSlices, requestContract, validateAltitudeRequest } from '../../src/request-contract.mjs';

export const altitude = 11;
export const altitudeId = 'altitude-11-alignment-evaluation';
export const altitudeName = 'Alignment evaluation';
export const providerId = 'sfx-authoring-altitude-11';
export const toolId = 'alignment.evaluate';
export const foldedTools = ['candidate.decide', 'alignment.broadcast'];

export const modelPrompt =
  'You are the local model provider at authoring altitude 11 (alignment evaluation). ' +
  'Evaluate one candidate bundle across the ten alignment dimensions (intent, scenario, semantic-altitude, estate, topology, authority, provider, proof, novelty, admission) and compute convergenceDistance for the declared altitude output contract.';

export const inputShape = {
  ...requestContract,
  toolInputContract: { contractId: 'alignment-evaluation.v1', status: 'EXISTING' },
};

export const outputShape = {
  contractId: 'altitude-11-alignment-evaluation-output.v1',
  status: 'EXISTING',
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://schemas.agentic-harness.local/contracts/altitude-11-alignment-evaluation-output.v1.schema.json',
    type: 'object',
    additionalProperties: true,
    required: ['contractId', 'altitude', 'altitudeId', 'altitudeName', 'stub', 'shapeSource', 'canned'],
    properties: {
      contractId: { const: 'altitude-11-alignment-evaluation-output.v1' },
      altitude: { const: 11 },
      altitudeId: { const: 'altitude-11-alignment-evaluation' },
      altitudeName: { type: 'string' },
      stub: { const: true },
      shapeSource: { type: 'string' },
      canned: { type: 'object' },
    },
  },
  toolOutputContract: { contractId: 'alignment-evaluation-receipt.v1', status: 'PROPOSED' },
};

const DIMENSIONS = [
  'intent',
  'scenario',
  'semantic-altitude',
  'estate',
  'topology',
  'authority',
  'provider',
  'proof',
  'novelty',
  'admission',
];

const DECLARED_CANNED = {
  candidateId: 'altitude-11-stub-candidate',
  alignment: { disposition: 'ALIGNED', altitudes: 11 },
  review: { decision: 'PENDING', reviewerAuthorityId: null },
  contractId: 'alignment-evaluation.v1',
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
    alignment: { ...DECLARED_CANNED.alignment },
    review: { ...DECLARED_CANNED.review },
  };
  if (typeof payload.candidateId === 'string' && payload.candidateId.length > 0) canned.candidateId = payload.candidateId;
  if (typeof payload.bundleDigest === 'string' && payload.bundleDigest.length > 0) canned.bundleDigest = payload.bundleDigest;
  const dimensions = isObject(payload.dimensions) ? payload.dimensions : {};
  const evaluated = {};
  const missing = [];
  for (const dimension of DIMENSIONS) {
    if (isObject(dimensions[dimension])) evaluated[dimension] = dimensions[dimension];
    else {
      evaluated[dimension] = {};
      missing.push(dimension);
    }
  }
  const convergenceDistance = missing.reduce((distance, dimension) => distance + (dimension === 'admission' ? 2 : 1), 0);
  canned.dimensions = evaluated;
  canned.convergenceDistance = convergenceDistance;
  canned.alignment = {
    disposition: convergenceDistance === 0 ? 'ALIGNED' : 'UNALIGNED',
    altitudes: 11,
    missingDimensions: missing,
  };
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
    if (payload.candidateId !== undefined && typeof payload.candidateId !== 'string') {
      findings.push({ code: 'INPUT_CANDIDATE_ID_INVALID', path: '$.payload.candidateId', message: 'candidateId must be a string when present' });
    }
    if (payload.bundleDigest !== undefined && typeof payload.bundleDigest !== 'string') {
      findings.push({ code: 'INPUT_BUNDLE_DIGEST_INVALID', path: '$.payload.bundleDigest', message: 'bundleDigest must be a string when present' });
    }
    if (payload.dimensions !== undefined && !isObject(payload.dimensions)) {
      findings.push({ code: 'INPUT_DIMENSIONS_INVALID', path: '$.payload.dimensions', message: 'dimensions must be an object when present' });
    }
    if (isObject(payload.dimensions)) {
      for (const [dimension, value] of Object.entries(payload.dimensions)) {
        if (!DIMENSIONS.includes(dimension)) {
          findings.push({ code: 'INPUT_DIMENSION_UNKNOWN', path: `$.payload.dimensions.${dimension}`, message: 'unknown alignment dimension' });
        } else if (!isObject(value)) {
          findings.push({ code: 'INPUT_DIMENSION_INVALID', path: `$.payload.dimensions.${dimension}`, message: 'each dimension must be an object' });
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

