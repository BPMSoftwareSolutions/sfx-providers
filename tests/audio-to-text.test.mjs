import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import * as audio from '../providers/audio-to-text.mjs';
import { runAudioWorker } from '../src/audio-process.mjs';
import { createAudioRequestHandler } from '../src/audio-http.mjs';
import { toSrt } from '../transcribe.mjs';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sfx-audio-test-'));
const audioPath = path.join(directory, "Anderson's interview 日本語.mp3");
await fs.writeFile(audioPath, 'test audio');
after(() => {
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(directory).startsWith('sfx-audio-test-'));
  return fs.rm(directory, { recursive: true, force: true });
});
const request = { contractId: audio.inputShape.contractId, audioPath, language: 'en' };
const config = audio.configuration({});
function output(sourcePath = audioPath) {
  return {
    text: 'Hello world.\nThis is a test.',
    segments: [{ id: 0, startSeconds: 0, endSeconds: 1, text: 'Hello world.' },
      { id: 1, startSeconds: 1, endSeconds: 2, text: 'This is a test.' }],
    language: 'en', languageProbability: 1, durationSeconds: 2,
    source: { path: sourcePath, bytes: 10, sha256: 'a'.repeat(64) },
    model: { engine: 'faster-whisper', version: '1.2.1', name: 'small', device: 'cpu',
      computeType: 'int8', cpuThreads: 8, beamSize: 5, temperature: 0, vadFilter: true },
  };
}

test('transcription returns validated text, timestamps and provenance; quoted paths stay data', async () => {
  const result = await audio.handle(request, { config, runWorker: async (input, settings) => {
    assert.equal(input.audioPath, await fs.realpath(audioPath));
    assert.equal(input.language, 'en');
    assert.equal(settings.device, 'cpu');
    return output(input.audioPath);
  } });
  assert.equal(result.disposition, 'AUTHORED');
  assert.equal(result.providerExecution, 'local-model');
  assert.equal(result.shapeConforms, true);
  assert.equal(result.candidate.contractId, audio.outputShape.contractId);
  assert.equal(result.candidate.text, output().text);
});

test('bad requests and oversized requests are held before launching a worker', async () => {
  let calls = 0;
  const options = { runWorker: async () => { calls++; return output(); } };
  for (const input of [null, [], {}, { ...request, contractId: 'wrong' }, { ...request, language: 4 },
    { ...request, audioPath: 'relative.mp3' }, { ...request, audioPath: 'https://example.com/audio.mp3' },
    { ...request, audioPath: audioPath + '\0' }, { ...request, command: 'anything' },
    { ...request, constructor: 'unexpected' }]) {
    const result = await audio.handle(input, options);
    assert.equal(result.findings[0].code, 'AUDIO_REQUEST_INVALID');
    assert.equal(result.candidate, null);
    assert.equal(result.providerExecution, 'none');
  }
  assert.equal((await audio.handle(request, { ...options, requestBytes: audio.MAX_REQUEST_BYTES + 1 })).findings[0].code, 'AUDIO_REQUEST_OVERSIZED');
  assert.equal(calls, 0);
});

test('missing, empty, non-file and unsupported audio never reaches inference', async () => {
  const empty = path.join(directory, 'empty.wav');
  const folder = path.join(directory, 'folder.mp3');
  await fs.writeFile(empty, '');
  await fs.mkdir(folder);
  const cases = [[path.join(directory, 'missing.mp3'), 'AUDIO_FILE_UNREADABLE'],
    [empty, 'AUDIO_FILE_INVALID'], [folder, 'AUDIO_FILE_INVALID'], [path.join(directory, 'readme.txt'), 'AUDIO_FORMAT_UNSUPPORTED']];
  for (const [file, code] of cases) {
    const result = await audio.handle({ ...request, audioPath: file }, { runWorker: () => assert.fail('worker must not run') });
    assert.equal(result.findings[0].code, code);
  }
});

test('malformed worker output and inconsistent timestamps cannot be marked conformant', async () => {
  for (const mutate of [
    (value) => { value.segments[0].startSeconds = -1; },
    (value) => { value.segments[1].endSeconds = 0; },
    (value) => { value.segments[1].endSeconds = 100; },
    (value) => { value.segments[1].id = 7; },
    (value) => { value.text = 'mismatched'; },
    (value) => { value.source.sha256 = 'invalid'; },
    (value) => { value.source.bytes = 11; },
    (value) => { value.source.path = 'wrong'; },
    (value) => { value.languageProbability = NaN; },
    (value) => { value.segments = [{}]; },
  ]) {
    const result = await audio.handle(request, { config, runWorker: async ({ audioPath: file }) => {
      const value = output(file); mutate(value); return value;
    } });
    assert.equal(result.findings[0].code, 'AUDIO_OUTPUT_INVALID');
    assert.equal(result.candidate, null);
    assert.equal(result.shapeConforms, undefined);
  }
});

test('a busy provider refuses a second job and recovers after worker failure', async () => {
  let release;
  let started;
  const running = new Promise((resolve) => { started = resolve; });
  const pending = audio.handle(request, { config, runWorker: () => {
    started(); return new Promise((resolve, reject) => { release = () => reject(Object.assign(new Error('model missing'), { code: 'AUDIO_MODEL_UNAVAILABLE' })); });
  } });
  await running;
  assert.equal((await audio.handle(request)).findings[0].code, 'AUDIO_BUSY');
  release();
  assert.equal((await pending).findings[0].code, 'AUDIO_MODEL_UNAVAILABLE');
  assert.equal((await audio.handle(request, { config, runWorker: ({ audioPath: file }) => output(file) })).disposition, 'AUTHORED');
});

test('worker reports missing Python, invalid worker output, timeout and cancellation', async () => {
  await assert.rejects(runAudioWorker(request, { ...config, python: path.join(directory, 'missing-python') }), { code: 'AUDIO_WORKER_UNAVAILABLE' });
  // Node cannot execute the Python worker; exercise a real non-JSON child failure.
  await assert.rejects(runAudioWorker(request, { ...config, python: process.execPath }), { code: 'AUDIO_WORKER_FAILED' });
  await assert.rejects(runAudioWorker(request, { ...config, python: process.execPath, timeoutMs: 1 }), { code: 'AUDIO_TIMEOUT' });
  const controller = new AbortController();
  const pending = runAudioWorker(request, { ...config, python: process.execPath }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { code: 'AUDIO_CANCELLED' });
  await assert.rejects(runAudioWorker(request, config, { signal: controller.signal }), { code: 'AUDIO_CANCELLED' });
});

test('HTTP route enforces body limits, serves metadata and returns transcription envelopes', async (t) => {
  let calls = 0;
  const route = createAudioRequestHandler({ ...audio, handle: (input, options) => {
    calls++;
    return audio.handle(input, { ...options, config, runWorker: ({ audioPath: file }) => output(file) });
  } });
  const server = http.createServer(async (req, res) => {
    if (!await route(req, res, new URL(req.url, 'http://localhost').pathname)) { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}/audio-to-text`;
  const post = (body, contentType = 'application/json') => fetch(`${base}/audio.transcribe`, {
    method: 'POST', headers: { 'content-type': contentType }, body,
  });
  const health = await (await fetch(`${base}/health`)).json();
  assert.equal(health.estateStatus, 'not-declared');
  assert.equal(health.modelReadiness, 'not-probed');
  assert.equal((await fetch(`${base}/audio.transcribe`)).status, 405);
  assert.equal((await post('bad', 'text/plain')).status, 415);
  assert.equal((await post('{')).status, 400);
  assert.equal((await post(' '.repeat(audio.MAX_REQUEST_BYTES + 1))).status, 413);
  assert.equal(calls, 0);
  const response = await post(JSON.stringify(request));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).candidate.text, output().text);
  assert.equal(calls, 1);
  assert.equal((await post('{}')).status, 422);
});

test('SRT preserves Unicode and carries timestamp rounding across hours', () => {
  assert.equal(toSrt([{ startSeconds: 3599.9996, endSeconds: 3601.234, text: 'Hello 日本語' }]),
    '1\n01:00:00,000 --> 01:00:01,234\nHello 日本語\n');
  assert.equal(toSrt([]), '');
});

test('configuration bounds worker runtime and CPU settings', () => {
  assert.throws(() => audio.configuration({ AUDIO_TIMEOUT_MS: '0' }), /AUDIO_TIMEOUT_MS/);
  assert.throws(() => audio.configuration({ AUDIO_CPU_THREADS: 'lots' }), /AUDIO_CPU_THREADS/);
  assert.equal(audio.configuration({ AUDIO_OFFLINE: '1' }).offline, true);
});
