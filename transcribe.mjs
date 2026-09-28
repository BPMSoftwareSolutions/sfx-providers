#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { handle, inputShape } from './providers/audio-to-text.mjs';

export function toSrt(segments) {
  const timestamp = (seconds) => {
    const ms = Math.round(seconds * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
  };
  return segments.map((segment, index) => `${index + 1}\n${timestamp(segment.startSeconds)} --> ${timestamp(segment.endSeconds)}\n${segment.text}\n`).join('\n');
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    'output-dir': { type: 'string' }, language: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log('Usage: node transcribe.mjs <audio-file> [--language en] [--output-dir <new-directory>]');
    return;
  }
  if (positionals.length !== 1) throw new Error('Supply one audio file. Use --help for usage.');
  const root = fileURLToPath(new URL('./', import.meta.url));
  const outputDir = path.resolve(values['output-dir'] ?? path.join(root, 'outputs', 'audio', `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`));
  try { await fs.access(outputDir); throw new Error(`Output directory already exists: ${outputDir}. Choose a new directory.`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  let result;
  try {
    result = await handle({ contractId: inputShape.contractId, audioPath: path.resolve(positionals[0]),
      ...(values.language ? { language: values.language } : {}),
    }, { signal: controller.signal, onProgress: (message) => process.stderr.write(message) });
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
  if (result.disposition !== 'AUTHORED') {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }
  await fs.mkdir(path.dirname(outputDir), { recursive: true });
  await fs.mkdir(outputDir);
  await fs.writeFile(path.join(outputDir, 'transcription.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  await fs.writeFile(path.join(outputDir, 'transcript.txt'), result.candidate.text + '\n', { flag: 'wx' });
  await fs.writeFile(path.join(outputDir, 'transcript.srt'), toSrt(result.candidate.segments), { flag: 'wx' });
  console.log(JSON.stringify({ outputDir, durationSeconds: result.candidate.durationSeconds,
    segments: result.candidate.segments.length, elapsedMs: result.elapsedMs,
    files: ['transcript.txt', 'transcription.json', 'transcript.srt'],
  }, null, 2));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
