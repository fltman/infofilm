---
name: infofilm
description: Make a narrated infographic explainer film (typically 5–15 minutes) about a real subject — how a system works, what happened, what happens next — as a 1950s instructional-card newsreel with a pantomime mascot, an over-eager narrator, sung commercial breaks and code-drawn infographics that land on the spoken word. Pipeline: research → fact-checked script → ElevenLabs narrator with per-character timestamps → Suno theme, beds and jingles → Gemini illustrations → Remotion scenes cued to words → −14 LUFS master + SRT. Use when the user asks for an explainer film, infographic film/video, "a film that explains …", "gör en film om …", a newsreel-style video about a topic, or another film "like the election film".
---

# infofilm: infographic explainer films

A film made with this skill is a deck of **instructional cards** dealt onto a navy table. Each card has a title band, a picture window and a caption band. An AI illustration plays in the window, and **code-drawn infographics** arrive on top of it **on the exact word** that names them. A newsreel narrator carries the meaning, and a mascot acts it out in pantomime without ever speaking. Sung commercial breaks and a closing ballad give the film its rhythm.

Every number, title and label is drawn in code from a fact base. Pictures never carry text.

The template in `template/` is a complete, working film: a one-minute demo about leap years. Scaffold it, then replace the demo with your film piece by piece. The film renders at every step: scenes without a component show their card, and scenes without narration get estimated timing. That way you can always look at the whole thing before you spend money.

## Standing rules (they override convenience)

1. **Money: ask first.** ElevenLabs, image generation and Suno downloads cost real money or quota. Before every paid batch, state what it is, how many items, and the estimated cost; `--dry-run` prints it. Wait for a yes. A yes covers that batch only, unless the user has given standing approval ("you have the go-ahead for images, voice and music"). Log every approval and cost in `notes/log.md`.
2. **Never guess a fact.**
   - Every claim and number comes from `notes/research.md`, which cites primary sources. Every on-screen number comes from `video/src/data.ts`, which cites the research section.
   - Current events must be verified against primary sources. If something cannot be verified, it stays out of the film, or the scene waits; see "Scenes that wait" in [references/script.md](references/script.md).
3. **Text and numbers are drawn in code, never by the image model.** Image prompts forbid text, and every image is inspected anyway.
4. **The user listens, Whisper doesn't.** Never transcribe generated speech to check it; Whisper hears more errors than there are. Give the user a listening page instead.
5. **Impartial satire.** The irony aims at the system, the machine and the spectacle, never at a party, group or person. Treat sides identically in size, colour logic and animation. No real people or logos in pictures.
6. **Correct diacritics everywhere** (å ä ö é ü …), including in prompts to subagents. Tell every subagent explicitly.
7. **Read the user's words literally.** "Dystopian", "retro" or "Fallout-ish" are moods, not prop lists. When a style word could mean several things, show proposals and confirm before building on it (see [references/style.md](references/style.md)).

## The pipeline

Work through these phases in order. The ⛔ steps are gates: stop and get the user's decision before going on.

### 0 · Kick-off
- Confirm the subject, audience, language, length (default about 12 minutes) and purpose. Check `ELEVENLABS_API_KEY` and `OPENROUTER_API_KEY` in the environment, Chrome with the claude-in-chrome extension and a Suno login, and `node`, `pnpm`/`npm`, `ffmpeg` and `python3` with `numpy` and `elevenlabs`.
- Scaffold:
  ```
  <skill>/scripts/new_film.sh <dir> --slug my-film --title "My Film" --lang sv --locale sv-SE
  ```
  This copies the template, installs Remotion, synthesises the sound effects, builds a first timeline and typechecks.
- Keep decisions in `notes/log.md`, with dates and who decided.
- Renders need room. Check `df -h`, and point `OUTDIR` at a big disk when the system disk is under about 20 GB free.

### 1 · Research → `notes/research.md`
- Write numbered sections (`## 2.3 · The threshold`), one fact or cluster per section, each with its primary source: legislation, official statistics, the authority's own pages.
- Mark anything uncertain. For a recent event, record the date the facts are valid for.
- See [references/script.md](references/script.md).

### 2 · Look and cast ⛔
- Reuse the house style (cream, navy and gold ink; 1957 retro-futurism; Bowlby One SC + Jost + Lobster) or propose alternatives. Render the same small infographic in 3–7 styles so the user compares like with like.
- Cast the mascot: a silent everyman with one **signature gesture** (the house mascot lifts his hat). Avoid gestures that belong to famous mascots, such as a wink with a thumbs-up.
- Generate the reference portrait first (`kind: "ref"`), then a model sheet, and get them approved before any scene image is made.
- ⛔ The user picks the style, mascot, gesture and fonts. Details: [references/style.md](references/style.md) and [references/images.md](references/images.md).

### 3 · Script → `script/script.md` ⛔
- Structure: an opening theme, 2–4 parts, a commercial break between parts, and a closing ballad. Each scene is one card of 15–40 s.
- The words budget is minutes × about 127 words per minute for a newsreel narrator.
- Spell numbers out in the narration; the cards show the exact digits.
- Avoid date-bound words like "on Monday". The film outlives the week.
- **Review before anyone pays.** Have an independent subagent check the script **and the research** against primary sources, sorting its findings into MUST, SHOULD and COULD. Fix everything rated MUST. Reviews have caught errors in the research itself.
- ⛔ The user approves the script. Format and craft: [references/script.md](references/script.md).

### 4 · Narrator ⛔
1. Design 3 takes with `voice/design_voice.py preview <tag>` (ask first), and let the user pick one. Save it with `create`.
2. Do a test reading of 2 representative scenes and let the user approve the pace and pronunciation.
3. Read everything: `python3 voice/narrate.py --dry-run`, then ask, then run it.

Edit a scene later and only that scene is billed again. Details and pitfalls: [references/voice.md](references/voice.md).

### 5 · Music (Suno, official web UI, via Chrome)
You need these cues:
- an opening **theme** of about 20 s, which works brilliantly in Speech mode as a deadpan close-harmony voice
- one instrumental **bed** per part, looped and ducked under the voice
- a sung **jingle** for each commercial break
- a **closing ballad**, typically a Cover of the theme.

Prompt for American 1950s idioms; genre words like "schlager" drag the music somewhere else. The user likes takes in Suno, unless they have handed you the choice. Download WAV through Suno's own menu, fetch the aligned lyrics for the cut points, and write `music/cuts.json` and `video/src/lyrics.ts`. Details: [references/music.md](references/music.md).

### 6 · Illustrations
- One 21:9 2K image per scene, `film-Sxx` in `art/shots.json`, drawn from the mascot reference. Cost: `python3 art/gen.py --dry-run`, then ask.
- **Look at every image** for text, doubled props, extra limbs and the wrong outfit, and regenerate the bad ones.
- Run `python3 tools/sync_art.py` and then `python3 tools/build_timeline.py`. Details: [references/images.md](references/images.md).

### 7 · Scenes (Remotion)
- Build **two golden scenes yourself**: the scenes that carry the film's central infographics. Make them meet the bar, and register them in `golden.ts`, replacing the demo's `TheYear`/`TheRule`.
- Then fan out to 2–3 parallel builder subagents with `video/CONTRACT.md` (fill in its `{{…}}` lines). Each builder has its own group registry and verifies with contact sheets.
- Builders can start before the narration exists, because cues follow the estimated words and then move to the real ones by themselves. If the script changes while they work (a review lands), send each builder the exact changes for its scenes with SendMessage.
- Review every scene's sheet yourself.
- Details: [references/scenes.md](references/scenes.md).

### 8 · Render and deliver
- Run `tools/render.sh`. It rebuilds the timeline, lints the cues, typechecks, renders, applies two-pass loudnorm to −14 LUFS / −1 dBTP, and writes the SRT.
- Verify loudness per segment and spot-check frames from the mp4, then open the film for the user.
- Details: [references/render.md](references/render.md).

### 9 · Revisions
- Changed text: re-narrate just that scene, then rebuild the timeline. Cues follow the words automatically.
- Changed picture: regenerate the image, sync, rebuild.
- Changed music: edit `cuts.json`.

Visual fixes cost nothing but a re-render; only new narration, images or downloads cost money.

## Map of the template

| Path | What |
|---|---|
| `film.json` | title, slug, language, locale, part kickers and beds, scene intro/after music, TTS model, outDir |
| `script/script.md` | the manuscript: `## Sxx · name`, `<!-- title: -->`, `<!-- facts: -->`, `> visual:`, narration |
| `notes/research.md`, `notes/log.md` | the fact base; decisions and costs |
| `voice/` | `design.json` + `design_voice.py` (voice design), `narrate.py` (narration + timestamps), `listen.py` (listening page), `voice.json` |
| `music/` | `suno/*.wav`, `cuts.json`, `tools/beats.py` (tempo), `tools/suno_lines.py` (aligned lyrics → lines) |
| `art/` | `style.json` (the look, the never-list), `shots.json`, `gen.py`, `img/` |
| `tools/` | `build_timeline.py`, `cues.py`, `lint_cues.py`, `make_srt.py`, `sync_art.py`, `art_sheet.py`, `unframe.py`, `make_sfx.py`, `render.sh` |
| `video/src/` | `theme.ts`, `fonts.ts`, `timing.tsx` (`useScene`, `cue`), `data.ts`, `lyrics.ts`, `Music.tsx`, `primitives/` (Card, Bits, Film, Jingle, Hemicycle), `scenes/` |
| `video/tools/` | `stills.mjs` (contact sheet of chosen frames), `review.mjs` (N frames per scene, many scenes) |

Known traps, with their fixes: [references/pitfalls.md](references/pitfalls.md).
