import { Buffer } from 'node:buffer';

export const REQUEST_CONTRACT_ID = 'altitude-model-request.v1';
export const MAX_REQUEST_BYTES = 256 * 1024;
export const MAX_PROMPT_SLICE_BYTES = 64 * 1024;

export const EMBEDDED_CONTEXT_MEMBERS = Object.freeze([
  'graphSource',
  'authority',
  'catalog',
  'plan',
  'currentInvocationRequest',
]);

export const COMPACT_REQUEST_MEMBERS = Object.freeze([
  'altitude',
  'toolId',
  'objective',
  'inputContractId',
  'contextRefs',
  'contextSlices',
]);

export const requestContract = {
  contractId: REQUEST_CONTRACT_ID,
  status: 'PROPOSED',
  description:
    'Compact altitude request: altitude, toolId, declared objective and input contract, contextRefs as pinned handles, and contextSlices as bounded selections. Embedded context members are refused with ALTITUDE_REQUEST_EMBEDDED_CONTEXT; bodies over 256 KB are refused with ALTITUDE_REQUEST_OVERSIZED before any model call.',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['altitude', 'toolId', 'objective', 'inputContractId'],
    properties: {
      altitude: { type: ['integer', 'string'] },
      toolId: { type: 'string', minLength: 1 },
      objective: { type: 'string', minLength: 1 },
      inputContractId: { type: 'string', minLength: 1 },
      contextRefs: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id'],
          properties: {
            kind: { type: 'string' },
            id: { type: 'string', minLength: 1 },
            digest: { type: 'string' },
          },
        },
      },
      contextSlices: {
        type: 'array',
        items: {
          type: 'object',
          required: ['ref', 'document'],
          properties: {
            ref: { type: 'string', minLength: 1 },
            document: {},
          },
        },
      },
    },
  },
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function has(object, member) {
  return Object.prototype.hasOwnProperty.call(object, member);
}

export function requestBytesOf(value) {
  return Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8');
}

export function validateAltitudeRequest(input, context = {}) {
  const findings = [];
  if (!isPlainObject(input)) {
    findings.push({ code: 'INPUT_NOT_OBJECT', path: '$', message: 'input must be a JSON object' });
    return findings;
  }
  const bytes =
    Number.isInteger(context.requestBytes) && context.requestBytes >= 0
      ? context.requestBytes
      : requestBytesOf(input);
  if (bytes > MAX_REQUEST_BYTES) {
    findings.push({
      code: 'ALTITUDE_REQUEST_OVERSIZED',
      path: '$',
      message: `request is ${bytes} bytes; ${REQUEST_CONTRACT_ID} caps requests at ${MAX_REQUEST_BYTES} bytes (256 KB)`,
    });
    return findings;
  }
  for (const member of EMBEDDED_CONTEXT_MEMBERS) {
    if (has(input, member)) {
      findings.push({
        code: 'ALTITUDE_REQUEST_EMBEDDED_CONTEXT',
        path: `$.${member}`,
        message: `embedded context member ${member} is refused; send a contextRefs handle or a bounded contextSlice instead`,
      });
    }
  }
  for (const member of Object.keys(input)) {
    if (!COMPACT_REQUEST_MEMBERS.includes(member) && !EMBEDDED_CONTEXT_MEMBERS.includes(member)) {
      findings.push({
        code: 'ALTITUDE_REQUEST_UNKNOWN_MEMBER',
        path: `$.${member}`,
        message: `${REQUEST_CONTRACT_ID} accepts only ${COMPACT_REQUEST_MEMBERS.join(', ')}`,
      });
    }
  }
  for (const member of ['altitude', 'toolId', 'objective', 'inputContractId']) {
    if (!has(input, member)) {
      findings.push({
        code: 'ALTITUDE_REQUEST_MEMBER_MISSING',
        path: `$.${member}`,
        message: `${member} is required by ${REQUEST_CONTRACT_ID}`,
      });
    }
  }
  if (has(input, 'objective') && (typeof input.objective !== 'string' || input.objective.length === 0)) {
    findings.push({ code: 'ALTITUDE_REQUEST_OBJECTIVE_INVALID', path: '$.objective', message: 'objective must be a non-empty string' });
  }
  if (has(input, 'inputContractId') && (typeof input.inputContractId !== 'string' || input.inputContractId.length === 0)) {
    findings.push({
      code: 'ALTITUDE_REQUEST_INPUT_CONTRACT_INVALID',
      path: '$.inputContractId',
      message: 'inputContractId must be a non-empty string',
    });
  }
  if (has(input, 'altitude') && context.altitude !== undefined) {
    const declared = Number.parseInt(String(input.altitude), 10);
    if (!Number.isInteger(declared) || declared !== context.altitude) {
      findings.push({
        code: 'ALTITUDE_REQUEST_ALTITUDE_MISMATCH',
        path: '$.altitude',
        message: `altitude must match provider altitude ${context.altitude}`,
      });
    }
  }
  if (has(input, 'toolId') && context.toolId !== undefined) {
    const known = Array.isArray(context.knownTools) && context.knownTools.length > 0 ? context.knownTools : [context.toolId];
    if (typeof input.toolId !== 'string' || !known.includes(input.toolId)) {
      findings.push({ code: 'ALTITUDE_REQUEST_TOOL_MISMATCH', path: '$.toolId', message: `toolId must be one of ${known.join(', ')}` });
    }
  }
  if (has(input, 'contextRefs')) {
    if (!Array.isArray(input.contextRefs)) {
      findings.push({ code: 'ALTITUDE_REQUEST_CONTEXT_REFS_INVALID', path: '$.contextRefs', message: 'contextRefs must be an array when present' });
    } else {
      input.contextRefs.forEach((ref, index) => {
        if (!isPlainObject(ref) || typeof ref.id !== 'string' || ref.id.length === 0) {
          findings.push({
            code: 'ALTITUDE_REQUEST_CONTEXT_REFS_INVALID',
            path: `$.contextRefs[${index}]`,
            message: 'each contextRef must be an object with a non-empty id',
          });
          return;
        }
        for (const member of ['kind', 'digest']) {
          if (ref[member] !== undefined && typeof ref[member] !== 'string') {
            findings.push({
              code: 'ALTITUDE_REQUEST_CONTEXT_REFS_INVALID',
              path: `$.contextRefs[${index}].${member}`,
              message: `${member} must be a string when present`,
            });
          }
        }
      });
    }
  }
  if (has(input, 'contextSlices')) {
    if (!Array.isArray(input.contextSlices)) {
      findings.push({ code: 'ALTITUDE_REQUEST_CONTEXT_SLICES_INVALID', path: '$.contextSlices', message: 'contextSlices must be an array when present' });
    } else {
      input.contextSlices.forEach((slice, index) => {
        if (!isPlainObject(slice) || typeof slice.ref !== 'string' || slice.ref.length === 0 || !has(slice, 'document')) {
          findings.push({
            code: 'ALTITUDE_REQUEST_CONTEXT_SLICES_INVALID',
            path: `$.contextSlices[${index}]`,
            message: 'each contextSlice must carry a non-empty ref and a document',
          });
        }
      });
    }
  }
  return findings;
}

export function payloadFromSlices(input) {
  const payload = {};
  if (!isPlainObject(input) || !Array.isArray(input.contextSlices)) return payload;
  for (const slice of input.contextSlices) {
    if (isPlainObject(slice) && isPlainObject(slice.document)) Object.assign(payload, slice.document);
  }
  return payload;
}

export function boundedSlices(input, maxBytes = MAX_PROMPT_SLICE_BYTES) {
  const slices = [];
  const omitted = [];
  if (!isPlainObject(input) || !Array.isArray(input.contextSlices)) return { slices, omitted };
  let used = 0;
  for (const slice of input.contextSlices) {
    if (!isPlainObject(slice) || typeof slice.ref !== 'string') continue;
    const entry = { ref: slice.ref, document: slice.document };
    const size = requestBytesOf(entry);
    if (used + size > maxBytes) {
      omitted.push(slice.ref);
      continue;
    }
    slices.push(entry);
    used += size;
  }
  return { slices, omitted };
}
