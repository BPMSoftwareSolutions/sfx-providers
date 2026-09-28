import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAudioWorker } from '../src/audio-process.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export const providerId = 'sfx-audio-to-text';
export const toolId = 'audio.transcribe';
export const MAX_REQUEST_BYTES = 16 * 1024;
export const MAX_AUDIO_BYTES = 1024 * 1024 * 1024;
export const inputShape = {
  contractId: 'audio-transcription-request.v1', status: 'PROPOSED',
  schema: {
    type: 'object', additionalProperties: false, required: ['contractId', 'audioPath'],
    properties: {
      contractId: { const: 'audio-transcription-request.v1' },
      audioPath: { type: 'string', minLength: 1 },
      language: { type: 'string', pattern: '^[a-z]{2,3}$' },
    },
  },
};
export const outputShape = {
  contractId: 'audio-transcription-output.v1', status: 'PROPOSED',
  schema: {
    type: 'object', additionalProperties: false,
    required: ['contractId', 'text', 'segments', 'language', 'languageProbability', 'durationSeconds', 'source', 'model'],
    properties: {
      contractId: { const: 'audio-transcription-output.v1' }, text: { type: 'string' },
      language: { type: 'string' }, languageProbability: { type: 'number', minimum: 0, maximum: 1 },
      durationSeconds: { type: 'number', minimum: 0 },
      source: { type: 'object', additionalProperties: false, required: ['path', 'bytes', 'sha256'], properties: {
        path: { type: 'string' }, bytes: { type: 'integer', minimum: 1 }, sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      } },
      model: { type: 'object', additionalProperties: false,
        required: ['engine', 'version', 'name', 'device', 'computeType', 'cpuThreads', 'beamSize', 'temperature', 'vadFilter'],
        properties: {
          engine: { const: 'faster-whisper' }, version: { type: 'string' }, name: { type: 'string' },
          device: { type: 'string' }, computeType: { type: 'string' }, cpuThreads: { type: 'integer', minimum: 1 },
          beamSize: { const: 5 }, temperature: { const: 0 }, vadFilter: { const: true },
        },
      },
      segments: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['id', 'startSeconds', 'endSeconds', 'text'], properties: {
          id: { type: 'integer', minimum: 0 }, startSeconds: { type: 'number', minimum: 0 },
          endSeconds: { type: 'number', minimum: 0 }, text: { type: 'string' },
        },
      } },
    },
  },
};

export function configuration(env = process.env) {
  const positiveInt = (key, fallback, max) => {
    const value = Number(env[key] ?? fallback);
    if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`${key} must be an integer from 1 to ${max}.`);
    return value;
  };
  return {
    python: env.AUDIO_PYTHON || path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'),
    model: env.AUDIO_MODEL || 'small', device: env.AUDIO_DEVICE || 'cpu', computeType: env.AUDIO_COMPUTE_TYPE || 'int8',
    cpuThreads: positiveInt('AUDIO_CPU_THREADS', 8, 256),
    timeoutMs: positiveInt('AUDIO_TIMEOUT_MS', 60 * 60 * 1000, 24 * 60 * 60 * 1000),
    modelCache: env.AUDIO_MODEL_CACHE || path.join(root, '.cache', 'audio-models'),
    offline: env.AUDIO_OFFLINE === '1',
  };
}

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// The small schema subset used above, including every nested segment, is checked
// at the worker boundary before any result is labeled shapeConforms.
export function conforms(value, schema) {
  if ('const' in schema && value !== schema.const) return false;
  if (schema.type === 'object') {
    if (!object(value) || schema.required?.some((key) => !Object.hasOwn(value, key))) return false;
    if (schema.additionalProperties === false && Object.keys(value).some((key) => !Object.hasOwn(schema.properties, key))) return false;
    return Object.entries(schema.properties).every(([key, sub]) => !Object.hasOwn(value, key) || conforms(value[key], sub));
  }
  if (schema.type === 'array') return Array.isArray(value) && value.every((item) => conforms(item, schema.items));
  if (schema.type === 'string') return typeof value === 'string' && value.length >= (schema.minLength ?? 0) && (!schema.pattern || new RegExp(schema.pattern).test(value));
  if (schema.type === 'number' || schema.type === 'integer') return Number.isFinite(value) &&
    (schema.type !== 'integer' || Number.isInteger(value)) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity);
  return true;
}

export function validateCandidate(candidate) {
  if (!conforms(candidate, outputShape.schema)) return false;
  let previousStart = 0;
  for (const [id, segment] of candidate.segments.entries()) {
    if (segment.id !== id || segment.startSeconds < previousStart || segment.endSeconds < segment.startSeconds ||
        segment.endSeconds > candidate.durationSeconds + 1) return false;
    previousStart = segment.startSeconds;
  }
  return candidate.text === candidate.segments.map((segment) => segment.text).join('\n');
}

let busy = false;
export async function handle(input, options = {}) {
  const started = performance.now();
  let requestBytes = 0;
  let attempted = false;
  const envelope = (outcome) => ({ providerId, toolId, providerExecution: attempted ? 'local-model' : 'none',
    elapsedMs: Math.round(performance.now() - started), requestBytes, ...outcome });
  const held = (code, message) => envelope({ disposition: 'HELD', candidate: null, findings: [{ code, path: '$', message }] });
  try { requestBytes = options.requestBytes ?? Buffer.byteLength(JSON.stringify(input) ?? ''); }
  catch { return held('AUDIO_REQUEST_INVALID', 'Request must be JSON.'); }
  if (requestBytes > MAX_REQUEST_BYTES) return held('AUDIO_REQUEST_OVERSIZED', `Request exceeds ${MAX_REQUEST_BYTES} bytes; supply a local audioPath.`);
  if (!conforms(input, inputShape.schema) || !path.isAbsolute(input.audioPath) || input.audioPath.includes('\0')) {
    return held('AUDIO_REQUEST_INVALID', 'Expected contractId, an absolute local audioPath, and optional lowercase language code; no other members.');
  }
  if (!['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.opus', '.aac', '.mp4', '.webm'].includes(path.extname(input.audioPath).toLowerCase())) {
    return held('AUDIO_FORMAT_UNSUPPORTED', 'Supported extensions: mp3, wav, m4a, flac, ogg, opus, aac, mp4, webm.');
  }
  if (busy) return held('AUDIO_BUSY', 'Another transcription is running; retry after it completes.');
  busy = true;
  try {
    let audioPath;
    let stat;
    try { audioPath = await fs.realpath(input.audioPath); stat = await fs.stat(audioPath); }
    catch { return held('AUDIO_FILE_UNREADABLE', 'The audio file does not exist or cannot be read.'); }
    if (!stat.isFile() || stat.size === 0 || stat.size > MAX_AUDIO_BYTES) {
      return held('AUDIO_FILE_INVALID', 'Audio must be a nonempty regular file of at most 1 GiB.');
    }
    let config;
    try { config = options.config ?? configuration(); }
    catch (error) { return held('AUDIO_CONFIGURATION_INVALID', error.message); }
    attempted = true;
    const result = await (options.runWorker ?? runAudioWorker)({ audioPath, language: input.language }, config, options);
    const candidate = { ...result, contractId: outputShape.contractId };
    if (!validateCandidate(candidate) || candidate.source.path !== audioPath || candidate.source.bytes !== stat.size) {
      return held('AUDIO_OUTPUT_INVALID', 'Worker result does not conform to the transcription output contract.');
    }
    return envelope({ disposition: 'AUTHORED', candidate, shapeConforms: true, findings: [] });
  } catch (error) {
    return held(typeof error.code === 'string' && error.code.startsWith('AUDIO_') ? error.code : 'AUDIO_WORKER_FAILED', String(error.message).slice(0, 4096));
  } finally { busy = false; }
}
