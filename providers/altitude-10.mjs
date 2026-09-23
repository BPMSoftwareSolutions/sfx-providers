import { createHash } from 'node:crypto';
import { payloadFromSlices, requestContract, validateAltitudeRequest } from '../src/request-contract.mjs';

export const altitude = 10;
export const altitudeId = 'altitude-10-fixtures-proof';
export const altitudeName = 'Fixtures and proof';
export const providerId = 'sfx-authoring-altitude-10';
export const toolId = 'fixture.author';
export const foldedTools = ['proof.obligation.author'];

export const modelPrompt =
  'You are the local model provider at authoring altitude 10 (fixtures/proof obligations). ' +
  'Author consumer-capability-fixtures.v1 fixtures {fixtureId, input, expected {disposition, terminalScenarioId, scenarioSequence, outcomeAssertions}} for the declared altitude output contract.';

export const inputShape = {
  ...requestContract,
  toolInputContract: { contractId: 'consumer-capability-fixtures.v1', status: 'EXISTING' },
};

export const outputShape = {
  contractId: 'altitude-10-fixtures-proof-output.v1',
  status: 'EXISTING',
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://schemas.agentic-harness.local/contracts/altitude-10-fixtures-proof-output.v1.schema.json',
    type: 'object',
    additionalProperties: true,
    required: ['contractId', 'altitude', 'altitudeId', 'altitudeName', 'stub', 'shapeSource', 'canned'],
    properties: {
      contractId: { const: 'altitude-10-fixtures-proof-output.v1' },
      altitude: { const: 10 },
      altitudeId: { const: 'altitude-10-fixtures-proof' },
      altitudeName: { type: 'string' },
      stub: { const: true },
      shapeSource: { type: 'string' },
      canned: { type: 'object' },
    },
  },
  toolOutputContract: { contractId: 'fixture-installed.v1', status: 'PROPOSED' },
};

const DECLARED_CANNED = {
  fixture_id: 'altitude-10-stub-fixture',
  input: { contractId: requestContract.contractId },
  expected: { disposition: 'terminated', scenarioSequence: ['altitude-10-fixtures-proof'] },
  fixtureProfile: 'consumer-capability-fixtures.v1',
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
    input: { ...DECLARED_CANNED.input },
    expected: { ...DECLARED_CANNED.expected },
  };
  if (typeof payload.fixtureId === 'string' && payload.fixtureId.length > 0) canned.fixture_id = payload.fixtureId;
  if (isObject(payload.fixture)) {
    if (typeof payload.fixture.fixtureId === 'string' && payload.fixture.fixtureId.length > 0) canned.fixture_id = payload.fixture.fixtureId;
    if (isObject(payload.fixture.input)) canned.input = payload.fixture.input;
    if (isObject(payload.fixture.expected)) canned.expected = payload.fixture.expected;
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
    if (payload.fixtureId !== undefined && typeof payload.fixtureId !== 'string') {
      findings.push({ code: 'INPUT_FIXTURE_ID_INVALID', path: '$.payload.fixtureId', message: 'fixtureId must be a string when present' });
    }
    if (payload.fixture !== undefined) {
      if (!isObject(payload.fixture)) {
        findings.push({ code: 'INPUT_FIXTURE_INVALID', path: '$.payload.fixture', message: 'fixture must be an object when present' });
      } else {
        if (payload.fixture.input !== undefined && !isObject(payload.fixture.input)) {
          findings.push({ code: 'INPUT_FIXTURE_INPUT_INVALID', path: '$.payload.fixture.input', message: 'fixture.input must be an object when present' });
        }
        if (payload.fixture.expected !== undefined && !isObject(payload.fixture.expected)) {
          findings.push({ code: 'INPUT_FIXTURE_EXPECTED_INVALID', path: '$.payload.fixture.expected', message: 'fixture.expected must be an object when present' });
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
