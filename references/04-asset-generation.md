# 04 — Asset generation (characters, backgrounds, props)

Contents: 0 Start here: the generation table (`tools/gen_table.py`) · 0b Other styles · 1 What to generate (shot-driven list) · 2 `tools/imagegen.py` · 3 Codex CLI gotchas · 4 Alpha: native vs chroma key (`tools/alpha_matte.py`) · 5 Character consistency method · 6 Style-block templates · 7 Backgrounds and props · 8 Review · 9 Other image models · 10 Pitfalls · 11 Grok · 12 NovelAI · 13 Choosing the generator (`tools/artgen.py`)

The method is model-agnostic: **one master reference image + verbatim locks (a style block; a character sentence if there is a cast)** for every picture, transparent output via native alpha or a flat chroma-key background. The kit wraps the Codex CLI, Grok, NovelAI or a custom generator (§9, §11–13). A film without generated pictures skips this file.

---

## 0. Start here: the generation table (`tools/gen_table.py`)

Every image of the film is a row of ONE table, `assets/gen/table.json`: the locks (your words, pasted verbatim into
every row), a subject per row, references, sizes, keys. `gen_table.py jobs` compiles it into the jobs files the
generators read (§2, §11, §12); `post` keys, splits and sorts the results (finals in `assets/gen/<id>.png`, review
sheets per category, `status`). Write a jobs file by hand only for a one-off retake. The sections below are the craft
behind the locks (§5–7) and the generators' own fields.

```json
{ "locks": { "STYLE": "...", "CHAR": "...", "CHAR_BACK": "...", "WORLD": "...", "ISO": "...", "EMPTY": "..." },
  "refs": { "char": [] }, "out": "assets/gen",
  "rows": [
    { "id": "CH00a", "kind": "char", "subject": "full body, standing, front three-quarter view", "aspect": "2:3", "transparent": true },
    { "id": "CH10", "kind": "char", "subject": "bust, singing into a microphone, facing the viewer", "transparent": true,
      "size": "1472x704", "sheet": { "cells": ["neutral", "blink", "open", "smile"], "cols": 4 } },
    { "id": "CH20", "kind": "char", "subject": "full body seen from behind, looking up at the sky", "transparent": true,
      "view": "back" },
    { "id": "BG01", "kind": "world", "subject": "a rooftop at dusk, a radio mast on the left ...", "aspect": "16:9" },
    { "id": "OBJ01", "kind": "world", "subject": "a porcelain locket, closed", "transparent": true } ] }
```
1. **Locks.** `STYLE` (medium, line, shading, palette), `CHAR` (the character sentence, §5), `WORLD` (the background
   style block, §6), `ISO` (a cut-out: the subject alone on the key colour), `EMPTY` (no people, no text). Rows get
   `STYLE + CHAR` (char) or `STYLE + WORLD` (world) unless they list their own `"locks"`.
   **Back views:** a row with `"view": "back"` gets the `CHAR_BACK` lock (the character from behind: hair as seen
   from behind, outfit, signature items) or, without one, `CHAR` with every comma-separated part that names the face
   (eyes, bangs, mouth, expression …) left out, a "seen from behind" lead-in and a `face, eyes, looking at viewer`
   negative. A back view prompted with the full `CHAR` comes back with eyes on the back of the head.
2. **Masters first:** three char rows with no `refs.char`; `jobs` → generate → `post`; pick one with the user; then
   `"refs": { "char": ["assets/gen/CH00b.png"] }` carries the character's face into every later char row (Codex, Grok). On
   NovelAI a character reference costs Anlas: ask the user once whether Anlas may be spent. If yes, use `refs.char` as
   above; if not, leave it empty and lean on `CHAR` plus takes (§12).
3. **Faces that live (optional, a cast only):** if the film wants a character to blink or change expression, per framing (bust, half body), the approved picture plus
   variant rows that repaint only its eye or face box (`"ref_mode": "inpaint", "mode": "full"`), swapped whole by the
   engine (`anim.whole`); an expression sheet is the fallback (styles/vocaloid/STYLE.md, Characters with a living face).
   A character who reacts in a shot is drawn from such a framing. The mouth is never swapped: a character who sings is
   generated singing and holds. A still character is fine too.
4. **The rest** from the storyboard (§1): poses, the eye close-up (opaque 16:9), backgrounds with their time-of-day
   variants, props. Look at every `_review_<category>.jpg`; line them up with
   `python tools/lineup.py assets/gen/CH*.png --bg assets/gen/BG01.png` (§5.9).

A character's expressions come from a **sheet row**: one generation of all of them (same style), split, aligned and
cut to eye / face patches for the engine (`styles/vocaloid/STYLE.md`). Lessons from the first real runs (NovelAI): its
"magenta" screen comes out hot pink (the keyer treats it as a two-channel screen; before, it ate every red / brown /
skin colour); it lays a sheet out its own way (a full body plus heads: pick the figures by number); copies on a sheet
are each redrawn a little, so a whole feature area is pasted, not only the changed pixels; asking for a changed version
of a finished picture (img2img / inpaint of a head) drifts in style or does not change — variant rows remain for small
fixes to one face (inpaint of an eye or face region, `"takes": 3`).

Sheet layout (iteration-4 run): a row of 4 busts (`"cells": [...], "cols": 4, "size": "1472x704"`) gave about
400x650 px per figure; a 2x2 sheet at 1024x1024 gives small faces. Name every expression in the subject (the first
take of a sheet that only listed the cell names came back with no blink and no smile) and budget a second take.
Busts drawn touching merge into one figure: `post` then cuts the sheet's own `cols` grid. A row's `size`, `aspect`,
`seed` and `negative` pass through to the generator.

## 0b. Other styles: one lock and one table per style

The examples in §5–7 come from illustrated-character films; other kinds of pictures need other locks; the table works
the same (`jobs` → generate → `post` → review sheets). These examples compile with `gen_table.py jobs`; they have not
been through a full film yet, so take a second batch after the first review sheet. Write your own words in the locks.

**Signal** (the vocaloid style's signal shots, STYLE.md B.4): NEUTRAL images that the code recolours (heat ramps, channel splits), so
no colour cast, mid contrast, no grade in the picture. Places and objects read best from Codex or Grok (NovelAI is weak
at photographic plates and legible objects, §12); the character can stay on the film's generator.
```json
{ "locks": { "NEUTRAL": "photograph-like still, natural daylight colour, mid contrast, no colour grading, no colour cast, sharp focus",
             "CHAR": "...", "ISO": "the subject alone on a flat #00FF00 background, nothing else", "EMPTY": "no people, no text" },
  "out": "assets/gen",
  "rows": [
    { "id": "PL01", "kind": "world", "locks": ["NEUTRAL", "EMPTY"], "subject": "an empty concrete corridor, ceiling lamps, a door at the end", "aspect": "16:9" },
    { "id": "OBJ01", "kind": "world", "locks": ["NEUTRAL", "ISO"], "subject": "a portable cassette recorder, three-quarter view", "transparent": true },
    { "id": "CH30", "kind": "char", "locks": ["NEUTRAL", "CHAR"], "subject": "extreme close-up of an eye, looking left", "aspect": "16:9" },
    { "id": "SIL01", "kind": "world", "locks": ["NEUTRAL", "ISO"], "subject": "the silhouette of a bird in flight, wings up", "transparent": true } ] }
```
Motion as separate rows (the same bird, wings level and wings down), states as variant rows (`"edit": "soiled, dust on it"`).

**Interface** (screen / treatise, its STYLE.md, Ink plates): art is a flat three-ink cut-paper figure that `kit.js`
splits by brightness into plates, so ask for exactly three flat tones and nothing in between. Codex or Grok first
(flat graphic shapes); on NovelAI lead with tags (`silhouette, flat color, limited palette, no gradients`) and budget
takes.
```json
{ "locks": { "INKS": "flat cut-paper figure in exactly three flat tones (light cream, mid orange, near-black), hard edges, no gradients, no shading, no outlines, no texture",
             "ISO": "the subject alone on a flat #00FF00 background, nothing else" },
  "rows": [
    { "id": "INK01", "kind": "world", "locks": ["INKS", "ISO"], "subject": "a woman at a desk seen from the side, one hand on a keyboard", "transparent": true },
    { "id": "INK02", "kind": "world", "locks": ["INKS", "ISO"], "subject": "an open hand reaching up", "transparent": true } ] }
```
Look at it as the plates (`kit.js` separation in a test sheet): a fourth tone or a soft gradient turns into a ragged
plate edge.


---

## 1. What to generate (derive it from the storyboard)

Do not generate a generic library. Go through `plan/storyboard.md` (and in team mode `docs/STORYBOARD.md`) shot by shot and list what each shot needs. The engine can re-frame, re-grade and re-light an image, but viewers still see the same picture: when a place or a person returns, generate another angle or another moment of it.

**The picture budget:** count it from the shot list, never from a habit.
- A film cut from pictures needs at least one per 2 pictured shots, and no picture in more than 4 shots.
- A fast song cuts more, so it needs more.
- Iteration 7 made 15–16 for 64–81 shots, so one background appeared in 21 shots and the films felt repetitive. A later
  film had 26 for 72, one picture in 9 shots, and its director still said the main pictures repeat too often.
- `storyboard.mjs` fails on both, counting the image paths in the shots' args. Don't accept them out loud, and don't
  argue the concept excuses them ("one room, one monitor"): a single room has many angles.

**Three composites that look fake.** A director rejected these three kinds in one film. Don't use them; do what the
right-hand column says.

| Composite | What it looked like | Instead |
|---|---|---|
| A changed state of an object, pasted in from part of another picture | a rectangle of an inpaint on a guitar case for an opened clasp: its texture and line weight showed, "strange-looking textures" | generate the new state as a whole picture (the clasp shut, then open) and cut between the two |
| An event drawn in flat shapes over a still | a door "closing" as a wedge of flat light at the edge of a still of the shut door, "very fake" | whole pictures of the before and the after (the door ajar, then shut), with a sound or a hit on the cut; or show the hand on the handle and cut |
| A picture put on a screen (monitor, phone, TV) without a perspective transform, or with corners that miss the glass | a singer in a CRT monitor that "doesn't fit precisely": a bilinear warp, the corners set a few pixels inside the glass so a dark rim showed, a bulging CRT glass no four straight edges follow | the perspective transform below, always |

When one of the first two is rejected, don't try a better version of it: generate, or change the shot. Other compositing
is fine and stays: cut-outs on plates, light, particles and type on top of a picture, a prop drawn on a picture (a
sticker), face frames, colour fixes, a sky revealed through a cut polygon, a plate replaced by a whole new picture on a cut.

**A picture on a screen: always a perspective transform.** A picture shown on a screen inside a plate (a phone, a
monitor, a TV) goes through `Z.draw.warpQuad(ctx, img, from, to)`, which maps its four corners onto the glass with a true
perspective transform (references/05). Never paste it upright, scale it into a rectangle, or clip an upright picture to
angled glass.
- Read the four corners off the full-size plate, on the glass's edge where it meets the bezel, not inside it. Overlay the
  quad on the plate at 4x and fix any corner that shows glass or bezel between the line and the edge.
- Clip to the glass's own outline (its rounded corners) and let the picture overfill the quad slightly rather than leave
  a rim of the plate's dark glass.
- Prefer flat glass: a phone, a flat panel, a tablet. A bulging CRT has curved edges no four corners follow; if the film
  needs one, generate it facing the camera and with a flat screen.
- Look at the result at full size in the render, not on a sheet. A phone screen pasted this way passed with the director;
  a monitor with the corners off by a few pixels did not.

**Generate more, and try them.**
- A picture the film leans on (its main room, the person, the screen): at least 3 seeds, compared on a sheet (`tools/art_grid.py`), best one kept.
- Plan the returns while listing: a location in 4 shots or more gets at least 2 plates from the start.
- Try the new picture in its shot on a still before settling; a good picture that doesn't fit the shot goes back to the batch.
- NovelAI at 1 MP or less costs no Anlas on Opus, so generate in batches by section until the budget is met. When the
  user has said Anlas may be spent, spend it where it shows: character references for the cast, a larger `max_pixels`
  for the key plates, `upscale` for close-ups; drafts and takes stay at the free size.

Rules of thumb: one image per *lyric image* the song insists on; generate the **time-of-day variants** the colour script needs for the key locations — a LUT can shift a plate's mood, but light sources (sun position, cast shadows, lamps, windows) must be painted; make close-ups as separate generations (cropping a full body gives soft, low-detail faces). A face that blinks
or sings comes from an expression-sheet row (§0), one per framing.

## 2. `tools/imagegen.py`

Batch generation through the local Codex CLI, `concurrency` jobs in parallel, retries, manifest.

```bash
python tools/imagegen.py assets/char/jobs_master.jsonl --out-dir assets/char --concurrency 3
python tools/imagegen.py assets/char/jobs_core.jsonl   --out-dir assets/char --concurrency 8
python tools/imagegen.py assets/char/jobs_core.jsonl   --out-dir assets/char --only run,jump --force   # redo two
python tools/imagegen.py assets/bg/jobs_bg.jsonl       --out-dir assets/bg   --concurrency 8
```
Options: `--concurrency 8` · `--timeout 600` (s per job) · `--effort low` (Codex reasoning effort; the image quality does not depend on it) · `--attempts 2` · `--only id1,id2` · `--force` (regenerate existing outputs; otherwise existing files are skipped).

Jobs file: JSONL (one object per line) or a JSON list.
```json
{"id": "bust_sing", "out": "bust_sing.png", "transparent": true, "images": ["assets/char/REF_master.png"], "trim": true,
 "prompt": "Bust shot (chest up), facing the viewer, singing ... <CHARACTER SENTENCE> ... <STYLE BLOCK>"}
{"id": "bg_crossing", "out": "bg_crossing.png", "transparent": false, "prompt": "A quiet suburban railway crossing at sunset ... <BG STYLE BLOCK>"}
```
| field | meaning |
|---|---|
| `id` | job key (manifest, logs, `--only`) |
| `prompt` | the full prompt; the wrapper adds "use the native image tool exactly once, reply DONE" around it |
| `out` | output path, relative to `--out-dir` (or absolute) |
| `transparent` | `true` → post-process to RGBA (§4); if the prompt does not contain the job's key colour, a chroma-key sentence for that colour is appended (default: *flat uniform pure chroma-key green (#00FF00) background, no floor, no cast shadow, no green on the subject, generous margin, nothing touches the edges*) |
| `key` | chroma colour for transparent jobs (default `"#00FF00"`; `"#FF00FF"` magenta for teal / aqua / mint / green designs — §4) |
| `images` | reference images attached with `-i` (project-relative). Adds: *keep the same character design, face, hair, outfit, colours and drawing style exactly* |
| `trim` | (default `true`) crop the RGBA result to its content + 16 px margin |

Outputs: `<out>` (final), `<stem>.raw.png` (untouched model output, for transparent jobs), `<out-dir>/manifest.json` (per id: status, elapsed, thread, source path, alpha method, size, transparent/opaque %, prompt), `<out-dir>/_logs/<id>.stdout.jsonl|.stderr.log`.

Measured throughput (残光, Codex image tool): **31–115 s per image** (backgrounds median ≈ 55 s, characters median ≈ 65 s), 5–8 jobs in parallel without throttling; 45 images in roughly 10–15 minutes of wall time. Raw sizes: full-body portraits 1024×1536 (trimmed to ≈ 800×1500), busts ≈ 1400×1120, landscapes **1672×941**.

## 3. Codex CLI gotchas (why the wrapper exists)

- **Where the image lands.** Codex saves generated images under `$CODEX_HOME/generated_images/<thread_id>/ig_*.png` (`CODEX_HOME` defaults to `~/.codex`); the agent's own reply does not contain the path. `codex exec --json` prints JSON events that include the `thread_id`, so the wrapper reads it from stdout and copies the newest PNG from that folder (fallback: any new subfolder created during the run).
- **`-i <FILE>...` is greedy**: it swallows following positional arguments, so a prompt after `-i ref.png` is treated as another image. The wrapper passes the prompt on **stdin** with a trailing `-`.
- The command used (non-interactive, cannot touch the repo):
  `codex exec --json --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules --sandbox read-only --color never -C <project> -c approval_policy="never" -c model_reasoning_effort="low" -i <ref.png> -`
- **Executable location** (`tools/kit_env.py` → `find_codex()`): env `CODEX_BIN`, else `codex` on PATH, else the Windows desktop install `%LOCALAPPDATA%\OpenAI\Codex\bin\codex.exe` (usually *not* on PATH), else `~/.local/bin`, `/usr/local/bin`, `/opt/homebrew/bin`. `python tools/kit_env.py` prints what was found. You must be logged in to Codex once interactively.
- **UTF-8 BOM.** Windows PowerShell 5.1 writes files with a BOM (`Out-File`, `>`), which breaks naive `json.loads`. The job loader reads `utf-8-sig`; write job files with Python or an editor anyway. (An earlier plugin reported "failed" for images that existed because its `result.json` had a BOM.)
- Failures are usually timeouts or a refusal on wording (e.g. a prompt that reads like an existing character); check `_logs/<id>.stderr.log`, adjust, `--only <id> --force`.

## 4. Alpha: native vs chroma key (`tools/alpha_matte.py`)

The model sometimes returns **native alpha** (RGBA with a transparent background) and sometimes paints the requested key-colour background (**#00FF00** unless the job sets `key`). `imagegen.py` decides per image: if < 5 % of pixels are transparent → chroma key, else → normalise native alpha. 残光 char batch: 19 native, 4 keyed.

```bash
python tools/alpha_matte.py check   assets/char/*.png                       # JSON report: alpha range, halo, transparent/opaque %
python tools/alpha_matte.py key     in.raw.png out.png --key auto --band 3 --feather 0.6   # also --key #00ff00|#ffffff, --contract N, --no-despill
python tools/alpha_matte.py trim    in.png out.png --margin 24 [--pad-square]
python tools/alpha_matte.py preview in.png sheet.png                        # composite over checker / black / white / orange
python tools/alpha_matte.py key     in.png out.png --key "#ffffff" --seal 2    # light-on-light: no leaks through line-art gaps
python tools/alpha_matte.py redraw  orig.png orig_green.png out.png         # mask from a green redraw, ORIGINAL pixels kept
```
- **Key**: key colour = median of the image border; hard background within tolerance of it; a 3 px edge band solved per pixel with the two-colour model `C = a·F + (1−a)·K` (F = nearest solid foreground colour); colours un-mixed, **key spill removed only in the soft edge band** (green key: `G ≤ max(R, B)` there; a global clamp would grey teal / mint under a green key and every skin tone under a magenta key), optional contract/feather, transparent pixels filled with the nearest foreground colour so bilinear filtering never pulls green or black into edges. For non-chroma keys (white/grey) only border-connected regions count as background, so eye whites survive.
- **Light-on-light** (white clothes on a white sheet, a pale character on a pale sky): a plain white key leaks through
  every small gap in the line art and eats the clothes. `--seal R` lets the background grow from the border only through
  openings at least 2R+1 px wide and keeps enclosed light areas (give `--holes-min-area` for real holes, e.g. between an
  arm and the body). Look at the preview on black.
- **Redraw mask** (the best cut-out when the art has a painted background or the subject is light-on-light): ask the
  same generator to redraw the image **unchanged on flat #00FF00** (attach the image; "the same picture, same framing,
  same pose, only the background replaced by flat green"), then `alpha_matte.py redraw orig redraw out`. Only the
  redraw's mask is used; every visible pixel is the original's, so faces and lines stay exact. It refuses a redraw that
  moved or changed the subject (`misfit` > 0.12: the mean colour difference inside the mask) -- redraw again.
- **`normalize_alpha`**: native model alpha often tops out at **252–254** on the opaque body (1 % see-through: backgrounds ghost through the character). It rescales so the 99.5th percentile of the body becomes 255, zeroes alpha ≤ 3, and bleeds colour into transparent pixels.
- Fake transparency (a grey checkerboard painted into the image) is detected (`detect_checkerboard`) — regenerate those.
- Always view the `preview` composite on black **and** orange: green fringes and dark halos only show on one of them.
- **Choose the key from the character's palette before generating.** Green (default) only if nothing in the design has G > max(R, B) — no teal, aqua, mint, lime, emerald. Teal / aqua / mint / green designs (typical for summer and sea films, and for V家 colours): magenta, `"key": "#FF00FF"` in the job. Blue (`#0000FF`) only if nothing is blue. The keyer (`alpha_matte.py key --key auto`) reads the screen colour from the image border whichever you pick.

## 5. Character consistency method (if the film has a cast)

1. **Character bible** `docs/CHARACTER.md` (cover: name & concept · silhouette · hair (colour + inner colour) · eyes · signature item · outfit layers · motion prop (which side!) · palette roles as hex · do-nots (existing-character likenesses); ): an *original* design (never an existing character — say so in the prompt: "ORIGINAL character, not any existing character"), with its identity details, any signature item or motion prop, and the palette roles as hex.
2. **Character sentence**: compress the bible into one sentence that is pasted verbatim into every pose prompt (see §6). Name the side of asymmetric details ("ribbon on the LEFT wrist") — models flip them otherwise.
3. **Three master candidates** (three master rows, §0): full body, plain pose, different angle/expression each, *no* reference image, full bible + style block. Make a contact sheet, pick one (ask the user at this checkpoint), copy it to `assets/char/REF_master.png`.
4. **Every pose** = `images: ["assets/char/REF_master.png"]` + pose description + *"The same original character as in the reference image (…character sentence…)"* + the style block. The reference carries the face and proportions; the sentence carries the details the model would drift on.
5. **Two takes of difficult poses** (unusual camera angles, foreshortening, lying/falling, hands): run the job twice (a second jobs file with `alt/` outputs) and keep the better one. A "lying on the back, seen directly from above" prompt came back as a **standing** figure; an extreme close-up asked as a cut-out (`eyes_ecu`, `transparent: true`) came back as a floating face crop and was redone **opaque, full-bleed 16:9**; `hand_reach` needed a rewrite that described only the arm ("Crop shows only the forearm, hand and ribbon").
6. Check every result against the master side by side: hair inner colour, eye colour, signature item, motion prop side, outfit layers. Regenerate rather than "fix in post".
7. **Several reference images: say what each one is for.** "The first image is the drawing style only; the second is
   the character design only (face, hair, outfit)." Without it the model mixes the style image's subject into the design.
8. **Light and tone come from the engine.** Cut-outs appear under several grades (LUTs, `Z.post`), so pose prompts keep
   the design colours (hair, outfit, signature item) but leave out lighting and mood words ("sunset glow", "cold blue
   night", "desaturated"): flat, even light. A cut-out painted warm cannot be graded cold. Backgrounds made for one
   scene may carry that scene's light.
9. **Line-up sheet** when there is more than one character (or one character from several batches):
   `python tools/lineup.py [--height ren=1.0 --height mio=0.92] --bg assets/bg/<a>.png --bg assets/bg/<b>.png` →
   `render/lineup.jpg`: all cut-outs side by side at one scale on a ruler, then standing in two key locations. Look for
   different head sizes, line weights, palettes or rendering; fix before the cut-outs reach scenes. Use full-body poses
   (a bust is not a body height) and read the floor line of each background with `tools/art_grid.py`.

## 6. Style-block templates (write new ones per project)

Write the blocks per film from the concept's medium, palette and picture-source slots, in your own words. Keep each
block identical across all jobs of its kind. (The vocaloid preset's 残光 blocks are in `styles/vocaloid/STYLE.md`,
Asset notes, for preset films only.)

Character sentence, if the film has a cast: the bible compressed into one sentence of identity details (hair, eyes,
signature items, outfit), with the side of every asymmetric detail named.

Prompt anatomy that worked: **framing** ("Bust shot (chest up)", "Full body seen from behind", "Extreme close-up … 16:9 landscape") → **pose/action** with physical cues for animation (hair and ribbon direction, wind) → **emotion** → character sentence → style block → constraints. For backgrounds: place + time of day + light source + 2–3 concrete local details (crossbuck, catenary wires, vending machine) + style block; for night/dawn variants restate the place ("The same kind of quiet suburban railway crossing at night: …") and the light that changes.

Palette words pull every image toward their light and time of day: change the medium, palette words, line description and shading rule together, from the concept.

## 7. Backgrounds and props

- **Size**: 16:9 at **1672×941** (the model's landscape size) is enough. The engine draws with `imageSmoothingQuality = 'high'`; up to **~1.45× cover zoom** at 1080p stays clean. For deeper push-ins (eyes, a single window) generate a dedicated close-up instead of zooming.
- Ask for **no people and no readable text** in backgrounds: the engine adds characters and typesets every sign itself (models write fake kana).
- Leave compositional room: low horizon for sky shots, an empty road centre for a small figure, a clear light source (sun, lamp, door gap) — scenes pin glows, lamp flashes and sun discs onto image coordinates.
- Variants follow the colour script: a night film needs lamps painted on and dawn plates with the sun on the horizon; a daylight film needs noon / afternoon / golden-hour plates with a consistent cast-shadow direction. Plates with nothing but sky, sea or ground are easy to reuse under different treatments.
- Props: isolated object, transparent, same style block.
- Colour: generate in colour from the palette words and pull shots together in the engine with gradient-map LUTs (`lutMix`, 05-engine), or ask for grey values and colour in code. For layers that will be heavily graded (multiplane strips, props), "grey values only: black ink lines, 3–5 flat grey fills" prompts give full control later.
- File layout: `assets/char/*.png` (RGBA, trimmed), `assets/char/alt/`, `assets/bg/*.png` (opaque), job files next to their outputs.

## 8. Review

- Make a contact sheet per batch and look at it (images are readable by the agent); compare against `REF_master.png`.
  ```bash
  python -c "import sys,glob;from PIL import Image;fs=[f for f in sorted(glob.glob(sys.argv[1])) if '.raw.' not in f];W=320;ims=[Image.open(f).convert('RGBA') for f in fs];hs=[int(W*i.height/i.width) for i in ims];S=Image.new('RGB',(W*min(6,len(fs)),max(hs)*((len(fs)+5)//6)),(30,30,30));[S.paste(i.resize((W,h)),((k%6)*W,(k//6)*max(hs)),i.resize((W,h))) for k,(i,h) in enumerate(zip(ims,hs))];S.save(sys.argv[2])" "assets/char/*.png" assets/char/_sheet.jpg
  ```
- Check per image: identity matches the master; asymmetric details on the right side; hands (finger count, ribbon wrist); alpha clean on black and orange; no text; the subject reads in silhouette.
- Record landmarks you will animate around (face centre, hand position, flame core, lamp lenses) in image pixels — several library scenes pin effects to such coordinates (a preset's porting checklist, e.g. `styles/vocaloid/STYLE.md`).

## 9. Other image models

Anything that can (a) take a reference image and (b) produce either RGBA or a flat key-colour background works: replace the `run_job()` call in `imagegen.py` (or generate by hand), keep the jobs file, and run `alpha_matte.py key/trim` on the results. Tips: if the model has no reference-image input, lean harder on the character sentence and generate several takes; prefer #00FF00 for warm-palette characters (no green in the design) and a magenta key (`"key": "#FF00FF"`) if the design has teal, aqua, mint or green; ask for "generous margin, nothing touches the image edges" or the trim will cut hair.

## 10. Pitfalls

- Generating poses before the master is fixed → five slightly different characters. Lock `REF_master.png` first.
- Prompt drift: editing the character sentence between batches. Keep it in one file and paste it programmatically.
- Unusual angles (from above, lying, foreshortened) silently fall back to a standing pose — always two takes, always look.
- Native alpha at 252–254 → the background ghosts through the body; run `normalize_alpha` (automatic in `imagegen.py`).
- Close-ups meant to fill the frame must be **opaque 16:9**, not cut-outs.
- Model-drawn text, logos or signatures in the art; existing-character likeness. Say "original" and "no text" in every prompt.
- `--force` overwrites the chosen take; copy keepers to `alt/` or rename before re-running a batch.
- Too many assets: every new image is ~1 min plus review time. Re-frame, re-grade and silhouette what you have first.

## 11. Grok Build CLI (mv-studio: `tools/grokgen.py` + `tools/grok_run.sh`)

Same jobs files as `tools/imagegen.py` (`id`, `prompt`, `out`, `transparent`, `key`, `images` = references, `trim`) plus
`aspect` (`16:9` | `9:16` | `1:1` | `2:3` | `3:2`; default 16:9, 2:3 for cut-outs). Grok's headless tools are `image_gen`
(prompt + aspect) and `image_edit` (reference images by absolute path: the character master for every pose; two
references to change an image's aspect ratio). **Grok will not start when Python launches it**, so it is three steps:
```bash
python tools/grokgen.py plan    assets/char/jobs_core.jsonl --out-dir assets/char     # _grok/<id>/prompt.txt + pending.txt
bash   tools/grok_run.sh 4                                                             # from the shell; ~20-40 s per image
python tools/grokgen.py collect assets/char/jobs_core.jsonl --out-dir assets/char     # copy, chroma-key, trim, check sheet
```
`image_edit` with ONE reference keeps that reference's aspect ratio (a 2:3 character master gives a 2:3 result whatever `aspect` says): for a 16:9 scene with the character, pass the master plus a 16:9 image (the background plate) as two references. Then **open `<out-dir>/_check_grok.jpg`** and look at every image. Typical misses: an extra figure or a framed scene behind
a cut-out (the prompt already says "the subject alone"; repeat it in your own words), a subject cut by the frame, a
"cut-out" that came back as a full rectangle (collect reports it), unreadable sign-like marks in towns. Re-run single
jobs with `--only id1,id2 --force`. `--always-approve` lets the CLI save files without a prompt; nothing else runs.
Never put keys or account details into prompts or files; the CLI uses the user's own sign-in.

**Things that must touch:** generate them together when the contact matters (a train on its bridge, a figure sitting on
a wall), or generate the plate first, read the contact line with `tools/art_grid.py`, and place the cut-out with
`pin` + `ground` / `water` (05 §12). Shadows and reflections belong to the scene, not to the cut-out (keep cut-outs
shadow-free; the engine adds contact shadows and reflections).

## 12. NovelAI (mv-studio: `tools/novelaigen.py`)

NovelAI's image API with its anime-trained models (default `nai-diffusion-5-full`): strong for illustrated characters
and painted backgrounds, weaker for photographic plates, legible objects and UI-like pictures. Same jobs files (`aspect`
as Grok plus `4:3` `3:4`; sized to ≤ 1 MP in multiples of 64).
```bash
python tools/novelaigen.py assets/char/jobs_core.jsonl --out-dir assets/char --dry-run          # request bodies in _novelai/, nothing sent
python tools/novelaigen.py assets/char/jobs_core.jsonl --out-dir assets/char --only master_a    # ONE job first, look at it
python tools/novelaigen.py assets/char/jobs_core.jsonl --out-dir assets/char                    # the rest; then _check_novelai.jpg
```
- **Key:** only from the environment variable `NOVELAI_API_KEY` (a persistent API token from NovelAI's account
  settings). The user sets it in their own shell (`setx NOVELAI_API_KEY "<token>"` on Windows, then a new terminal;
  `export` on macOS / Linux). Never ask for it in the chat, never write it into `art.config.json`, a jobs file, a script
  or a log. `check_env.py` and `artgen.py providers` only report whether it is set.
- **One at a time.** NovelAI runs one generation per account; the tool is sequential and retries HTTP 429 / 5xx with
  back-off.
- **Cost.** On an Opus subscription a plain generation up to 1 MP and 28 steps is free; larger sizes, more steps, img2img
  and references cost Anlas (HTTP 402 = no subscription or not enough Anlas; the tool stops at the first 401/402/403).
- **Prompts.** The V4.5 and V5 models read natural language *and* Danbooru-style tags; a tag lead-in helps
  (a count tag such as `solo` or `no humans`, `original`, the framing, then the subject). **Never use character, series or artist tags**:
  they reproduce existing characters and styles, which breaks "original characters only". The tool adds a negative
  prompt (`nsfw`, text, logo, watermark, bad hands, ...) from `art.config.json` → `novelai.negative`; a job adds its own
  with `"negative"`. Cut-outs get the tags `solo, simple background, green background` (V3 models: plus the usual key
  sentence); check the edge for a green rim and use `"key": "#FF00FF"` for green / teal designs as usual.
- **Write the locks as tags on NovelAI.** Prompt = count tags + `original` + framing + subject +
  the STYLE tags + `masterpiece, best quality, very aesthetic`. The character goes in `"char"` (a V4 character caption:
  hair, eyes, outfit, signature items as tags); `gen_table.py` fills it from the row's `CHAR` / `CHAR_BACK` lock. Leave
  out prose sentences, "generous margin" and "nothing touching the edges": in an A/B on one pose (Gemini runs of
  2026-10, seed 1003) the prose version stood front-on with both hands at the chest, the tag version with the character
  caption threw the head back with the microphone raised.
- **Backgrounds on NovelAI:** start the WORLD lock with `scenery, no humans,` and end it with `anime background art,
  detailed background, painterly sky, dramatic lighting` (+ quality tags). The §6 wording "flat cel colour areas …
  sky painted as a few posterised colour bands" reads as screen-print to NovelAI: in the same A/B it gave a halftone dot
  sky, the tag lock a painted dusk sky. Never add an artist's name to reach a look.
- **More variety:** `"nai": {"skip_cfg_above_sigma": 58}` on a job (or `skip_cfg_above_sigma` in `art.config.json` →
  `novelai`) gives livelier poses, and the design drifts more (the A/B lost the outfit's details): use it for action
  poses, check the design, keep it off for masters and sheets.
- **Seeds.** Default seed = hash of id + prompt, so a re-run gives the same image (the manifest records it). For
  another take change `"seed"` (or the prompt) and pass `--force`.
- **References** (`"images"`), by `ref_mode`: `"character"` (V4.5 character reference: the identity of the first image;
  `ref_strength`, `fidelity`; the default on V4.5; on V5 the default is `"img2img"`), `"img2img"` (the first image is the starting picture, `"strength"`
  0–1, default 0.6: re-framing a plate, a variant of a pose), `"vibe"` (V3 models). Character reference is the way to
  keep a master consistent across poses, and it costs Anlas. The reference request format is the least stable part of
  NovelAI's API: run one job first; on HTTP 400 try `img2img`, or go without and lean on the verbatim character
  sentence plus several takes (§9). On `nai-diffusion-5-full` the character reference returned HTTP 500 on every
  retry (iteration 6, 2026-10-24): with V5, leave `refs.char` empty and hold the design with `"char"` tags.
- **Model / settings:** `art.config.json` → `novelai` (`model`, `steps`, `scale`, `sampler`, `noise_schedule`,
  `max_pixels`, `negative`, `upscale_model`); raw request overrides per job in `"nai": {...}`. Other models: `nai-diffusion-4-5-full`, `nai-diffusion-4-5-curated`,
  `nai-diffusion-4-full`, `nai-diffusion-3`. `NOVELAI_API_URL` overrides the endpoint (a proxy or a local mock).
- The returned PNG is re-encoded on save (NovelAI's metadata chunks with the prompt are not kept).
- **Edit jobs** (`"op"`, the source in `"images"`, no prompt; same jobs file, same one-at-a-time queue, all cost Anlas):
  - `"upscale"`: 2× (an 832×1216 master becomes 1664×2432, for close-ups and the 9:16 crop; run it twice for 4×).
    Only the V5 line upscales (`novelai.upscale_model`, default `nai-diffusion-5-full`); a cut-out keeps its own
    matte, scaled up. Crisper lines than a plain resize, not new detail: it can't rescue a blurry source.
  - `"bg-removal"`: cuts the subject out of a full picture, e.g. a character from a generation that kept its
    scenery, or a pose that only works with a background. Gives a native-alpha cut-out, trimmed like the rest; check
    hair and loose edges on the check sheet.
  - `"lineart"`, `"sketch"`, `"declutter"`, `"colorize"`, `"emotion"`: the other Director tools, with `"prompt"` and
    `"defry"` as NovelAI takes them (emotion: `"prompt": "happy;;"`, `"defry"` 0–5).
  ```json
  {"id": "master_a_2x", "op": "upscale", "images": ["assets/char/master_a.png"], "out": "master_a_2x.png"}
  {"id": "pose_run_cut", "op": "bg-removal", "images": ["assets/char/pose_run_scene.png"], "out": "pose_run.png"}
  ```
  Generate first, then edit in a second jobs file (an edit job needs its source to exist). `--dry-run` shows these
  requests too. The API centre-crops sources off its size grid, so the tool pads them and cuts the padding off again
  (any source size is fine). Upscale and bg-removal were checked live on 2026-10-24; the other Director tools only
  share the request format, so run ONE job first.

## 13. Choosing the generator (`tools/artgen.py`)

The kit prefers no generator: **the user chooses.** Ask once, at the assets checkpoint, which one they want (or which
for what, e.g. characters on NovelAI and plates on Codex), and record it:
```bash
python tools/artgen.py providers                                                         # available? chosen?
python tools/artgen.py use novelai                                                       # art.config.json "provider"
python tools/artgen.py run assets/char/jobs_core.jsonl --out-dir assets/char             # the chosen generator
python tools/artgen.py run assets/bg/jobs_bg.jsonl --out-dir assets/bg --provider codex  # one batch elsewhere
python tools/artgen.py collect assets/char/jobs_core.jsonl --out-dir assets/char         # Grok only, after grok_run.sh
```
Per job, the first of these wins: the job's `"provider"` field, `--provider`, env `MV_ART_PROVIDER`,
`art.config.json` `"provider"` (also set by `new_project.py --art`), the only available provider. With several
available and nothing chosen it stops and lists them: ask the user, don't pick for them. Backend options pass through
(`artgen.py run <jobs> -- --concurrency 4`) or live in `art.config.json` → `<provider>.args`.
Any other generator that takes `<jobs> --out-dir <dir>` and writes the outputs plus `manifest.json` plugs in through
`art.config.json` → `"custom"`, with no code change:
`{"mygen": {"cmd": ["python", "tools/mygen.py", "{jobs}", "--out-dir", "{out_dir}"], "needs_env": "MYGEN_KEY"}}`
(model it on `novelaigen.py`: reuse `imagegen.load_jobs`, `key_suffix`, `postprocess_alpha` and `grokgen.check_sheet`).
Each generator is subject to its own terms; whatever made the image, look at the check sheet.

---
Author: **NikusonP** · vocaloid-style-mv-pipeline (MIT)
