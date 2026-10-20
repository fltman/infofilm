# Music (Suno, official web UI)

Suno has no public API. Use the **official web UI** in Chrome through the claude-in-chrome tools, logged in as the user. Never use third-party API wrappers.

## The cues a film needs
| Key (cuts.json) | What | Length | Notes |
|---|---|---|---|
| `theme` | opening theme | about 20 s | **Speech mode** gives a deadpan bass voice in close harmony that is perfect for the newsreel. Speech settings: Script, Tone, background music on, Male. It ends with the film's name |
| `bed-1`… | one instrumental bed per part | 2–3 min, loops | bossa/lounge for explaining, a nervous swing for drama, a stately march for procedure. Instrumental, no long intro |
| `jingle-1`… | a sung commercial break | 20–35 s | doo-wop or close-harmony ad jingle. Its lyrics sell the system like an appliance. Speech mode a cappella works too |
| `ballad` | the closing ballad over the credits | 60–110 s | Remix → **Cover** of the theme, slower, a crooner with strings. It ends on the mascot's catchphrase |

## Prompting
- Ask for **American 1950s** idioms by name: doo-wop, close harmony, crooner, exotica, bossa lounge, big-band swing, Hammond organ, vibraphone.
- Avoid regional genre words that drag the music elsewhere. "Swedish schlager" gave a dance-band sound the user hated.
- Lyrics follow the same never-list as the pictures. No "gas mask", "siren" or "bunker" lines; take them out of the lyrics before generating.
- Keep intros short. The theme must start singing within a second.
- Generate 2–4 takes per cue. **The user likes the keepers in Suno**, unless they have handed you the choice.

## Driving the Suno UI
- **Speech tab, Advanced mode.** Fields: Script, Tone and a collapsible **Advanced** (Vocal Gender Male/Female, Background music Off/On, Variety). Each Create gives two takes. A useful pattern is one Create with background music on and one with it off.
- **Songs tab, Advanced mode.** Fields: Lyrics, Styles, **More Options** (collapsed; Exclude styles and Vocal Gender are inside it) and Song Title.
- **Fields go wrong.** A click on the title can land on "+ Voice" and open the Voice dialog, and typing can end up in the exclude field. Set React-controlled fields with the native setter, then verify:
  ```js
  const set = (el, v) => { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  set([...document.querySelectorAll('input')].find(e => e.placeholder === 'Exclude styles'), 'schlager, polka, …');
  ```
- **The Songs lyrics field is a Lexical editor** (`.lyrics-editor-content`), not a textarea: the native setter and a synthetic paste do nothing, and `execCommand('insertParagraph')` joins every line. Into the empty editor, insert line by line with a synthetic Enter between lines (verified 2026-10-20):
  ```js
  const ed = document.querySelector('.lyrics-editor-content'); ed.focus();
  const enter = () => ed.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  const lines = LYRICS.split('\n');
  lines.forEach((l, i) => { if (l) document.execCommand('insertText', false, l); if (i < lines.length - 1) enter(); });
  ```
  `selectAll` + `delete` does not clear it. To fix text that is already there, edit Lexical's own state and read it back: `const js = ed.__lexicalEditor.getEditorState().toJSON()`, change `js.root.children[i].children[0].text`, then `editor.setEditorState(editor.parseEditorState(JSON.stringify(js)))`.
- **Spoken lines in a song:** write `[Spoken Word]` on its own line, not "(spoken)"; Suno sings parentheses as backing vocals.
- **Clip ids** are in the list's links: `[...document.querySelectorAll('a[href*="/song/"]')]`. Fetch metadata (title, duration, Suno's own description of the delivery in `metadata.tags`) from `https://studio-api.prod.suno.com/api/clip/<id>`, with the bearer token described below.

## Choosing takes when the user has handed you the choice
You cannot listen, so choose on evidence and log it:
- **Suno's own description of the take** (`metadata.tags`). It often names the voice it actually made ("Male deep bass register …" or "Male high, thin register …").
- **The aligned lyrics.** Did every line get sung? How long is the take, and when does the last word end?
- **Fit with the film:** the length, and whether the take has background music.

Like the chosen takes in Suno, write the ids in `notes/log.md`, and tell the user which you picked and why, so they can swap.

## Downloading (WAV)
1. On the take: open the **⋯ menu → Download**, choose WAV, untick M4A, then press "Unlock & Download".
2. If Chrome is set to ask where to save each file, a native **Save dialog** opens, and Claude cannot click it (Chrome is read-only for computer use). Ask the user to choose ~/Downloads and press Save, and watch ~/Downloads for the file. A hidden `.com.google.Chrome.*` file that stops growing means the dialog is waiting.
3. **Do not navigate away until the file has arrived** in ~/Downloads (about 10 s). Leaving early silently aborts the download.
4. Suno's CDN links return 403 to scripts, and the streaming m4a can be truncated. The UI download is the reliable path.
5. WAV downloads may count against a plan quota. Download only the keepers, and ask first.

Move the files to `music/suno/<key>.wav`, and log the take id and title in `notes/log.md`. The dialog shows the remaining downloads and when the quota refreshes; note it in the log.

## Cut points from the aligned lyrics
Suno's own lyric alignment gives word times. In the Suno tab, run this with the claude-in-chrome `javascript_tool`. It runs in the user's own logged-in session, and the bearer token is the `__session` cookie:
```js
const tok = document.cookie.split('; ').find(c => c.startsWith('__session='))?.split('=')[1];
const r = await fetch(`https://studio-api.prod.suno.com/api/gen/${ID}/aligned_lyrics/v2/`, { headers: { Authorization: 'Bearer ' + tok } });
const j = await r.json();
JSON.stringify(j.aligned_words.map(w => ({ word: w.word, start_s: w.start_s, end_s: w.end_s })));
```
`ID` is the clip id from the song's URL. Save the result as `music/suno/<key>.aligned.json`, then run:
```
python3 music/tools/suno_lines.py music/suno/theme.aligned.json THEME   # → paste into video/src/lyrics.ts
```
It also prints `sungEnd`. Check the first line of songs with an instrumental intro: Suno sometimes aligns the first word to 0.0 s. Fix that line's `t` by hand, and leave a comment saying how you set it. Then write `music/cuts.json`:
```json
"theme":  {"file": "suno/theme.wav",  "in": 0.0, "out": 21.4, "sungEnd": 17.6, "fade": 1.0},
"bed-1":  {"file": "suno/bed-1.wav"},
"jingle-1": {"file": "suno/jingle-1.wav", "in": 0.0, "out": 34.0, "sungEnd": 33.6, "fade": 0.4}
```
Wire the cues in film.json: `"parts": {"PART 1 — …": {"bed": "bed-1"}}` and `"scenes": {"opening": {"intro": "theme"}, "break-1": {"after": "jingle-1"}, "closing": {"after": "ballad"}}`.
- An **intro** starts 8 frames into its scene, and the narration starts 0.4 s after `sungEnd`. The rest of the theme plays on, ducked under the voice.
- An **after** cut starts 6 frames after the scene's speech. The scene lasts until the cut ends, and the bed steps aside while it plays.

## Tempo for beat-synced animation
```
python3 music/tools/beats.py music/suno/jingle-1.wav        # default range 70–220 BPM
```
- Keep the range wide. A narrow range reads 166 BPM as 118.
- Swing reports both the beat and its double or half (a 70 BPM ballad came out as 187.6), so listen and pick. For pulses on the beat, a double still lands on every beat.
- Check the tool against a click track of a known tempo before you trust it.

The tempo and the first-beat phase go into the scene as `{ bpm, phase }` for `beatPulse` / `KineticLyrics`.

## Mix (in `Music.tsx`)
| Element | Level |
|---|---|
| Bed alone | 0.3 |
| Bed under the voice | 0.055, with 10-frame ramps |
| Jingles and ballad | 0.95; the bed fades out around them |
| Theme under the first words | ducked to about 15 % |

The master is loudness-normalised afterwards. Check the segments: theme, voice over bed, jingle and ballad should all land within about 1 LU of each other. When one is off, give its cut a `gain` in dB in `cuts.json` and render again. An a cappella Speech jingle measured 1.2 LU under the speech, and a crooner ballad 1.2 LU over it (Kalmar slott, 2026-10-20). Keep the resulting volume at or under 1.
