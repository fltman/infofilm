#!/usr/bin/env python3
"""Turn Suno's aligned lyrics into sung lines for video/src/lyrics.ts, and print the cut points.

  python3 music/tools/suno_lines.py music/suno/theme.aligned.json THEME

The input is the "aligned_words" array (word, start_s, end_s) saved from the Suno tab — see the
skill's references/music-suno.md. A line ends where a word carries a newline; section tags like
[Chorus] are dropped. Prints a TypeScript Line[] to paste into lyrics.ts and the sungEnd for cuts.json.
"""
import json
import re
import sys

words = json.load(open(sys.argv[1], encoding="utf-8"))
if isinstance(words, dict):
    words = words.get("aligned_words", [])
name = sys.argv[2] if len(sys.argv) > 2 else "LINES"
lines, cur = [], []
in_tag = skip_ws = False
for w in words:
    # Suno's tokens carry their own spacing ("Goddag, ", "lektion! (") and a section tag rides on the
    # next word with its own newline ("[Verse]\nHej ") — drop the tag and that newline, keep the rest.
    # A tag can also be split across two tokens ("vind.\n\n[", "Outro]\n\n\n"), so track it char by char.
    out = []
    for ch in w["word"]:
        if in_tag:
            in_tag = ch != "]"
            skip_ws = not in_tag
        elif ch == "[":
            in_tag = True
        elif not (skip_ws and ch.isspace()):
            skip_ws = False
            out.append(ch)
    text = "".join(out)
    if text.strip():
        cur.append((text, w["start_s"], w["end_s"]))
    if "\n" in text and cur:
        lines.append(cur)
        cur = []
if cur:
    lines.append(cur)
print(f"export const {name}: Line[] = [")
for ln in lines:
    txt = re.sub(r"\s+", " ", "".join(t for t, _, _ in ln)).strip().replace('"', '\\"')
    print(f'  {{ t: {ln[0][1]:.2f}, end: {ln[-1][2]:.2f}, text: "{txt}" }},')
print("];")
if lines:
    print(f"// sungEnd for music/cuts.json: {lines[-1][-1][2]:.2f}", file=sys.stderr)
