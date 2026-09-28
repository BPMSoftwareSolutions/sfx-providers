#!/usr/bin/env node
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { boundedSlices, MAX_REQUEST_BYTES, REQUEST_CONTRACT_ID, requestBytesOf } from './src/request-contract.mjs';
import * as audioProvider from './providers/audio-to-text.mjs';
import { createAudioRequestHandler } from './src/audio-http.mjs';

import * as circuitProvider from './providers/circuit-presentation.mjs';
import { createCircuitRequestHandler } from './src/circuit-presentation/http.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 8790;
const DEFAULT_CERT_PASSWORD = 'sfx-providers';
const CERT_PFX = path.join(here, 'certs', 'localhost.pfx');
const GEMINI_MODEL = 'gemini-2.5-pro';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const ALTITUDE_COUNT = 11;
const MODEL_TIMEOUT_MS = 60000;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

function matchesType(value, type) {
  switch (type) {
    case 'object':
      return isPlainObject(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'integer':
      return Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return true;
  }
}

function validateSchema(value, schema, pointer = '$') {
  const findings = [];
  if (!isPlainObject(schema)) return findings;
  if ('const' in schema && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    findings.push({ code: 'CONST_MISMATCH', path: pointer, message: `expected const ${JSON.stringify(schema.const)}` });
  }
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => matchesType(value, type))) {
      findings.push({ code: 'TYPE_MISMATCH', path: pointer, message: `expected type ${types.join('|')}` });
    }
  }
  if (isPlainObject(value)) {
    if (Array.isArray(schema.required)) {
      for (const member of schema.required) {
        if (!(member in value)) {
          findings.push({ code: 'REQUIRED_MISSING', path: `${pointer}.${member}`, message: 'required member missing' });
        }
      }
    }
    if (isPlainObject(schema.properties)) {
      for (const [member, subSchema] of Object.entries(schema.properties)) {
        if (member in value) findings.push(...validateSchema(value[member], subSchema, `${pointer}.${member}`));
      }
    }
  }
  return findings;
}

function readJsonBody(req, maxBytes = MAX_REQUEST_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let exceeded = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        exceeded = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => {
      const text = exceeded ? '' : Buffer.concat(chunks).toString('utf8').trim();
      resolve({ text, bytes: size, exceeded });
    });
  });
}

function buildModelPrompt(provider, input) {
  const refs = Array.isArray(input.contextRefs)
    ? input.contextRefs.map((ref) => `${ref.kind ?? 'ref'}:${ref.id ?? ref.digest ?? 'unknown'}`)
    : [];
  const { slices, omitted } = boundedSlices(input);
  const lines = [
    provider.modelPrompt ?? `Author the ${provider.altitudeName} artifact for tool ${provider.toolId}.`,
    `Tool contract: ${provider.toolId} / ${input.inputContractId ?? provider.inputShape.toolInputContract?.contractId ?? 'unspecified'}.`,
    `Objective: ${input.objective}`,
    `Context refs (pinned handles; bodies are not inlined): ${refs.length > 0 ? refs.join(', ') : 'none'}.`,
    `Bounded context slices: ${slices.length > 0 ? JSON.stringify(slices) : 'none'}.`,
    `Return one JSON object conforming to the declared contract ${provider.outputShape.contractId}.`,
    'Required top-level members: contractId, altitude, altitudeId, altitudeName, stub, shapeSource, canned.',
    'The canned member carries the altitude artifact. Do not add commentary or markdown fences.',
  ];
  if (omitted.length > 0) {
    lines.push(`Context slices omitted beyond the prompt budget: ${omitted.join(', ')}.`);
  }
  return lines.join('\n');
}

async function callGemini(provider, input, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildModelPrompt(provider, input) }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      return { attempted: true, ok: false, status: response.status, message: `gemini_status_${response.status}` };
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { attempted: true, ok: false, status: response.status, message: 'gemini_envelope_not_json' };
    }
    const parts = parsed?.candidates?.[0]?.content?.parts;
    const reply = Array.isArray(parts)
      ? parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).filter(Boolean).join('\n')
      : '';
    if (reply.length === 0) {
      return { attempted: true, ok: false, status: response.status, message: 'gemini_empty_response' };
    }
    let output;
    try {
      output = JSON.parse(reply);
    } catch {
      output = { text: reply };
    }
    return { attempted: true, ok: true, status: response.status, model: GEMINI_MODEL, output };
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError' ? 'gemini_timeout' : 'gemini_fetch_failed';
    return { attempted: true, ok: false, status: null, message };
  } finally {
    clearTimeout(timer);
  }
}

async function invokeProvider(provider, requestedToolId, input, apiKey, requestBytes) {
  const started = performance.now();
  let outcome;
  try {
    outcome = await provider.handle(input, { requestBytes });
  } catch (error) {
    outcome = {
      disposition: 'HELD',
      candidate: null,
      findings: [{ code: 'PROVIDER_EXCEPTION', path: '$', message: error instanceof Error ? error.message : String(error) }],
    };
  }

  let providerExecution = 'stub';
  let modelCall = null;
  if (outcome.disposition === 'AUTHORED' && apiKey) {
    modelCall = await callGemini(provider, input, apiKey);
    if (modelCall.ok) {
      providerExecution = 'model';
      outcome.candidate.canned.modelOutput = modelCall.output;
      outcome.candidate.canned.modelId = GEMINI_MODEL;
    } else {
      outcome.candidate.canned.modelCallError = { status: modelCall.status, message: modelCall.message };
    }
  }

  let findings = Array.isArray(outcome.findings) ? outcome.findings : [];
  let candidate = outcome.candidate ?? null;
  let disposition = outcome.disposition;
  if (candidate) {
    const shapeFindings = validateSchema(candidate, provider.outputShape.schema);
    if (shapeFindings.length > 0) {
      findings = [...findings, ...shapeFindings];
      candidate = null;
      disposition = 'HELD';
    }
  }

  const elapsedMs = Number((performance.now() - started).toFixed(3));
  const body = {
    providerId: provider.providerId,
    altitude: provider.altitude,
    toolId: requestedToolId,
    disposition,
    candidate,
    providerExecution,
    elapsedMs,
    requestBytes: Number.isInteger(requestBytes) && requestBytes >= 0 ? requestBytes : requestBytesOf(input),
  };
  if (candidate) body.shapeConforms = true;
  if (findings.length > 0) body.findings = findings;
  if (apiKey) body.modelCall = modelCall ?? { attempted: false, reason: 'candidate_not_authored' };
  return { status: disposition === 'AUTHORED' ? 200 : 422, body };
}

function servedTools(provider) {
  return [provider.toolId, ...(provider.foldedTools ?? [])];
}

function healthBody(provider, port, modelCallConfigured) {
  const nn = String(provider.altitude).padStart(2, '0');
  return {
    status: 'ok',
    providerId: provider.providerId,
    altitude: provider.altitude,
    altitudeId: provider.altitudeId,
    altitudeName: provider.altitudeName,
    toolId: provider.toolId,
    foldedTools: provider.foldedTools ?? [],
    endpoints: {
      invoke: `https://localhost:${port}/altitude-${nn}/${provider.toolId}`,
      health: `https://localhost:${port}/altitude-${nn}/health`,
    },
    inputContract: provider.inputShape.contractId,
    outputContract: provider.outputShape.contractId,
    toolInputContract: provider.inputShape.toolInputContract ?? null,
    toolOutputContract: provider.outputShape.toolOutputContract ?? null,
    providerExecution: modelCallConfigured ? 'model' : 'stub',
    modelCallConfigured,
  };
}

function createRequestHandler(providers, port) {
  const handleCircuitRequest = createCircuitRequestHandler();
  const handleAudioRequest = createAudioRequestHandler();
  const byAltitude = new Map(providers.map((provider) => [provider.altitude, provider]));
  const byTool = new Map();
  for (const provider of providers) {
    for (const tool of servedTools(provider)) byTool.set(tool, { provider });
  }
  const apiKey = process.env.GEMINI_API_KEY || process.env.LOC_GEMINI_API_KEY || null;

  return async (req, res) => {
    const url = new URL(req.url ?? '/', `https://localhost:${port}`);
    try {
      if (await handleAudioRequest(req, res, url.pathname)) return;
      if (await handleCircuitRequest(req, res, url.pathname)) return;
      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, {
          status: 'ok',
          service: 'sfx-providers',
          port,
          providerCount: providers.length + 2,
          altitudeProviderCount: providers.length,
          handAuthoredProviders: [audioProvider.providerId, circuitProvider.providerId],
          modelCallConfigured: Boolean(apiKey),
          defaultProviderExecution: apiKey ? 'model' : 'stub',
          requestContract: REQUEST_CONTRACT_ID,
          maxRequestBytes: MAX_REQUEST_BYTES,
        });
        return;
      }

      const health = /^\/altitude-(\d{1,2})\/health$/.exec(url.pathname);
      if (req.method === 'GET' && health) {
        const provider = byAltitude.get(Number.parseInt(health[1], 10));
        if (!provider) {
          sendJson(res, 404, { error: 'unknown_altitude', altitude: health[1] });
          return;
        }
        sendJson(res, 200, healthBody(provider, port, Boolean(apiKey)));
        return;
      }

      const post = /^\/altitude-(\d{1,2})\/([A-Za-z0-9._-]+)$/.exec(url.pathname);
      if (post) {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'method_not_allowed', allow: 'POST' });
          return;
        }
        const provider = byAltitude.get(Number.parseInt(post[1], 10));
        if (!provider) {
          sendJson(res, 404, { error: 'unknown_altitude', altitude: post[1] });
          return;
        }
        const requestedToolId = decodeURIComponent(post[2]);
        const route = byTool.get(requestedToolId);
        if (!route || route.provider !== provider) {
          sendJson(res, 404, { error: 'unknown_tool', altitude: provider.altitude, toolId: requestedToolId, servedToolIds: servedTools(provider) });
          return;
        }
        const postStarted = performance.now();
        let raw;
        try {
          raw = await readJsonBody(req);
        } catch (error) {
          sendJson(res, 400, { error: 'invalid_json', message: error instanceof Error ? error.message : String(error) });
          return;
        }
        if (raw.exceeded) {
          const body = {
            providerId: provider.providerId,
            altitude: provider.altitude,
            toolId: requestedToolId,
            disposition: 'HELD',
            candidate: null,
            providerExecution: 'stub',
            elapsedMs: Number((performance.now() - postStarted).toFixed(3)),
            requestBytes: raw.bytes,
            findings: [
              {
                code: 'ALTITUDE_REQUEST_OVERSIZED',
                path: '$',
                message: `request is ${raw.bytes} bytes; ${REQUEST_CONTRACT_ID} caps requests at ${MAX_REQUEST_BYTES} bytes (256 KB) before any model call`,
              },
            ],
          };
          sendJson(res, 422, body);
          console.log(
            `PROVIDER_POST altitude=${String(provider.altitude).padStart(2, '0')} tool=${requestedToolId} status=422 refusal=ALTITUDE_REQUEST_OVERSIZED requestBytes=${raw.bytes}`,
          );
          return;
        }
        let input;
        try {
          input = raw.text.length === 0 ? {} : JSON.parse(raw.text);
        } catch (error) {
          sendJson(res, 400, { error: 'invalid_json', message: error instanceof Error ? error.message : String(error) });
          return;
        }
        const result = await invokeProvider(provider, requestedToolId, input, apiKey, raw.bytes);
        sendJson(res, result.status, result.body);
        console.log(
          `PROVIDER_POST altitude=${String(provider.altitude).padStart(2, '0')} tool=${requestedToolId} status=${result.status} disposition=${result.body.disposition ?? 'n/a'} providerExecution=${result.body.providerExecution ?? 'n/a'} elapsedMs=${result.body.elapsedMs ?? 'n/a'} requestBytes=${result.body.requestBytes ?? 'n/a'} refusal=${result.body.findings?.[0]?.code ?? 'none'}`,
        );
        return;
      }

      sendJson(res, 404, { error: 'not_found', path: url.pathname, requestContract: REQUEST_CONTRACT_ID });
    } catch (error) {
      sendJson(res, 500, { error: 'internal_error', message: error instanceof Error ? error.message : String(error) });
    }
  };
}

async function loadProviders() {
  const providers = [];
  for (let index = 1; index <= ALTITUDE_COUNT; index += 1) {
    const file = `altitude-${String(index).padStart(2, '0')}.mjs`;
    const module = await import(new URL(`./providers/${file}`, import.meta.url));
    for (const member of ['altitude', 'toolId', 'inputShape', 'outputShape', 'handle']) {
      if (module[member] === undefined) throw new Error(`provider ${file} is missing export ${member}`);
    }
    if (module.altitude !== index) throw new Error(`provider ${file} declares altitude ${module.altitude}, expected ${index}`);
    if (typeof module.handle !== 'function') throw new Error(`provider ${file} handle must be a function`);
    if (module.outputShape.contractId === undefined) throw new Error(`provider ${file} outputShape.contractId is required`);
    providers.push(module);
  }
  return providers;
}

export async function startServer() {
  const port = Number.parseInt(process.env.PROVIDER_PORT ?? String(DEFAULT_PORT), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PROVIDER_PORT must be a TCP port; received ${process.env.PROVIDER_PORT}`);
  }
  const passphrase = process.env.PROVIDER_CERT_PASSWORD ?? DEFAULT_CERT_PASSWORD;
  if (!fs.existsSync(CERT_PFX)) {
    throw new Error(`missing certificate ${CERT_PFX}; run setup-cert.ps1 first`);
  }
  const providers = await loadProviders();
  const server = https.createServer(
    { pfx: fs.readFileSync(CERT_PFX), passphrase },
    createRequestHandler(providers, port),
  );
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  server.on('error', (error) => {
    console.error(`PROVIDER_SERVER_ERROR ${error.code ?? error.message}`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  return { server, port, providerCount: providers.length + 2, providers: [...providers, audioProvider, circuitProvider] };
}

const invokedDirectly =
  process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  startServer()
    .then(({ port, providerCount }) => {
      console.log(`PROVIDERS_READY port=${port} providers=${providerCount} https://localhost:${port}`);
    })
    .catch((error) => {
      console.error(`PROVIDERS_FAILED ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    });
}
