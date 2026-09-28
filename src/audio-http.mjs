import * as audio from '../providers/audio-to-text.mjs';

const INVOKE = '/audio-to-text/audio.transcribe';
const HEALTH = '/audio-to-text/health';

function send(res, status, body) {
  if (res.destroyed) return;
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function createAudioRequestHandler(provider = audio) {
  return async (req, res, pathname) => {
    if (pathname !== INVOKE && pathname !== HEALTH) return false;
    const held = (status, code, message) => send(res, status, {
      providerId: provider.providerId, toolId: provider.toolId, disposition: 'HELD',
      candidate: null, providerExecution: 'none', findings: [{ code, path: '$', message }],
    });
    if (req.method === 'GET' && pathname === HEALTH) {
      // Liveness only: do not import a model, download weights, or claim readiness.
      send(res, 200, { status: 'ok', providerId: provider.providerId, toolId: provider.toolId,
        implementation: 'hand-authored', estateStatus: 'not-declared', backend: 'faster-whisper',
        modelReadiness: 'not-probed', inputContract: provider.inputShape.contractId,
        outputContract: provider.outputShape.contractId, contractStatus: 'PROPOSED',
        endpoints: { invoke: INVOKE, health: HEALTH }, maxRequestBytes: provider.MAX_REQUEST_BYTES,
      });
      return true;
    }
    if (req.method !== 'POST' || pathname !== INVOKE) {
      held(405, 'AUDIO_METHOD_NOT_ALLOWED', pathname === HEALTH ? 'Use GET.' : 'Use POST.');
      return true;
    }
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      held(415, 'AUDIO_CONTENT_TYPE_INVALID', 'Use application/json.');
      req.resume();
      return true;
    }
    const controller = new AbortController();
    const cancel = () => controller.abort();
    res.once('close', cancel);
    try {
      let bytes = 0;
      const chunks = [];
      let oversized = false;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > provider.MAX_REQUEST_BYTES) {
          chunks.length = 0;
          oversized = true;
        } else if (!oversized) chunks.push(chunk);
      }
      if (oversized) {
        held(413, 'AUDIO_REQUEST_OVERSIZED', `Request exceeds ${provider.MAX_REQUEST_BYTES} bytes; supply a local audioPath.`);
        return true;
      }
      let input;
      try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { held(400, 'AUDIO_REQUEST_INVALID', 'Request body must be JSON.'); return true; }
      const result = await provider.handle(input, { requestBytes: bytes, signal: controller.signal });
      const code = result.findings?.[0]?.code;
      const status = result.disposition === 'AUTHORED' ? 200 : code === 'AUDIO_BUSY' ? 429 : code === 'AUDIO_TIMEOUT' ? 504 : 422;
      send(res, status, result);
    } catch (error) {
      held(500, 'AUDIO_REQUEST_FAILED', error.message);
    } finally { res.removeListener('close', cancel); }
    return true;
  };
}
