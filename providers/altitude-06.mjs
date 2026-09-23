import { createHash } from 'node:crypto';
import { payloadFromSlices, requestContract, validateAltitudeRequest } from '../src/request-contract.mjs';

export const altitude = 6;
export const altitudeId = 'altitude-6-transformation-ast';
export const altitudeName = 'Transformation AST';
export const providerId = 'sfx-authoring-altitude-06';
export const toolId = 'ast.author';
export const foldedTools = ['ast.normalize', 'ast.repair'];

export const modelPrompt =
  'You are the local model provider at authoring altitude 6 (transformation AST). ' +
  'Author one transformation expression profile json-expression-tree.v1 ($.semantics.expression) for the declared altitude output contract.';

export const inputShape = {
  ...requestContract,
  toolInputContract: { contractId: 'transformation-change.v1', status: 'PROPOSED' },
};

export const outputShape = {
  contractId: 'altitude-6-transformation-ast-output.v1',
  status: 'EXISTING',
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://schemas.agentic-harness.local/contracts/altitude-6-transformation-ast-output.v1.schema.json',
    type: 'object',
    additionalProperties: true,
    required: ['contractId', 'altitude', 'altitudeId', 'altitudeName', 'stub', 'shapeSource', 'canned'],
    properties: {
      contractId: { const: 'altitude-6-transformation-ast-output.v1' },
      altitude: { const: 6 },
      altitudeId: { const: 'altitude-6-transformation-ast' },
      altitudeName: { type: 'string' },
      stub: { const: true },
      shapeSource: { type: 'string' },
      canned: { type: 'object' },
    },
  },
  toolOutputContract: { contractId: 'transformation-change-installed.v1', status: 'PROPOSED' },
};

const DECLARED_CANNED = {
  transformation_id: 'altitude-6-transformation-ast-stub-transform.v1',
  transformation_version_pk: 0,
  expression: { op: 'object', fields: { stub: { op: 'literal', value: true } } },
  normalization: { root: 'object', nodes: 2 },
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

function countNodes(node) {
  if (!isObject(node)) return 0;
  let count = 1;
  if (isObject(node.fields)) {
    for (const child of Object.values(node.fields)) count += countNodes(child);
  }
  for (const member of ['children', 'args', 'arguments', 'items']) {
    if (Array.isArray(node[member])) {
      for (const child of node[member]) count += countNodes(child);
    }
  }
  return count;
}

function buildCanned(input) {
  const payload = payloadFromSlices(input);
  const canned = { ...DECLARED_CANNED };
  if (typeof payload.transformationId === 'string' && payload.transformationId.length > 0) {
    canned.transformation_id = payload.transformationId;
  }
  if (Number.isInteger(payload.transformationVersion)) canned.transformation_version_pk = payload.transformationVersion;
  if (isObject(payload.expression)) {
    canned.expression = payload.expression;
    canned.normalization = { root: payload.expression.op, nodes: countNodes(payload.expression) };
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
    if (payload.transformationId !== undefined && typeof payload.transformationId !== 'string') {
      findings.push({ code: 'INPUT_TRANSFORMATION_ID_INVALID', path: '$.payload.transformationId', message: 'transformationId must be a string when present' });
    }
    if (payload.transformationVersion !== undefined && !Number.isInteger(payload.transformationVersion)) {
      findings.push({ code: 'INPUT_TRANSFORMATION_VERSION_INVALID', path: '$.payload.transformationVersion', message: 'transformationVersion must be an integer when present' });
    }
    if (payload.expression !== undefined) {
      if (!isObject(payload.expression)) {
        findings.push({ code: 'INPUT_EXPRESSION_INVALID', path: '$.payload.expression', message: 'expression must be a json-expression-tree.v1 object when present' });
      } else if (typeof payload.expression.op !== 'string' || payload.expression.op.length === 0) {
        findings.push({ code: 'INPUT_EXPRESSION_OP_MISSING', path: '$.payload.expression.op', message: 'expression.op must be a non-empty operator string' });
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
