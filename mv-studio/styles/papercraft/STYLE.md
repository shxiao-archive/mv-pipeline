# Style: PAPERCRAFT — a cut-paper collage picture book, read aloud

**Technical manual of this style pack** (API, building, assets). The creative brief is BRIEF.md next to this file:
read that first, and open only the section here that the build needs.

Engine code: `template/engine/styles/papercraft/` (`paper.js` primitives, `storybook.js` the picture book, `scenes.js`
the book bookends, transitions and the RPG kit's scenes, `rpg.js` the RPG kit). Starter: `engine/starters/papercraft.js`
(`new_project.py --style papercraft`). After *dalabengba-mv* (ISC, see `licenses/LICENSE-dalabengba-mv.txt`): its paper
primitives are adapted, its pop-up book, journey lands and transitions are followed. Its song, lyrics, characters and
story are not ours: make your own film.

## 1. The spread: `pcStory`

```js
const SC = 0.7, STRIDE = 127 * SC / 0.5;                         // puppet scale; px per walk cycle (feet do not slide)
const walker = (who, x0, v, t0) => S => { const x = x0 + (S.t - t0) * v; return { who, x, face: 1, walk: 1, phase: x / STRIDE, s: SC }; };
S.push({ id: 'v03', t0: B(6), t1: B(8), scene: 'pcStory', lyric: 'none', hud: false, line: 3, post: PC.post,
  trans: { type: 'pageTurn', dur: 2 * beat },
  moment: 'line 3: the two of them reach the market town',
  args: { land: TOWN, line: 3, textAt: 'L',
    cast: S => [walker('hero', 600, 110, B(6))(S), walker('companion', 920, 110, B(6))(S)],
    back: (g, S) => drawStalls(g, S) } });                     // the film's own pieces behind the cast
```
- `land`: `'meadow' | 'dusk' | 'snow' | 'blank'` or the film's own palette object (copy `PC.story.LANDS.meadow`: sky,
  sun, far ranges, hills, ground, path, tree colours, `pine`, flowers, `grass`, `clouds`, `ink` the text colour: a
  night or other dark land needs a light one).
- `line` (or a list: the latest started is shown) is set on the `textAt` page (`'L'` or `'R'`; the sun and clouds move
  to the other side), Klee One 600 at 62 px, inked in as sung. Never ahead of the voice; lyric text never in code.
- `cast(S)`: `{ who, x, y (default the path), s, face ±1, walk 0..1, phase, nod, front (the front view, standing) }`;
  drawn in order of y.
- `back(g, S)` / `front(g, S)`: the film's own props behind / in front of the cast, drawn with `PC.story.cut(g, path,
  col, { edge, shadow })` on `PC.poly` / `PC.blob` paths so they share the tissue material.
- Paper fibre and the vignette come from `PC.install()` (the starter calls it) for every scene named `pc*`; do not add
  texture per shape. The book (desk, cloth cover, page stack, gutter) is drawn by the scene. Landscape only.
- Bookends: `pcBook` `{ mode: 'open' | 'close' }`. Between spreads: `pageTurn` (1–2 beats).

## 2. The cast: jointed dolls, or reference sheets cut into puppets

Two kinds (BRIEF §1.5; the user picks after a walking clip of each):

**Jointed doll (code).** `PC.story.looks.<who> = { detail: 1, hairStyle, hair, outfit, trim, legs, shoes, hat, ears,
earIn, tail, tailTip, seed }` (every `PC.doll` look option; `ears` and `tail` take a colour) and that role is drawn as
the rigged doll: knees and arms in the walk, its phase taken from x so the feet plant (the cast's `phase` is ignored),
`nod` turns the head, `front` faces the reader. `s: 0.45` is about 280 px, small on the page. `detail: 1` keeps the
ink line and pins of `PC.doll`; without it the doll is the flat stand-in.

**Reference sheets cut into puppets:**

1. **Generate** a sheet per role with the image generator the user chose (`tools/artgen.py`, references/04): one
   character, full body, a side view facing left and a front view, picture-book proportions (about four heads), cut
   paper collage style, on a flat background that contrasts with the figure (a pale figure on cream defeats background
   removal: use slate or green). Long tails, capes or scarves: generate them as a separate piece on a flat background.
2. **Remove the background** (the generator's tool, `tools/alpha_matte.py`, or `"key": true` in puppets.json for a flat
   background) and look at the cut-out on grey.
3. **Cut**: write `assets/cast/puppets.json` (the side and front x spans, the neck line under a collar or hair, the hem
   line under a coat or skirt, `tall` for relative heights, `extras` with their join point) and run
   `python tools/cut_puppet.py` → `assets/cast/<role>_{head,body,leg,front,<extra>}.png` + `rig.json`. The docstring
   lists every field. Check a still: the neck and hip seams must hide under the collar and the hem while walking.
4. Until a role is cut, `pcStory` draws a flat `PC.doll` stand-in (`look`: its options), so the film renders from day one.
   A role in `PC.story.looks` is always drawn as the doll, cut or not.

Keep scale consistent: the starter's `s: 0.7` puts a 640-px `tall` role at ~450 px on the page.

## 3. Motion

The frame holds: motion is the cast walking (a steady pace, `walk: 1`, `phase = x / STRIDE` so the feet plant), the
clouds, the grass, the extras swinging, the text inking in, the page turns. Accents on lyric cues: a stop, a nod
(`nod`), a turn (`face`), a character stepping in. Run `motion_check.py` on renders: static stretches ≤ 10 %.

## 4. New scenes

Name them `pcXxx` (the paper fibre and vignette apply only to scenes matching `/^pc[A-Z]/`, `PC.isPaper`), draw with
`PC.story.cut` and `PC.poly / blob`, and add the file to `engine/index.html` **and** `engine/vertical.html`
(references/05 §9). A close-up page (a hand, an apple, a letter) is a spread too: the same book, a bigger subject.

## 5. On request only: the pop-up RPG kit

The earlier pop-up RPG language is still in the engine for a user who asks for it: `pcWorld` (multiplane lands with a
tracking camera, HUD, mini-map), `pcMap` (a route drawn), `pcBattle` (paper theatre), `PC.doll`'s RPG poses and
expressions (`engine/styles/papercraft/papercraft_doll.js` model sheet), and the paper UI kit (`PC.dialog /
panel / nameTab / bar / lvUp / coins / menu / map`). Search `grep '"papercraft"' index/index.jsonl`. Do not mix it
into a picture-book film.
