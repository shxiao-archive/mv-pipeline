# Style: TEGAKI — illustrated MV with an original character (the base kit's style)

This is the style vocaloid-style-mv-pipeline (NikusonP, MIT) was built for and documented in full; its references are
the guide. Engine: `template/engine/scenes/*.js` (24 scenes), JIZURA lyric layer, Blender toon 3D. Starter: the demo
timeline 「蛍火」 (`engine/timeline.js`; kept as `engine/starters/tegaki_demo.js` when another style is scaffolded).
Case study 「残光」: https://github.com/EGSECDA/vocaloid-style-mv-pipeline/tree/main/examples/zanko (© NikusonP — learn
from it, do not reuse its motifs, character or palettes).

Read, in order: `references/02-creative-direction.md` (thesis, colour script, motifs, signature moments, variation
matrix, bright films §13) → `references/04-asset-generation.md` (character bible, master, poses, backgrounds; Codex §2–3,
Grok §11, NovelAI §12, choosing §13) → `references/05-engine.md` (timeline, `illust` and the scene library, post, LUTs; additions §12) →
`references/06-jizura.md` (lyric plans, curation) → `references/07-blender-3d.md` (optional) → `references/09` (QA).

## What our eval rounds added (apply them in every tegaki film)

- **Grounding.** Background plates come first; read each plate's surfaces with `python tools/art_grid.py
  assets/bg/<plate>.png` and pin characters and props to them: `chars: [{ img, pin: [u, v], pin2, h, ground: true }]`
  (moves and scales with the bg camera; contact shadow), floating things `water: { sink: 0.15, reflect: 0.5 }` at the
  waterline, `tint: { color: <the scene's light>, a: 0.4–0.6 }` so a cut-out takes the plate's light. Things that must
  touch (a train ON a bridge, a hand ON a rail) are best generated in ONE image; otherwise measure the contact line.
- **Light sources** are `fx: [{ type: 'light', pin: [u, v], core, color }]` (soft stacked halos), not discs.
- **Motion with weight:** moving props travel on arcs with anticipation and follow-through (`D.travel`, `D.along` bank
  angle); nothing glides at a constant speed on a straight line unless it is a machine on rails.
- **Composition:** subject on a third, three depth layers (a blurred foreground element sells depth cheaply), the lyric
  in a quiet zone (centre-free JIZURA plan `cf` when the subject is central); the final shot is a composed picture with
  a subject, depth and light — never one small object in an empty frame.
- **Story actions get time:** an action the lyric names (she lets go of the lantern, the door opens) needs ≥ 1.5–2 s and a
  clear before / after; set it up in the previous shot.
- **Type range:** at least three JIZURA plans / styles per film plus custom typographic scenes for the キメ lines.
