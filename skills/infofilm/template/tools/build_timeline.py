#!/usr/bin/env python3
"""Build video/src/timeline/master.json from the manuscript, the narration that exists and the music.

  python3 tools/build_timeline.py

For each scene:
  • narration exists (voice/scenes/<Sxx>.mp3 + alignment for the CURRENT text) → copied to
    video/public/audio/, exact per-word times from the ElevenLabs alignment;
  • otherwise → estimated duration and proportional word times, marked "estimated", so the film
    can be built, cued and reviewed before a single credit is spent.
film.json "parts" gives each part its kicker and music bed; film.json "scenes" gives a scene an
opening theme ("intro") or a jingle after its speech ("after"). Music cut points come from
music/cuts.json; the files are copied to video/public/music/. Illustrations are picked up from
video/public/img/film-<Sxx>.jpg (tools/sync_art.py puts them there).
"""
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from film import FILM, FPS, ROOT  # noqa: E402
from script_parse import parse  # noqa: E402

EST_WPM = FILM.get("estWpm", 130)  # replace with the measured median once the narration exists
LEAD, TAIL = FILM.get("lead", 24), FILM.get("tail", 18)  # frames before / after the speech: the card lands
INTRO_AT = 8  # the opening theme starts 8 frames into its scene
TAG = re.compile(r"\[[^\]]*\]\s*")
CUTS = {k: v for k, v in json.loads((ROOT / "music/cuts.json").read_text()).items() if not k.startswith("_")}
PARTS = FILM.get("parts", {})
SPECIAL = FILM.get("scenes", {})


def ffdur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True).stdout.strip()
    return float(out)


def alignment_words(seg_dir, lines):
    """Per-word times from the cached chunks. The API glues the lines of a chunk together without
    spaces ("majority.Remember"), so a word boundary is forced at every line start."""
    m = json.loads((seg_dir / "manifest.json").read_text())
    chars, st, en, offset = [], [], [], 0.0
    for ch in m["chunks"]:
        if not ch.get("alignment_file"):
            return None
        al = json.loads((seg_dir / ch["alignment_file"]).read_text())["alignment"]
        chars += al["characters"]
        st += [t + offset for t in al["character_start_times_seconds"]]
        en += [t + offset for t in al["character_end_times_seconds"]]
        offset += ffdur(seg_dir / ch["audio_file"])
    if "".join(chars) != "".join(lines):
        return None  # the narration is for an older text
    breaks, acc = set(), 0
    for line in lines:
        breaks.add(acc)
        acc += len(line)
    words, cur, ws, we = [], "", 0.0, 0.0
    for i, (c, s, e) in enumerate(zip(chars, st, en)):
        if c.isspace() or (i in breaks and cur):
            if cur:
                words.append((cur, ws, we))
            cur = ""
            if c.isspace():
                continue
        if not cur:
            ws = s
        cur += c
        we = e
    if cur:
        words.append((cur, ws, we))
    return [{"w": w, "s": round(s, 3), "e": round(e, 3)} for w, s, e in words if not re.fullmatch(r"\[[^\]]*\]", w)]


def estimated_words(text):
    toks = re.findall(r"\S+", TAG.sub("", text))
    total = len(toks) / EST_WPM * 60
    weights = [len(t) + 2 for t in toks]
    acc, out, W = 0.0, [], sum(weights) or 1
    for t, w in zip(toks, weights):
        d = total * w / W
        out.append({"w": t, "s": round(acc, 3), "e": round(acc + d * 0.9, 3)})
        acc += d
    return out, total


def copy_audio(src, dst):
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-ar", "48000", "-b:a", "192k", str(dst)], check=True)


def main():
    _, scenes = parse()
    pub = ROOT / "video/public"
    music = {}
    for key, c in CUTS.items():
        src = ROOT / "music" / c["file"]
        if not src.exists():
            print(f"  music '{key}': {src.relative_to(ROOT)} is missing — skipped")
            continue
        dst = pub / "music" / (Path(c["file"]).stem + ".mp3")
        copy_audio(src, dst)
        music[key] = {"src": f"music/{dst.name}", "inFrames": round(c.get("in", 0) * FPS),
                      "outFrames": round(c.get("out", ffdur(src)) * FPS), "fadeFrames": round(c.get("fade", 1.5) * FPS),
                      "gain": round(10 ** (c.get("gain", 0) / 20), 4)}  # gain in dB evens out a quiet or loud take

    out, frame, n_real = [], 0, 0
    for s in scenes:
        lines = s["text"].split("\n\n")
        audio_rel, words, estimated = None, None, True
        mp3 = ROOT / "voice/scenes" / f"{s['id']}.mp3"
        seg = ROOT / "voice/scenes/.segments" / s["id"]
        if mp3.exists() and (seg / "manifest.json").exists():
            words = alignment_words(seg, lines)
            if words is not None:
                copy_audio(mp3, pub / "audio" / f"{s['id']}.mp3")
                audio_rel = f"audio/{s['id']}.mp3"
                dur = ffdur(pub / "audio" / f"{s['id']}.mp3")
                estimated = False
                n_real += 1
            else:
                print(f"  {s['id']}: the narration is for an older text — estimated (re-run voice/narrate.py {s['id']})")
        if estimated:
            words, dur = estimated_words(s["text"])
        sp = SPECIAL.get(s["name"], {})
        lead, intro, after = LEAD, None, None
        if sp.get("intro") in music:
            c = CUTS[sp["intro"]]
            intro = {"key": sp["intro"], "at": INTRO_AT}
            # the speech starts after the sung part of the theme (the rest plays under it, ducked)
            lead = INTRO_AT + round((c.get("sungEnd", c.get("out", 0)) + 0.4) * FPS)
        if "lead_s" in sp:
            lead = round(sp["lead_s"] * FPS)
        audio_frames = round(dur * FPS)
        total = lead + audio_frames + TAIL
        if sp.get("after") in music:
            m = music[sp["after"]]
            after = {"key": sp["after"], "at": lead + audio_frames + 6}
            total = after["at"] + (m["outFrames"] - m["inFrames"]) + 12
        part = s["part"] or ""
        pconf = PARTS.get(part, {})
        img = f"img/film-{s['id']}.jpg"
        out.append({
            "id": s["id"], "name": s["name"], "part": part, "kicker": pconf.get("kicker", part),
            "title": s["title"], "bed": pconf.get("bed") if pconf.get("bed") in music else None,
            "from": frame, "durationInFrames": total, "lead": lead,
            "audio": audio_rel, "audioFrames": audio_frames, "intro": intro, "after": after,
            "text": TAG.sub("", s["text"]), "words": words, "estimated": estimated,
            "img": img if (pub / img).exists() else None,
        })
        frame += total

    tl = {"title": FILM.get("title", ""), "locale": FILM.get("locale", "en-US"), "fps": FPS,
          "durationInFrames": frame, "music": music, "scenes": out}
    dst = ROOT / "video/src/timeline/master.json"
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(tl, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{dst.relative_to(ROOT)}: {len(out)} scenes, {frame} frames = {frame / FPS / 60:.1f} min "
          f"({n_real} narrated, {len(out) - n_real} estimated, {sum(1 for o in out if o['img'])} with an illustration)")


if __name__ == "__main__":
    main()
