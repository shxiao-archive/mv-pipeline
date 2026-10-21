# 04 — Asset generation (characters, backgrounds, props)

Contents: 1 What to generate (shot-driven list) · 2 `tools/imagegen.py` · 3 Codex CLI gotchas · 4 Alpha: native vs chroma key (`tools/alpha_matte.py`) · 5 Character consistency method · 6 Style-block templates · 7 Backgrounds and props · 8 Review · 9 Other image models · 10 Pitfalls · 11 Grok · 12 NovelAI · 13 Choosing the generator (`tools/artgen.py`)

The method is model-agnostic: **one master reference image + a verbatim character sentence + a verbatim style block** for every pose, transparent output via native alpha or a flat chroma-key background. The kit wraps the **Codex CLI**'s native image tool because that is what 残光 used; §9 covers other generators.

---

## 1. What to generate (derive it from the storyboard)

Do not generate a generic pose library. Go through `docs/STORYBOARD.md` shot by shot and list what each shot needs; merge duplicates. 残光 ended with **17 poses (+6 alternates), 14 backgrounds, 1 prop** for ~70 shots — roughly one asset per 3–4 shots, because the engine re-frames, re-grades and re-lights the same images many times (`illust` camera moves, LUTs, silhouettes, rims, panels, bursts).

| need | 残光 example | typical shots |
|---|---|---|
| reference / masters | `REF_master` (+ `master_a`, `master_c`) full body front | title lockup, afterimage, recaps |
| singing (2–3) | `bust_sing` (hand on headphone), `profile_sing` (side profile), `sing_power` (low angle, full voice) | chorus slams, panels, bursts |
| quiet / emotional (3–4) | `bust_calm` (eyes closed), `face_tear`, `lookup_tear`, `smile_dawn` | verses, breathing shots, ending |
| back view | `back_sunset` (hair and ribbon blowing) | establishing shots, small figure in a big world |
| full-body action (3–4) | `run` (to the left), `turn_smile`, `jump`, `fall` (seen from above), `reach_viewer` (foreshortened hand) | climaxes, bursts, the road |
| body language (2–3) | `hug_self`, `sit_knees`, `kneel_pick` | verses, despair, gathering |
| hands / close-ups | `hand_reach` (arm + ribbon only), `flame_hands`, `hands_shards`, `eyes_ecu` (**opaque 16:9** eye close-up) | lyric images (指先, 小さな火, 拾い上げて) |
| locations (8–14) | `bg_crossing`, `_night`, `_dawn`, `bg_platform`, `bg_embankment`, `bg_train`, `_night`, `bg_rooftop`, `bg_sky` (sky only), `bg_fireflies`, `bg_classroom`, `bg_vending`, `bg_door`, `bg_wetstreet` | every `illust` shot |
| props | `prop_heart` (cracked glass heart, RGBA) | the song's central metaphor |

Rules of thumb: one image per *lyric image* the song insists on (in 残光: cracked sky, thread, rusted door, cold fingertips, falling, a small flame, shattered heart, wet floor, broken wings, tears → road); a back view and a sky-only plate are always useful; generate the **time-of-day variants** your colour script needs for the 2–3 key locations (残光: night/dawn; a daylight film: noon / afternoon / golden hour) — a LUT can shift a plate's mood, but light sources (sun position, cast shadows, lamps, windows) must be painted; make close-ups as separate generations (cropping a full body gives soft, low-detail faces).

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

## 5. Character consistency method

1. **Character bible** `docs/CHARACTER.md` (cover: name & concept · silhouette · hair (colour + inner colour) · eyes · signature item · outfit layers · motion prop (which side!) · palette roles as hex · do-nots (existing-character likenesses); a worked example is [examples/zanko/CHARACTER.md](https://github.com/EGSECDA/vocaloid-style-mv-pipeline/blob/main/examples/zanko/CHARACTER.md) in the kit repo, not inside the installed skill): an *original* design (never an existing character — say so in the prompt: "ORIGINAL virtual singer girl (Vocaloid-style design, NOT Hatsune Miku, not any existing character)"), with hair (colour + an inner colour that rim-lights well), eyes, a **signature item** (残光: white headphones with orange ring lights, a setting-sun hairpin), outfit, a **motion prop** that animates for free (a 1 m vermilion ribbon on the left wrist), and the palette roles as hex.
2. **Character sentence**: compress the bible into one sentence that is pasted verbatim into every pose prompt (see §6). Name the side of asymmetric details ("ribbon on her LEFT wrist", "hairpin on her right side") — models flip them otherwise.
3. **Three master candidates** (`jobs_master.jsonl`): full body, plain pose, different angle/expression each, *no* reference image, full bible + style block. Make a contact sheet, pick one (ask the user at this checkpoint), copy it to `assets/char/REF_master.png`. 残光 chose `master_b` (front, arms loose, wind in the hair).
4. **Every pose** = `images: ["assets/char/REF_master.png"]` + pose description + *"The same original character as in the reference image (…character sentence…)"* + the style block. The reference carries the face and proportions; the sentence carries the details the model would drift on.
5. **Two takes of difficult poses** (unusual camera angles, foreshortening, lying/falling, hands): run the job twice (a second jobs file with `alt/` outputs) and keep the better one. 残光 generated alternates of `fall`, `flame_hands`, `hug_self`, `kneel_pick`, `reach_viewer`, `smile_dawn`. A "lying on her back, seen directly from above" prompt came back as a **standing** figure; an extreme close-up asked as a cut-out (`eyes_ecu`, `transparent: true`) came back as a floating face crop and was redone **opaque, full-bleed 16:9**; `hand_reach` needed a rewrite that described only the arm ("Crop shows only the forearm, hand and ribbon").
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

These are the blocks 残光 actually used. **Copy the structure, not the words**: a new film needs its own medium, palette words and mood. Keep each block identical across all jobs of its kind.

Character sentence (残光):
```text
The same original character as in the reference image (waist-length ink violet-black hair with sunset-orange inner
colour and tips, blunt bangs, amber-gold eyes, white headphones with glowing orange ring lights, setting-sun hairpin on
her right side, navy sailor blouse with vermilion tie, oversized cream knit cardigan, navy pleated skirt, black tights,
brown loafers, long vermilion ribbon tied on her LEFT wrist).
```
Character style block (appended to every character, close-up and prop prompt):
```text
Japanese Vocaloid music-video tegaki (hand-drawn) illustration: confident hand-inked line art with visible brush-pen
pressure (thick outer contour, thin inner lines), flat cel colours with ONE hard shadow tone, no airbrushed gradients on
skin or clothes, restrained dusk palette (ink violet-black, dusk magenta, vermilion, sunset orange, amber, cream), crisp
readable silhouette, looks like a key frame from an indie Vocaloid MV. No text, no watermark, no signature.
```
Background style block:
```text
Style: Japanese Vocaloid MV tegaki background art, hand-inked outlines on buildings and objects (coloured line art, not
pure black), flat cel colour areas with hard-edged shadow shapes, sky painted as a few posterised colour bands instead
of a smooth gradient, subtle paper grain, restrained palette of ink violet-black, dusk magenta, vermilion, sunset orange,
amber and cream. Wide 16:9 landscape composition. No people, no characters, no text, no readable signs, no watermark.
```
Prompt anatomy that worked: **framing** ("Bust shot (chest up)", "Full body seen from behind", "Extreme close-up … 16:9 landscape") → **pose/action** with physical cues for animation (hair and ribbon direction, wind) → **emotion** → character sentence → style block → constraints. For backgrounds: place + time of day + light source + 2–3 concrete local details (crossbuck, catenary wires, vending machine) + style block; for night/dawn variants restate the place ("The same kind of quiet suburban railway crossing at night: …") and the light that changes.

Daylight example (summer / sea film), palette words only (the 残光 blocks above name a dusk palette, and those words alone pull every image toward sunset):
```text
…high-key summer daylight, saturated sky cyan and sea teal, white cumulus, coral and sunflower accents, crisp cast
shadows, bright paper white, no dusk or night tones…
```

Variation ideas for a new film (pick one coherent medium): pencil + watercolour wash; screen-print 2–3 inks; thick-line pop with halftone; sumi ink + one accent colour; pastel chalk; flat vector with paper texture. Change the palette words, the line description and the shading rule together, and match the time of day to the colour script.

## 7. Backgrounds and props

- **Size**: 16:9 at **1672×941** (the model's landscape size) is enough. The engine draws with `imageSmoothingQuality = 'high'`; up to **~1.45× cover zoom** at 1080p stays clean under line boil + grain (残光 camera moves used zoom 1.0–1.5). For deeper push-ins (eyes, a single window) generate a dedicated close-up instead of zooming.
- Ask for **no people and no readable text** in backgrounds: the engine adds characters and typesets every sign itself (models write fake kana).
- Leave compositional room: low horizon for sky shots, an empty road centre for a small figure, a clear light source (sun, lamp, door gap) — scenes pin glows, lamp flashes and sun discs onto image coordinates.
- Variants follow the colour script: a night film needs lamps painted on and dawn plates with the sun on the horizon; a daylight film needs noon / afternoon / golden-hour plates with a consistent cast-shadow direction. A sky-only plate (`bg_sky` in 残光; with cumulus for daylight) and a sea- or ground-only plate are the most reused images (cracks, slams, monuments).
- Props: isolated object, transparent, same style block.
- Colour: 残光 generated art *in colour* using the palette words above and pulled shots together in the engine with gradient-map LUTs at `lutMix` 0.1–0.35 (05-engine). For layers that will be heavily graded (multiplane strips, props), "grey values only: black ink lines, 3–5 flat grey fills" prompts give full control later.
- File layout: `assets/char/*.png` (RGBA, trimmed), `assets/char/alt/`, `assets/bg/*.png` (opaque), job files next to their outputs.

## 8. Review

- Make a contact sheet per batch and look at it (images are readable by the agent); compare against `REF_master.png`.
  ```bash
  python -c "import sys,glob;from PIL import Image;fs=[f for f in sorted(glob.glob(sys.argv[1])) if '.raw.' not in f];W=320;ims=[Image.open(f).convert('RGBA') for f in fs];hs=[int(W*i.height/i.width) for i in ims];S=Image.new('RGB',(W*min(6,len(fs)),max(hs)*((len(fs)+5)//6)),(30,30,30));[S.paste(i.resize((W,h)),((k%6)*W,(k//6)*max(hs)),i.resize((W,h))) for k,(i,h) in enumerate(zip(ims,hs))];S.save(sys.argv[2])" "assets/char/*.png" assets/char/_sheet.jpg
  ```
- Check per image: identity matches the master; asymmetric details on the right side; hands (finger count, ribbon wrist); alpha clean on black and orange; no text; the pose reads in silhouette (the engine uses silhouettes and rims a lot).
- Record landmarks you will animate around (face centre, hand position, flame core, lamp lenses) in image pixels — several library scenes pin effects to such coordinates (05-engine §11).

## 9. Other image models

Anything that can (a) take a reference image and (b) produce either RGBA or a flat key-colour background works: replace the `run_job()` call in `imagegen.py` (or generate by hand), keep the jobs file, and run `alpha_matte.py key/trim` on the results. Tips: if the model has no reference-image input, lean harder on the character sentence and generate several takes; prefer #00FF00 for warm-palette characters (no green in the design) and a magenta key (`"key": "#FF00FF"`) if the design has teal, aqua, mint or green; ask for "generous margin, nothing touches the image edges" or the trim will cut hair.

## 10. Pitfalls

- Generating poses before the master is fixed → five slightly different girls. Lock `REF_master.png` first.
- Prompt drift: editing the character sentence between batches. Keep it in one file and paste it programmatically.
- Unusual angles (from above, lying, foreshortened) silently fall back to a standing pose — always two takes, always look.
- Native alpha at 252–254 → the background ghosts through the body; run `normalize_alpha` (automatic in `imagegen.py`).
- Close-ups meant to fill the frame must be **opaque 16:9**, not cut-outs.
- Model-drawn text, logos or signatures in the art; existing-character likeness (headphones + twin tails + teal = trouble). Say "original" and "no text" in every prompt.
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

NovelAI's image API with its anime models (default `nai-diffusion-4-5-full`): strong for tegaki characters and painted
anime backgrounds, weaker for photographic plates, legible objects and UI-like pictures. Same jobs files (`aspect`
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
- **Prompts.** The V4.5 models read natural language *and* Danbooru-style tags; a tag lead-in helps
  (`1girl, solo, original, full body, ...` then the character sentence). **Never use character, series or artist tags**:
  they reproduce existing characters and styles, which breaks "original characters only". The tool adds a negative
  prompt (`nsfw`, text, logo, watermark, bad hands, ...) from `art.config.json` → `novelai.negative`; a job adds its own
  with `"negative"`. Cut-outs get `simple background, green background` plus the usual key sentence; check the edge for
  a green rim and use `"key": "#FF00FF"` for green / teal designs as usual.
- **Seeds.** Default seed = hash of id + prompt, so a re-run gives the same image (the manifest records it). For
  another take change `"seed"` (or the prompt) and pass `--force`.
- **References** (`"images"`), by `ref_mode`: `"character"` (V4.5 character reference: the identity of the first image;
  `ref_strength`, `fidelity`; the default on V4.5), `"img2img"` (the first image is the starting picture, `"strength"`
  0–1, default 0.6: re-framing a plate, a variant of a pose), `"vibe"` (V3 models). Character reference is the way to
  keep a master consistent across poses, and it costs Anlas. The reference request format is the least stable part of
  NovelAI's API: run one job first; on HTTP 400 try `img2img`, or go without and lean on the verbatim character
  sentence plus several takes (§9).
- **Model / settings:** `art.config.json` → `novelai` (`model`, `steps`, `scale`, `sampler`, `noise_schedule`,
  `max_pixels`, `negative`); raw request overrides per job in `"nai": {...}`. Other models: `nai-diffusion-4-5-curated`,
  `nai-diffusion-4-full`, `nai-diffusion-3`. `NOVELAI_API_URL` overrides the endpoint (a proxy or a local mock).
- The returned PNG is re-encoded on save (NovelAI's metadata chunks with the prompt are not kept).

## 12b. The generation table and expression sheets (`tools/gen_table.py`)

One table for the film's images (locks + a subject per row, references, sizes, keys), compiled into jobs files for
`artgen.py`, then `post` (finals, review sheets per category, `status`). A character's expressions come from a
**sheet row**: one generation of all of them (same style), split, aligned and cut to eye / mouth patches for the
engine (`styles/vocaloid/STYLE.md`). Lessons from the first real runs (NovelAI): its "magenta" screen comes out hot
pink (the keyer treats it as a two-channel screen; before, it ate every red / brown / skin colour); it lays a sheet out
its own way (a full body plus heads: pick the figures by number); copies on a sheet are each redrawn a little, so a
whole feature area is pasted, not only the changed pixels; asking for a changed version of a finished picture (img2img
/ inpaint of a head) drifts in style or does not change — variant rows remain for small fixes to one face (inpaint of
an eye or mouth region, `"takes": 3`).

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
