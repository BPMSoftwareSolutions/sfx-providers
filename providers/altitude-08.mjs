import { createHash } from 'node:crypto';
import { payloadFromSlices, requestContract, validateAltitudeRequest } from '../src/request-contract.mjs';

export const altitude = 8;
export const altitudeId = 'altitude-8-providers-bindings-overlays';
export const altitudeName = 'Providers, bindings, overlays';
export const providerId = 'sfx-authoring-altitude-08';
export const toolId = 'provider.author';
export const foldedTools = ['provider.read', 'overlay.bind'];

export const modelPrompt =
  'You are the local model provider at authoring altitude 8 (providers/bindings/overlays). ' +
  'Author and preflight a provider-binding-change.v1 document (endpoint, credential reference, mapping) for the declared altitude output contract.';

export const inputShape = {
  ...requestContract,
  toolInputContract: { contractId: 'provider-binding-change-request.v1', status: 'EXISTING' },
};

export const outputShape = {
  contractId: 'altitude-8-providers-bindings-overlays-output.v1',
  status: 'EXISTING',
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://schemas.agentic-harness.local/contracts/altitude-8-providers-bindings-overlays-output.v1.schema.json',
    type: 'object',
    additionalProperties: true,
    required: ['contractId', 'altitude', 'altitudeId', 'altitudeName', 'stub', 'shapeSource', 'canned'],
    properties: {
      contractId: { const: 'altitude-8-providers-bindings-overlays-output.v1' },
      altitude: { const: 8 },
      altitudeId: { const: 'altitude-8-providers-bindings-overlays' },
      altitudeName: { type: 'string' },
      stub: { const: true },
      shapeSource: { type: 'string' },
      canned: { type: 'object' },
    },
  },
  toolOutputContract: { contractId: 'provider-binding-change-result.v1', status: 'EXISTING' },
};

const HTTP_METHODS = ['GET', 'POST'];

const DECLARED_CANNED = {
  providerId: 'altitude-8-stub-provider',
  disposition: 'PROVIDER_CHANGE_AUTHORED',
  bindingId: 'altitude-8-providers-bindings-overlays-stub-binding.v1',
  overlay: {
    mechanicId: 'sda-authority-transformation-port.v1',
    providerProfileId: 'sda-semantic-value-graph-provider.v1',
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
  const canned = { ...DECLARED_CANNED, overlay: { ...DECLARED_CANNED.overlay } };
  if (typeof payload.providerId === 'string' && payload.providerId.length > 0) canned.providerId = payload.providerId;
  if (typeof payload.bindingId === 'string' && payload.bindingId.length > 0) canned.bindingId = payload.bindingId;
  if (isObject(payload.endpoint)) canned.endpoint = { ...payload.endpoint };
  if (isObject(payload.credential)) canned.credentialReference = { ...payload.credential };
  if (isObject(payload.overlay)) canned.overlay = { ...canned.overlay, ...payload.overlay };
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
    if (payload.providerId !== undefined && typeof payload.providerId !== 'string') {
      findings.push({ code: 'INPUT_PROVIDER_ID_INVALID', path: '$.payload.providerId', message: 'providerId must be a string when present' });
    }
    if (payload.bindingId !== undefined && typeof payload.bindingId !== 'string') {
      findings.push({ code: 'INPUT_BINDING_ID_INVALID', path: '$.payload.bindingId', message: 'bindingId must be a string when present' });
    }
    if (payload.endpoint !== undefined) {
      if (!isObject(payload.endpoint)) {
        findings.push({ code: 'INPUT_ENDPOINT_INVALID', path: '$.payload.endpoint', message: 'endpoint must be an object when present' });
      } else {
        if (payload.endpoint.host !== undefined && typeof payload.endpoint.host !== 'string') {
          findings.push({ code: 'INPUT_ENDPOINT_HOST_INVALID', path: '$.payload.endpoint.host', message: 'endpoint.host must be a string when present' });
        }
        if (payload.endpoint.method !== undefined && !HTTP_METHODS.includes(payload.endpoint.method)) {
          findings.push({
            code: 'INPUT_ENDPOINT_METHOD_INVALID',
            path: '$.payload.endpoint.method',
            message: `endpoint.method must be one of ${HTTP_METHODS.join('|')} when present`,
          });
        }
      }
    }
    if (payload.credential !== undefined && !isObject(payload.credential)) {
      findings.push({ code: 'INPUT_CREDENTIAL_INVALID', path: '$.payload.credential', message: 'credential must be an object when present' });
    }
    if (payload.overlay !== undefined && !isObject(payload.overlay)) {
      findings.push({ code: 'INPUT_OVERLAY_INVALID', path: '$.payload.overlay', message: 'overlay must be an object when present' });
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
