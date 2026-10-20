# Pitfalls (each one happened at least once)

| Symptom | Cause | Fix |
|---|---|---|
| The style came out wrong ("why the bunkers and gas masks?") | A mood word ("dystopian", "Fallout") was read as a prop list | Show style proposals and confirm the reading; put the unwanted motifs on the never-list in `art/style.json`, the lyrics and the contract |
| The jingle sounds like a regional dance band | A genre word like "Swedish schlager" in the Suno style | Name American 1950s idioms (doo-wop, close harmony, crooner); try **Speech mode** for spoken-sung jingles |
| A lyric line contradicts the brief ("masks on!") | Lyrics written before the course change | Re-read every lyric against the never-list before generating |
| Suno downloads vanish | Navigated away before the file arrived | Wait about 10 s per download; check ~/Downloads |
| Suno file links give 403, m4a truncated | CDN links are not for scripts | Download WAV through the ⋯ menu |
| Text typed into the wrong Suno field | Coordinate clicks on retina are unreliable | Use `find` references and focus fields through JS |
| Beat tracker says 118 BPM for a 166 BPM song | Search range too narrow (octave error) | Keep 70–220, calibrate against a click track |
| The narrator reads a production note aloud; the note shows up as a caption | The parser treated `<!-- … -->` as narration | The template parser skips every comment; check `script_parse.py --json` |
| Words glued in the timeline ("majority.Remember"), a cue not found | Text-to-Dialogue joins paragraphs without spaces | `build_timeline.py` forces a word boundary at each paragraph start |
| `narrate.py --dry-run S25` billed the scene | An older project's `narrate.py` had no `--dry-run`, so the flag was ignored and S25 was narrated | Check `grep -c dry-run voice/narrate.py` before trusting the flag in a project made before the template had it; the template now refuses unknown flags |
| A scene's audio is silent after an edit | The narration is for the old text | `build_timeline.py` prints "older text"; re-narrate that scene |
| The image model writes words ("WHOOSH", "1957", "BALLOT") | Models add text | Explicit "no text" in every prompt, plus inspecting every image |
| The mascot has two hats | Image-to-image doubles props | Inspect; regenerate; re-measure positions laid over the picture |
| The hat and head are cut off in the card | 16:9 image in a 2.4:1 window | Generate 21:9 with headroom |
| The kicker wraps to two lines | A long title | The card auto-shrinks titles (about 0.74 em per Bowlby character); keep titles at most 5 words |
| A label hides behind bars, a decimal is clipped | The plate is too narrow for the content at full size | Check the final state of every number in the sheet; plates clip with overflow hidden |
| The fact base itself was wrong | Research from secondary summaries | An independent review against primary sources, covering the research as well as the script |
| A date-bound phrase ("on Monday") aged within a week | Writing from the calendar | Use absolute dates, or structure that doesn't need them |
| The disk filled up during stills | Every bundle copies `public/` | The still tools clean up on exit; check the temp folder; render to a big disk |
| A sung line's first word sits at 0.0 s | Suno's alignment on a song with an instrumental intro | Check the first line of every song; fix its `t` by hand, with a comment saying how |
| Lyric lines split at section tags, or "( word" gets a stray space | Section tags ride on the next token with their own newline; tokens carry their own spacing | `suno_lines.py` drops the tag plus its newline and joins tokens without adding spaces |
| The narration claims a rule that is about to change | Pending legislation (a vote planned after the research date) | Research records pending changes; word the scene so it is true under both versions, and add a re-check comment with the date |
| A timeless film shows a count that will change (agencies, courts, ministries) | Figures copied without their date | Show them with a source line and date, or leave them out (the research marks them ⚠) |
| Two renders at once, both crawling or crashing | RAM and Chrome instances | One render at a time; builders render stills only |
| Scene images come out as a worn paper sheet with edges or a frame | The style reference is a model sheet on aged paper, and `style_only` asked to match its "aged paper" | `style_only` takes only the drawing style ("not its paper sheet, worn edges or layout"); `kinds.film` forbids paper sheets, worn edges and rounded corners |
| A real building comes out as a generic one | The model draws its own idea of the place | Attach photographs with `photos` (see images.md, "Real places") |
| A scene image has a drawn frame, a cream margin or rounded paper corners despite the prompt (aerial and map-like views most often) | The model frames "a view" like a picture; regenerating often frames it again | `python3 tools/unframe.py film-Sxx` crops it off and keeps the aspect; check that it does not cut into the subject |
| A long card title runs into the kicker (Swedish part names are long) | The title shrank against a fixed budget, ignoring the kicker | Fixed in `Card.tsx`: the title gets the width the kicker leaves. Keep kickers under ~35 characters anyway |
| A sung line reads "Outro]" or ends in "[" | Suno split a section tag across two aligned words ("vind.\n\n[", "Outro]\n\n\n") | Fixed in `suno_lines.py`: tags are stripped character by character across tokens |
