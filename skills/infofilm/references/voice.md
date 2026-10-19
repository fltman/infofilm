# The narrator (ElevenLabs)

## Design a voice (Voice Design, `eleven_ttv_v3`)
1. Write `voice/design.json`:
   - `description`: who the narrator is (age, era, accent, pitch, tempo, attitude, recording quality).
   - `text`: 3–5 sentences in the film's language and register, with the numbers, names and exclamations the script will use.

   A good description for the house style:
   > A [language-speaking] male newsreel announcer straight out of a 1950s cinema newsreel or a vintage radio commercial, in his forties, speaking crisp, old-fashioned standard [language]. Bright, booming, resonant mid pitch, brisk staccato delivery with theatrical emphasis on numbers and exclamations. Relentlessly upbeat, a bit too cheerful, like a salesman who believes every word. Clean close-mic studio recording with no room echo.
2. Run `python3 voice/design_voice.py preview journal`. It costs money, so ask first. It gives three takes and `voice/previews/listen.html`.
3. The user picks a take. Then run `python3 voice/design_voice.py create <generated_voice_id> "<film> – narrator"`, which writes `voice/voice.json`.
4. Add the vintage feel in the mix, not in the description. A description that asks for "old radio crackle" bakes noise into every line.

A series of films can share one narrator: copy `voice/voice.json` from the earlier film.

## The test reading
Skip it only when you reuse a voice the user has already approved on the same model; log that decision.

Before reading 10 minutes, read **two representative scenes**: one dense with numbers, one with emotion. Let the user listen and approve the pace and pronunciation.
- If the pace is wrong, adjust the text (shorter sentences), not the playback speed.
- If a word is mispronounced, respell it phonetically in the script, or reword.

## Narration (`voice/narrate.py`)
- Model `eleven_v4` with `language_code` from film.json (it stops the model drifting into another accent), the Text-to-Dialogue endpoint **with timestamps**, and one input line per paragraph.
- The cache is content-addressed per chunk. Changing one paragraph re-bills only that paragraph's chunk; everything else is reused.
- Always run `--dry-run` first. It prints the new characters to bill, without calling the API.
- The script prints the credits used (from the subscription endpoint) after a real run. Log it. `eleven_v4` has measured 0.53–0.64 credits per character (6,760 characters = 3,602 credits in one film, 6,364 = 4,077 in the next), so quote the higher figure when you ask.
- Measure the real pace afterwards (median words per minute) and set `estWpm` in film.json to it, so that scenes still waiting for narration estimate well. A newsreel narrator on `eleven_v4` measured about 127 words per minute.

## Delivery tags
`eleven_v4` takes tags like `[excited]`, `[whispers]` and `[sighs]`. Use them sparingly, mostly in the opening and at punchlines. The parser strips them from the cue words and the subtitles.

## Pitfalls
- **Glued paragraphs.** Text-to-Dialogue concatenates the inputs of a chunk without spaces in the alignment ("majority.Remember"). `build_timeline.py` forces a word boundary at every paragraph start. Keep that logic if you change the parser.
- **Comments read aloud.** A parser that treats `<!-- … -->` lines as narration will have the narrator read your production notes. The template's parser skips every comment, one line or many. Check `python3 tools/script_parse.py --json /tmp/s.json` if in doubt.
- **No Whisper QA.** Transcribing TTS to check it produces false alarms. The user listens: `python3 voice/listen.py` writes `voice/listen.html`, with one player per scene and the text beside it.
- **Mixing narrators.** One film, one voice. The opening theme can have its own singer.
