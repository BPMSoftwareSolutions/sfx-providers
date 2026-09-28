"""One local transcription per process. JSON in/out; progress only on stderr."""
import hashlib
import importlib.metadata
import json
import os
import sys


def report(message):
    print(message, file=sys.stderr, flush=True)


def main():
    request = json.load(sys.stdin)
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return {"error": {"code": "AUDIO_DEPENDENCY_MISSING", "message":
            "Install requirements-audio.txt into the configured Python environment."}}

    # Open bytes, not a URL or a decoder protocol. Hash and decode the same handle.
    try:
        source = open(request["audioPath"], "rb")
    except OSError as error:
        return {"error": {"code": "AUDIO_FILE_UNREADABLE", "message": str(error)}}
    with source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
        size = os.fstat(source.fileno()).st_size
        source.seek(0)
        report("AUDIO_MODEL_LOADING")
        try:
            model = WhisperModel(
                request["model"], device=request["device"],
                compute_type=request["computeType"], cpu_threads=request["cpuThreads"],
                download_root=request["modelCache"], local_files_only=request["offline"],
            )
        except Exception as error:
            return {"error": {"code": "AUDIO_MODEL_UNAVAILABLE", "message": str(error)}}

        try:
            stream, info = model.transcribe(
                source, language=request.get("language"), task="transcribe",
                beam_size=5, temperature=0, vad_filter=True,
            )
            segments = []
            reported_until = -30
            for segment in stream:
                text = segment.text.strip()
                if text:
                    segments.append({"id": len(segments),
                        "startSeconds": round(segment.start, 3),
                        "endSeconds": round(segment.end, 3), "text": text})
                if segment.end - reported_until >= 30:
                    report(f"AUDIO_PROGRESS seconds={segment.end:.1f} duration={info.duration:.1f}")
                    reported_until = segment.end
        except Exception as error:
            return {"error": {"code": "AUDIO_TRANSCRIPTION_FAILED", "message": str(error)}}

    return {
        "text": "\n".join(segment["text"] for segment in segments),
        "segments": segments,
        "language": info.language,
        "languageProbability": info.language_probability,
        "durationSeconds": round(info.duration, 3),
        "source": {"path": request["audioPath"], "bytes": size, "sha256": digest},
        "model": {"engine": "faster-whisper", "version": importlib.metadata.version("faster-whisper"),
            "name": request["model"], "device": request["device"], "computeType": request["computeType"],
            "cpuThreads": request["cpuThreads"], "beamSize": 5, "temperature": 0, "vadFilter": True},
    }


if __name__ == "__main__":
    try:
        result = main()
    except Exception as error:
        result = {"error": {"code": "AUDIO_WORKER_FAILED", "message": str(error)}}
    print(json.dumps(result, ensure_ascii=False, allow_nan=False), flush=True)
    sys.exit(1 if "error" in result else 0)
