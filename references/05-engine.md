# 05 — The engine: architecture, API, scene library

Contents: 1 Architecture · 2 Hard rules (determinism, performance) · 3 The timeline (`engine/timeline.js`) · 4 Scene API · 5 Drawing toolkit · 6 Transitions · 7 Post pass and LUTs · 8 Shared scenes · 9 Writing a new scene · 10 Porting a preset's scenes · 11 Pitfalls

---

## 1. Architecture

`engine/index.html` loads, in order: seeded `Math.random` shim → `../jizura/app/jizura_engine.js` + `jizura_adapter.js` → `core/util.js` → `core/assets.js` → `core/gl.js` → `core/draw.js` → `core/trans.js` → … → `core/scenes.js` (`solid`, `jz`, `illust`) → the style packs (`styles/<preset>/*`, §12) → the timeline (`timeline.js`, or `?tl=tests/<file>.js`) → `core/main.js`. `engine/vertical.html` is the same stack (`?tl=` included) plus `Z.NO_LYRICS = Z.VERTICAL = true` and `vertical.js` (see 08).

Contract used by the renderer: `window.ready` (Promise → `{duration, fps, renderer, shots, assets}`), `window.renderFrame(t)` (async, draws song time `t` into `<canvas id="out">`), `window.__zankoMeta` (`{duration, fps}`; the timeline must set `duration`).

Per frame (1920×1080, 30 fps):

```
active shot(s) at t ──► scene.draw(ctx, S) ─► SCENE layer (Canvas2D, opaque)      ─┐
                        └─ S.fg  ───────────► FOREGROUND layer (transparent)        │  WebGL2 post (gl.js):
JIZURA plan (shot.lyric) ─► TEXT layer (transparent) ◄─ shot.text(ctx,S) ◄─ Z.hud   ├─► comp: scene → boil, glitch, zoom blur, CA,
                                                                                    │   palette LUT, grade; + text (opt. textCa);
                                                                                    │   + fg (same boil + grade)
                                                                                    └─► bloom (3 levels) → flash, invert,
                                                                                        vignette, grain, fade, letterbox, dither
```
- Line boil, glitch, zoom blur, CA and LUTs touch the **scene** layer; the **text** layer stays crisp on top; the **foreground** layer (characters drawn in front of the lyrics) gets the same boil and grade as the scene, but sits *above* the text — the "lyric passes behind the singer" look.
- During a transition (`[t0, t0+trans.dur]` of the incoming shot) both shots render into separate canvases, the transition function blends them, post params are interpolated (`inOutSine`; different `lutA`s cross-blend via `lutB/lutBlend`), and the lyric layer follows the **incoming** shot.

## 2. Hard rules

- **Pure function of time.** No `Date.now()`/`performance.now()` in visuals, no unseeded randomness. Use `Z.rnd(...ints)` [0,1), `Z.rnds` [−1,1), `Z.rng(seed)` (mulberry32 stream with `.range .pick .sign`), `Z.noise1(x, seed)`, `Z.fbm1(x, seed, oct)`, `S.rng(seed)` (seeded per shot). Particles are closed-form in `t` (`D.rain`); if a simulation is unavoidable, integrate from the shot start with fixed `dt` (残光 `fall`). Workers seek to arbitrary frames: a scene may be entered at any `t` and must not carry state between frames except caches of immutable data (offscreen art keyed by args).
- The render page seeds `Math.random` once per frame (`__zankoSeed(f)`), so third-party code (JIZURA's textures) stays identical across workers — but don't rely on draw order.
- **Bitmap warm-up.** Chromium rasterises the *first* draw of an ImageBitmap differently (measured up to 78/255 on sprite edges). `meta.js` draws every preloaded image once at 4 scales in its `init`; it only runs if a meta scene (`panels`, `burst`, `ref`, `seq`) is in the timeline. If yours has none, move that warm-up into `main.js` after `Z.preload` — otherwise frames can differ at worker seams.
- Draw only inside 1920×1080; `save()/restore()` around state; reset `globalCompositeOperation`, `filter`, `globalAlpha`. `Z.scratch[0..2]` are shared 1920×1080 temp canvases — use them only inside one synchronous draw, never across `await`.
- **Hand-drawn timing**: drawn/character motion on 12 fps (`Z.quant(t, 12)`, `S.tq`, `S.ltq`, char `q: 12`); camera, light, particles on full time.
- **Performance**: target < 40 ms per frame (残光 averaged ≈ 6 ms render per frame; readback dominates). `ctx.filter = 'blur()'` on large canvases is expensive — blur small canvases or cache pre-blurred art. No `getImageData` per frame except on tiny canvases. Prefer `drawImage` of cached sprites.

## 3. The timeline (`engine/timeline.js`)

```js
(() => { const Z = window.Z, D = Z.draw, E = Z.ease; const A = 'assets/char/', BG = 'assets/bg/';
  Z.TITLE = '<title>'; Z.TITLE_SUB = '<romaji>'; Z.ARTIST = '<artist>';   // new_project.py --title / --title-sub / --artist
  Z.CREDIT = 'Music / Lyrics / Movie：<artist>';                           // new_project.py --credit
  Z.setup = async (audio) => {
    const lastBar = audio.bars.length ? audio.bars[audio.bars.length - 1].index : 0;
    const B = n => { const b = audio.bars.find(x => x.index === n); return b ? b.start : n > lastBar ? audio.music_cut : 0; };   // by bars[].index, never array position
    const nb = t => audio.beats.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), audio.beats[0] ?? t);
    // no beats after music_cut: nb() snaps every tail time back to the last beat and collapses the tail shots; time them in seconds
    Z.LOOK_DEFAULT = { boil: 0, bloom: 0, grain: 0, vignette: 0, lutMix: 0 };   // the film's own values (every param: §7)
    // JIZURA: JZ.setAudio(...); await JZ.addPlan('main', {...}); ...           (06-jizura.md)
    const S = []; const shot = (id, t0, t1, scene, args, extra = {}) => S.push(Object.assign({ id, t0, t1, scene, args }, extra));
    shot('s04', B(10), nb(20.76), 'myScene', { /* the scene's own args */ }, { lyric: 'none', trans: { type: 'iris', dur: 0.55, cx: 960, cy: 540 } });
    Z.SHOTS = S;
    window.__zankoMeta.duration = audio.music_cut + 3;   // song + end-card tail (mux pads the audio)
  };
})();
```
**Shot object**: `{ id, t0, t1, scene, args, lyric, plan, post, trans, text, hud }`
- `lyric`: `'front'` (default: JIZURA's front layer over the scene) · `'full'` (JIZURA's own backgrounds too — covers the scene) · `'backfront'` · `'none'` · `{plan, mode}` · or `S => …`. `plan`: JIZURA plan name (default `'main'`).
- `post`: object or `S => object`, merged over `Z.LOOK_DEFAULT` (+ `Z.LOOKS[section.look]` if you define looks and `Z.sectionAt`).
- `trans`: `{type, dur, …params, post?: (k, P) => {}}` — transition *into* this shot, occupying `[t0, t0+dur]`.
- `text: (ctx, S) => {}` custom typography on the text layer (after JIZURA). `hud: false` hides `Z.hud` for this shot.
- `fps: 8` draws the scene at 8 frames a second (a dropped-frame stutter); `tmap: t => t'` draws it at another time
  (`Z.replayMap(src, [t1, t2], len)`: the same gesture again from each start). The lyric layer and post keep song time.
- `span: [t0, t1]`: `S.lt` / `S.p` run over the whole span. `Z.withInserts(shot, [{ t0, t1, shot: {...}, back }])` sets it:
  the shot cuts away to an insert and comes back in the state it would have by then (ids `-b`, `-c`, ...; `back` = the
  transition back, default a cut).

**Globals the timeline may define**: `Z.LOOK_DEFAULT`, `Z.LOOKS` + `Z.sectionAt(t)` (section-based looks; also feeds `S.section`), `Z.globalFX(P, t)` (mutate post params every frame — 残光 used it for six big-downbeat flashes and a kick-driven shake `5·env.low(t)^3` during choruses only), `Z.hud(ctx, S)` (small corner typography on the text layer; skipped when `Z.VERTICAL`), `Z.CREDIT` (used by the title lockup and the vertical footer), `Z.VERTICAL_CFG` (the 9:16 build, 08 §5: `full` shot ids that keep their 16:9 composition, `planMap`, header `title` / `sub` / `artist` (the template passes `Z.TITLE`, `Z.TITLE_SUB`, `Z.ARTIST`), `credits: [t0, t1]` (when the header and the `Z.CREDIT` footer show), `schemes` (lyric schemes of the 9:16 plans, default `'dark'`), `ambience` (`[r, g, b]` tint over the blurred surround); fields left out fall back to `vertical.js`'s neutral defaults: no full shots, no plan map, a black surround). The template timeline also keeps the film's identity in `Z.TITLE`, `Z.TITLE_SUB` (HUD, end card, vertical header) and `Z.ARTIST` (artist name in the 9:16 header); `new_project.py --title --title-sub --artist --credit` writes them. `Z.NO_LYRICS` disables the lyric layer (vertical build).

Edit conventions that worked: shot ids `s01…` in film order (insert `s52b` rather than renumbering); cuts on `nb(lyric onset)` inside sections and `B(n)` at section changes; 60–80 shots for 3–4 min; chorus shots 0.9–2 s, verse shots 2.5–5 s, a few long holds.

## 4. Scene API

```js
Z.scene('name', {
  preload: (args) => ['assets/char/x.png', ...],   // every image used (decoded before frame 0); read with Z.imgSync(path)
  init: async () => {},                             // once per scene name used in the timeline (fonts: document.fonts.load)
  draw(ctx, S) {},                                  // may be async (image sequences)
});
```
`S = { t, lt, dur, p, shot, args, W:1920, H:1080, clock, env, section, tq, ltq, rng(seed), fg }` — `t` song time; `lt = t − shot.t0` (can exceed `dur` while the next shot's transition runs); `p = clamp(lt/dur)`; `tq/ltq` 12 fps-quantised; `fg` = the foreground canvas context (falls back to `ctx` during transitions). Clock and envelope: 03-audio-and-lyrics §5.

Helpers: `Z.img(p)` (async decode, cached) · `Z.imgSync(p)` · `Z.seqFrame(pattern, n)` (LRU of 48 decoded frames, `f_####.jpg` patterns) · `Z.canvas(w,h)` · `Z.tinted(img, color, key)` (cached flat-colour copy) · `Z.fx(ctx, S, fxSpec)` and `Z.drawChar(ctx, S, charSpec)` (the `illust` building blocks, usable in any scene) · **meta helpers**: `Z.shotById(id)`, `Z.renderShot(id, t, ctx)` (draw another shot's scene at time t), `Z.drawSceneAs(name, ctx, t, args, t0, t1)` (draw any scene as if it were a shot), `Z.stateFor(shot, t)`, `Z.activeShots(t)`.

Math/easing: `Z.clamp lerp inv remap smooth fract quant hex rgba mix3 TAU`, `Z.tween(t, t0, t1, a, b, ease)`, `Z.ease.{linear, in/out/inOut Quad|Cubic|Sine|Expo, outQuart, inQuart, outBack, inBack, outElastic, snap}` (`snap` = creep to 90 % over 85 % of the time, then snap). Several scene files also define CSS cubic-bezier curves (`EZ.out = bezier(.16,1,.3,1)` entrances, `EZ.in = (.7,0,.84,0)` exits).

## 5. Drawing toolkit (`Z.draw`, alias `D`)

The rays, embers, fireflies, feathers, glass cracks and rim light carry the vocaloid look together; they live in its
pack (`engine/styles/vocaloid/fx.js`, which adds them to `Z.draw`, to `illust` fx and chars) with its transitions
(`trans.js`: `barrier`, `shatter`). In a film with its own style one of them, restyled, is a shared element (`design-a-style.md` §5).

- Framing: `D.cover(ctx, img, {zoom, x, y, rot}, alpha)` (x/y in −1..1 of the spare margin), `D.viewLerp(a, b, k)`, `D.shake(t, amp, fps=24, seed)`.
- Characters: `D.sprite(ctx, img, x, y, h, {anchor:[.5,1], rot, flip, sway, breathe, t, phase, alpha, wave:{amp, freq 2.2, speed 3.2, from .25, q}})` — `wave` is a hair-wind strip warp (keep `from` 0.25–0.4 so the face doesn't bend); `D.silhouette(…, color)`; vocaloid: `D.rim(…, color, [dx,dy])`.
- Light: `D.glow(ctx, x, y, r, color, a)` (additive radial), `D.disc`, `D.softLight`; vocaloid: `D.rays(ctx, x, y, n, len, color, a, t, seed)`.
- Particles (closed-form): `D.rain({n 260, angle .18, speed 1900, len 60, color, width 1.4})`, `D.dust({n 70, color})`; vocaloid: `D.embers(ctx, t, {n 80, seed, area:[x0,y0,x1,y1], color '#FFA552', rise 120, size 3, alpha, wind})`, `D.fireflies({n 40, area, color '#DDFF7A', size 3, alpha})`, `D.feathers({n 14, size, color, line})`.
- Glass (vocaloid): `D.crackNet(seed, cx, cy, n=22, reach=1100)` → cached polylines; `D.cracks(ctx, lines, prog, {glow, core, width, alpha})`.
- Type: `Z.FONT` = `mincho` Shippori Mincho B1 · `minchoHeavy` Zen Old Mincho · `tokumin` Kaisei Tokumin · `serif` Noto Serif JP · `gothic` Zen Kaku Gothic New · `dela` Dela Gothic One · `sans` Noto Sans JP · `hand` Klee One · `brush` Yuji Syuku · `dot` DotGothic16 (Noto Sans/Serif **SC** are also fetched for Chinese). `D.font(ctx, size, fam, weight)`, `D.vtext(ctx, text, x, yTop, {size, fam, weight, pitch, color, stroke, reveal, glow})` (縦書き), `D.htext(ctx, text, x, y, {size, fam, weight, color, stroke, glow, align, reveal, spacing, jitter, scaleIn})`. Await real weights in `init` (`document.fonts.load('800 100px "Shippori Mincho B1"', chars)`) so frame 0 never falls back.
- Overlays: `D.fill(ctx, color, a, comp)`, `D.vgrad(ctx, [[k, color]…], a, comp, rect)`, `D.halftone(ctx, rect, step, fn, color)`.

## 6. Transitions (`core/trans.js`; on the incoming shot: `trans: {type, dur, …}`)

| type | params | look |
|---|---|---|
| `cut` | — | hard cut (also the default with no `trans`) |
| `xfade` | — | sine crossfade |
| `flash` | `color '#FFF4DC'` | A brightens to colour, B emerges |
| `black` | — | dip to black |
| `iris` | `cx, cy, color` | B in a growing circle with a fading ring — match-cut circles (sun → lamp → 。) |
| `irisClose` | `cx, cy` | A shrinks into a circle |
| `barrier` (vocaloid) | `px, py` | striped crossing arm sweeps down from a left pivot, wiping B in |
| `wipe` | `angle −0.35, color '#C8373A'` | diagonal hard wipe with a coloured edge |
| `slices` | `n 9` | horizontal slices slide in alternately |
| `push` | `dx −1, dy 0` | A slides out, B in |
| `zoom` | — | A scales up and fades, B scales in from 0.4 |
| `ink` | `seed` | B through growing organic ink blobs |
| `shatter` (vocaloid) | `cx, cy, seed` | A breaks into triangles that fall away |

New: `Z.transition('name', (ctx, A, B, k, o) => {})` — draw the blend of canvases A, B at k∈[0,1]; `o` = the trans spec + `{t, W, H}`.

## 7. Post pass and LUTs (`core/gl.js`; per shot `post: {…}` or `post: S => ({…})`)

| param (default) | meaning |
|---|---|
| `boil` 1.2 px, `boilFps` 12 | hand-drawn line boil (low-freq displacement re-seeded 12×/s); 0 for clean typography shots |
| `lutA`, `lutB`, `lutBlend`, `lutMix` 0 | palette gradient map (luma → ramp), blend between two ramps, amount (残光 shots: 0.08–0.55) |
| `exposure` 0, `contrast` 1, `saturation` 1, `lift [0,0,0]`, `gain [1,1,1]` | grade (scene + fg) |
| `ca` 0 px, `beatCA` | radial chromatic aberration; `beatCA` adds `beatCA·pulse(t,9)` automatically |
| `textCa` 0 | horizontal RGB split on the text layer |
| `glitch` 0..1, `glitchSeed` | horizontal slice displacement (seed auto 24/s) |
| `zoomBlur` 0, `zoomCenter [.5,.5]` | radial zoom blur (14 taps) |
| `rays` 0, `raysAt [960,540]` px; `streak` 0 | light rays of whatever blooms, outwards from a point; a horizontal streak through it. Both light only what is dark, so a flat colour keeps its hue; they use the bloom pyramid even when `bloom` is 0. Not capped by any flash limit: run `check_flash.py` |
| `bloom` 0.35, `bloomThreshold` 0.72, `beatBloom` | bright pass + 3-level blur, added back — the bright pass keys on max(R,G,B), so at 0.72 every pixel of a blue sky or white cloud blooms and a daylight frame turns milky: on daylight plates use `bloom` 0.1–0.2, `bloomThreshold` 0.9–0.95, `beatBloom` ≤ 0.1, `vignette` ≤ 0.15 and no `exposure` pushes in `Z.globalFX` (e.g. `Z.LOOK_DEFAULT = { boil: 1.0, bloom: 0.15, bloomThreshold: 0.93, grain: 0.04, vignette: 0.1, lutMix: 0 }`) |
| `flash` 0, `flashColor [1,1,1]` | mix to colour (keep ≤ 3 full-frame flashes/s) |
| `invert` 0, `vignette` 0.35, `grain` 0.06 (re-seeded 24/s), `fade` 0 (to black), `letterbox` 0..1 (2.39:1 bars), `shake [x,y]` px, `textOpacity` 1 | finish |

LUT names: every palette in the film's `assets/style/palettes.json` gets two rows — `<short>`, `<short>_duo` (also the full id) — plus hand-built ramps `night`, `mono`, `day` (high-key daylight: navy → sky blue → white) and the packs' `Z.RAMPS` (vocaloid: `ember`, `dawn`; signal: 4). A `--style vocaloid` project's palettes.json is a copy of `engine/styles/vocaloid/palettes.json`: `P1`, `P1_duo` (`P1_oumagatoki`) … `P5`, LUTs in `engine/styles/vocaloid/luts/`. The atlas is **256×32 rows** (`LUT_ROWS = 32`, mv-studio; was 16): a vocaloid film: 5 palettes × 2 + 3 ramps + 6 `Z.RAMPS` = 19; beyond 32 raise `LUT_ROWS` and the LUT texture height (`gl.js`) and the atlas canvas height (`main.js`) together. The shipped `P1`–`P5` are 残光's dusk/night ramps: a high-key frame lives in the top third of the ramp, so `P1` turns a blue sky (luma ≈ 0.76) orange — build your own palettes for a bright film. Palette ids must look like `P<n>_<name>` (the short name is the part before `_`). New palettes: edit `PALETTES` in `tools/style_palette_sheet.py` and run it (writes `palettes.json`, OKLab-interpolated LUT PNGs and a contact sheet on a built-in dusk scene; `--plate assets/bg/<plate>.png` previews them on one of your own backgrounds instead); add ramps with `Z.RAMPS = Object.assign(Z.RAMPS || {}, { name: [[k, '#hex'], …] })` in the timeline file.

## 8. Shared scenes (`core/scenes.js`)

`illust`, `solid` and `jz` are the shared scenes, for any film. A preset's scenes are documented in its pack's
STYLE.md (vocaloid: the 21 scenes of its demo film 残光, `styles/vocaloid/STYLE.md` "Scene catalogue"); an own-style
film reads them as API examples and borrows techniques and elements, not the preset's look as a whole
(`design-a-style.md` §5).

The shared scenes' colour defaults come from that demo (ink `#140B1E` for `solid` and shadows, glow `#FFA552`): pass
your own colours.

| scene | what | args (defaults) |
|---|---|---|
| `illust` | the workhorse: background with camera move + cut-out characters + fx | `bg`, `bgFrom {zoom 1.06}`, `bgTo {zoom 1.12}`, `bgEase 'inOutSine'`, `beatZoom`, `shake`; or `grad [[k,c]…]` / `color`; `tint [{color, a .5, comp 'multiply'}]`, `overlayGrad/overlayA/overlayComp`, `layers [{img, x,y,h, x2,y2,h2, anchor [.5,.5], alpha, rot, ease}]` (parallax cut-outs), `fxBack [...]`, `chars [...]`, `fx [...]`, `vignette` |
| `solid` | flat colour / gradient + optional particles (`embers`, `fireflies`: the vocaloid pack's `Z.FX`) | `color` or `grad`, `embers {...}`, `fireflies {...}` |
| `jz` | full-frame JIZURA 文字PV (its own backgrounds) | `plan` |

`illust` char spec: `{img, x, y, h, x2, y2, h2, ease 'inOutSine', anchor [.5,1], flip, front (draw into S.fg), sway .012, breathe 1, phase, wave {amp 10, from .3, q 12} | false, q (koma fps), rim {color, off [7,−3]}, sil '#hex', shadow {a .5, dx 30, dy, color}, alpha, rot, in {at, dur .5, dx, dy, ds, rot, ease 'outExpo', alpha}, out {at, dur .4, dx, dy, ds, ease 'inExpo'}, beatBump, glowAt [fx, fy, fr] (fractions of h), glowColor, glowA}`.
fx specs (`fxBack`/`fx`, or `Z.fx`): `rain`, `dust` (options as in §5), `glow {x, y, r, color, a .8, beat}`, `grad {stops, a, comp}`, `fill {color, a, comp}`, `custom {fn(ctx, S)}`, and any type a style pack adds to `Z.FX` (vocaloid: `embers`, `fireflies`, `feathers`, `rays`, `cracks`; `styles/vocaloid/STYLE.md` "Scene catalogue"). Char options a pack adds go in `Z.CHAR_FX` (vocaloid: `rim`).

## 9. Writing a new scene

```js
/* scenes/rain_glass.js — 'rainGlass' {bg, char, drops=60, seed=5}: drops run down a window over a blurred city, she is behind the glass */
(() => {
  'use strict';
  const Z = window.Z, D = Z.draw, E = Z.ease, W = 1920, H = 1080;
  const cache = new Map();                                   // immutable art only, keyed by args
  const blurred = (path) => { let c = cache.get(path); if (c) return c;
    const img = Z.imgSync(path); c = Z.canvas(W / 4, H / 4); const x = c.getContext('2d');
    x.filter = 'blur(6px)'; x.drawImage(img, 0, 0, W / 4, H / 4); cache.set(path, c); return c; };
  Z.scene('rainGlass', {
    preload: a => [a.bg, a.char].filter(Boolean),
    init: async () => { await document.fonts.load('700 100px "Shippori Mincho B1"', '雨'); },
    draw(ctx, S) {
      const a = S.args, t = S.t, n = a.drops ?? 60, seed = a.seed ?? 5;
      ctx.drawImage(blurred(a.bg), 0, 0, W, H);                                      // background (cached blur)
      const zoom = 1 + 0.015 * S.clock.pulse(t, 8);                                  // camera: full time + beat breath
      if (a.char) Z.drawChar(ctx, S, { img: a.char, x: a.x ?? 1280, y: 1100, h: 1000 * zoom, sil: '#140B1E', rim: { color: '#9CC2C0' } });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) {                                                  // closed-form drops: pure function of t
        const life = 2 + 3 * Z.rnd(i, seed), k = Z.fract((t + Z.rnd(i, seed + 1) * life) / life);
        const x = W * Z.rnd(i, seed + 2), y = -40 + (H + 80) * E.inQuad(k);
        D.glow(ctx, x, y, 10 + 8 * Z.rnd(i, seed + 3), '#BFD4FF', 0.5 * Math.sin(Math.PI * k));
      }
      ctx.restore();
      const tq = S.tq;                                                               // drawn element on 12 fps
      if (S.lt > 0.5) D.vtext(S.fg, '雨', 1650, 180, { size: 140, color: '#F4EFE6', reveal: Z.clamp((tq - S.shot.t0 - 0.5) / 0.4) });
    },
  });
})();
```
Then: add `<script src="scenes/rain_glass.js"></script>` to `index.html` **and** `vertical.html` (`lint.mjs` PAGES fails until both load it); write a test timeline; render stills; **look at them**; iterate.
```js
// engine/tests/rain.js
(() => { const Z = window.Z; Z.setup = async () => {
  Z.LOOK_DEFAULT = { boil: 0, bloom: 0, grain: 0, vignette: 0 };
  Z.SHOTS = [{ id: 'x', t0: 62.53, t1: 66.26, scene: 'rainGlass', lyric: 'none', args: { bg: 'assets/bg/<plate>.png' } }];
  window.__zankoMeta.duration = 66.26; }; })();
```
```bash
node tools/stills.mjs --url "engine/index.html?tl=tests/rain.js" --times 62.6,63.4,64.8,66.0 --out render/tests/rain --sheet rain
node tools/render_frames.mjs --url "engine/index.html?tl=tests/rain.js" --start 62.5 --end 66.2 --mode blob --out render/tests/rain.mp4 --audio audio/song.wav
```
Use the real song times the scene is meant for (beats, stops and lyric onsets then line up). `stills.mjs` prints ms per frame and any page errors. Checklist for a new scene: renders identically when entered mid-shot (render one still at `t0+2` in a fresh page and compare with the clip), < 40 ms per frame, drawn motion on 12 fps, beat-locked accents on real beats, fonts loaded in `init`, no text over the face (or use `S.fg` + a centre-free lyric plan), header comment documenting args.

## 10. Porting a preset's scenes

A preset's stock scenes carry their demo film's constants (image landmarks, strings, times); the pack's STYLE.md lists
them (vocaloid: `styles/vocaloid/STYLE.md` "Porting checklist"). For any film, set in the timeline: `__zankoMeta.duration`
(§3; `core/main.js` falls back to 224.32 s), `Z.VERTICAL_CFG` (§3), `Z.hud` and `Z.globalFX`.

## 11. Pitfalls

- A character with `front: true` is drawn into the scene layer during transitions (no fg canvas then), so the lyric briefly passes in front of the character — keep transitions into text-behind shots short.
- `lyric: 'full'` covers the scene with JIZURA's backgrounds; during gaps without a lyric it can show an empty frame — use an illustrated shot there.
- Typographic scenes (slams, cards, tunnel, title, end card) need `lyric: 'none'` or the JIZURA layer doubles the text.
- `ctx.filter` blur on full-frame canvases, per-frame `getImageData`, or rebuilding art every frame → 100+ ms frames. Cache.
- Unseeded randomness or state carried across frames → flicker at the 3 worker seams (frames 1/3 and 2/3 of the film).
- Fonts not awaited in `init` → frame 0 or the first frame after a seek renders with a fallback font.
- `Z.scratch` used across an `await` (e.g. inside an async `seq` draw) gets overwritten by another draw.
- Boil on clean typography looks dirty: `post: { boil: 0 }` for type cards and end cards.
- Too many palettes + ramps → LUT rows overflow the 32-row atlas (§7: 2 rows per palette + 5 ramps + Z.RAMPS; a console warning). A misspelt `lutA` name also fails silently (falls back to row 0 = the first palette).

## 12. mv-studio additions (core)

**Presets and where they live.** `engine/index.html` and `engine/vertical.html` load every pack, whatever
the film's style; `--style` chooses only the starter timeline copied to `engine/timeline.js`. The table says where each
preset's code and docs live (vocaloid and interface each draw on two kits, mixed per shot):

| preset | `--style` | starter (`engine/starters/`) | code (`engine/`) | docs (`<skill>/`) |
|---|---|---|---|---|
| — (the film's own, default) | `own` | `blank.js` | `scenes/<film>.js` | `design-a-style.md` |
| vocaloid | `vocaloid` | `vocaloid.js` | `styles/vocaloid/` (tegaki), `styles/signal/` (signal) | `styles/vocaloid/` |
| interface | `interface` | `interface.js` | `styles/interface/` (screen), `styles/treatise/` (treatise) | `styles/interface/` |
| magazine | `magazine` | `magazine.js` | `styles/magazine/` | `styles/magazine/` |

- **What each pack registers** (all load after `core/scenes.js`): `styles/vocaloid/*` (its fx, transitions and scenes, §5; its scenes: `styles/vocaloid/STYLE.md`), `styles/interface/*` (`Z.IF`, scenes
  `ifChat ifPlate ifCode`; `kit.js`: ink plates `IF.inks / inkClip / part`, sagging type `IF.limp`, `IF.masked`) and `styles/signal/*` (`Z.SIG`, scenes `sigShot sigTerm sigFrag sigAbs`, transitions `whipL/R/U/D
  zoomThru spin sigTear`) and `styles/treatise/*` (`Z.TR`, plates `trSheet trPlot trScope trForm trPrompt trHook trContour`
  and the GPU plates `trEngrave trField`, `TR.write` (a line written by the pen),
  per-word lyrics `TR.words / lineWords`, the running number `TR.NUM`) and `styles/magazine/*`
  (`Z.MZ`: the press `MZ.begin / print / react` with spot separation, screens and misregistration, type and furniture
  `MZ.lyricV / folio / ruler / proofCircle ...`, scenes `mzSpread mzContents mzStrips mzGrid mzSlam mzBurn mzTear
  mzContact mzDecon mzFlash`; self-test `node engine/styles/magazine/press_selftest.mjs`). Their guides: `<skill>/styles/<style>/STYLE.md` (vocaloid = `styles/vocaloid` + `signal`; interface = `interface` + `treatise`). Starters: `engine/starters/`. `Z.SIG.spans` limits the signal layer to sections.
- **Rigs, particles, model sheets** (`core/rig.js`, method in `references/10`): `Z.rig` (joint-table blending
  `mix`, keyed actions `keyed`, `cycle` from distance, `ik2`, `squash`, `trail`, `blink`, `take` for expression
  changes), `Z.rig.biped` (a generic skeleton: 34 poses incl. walk / run / jump / fall / dance moves, 19 expressions,
  `solve(o)` → skeleton, `anchors`, measured `STRIDE`), `Z.rig.face` (one face construction for a cast); stateless
  `Z.burst / Z.stream / Z.field`; the `sheet` scene + `Z.sheetGrid` for model sheets (`engine/sheets/biped.js`). The biped is
  an example of the API, not a cast: a film paints its characters natively in its own way (references/10).
  Self-test: `node tools/rig_selftest.mjs` (ground contact, IK reach, determinism, stride).
- **Preloading:** a scene preloads only the images its args name (`illust`: bg / chars / layers). An image a custom
  `fx` or `text` hook draws needs `await Z.preload([...])` in `Z.setup`, or it is missing on the first frames.
- **Cut-outs** (`core/scenes.js` `chars[].anim`): no partial face replacement (blink, expression and mouth patches were
  removed); optional `tilt` / `hair` mesh warps (`core/draw.js` `D.meshDraw`) and whole-picture `states` (another expression, a turn).
- **A picture on a screen inside a plate:** always `Z.draw.warpQuad(ctx, img, from, to)` (`core/draw.js`), a true
  perspective transform from the picture's four corners `[tl, tr, br, bl]` to the glass's; never an upright paste, a
  scaled rectangle, a bilinear grid or a scene's own warp. Clip to the glass's outline first, with the corners read on the
  glass's edge off the full-size plate (`references/04` §1, "A picture on a screen").
- **Lyric lines in code** (`core/lyrics.js`): `Z.LYR` = `[{ i, t, end, text, parts, emph, kime }]` parsed from
  `analysis/lyrics_mv.lrc` before `Z.setup`; `Z.line(i)`, `Z.lineAt(t, lead)`, `Z.charsAt(i, t, { lead, over | rate })`
  (characters typed out with the voice), `Z.isEmph(i, k)`. Scenes take line indices; the text is read at draw time.
- **Time and words** (`core/util.js`, `core/lyrics.js`; after world-execute-me v4): `Z.dropFrames(t, fps, from)`,
  `Z.replay(t, starts, len)` / `Z.passOf(t, starts)` / `Z.replayMap`, `Z.tear(t, at, amount, hold)` (post params of ONE
  glitch tear that holds its pattern: `post: S => Object.assign({}, look, Z.tear(S.t, at))`), `Z.withInserts`;
  `Z.wordsAt(i, t)` (words come out whole when their first character is sung), `Z.wordIndex(i, word, last)`.
  Self-test: `node tools/time_selftest.mjs`.
- **Scenes with their own GLSL** (`core/shade.js`): `Z.shade(ctx, frag, uniforms, { rect, ss })` runs a fragment
  shader that defines `vec4 frag(vec2 p)` (p = scene px under the ctx transform: cameras apply) and lands on the ctx
  like any drawing; `Z.glScene(name, { frag, uniforms(S), before, after })`. `Z.GLSL` is in every shader: noise, 2D/3D
  distances, `smin`, `lineAA`, the ENGRAVING set (`hatch`, `hatchD`, `engrave`, `slice` / `slice2` = burin lines that
  wrap a 3D form, `stipple`), `lambert`, `rim`, `camRay`; `#include <raymarch>` after your `map()` adds `march`,
  `normal`, `softShadow`, `ao`. `Z.lineBatch(cap)`: tens of thousands of anti-aliased capsule hairlines per frame on
  the GPU (`seg`, `poly`, `draw(ctx, { blend: 'add' })`). An integrated GPU is enough (measured on
  an Intel iGPU, ANGLE D3D11: a raymarched 1400×840 plate ~0.3 s/frame in stills, a 34 s film in ~3 min with 3
  workers, where readback and encoding cost more than the shaders). With no GPU at all Chrome uses SwiftShader:
  correct, several times slower; keep `rect` tight.
- **Single-stroke fonts** (`core/stroke.js`, fonts in `engine/fonts/stroke`: `sans script serif` Hershey, `readable
  allure` EMS, OFL): `await Z.stroke.load([...])` in a scene `init`, `Z.stroke.layout(text, font, capPx, o)`,
  `Z.stroke.draw(ctx, st, x, y, { len })` → the pen head, `Z.stroke.at(st, len)`, `Z.stroke.lenAt(st, i, t)` (written as
  it is sung). Latin text only.
- **Layer hook** `Z.layerFX({ scene, text, fg, P, shot }, t)`: runs after the Canvas2D layers are drawn and before the
  WebGL post; may draw over / displace the layers and edit post params `P` (signal's degradation uses it).
- **Extra LUT ramps** `Z.RAMPS = { name: [[k, '#hex'], ...] }` (defined before `main.js` runs) join the atlas; the atlas has
  **32 rows** now (`LUT_ROWS` in `gl.js`, atlas height in `main.js`).
- **Post `hca`**: horizontal RGB split of the scene layer in px (analog chroma shift).
- **Fonts** `Z.FONT.ui` (Inter), `Z.FONT.mono` (IBM Plex Mono), `sansSC`, `serifSC` (setup fetches Inter + IBM Plex Mono).
- **Grounding & light (draw.js):** `D.coverPt(img, view, u, v)` → frame point of an image point under a cover view;
  `D.contactShadow(ctx, cx, y, w, { a, squash })`; `D.onWater(ctx, img, x, waterY, h, t, { sink, bob, rock, reflect,
  ripple, tint })` (sunk at the waterline + rippled reflection); `D.softLight(ctx, x, y, core, color, { spread, a,
  flicker, t })` (a light source without a rim); `D.along(k, p0, p1, p2)` (point + tangent on a curve);
  `D.travel(t, t0, t1, p0, p2, { arc, via, anticipate, overshoot })` (a move with weight); `D.sprite(..., { tint })`
  (multiply by the scene's light colour).
- **`illust` grounding:** chars / layers take `pin: [u, v]` (+ `pin2`, eased over the shot) = a point of the bg image;
  they stand on it, move and scale with the bg camera (`x`, `y` become offsets). A scene of your own that draws its
  plate with `D.cover(ctx, img, view)` sets `S.bgImg = img; S.bgView = view` for pins to follow it; without them a pin
  is a point of the screen. Chars: `ground: true | { a, w }` (contact
  shadow), `water: { sink, reflect, bob }` (afloat at the pin), `tint: { color, a }`. Fx `{ type: 'light', pin, core,
  color, spread, flicker, beat }`. `Z.pinPt(S, spec, k)` for custom fx.
- **Tools:** `estimate_lrc.py` (plain text → estimated LRC), `art_grid.py` (labelled grid over a plate to read u, v),
  `grokgen.py` + `grok_run.sh` (Grok images), `check_flash.py` (WCAG 2.3.1 approximation; exit 1 on FAIL),
  `motion_check.py` (static stretches, measured with the camera taken out; exit 1 above 10 %, which verify lists as information), `check_no_lyrics.mjs` (lyric text outside `analysis/`).

---
Author: **NikusonP** · vocaloid-style-mv-pipeline (MIT) · §12: mv-studio (MIT)


### 12b. Plan data and timing (mv-studio)

- **Cues** (`core/cues.js`, `analysis/cues.json`): `Z.cue('L07', dt)` (throws on an unknown id), `Z.cueOr(id, fallback)`,
  `Z.cues(kind)`, `Z.CUES`. Place cuts on cues instead of typing seconds.
- **Shot fields read by the tools** (all optional): `moment` (what the shot shows and why, your words), `line` (the
  lyric line number(s) it answers), `cue` (the cue its cut sits on; checked within `review.cueTolerance`), `offgrid:
  'reason'` (a deliberate off-grid cut), `insert: true` (1-2 frame inserts), `allowBlack: true` (a deliberately black
  shot), `hold: true` (a deliberate still: motion_check.py leaves it out, up to 8 % of the film; the song's own stops
  and the tail after `music_cut` are left out without it), `crop: true` (the frame or the picture's edge cuts the figure on
  purpose: check_shots.mjs leaves out FIGURE CUT). Line indices inside `args` (`line`, `lines`) count as "this shot shows that line".
- **Offsets** (`project.json` → `timing`): `offset` delays every picture (applied in `window.renderFrame`),
  `lyricOffset` delays the lyrics only (Z.LYR, line cues, the JIZURA layer). Scenes never add them.
- **Per-character times:** `Z.charTimes(i)`; `Z.charsAt(i, t)` uses them when `analysis/lyric_timing.json` has them
  for a line (and it still matches the LRC), unless the caller passes `rate` or `over`.
- `Z.shotList()` returns the sorted shots (the tools read it); `Z.hudShowsLyrics = true` tells the storyboard check
  that a `Z.hud` sets the lyrics (vocaloid's signal shots).
- `audio.json` → `onsets.kick / snare / hat / vocal` (`[t, strength]`) for hits; `grid_fit` for the tempo.
