import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workerPath = fileURLToPath(new URL('./audio-worker.py', import.meta.url));
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

export function runAudioWorker(request, config, { signal, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const fail = (code, message) => Object.assign(new Error(message), { code });
    if (signal?.aborted) return reject(fail('AUDIO_CANCELLED', 'Transcription cancelled.'));
    const child = spawn(config.python, ['-u', workerPath], {
      shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', HF_HUB_DISABLE_TELEMETRY: '1' },
    });
    const chunks = [];
    let bytes = 0;
    let stderr = '';
    let failure;
    const stop = (code, message) => {
      failure ??= fail(code, message);
      child.kill();
    };
    const abort = () => stop('AUDIO_CANCELLED', 'Transcription cancelled.');
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => stop('AUDIO_TIMEOUT', 'Transcription exceeded AUDIO_TIMEOUT_MS.'), config.timeoutMs);
    child.on('error', (error) => { failure ??= fail('AUDIO_WORKER_UNAVAILABLE', `Cannot start Python: ${error.message}`); });
    child.stdin.on('error', () => {}); // A worker may exit before consuming input.
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT_BYTES) return stop('AUDIO_OUTPUT_OVERSIZED', 'Transcription exceeds the 16 MiB result limit.');
      chunks.push(chunk);
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-4096);
      onProgress?.(chunk);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (failure) return reject(failure);
      let result;
      try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return reject(fail('AUDIO_WORKER_FAILED', `Worker exited ${code} without a JSON result. ${stderr}`)); }
      if (result?.error) return reject(fail(result.error.code ?? 'AUDIO_WORKER_FAILED', String(result.error.message).slice(0, 4096)));
      if (code !== 0) return reject(fail('AUDIO_WORKER_FAILED', `Worker exited ${code}. ${stderr}`));
      resolve(result);
    });
    child.stdin.end(JSON.stringify({ ...config, ...request, python: undefined, timeoutMs: undefined }));
  });
}
