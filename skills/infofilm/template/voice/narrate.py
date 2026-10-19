#!/usr/bin/env python3
"""Read the manuscript aloud, scene by scene: ElevenLabs Text-to-Dialogue with per-character timestamps.

  python3 voice/narrate.py --dry-run          # what WOULD be billed (uncached characters) — no API call
  python3 voice/narrate.py                    # every scene without an up-to-date reading
  python3 voice/narrate.py S05 S20            # just these scenes
  python3 voice/narrate.py --skip S25         # everything except these

COSTS MONEY. Run --dry-run first and get the user's OK for the number it prints.

Writes voice/scenes/<Sxx>.mp3 and voice/scenes/.segments/<Sxx>/ (chunk mp3s, alignment JSON and a
manifest.json that tools/build_timeline.py reads). Every paragraph of the scene is one dialogue
input; chunks are cached by content (voice + text + model + language + format), so an unchanged
paragraph is never billed twice — edit one scene, pay for that scene.
Voice: voice/voice.json {"voice_id"}. Model/format: film.json "tts". Language: film.json "language".
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from film import FILM  # noqa: E402
from script_parse import parse  # noqa: E402

OUT = ROOT / "voice/scenes"
TTS = {"model": "eleven_v4", "format": "mp3_44100_192", **FILM.get("tts", {})}
LANG = FILM.get("language")
MAX_CHARS = 2000  # per API call


def chunks_of(lines):
    out, cur, n = [], [], 0
    for line in lines:
        if cur and n + len(line) > MAX_CHARS:
            out.append(cur)
            cur, n = [], 0
        cur.append(line)
        n += len(line)
    return out + ([cur] if cur else [])


def chunk_hash(voice, chunk):
    h = hashlib.sha256(json.dumps([TTS["model"], TTS["format"], LANG, voice, chunk], ensure_ascii=False).encode())
    return h.hexdigest()[:12]


def credits(client):
    try:
        sub = client.user.subscription.get()
        return sub.character_count, sub.character_limit
    except Exception:
        return None


def main(argv):
    dry = "--dry-run" in argv
    argv = [a for a in argv if a != "--dry-run"]
    skip = set()
    if "--skip" in argv:
        i = argv.index("--skip")
        skip, argv = set(argv[i + 1:]), argv[:i]
    # a mistyped flag must never be read as a scene list next to real ids: that bills those scenes
    bad = [a for a in argv + sorted(skip) if a.startswith("-")]
    if bad:
        sys.exit(f"unknown flag: {' '.join(bad)} (known: --dry-run, --skip)")
    voice = json.loads((ROOT / "voice/voice.json").read_text())["voice_id"]
    _, scenes = parse()
    todo = []
    for s in scenes:
        if (argv and s["id"] not in argv) or s["id"] in skip or not s["text"].strip():
            continue
        lines = s["text"].split("\n\n")
        plan = [(chunk_hash(voice, c), c) for c in chunks_of(lines)]
        seg = OUT / ".segments" / s["id"]
        new = [(h, c) for h, c in plan if not (seg / f"chunk_{h}.mp3").exists()]
        if new or not (OUT / f"{s['id']}.mp3").exists():
            todo.append((s, seg, plan, new))
    billed = sum(len(x) for _, _, _, new in todo for _, c in new for x in c)
    print(f"{len(todo)} scenes to (re)build, {billed} new characters to bill"
          f" (model {TTS['model']}, language {LANG or 'auto'})")
    for s, _, plan, new in todo:
        print(f"  {s['id']} {s['name']}: {sum(len(x) for _, c in new for x in c)} new characters, "
              f"{len(plan) - len(new)}/{len(plan)} chunks cached")
    if dry or not todo:
        return

    from elevenlabs import ElevenLabs
    client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])
    before = credits(client)
    for s, seg, plan, new in todo:
        seg.mkdir(parents=True, exist_ok=True)
        records = []
        for h, chunk in plan:
            mp3, al = seg / f"chunk_{h}.mp3", seg / f"chunk_{h}.alignment.json"
            if not mp3.exists():
                print(f"  {s['id']}: generating {sum(len(x) for x in chunk)} characters …", flush=True)
                kw = {"model_id": TTS["model"], "output_format": TTS["format"]}
                if LANG:
                    kw["language_code"] = LANG
                res = client.text_to_dialogue.convert_with_timestamps(
                    inputs=[{"text": x, "voice_id": voice} for x in chunk], **kw)
                mp3.write_bytes(base64.b64decode(res.audio_base_64))
                dump = lambda m: m.model_dump() if hasattr(m, "model_dump") else m.dict()
                al.write_text(json.dumps({"alignment": dump(res.alignment)}, ensure_ascii=False))
            records.append({"audio_file": mp3.name, "alignment_file": al.name, "chars": sum(len(x) for x in chunk)})
        (seg / "manifest.json").write_text(json.dumps({"scene": s["id"], "tts": TTS, "chunks": records}, indent=1))
        # decode + concatenate (never the concat demuxer on mp3: encoder padding drifts the timing)
        inputs = [a for r in records for a in ("-i", str(seg / r["audio_file"]))]
        graph = "".join(f"[{i}:a]" for i in range(len(records))) + f"concat=n={len(records)}:v=0:a=1[a]"
        subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", "[a]",
                        "-b:a", "192k", str(OUT / f"{s['id']}.mp3")], check=True)
        print(f"  {s['id']} → voice/scenes/{s['id']}.mp3")
    after = credits(client)
    if before and after:
        print(f"credits used: {after[0] - before[0]} (now {after[0]} of {after[1]})")


if __name__ == "__main__":
    main(sys.argv[1:])
