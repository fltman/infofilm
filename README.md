# infofilm

[![Support me on Patreon](https://img.shields.io/badge/Patreon-Support%20my%20work-FF424D?style=flat&logo=patreon&logoColor=white)](https://www.patreon.com/AndersBjarby)

A Claude Code **skill** for making narrated **infographic explainer films**: 5–15 minutes on how a system works, what happened and what happens next. They are told as a 1950s newsreel of instructional cards, with a silent mascot, a far-too-cheerful narrator, sung commercial breaks, and code-drawn infographics that land on the exact spoken word.

![The template's golden scene "One year": a day counter with decimals snapping on, an orbit and a quarter-day pie](docs/the-year.jpg)

The skill was extracted from a real 13-minute production about a national election. It packages the whole pipeline, the template that renders and the lessons learned the hard way:

```
research → fact-checked script → narrator (ElevenLabs, per-character timestamps)
         → theme, beds and jingles (Suno) → illustrations (Gemini 3 Pro Image)
         → Remotion scenes cued to words → −14 LUFS master + SRT
```

## Why it works
- **Code draws everything that must be true.** Every number, title and label is rendered from a fact base (`data.ts` ← `notes/research.md` ← primary sources). The image model only supplies mood, setting and the mascot, and every prompt forbids text.
- **The animation is timed to speech, not to frames.** Scenes say `cue("three hundred and sixty-five")` and get the frame where the narrator says it. Before any narration exists, the timings are estimated from the text, so the whole film can be built and reviewed for free. When the voice arrives, the cues move by themselves.
- **The film always plays.** A scene without a component renders as its card, a scene without a picture gets a drawn ground, and a scene without a voice gets estimated timing. You can watch the whole film at every stage.
- **Money is gated.** Narration, images and music downloads each have a `--dry-run` that prints the cost, and the skill asks before spending. The narration cache is content-addressed per paragraph, so editing one scene re-bills one scene.

![The template's golden scene "The rule": three rules and three verdicts](docs/the-rule.jpg)

## What's inside
```
skills/infofilm/
├── SKILL.md                 # the pipeline: 10 phases, the gates, the standing rules
├── references/
│   ├── script.md            # research file, manuscript format, film structure, review
│   ├── style.md             # the house look, the mascot, changing styles
│   ├── voice.md             # Voice Design, test reading, narration with timestamps
│   ├── music.md             # Suno web UI: theme in Speech mode, beds, jingles, WAV, aligned lyrics
│   ├── images.md            # Gemini 21:9 2K, character reference, inspecting every image
│   ├── scenes.md            # golden scenes, parallel builders, primitives, contact sheets
│   ├── render.md            # render, loudness, verification, delivery
│   └── pitfalls.md          # every trap that cost a round, with its fix
├── scripts/new_film.sh      # scaffold a project from the template
└── template/                # a complete, rendering film (1-minute demo about leap years)
    ├── film.json            # title, language, locale, parts → kicker + music bed, scene music hooks
    ├── script/script.md     # the manuscript
    ├── notes/               # research.md (the fact base), log.md (decisions, approvals, costs)
    ├── voice/               # design_voice.py, narrate.py (ElevenLabs, cached, timestamps)
    ├── music/               # cuts.json, tools/beats.py, tools/suno_lines.py
    ├── art/                 # style.json (the look + the never-list), shots.json, gen.py
    ├── tools/               # build_timeline, cues, lint_cues, make_srt, sync_art, make_sfx, render.sh
    └── video/               # Remotion 4: Card, Plate, Counter, Stamp, KineticLyrics, CommercialBreak …
```

## Install
```bash
git clone https://github.com/fltman/infofilm.git
cd infofilm && ./install.sh          # or ./install.sh --link
```
Then ask Claude Code for a film, for example *"make a 10-minute explainer film about how the EU makes a law"*. To start a project by hand:
```bash
~/.claude/skills/infofilm/scripts/new_film.sh ~/films/eu-law --slug eu-law --title "How the EU Makes a Law" --lang en --locale en-GB
cd ~/films/eu-law/video && npx remotion studio src/index.ts
```

## Requirements
- Claude Code. For music, the [Claude in Chrome](https://claude.ai/chrome) extension and a [Suno](https://suno.com) account (the skill uses Suno's own web UI).
- Node 20+ with pnpm or npm, Python 3.10+ with `numpy` and `elevenlabs`, and `ffmpeg`.
- `ELEVENLABS_API_KEY` for narration and `OPENROUTER_API_KEY` for illustrations (Gemini 3 Pro Image).

## What a 12-minute film costs (measured)
| Item | Volume | Cost |
|---|---|---|
| Illustrations | 19–30 scene images at 2K (about $0.14 each), plus retakes and style tests | $3–9 |
| Narration | 6,000–8,000 characters (eleven_v4) | 0.5–0.65 ElevenLabs credits per character: 6,760 characters cost 3,602 credits, 6,364 cost 4,077 |
| Voice design | 1–2 rounds of 3 takes | a few hundred credits |
| Music | about 7 cues, 2–4 takes each | Suno credits; WAV downloads may count against a plan quota |
| Render | 13 minutes at 1080p30 | about 50 minutes on a laptop, about 1.2 GB |

## Films made with it
- **Svenska Valjournalen 2026** (13 min). The election film the skill was extracted from.
- **Svenska Journalen: Så styrs Sverige** (10.4 min). It is about Sweden's constitution and was the skill's first test run, made end to end from `new_film.sh`. The steps were:
  1. a research agent wrote 79 sourced sections
  2. an independent reviewer found 2 MUST and 9 SHOULD issues, which were fixed before a credit was spent
  3. 19 illustrations, three Suno cues and the narration were made
  4. two golden scenes were built by hand, and 17 scenes by three parallel builders.

## Licence
MIT. The template's fonts (Bowlby One SC, Jost, Lobster) are loaded from Google Fonts under the SIL Open Font License. The sound effects are synthesised by `tools/make_sfx.py`. Your film's narration, music and images are subject to the terms of the services that made them.
