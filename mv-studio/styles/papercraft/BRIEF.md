# Papercraft — a pop-up paper storybook told as a retro RPG (preset)

Use this preset only when the user asked for it: a pop-up book, cut-paper, an RPG storybook, "papercraft" (SKILL.md).
The technical manual is `styles/papercraft/STYLE.md`; `styles/papercraft/look.jpg` shows what
its starters render with no art of yours (look at it once: a floor to rise above, not the target).

**Reads as:** a moving pop-up book whose language is a retro RPG. Everything is cut paper in multiplane depth; the
song is a quest out, through lands, a fight and back home; the book opens on the first frame and closes on the last.

## 1. The feel

1. **Everything is cut paper, and nothing is outlined.** Flat colour, a slightly wavy hand-cut edge, a lit rim inside
   the top edge, a dark under-edge, a shadow that grows with the piece's height above the page, fibre in the sheet.
   Light always from the top left. *Why:* the material is the style. An ink outline turns it into a cartoon.
2. **Depth is multiplane.** Far layers slow, the subject at 1, the foreground faster and softly blurred. The camera
   pushes into the book, follows the route, pulls back out as the book closes. *Why:* parallax is how a flat medium
   becomes a world.
3. **Things unfold.** Pop-ups rise piece by piece and fold back in reverse; tabs slide; the cover is a hinge, not fake
   3D. *Why:* unfolding is this medium's special effect, and the viewer's delight.
4. **The RPG is the language.** Paper UI (cream card, ink line, dashed stitch, gold corners, red name tabs), HP and EXP
   bars, LV UP, coins, a battle menu, damage numbers, and the map with a red dashed route. *Why:* a game's dry rules
   make the song's feelings funny and touching.
5. **Words are physical objects.** A name or keyword is rebuilt in a new material each time and fills a wider space: a
   dialogue box, a panel, a dragon's body, fire, a stone wall, a banner wrapping the castle. *Why:* it turns the lyric
   into the world's stuff. Lyrics typed in the dialogue box are one option, not the rule.
6. **One red line runs through it** (bookmark → scarf → route → patch → cord → bookmark), with setups planted early
   and paid off late, and running gags that grow each chorus.
7. **Disciplined colour.** One palette; at most 3 main colours and 2 accents at a time; every change of place shares
   a colour across the hand-off; per-layer saturation (a grey kingdom with a saturated red hero).

## 2. Art construction (what makes a frame look hand-made and finished)

- **Primitives:**
  - a blob (an ellipse with stacked soft wobbles, stable from frame to frame);
  - a polygon whose straight edges are subdivided and jittered;
  - a cut (a drop shadow plus a lit rim);
  - a gradient inside a shape.
- **Shadows per depth layer, not per shape:**
  - far layers cast a short shadow (about 4–6 px), the subject a deeper one (8–12);
  - the foreground is blurred 3–5 px;
  - each layer can take a tint and a saturation.
- **Fibre only where there is content** (inside the shapes), travelling with each layer. Multiplying it over whole
  layers greys the picture, the reference film's first visual bug.
- **Night and caves:** tint layers plus glowing point lights.
- **Type:** four fonts, each with one job (round display, playful UI, storybook serif, round Latin numbers); symbols
  drawn as paths.
- **Finished versus amateur:** a finished frame has layered shadows, a lit rim, fibre, and one colour bridge to the
  next scene. An amateur frame has outlined clip-art on a flat backdrop.

## 3. Motion vocabulary

| move | feel | when | not when | size |
|---|---|---|---|---|
| cue-locked accent | acting on the lyric | every lyric cue | — | one accent 0 to +0.15 s after the cue; anticipation 0.1–0.4 s before |
| think, then act | believable acting | every action | — | the expression changes 2–4 frames before the move |
| stagger | a group feels alive | groups entering, pop-up pieces | — | 30–80 ms apart |
| hold | the action reads | after every action | — | ≥ 0.2 s |
| follow-through | paper flutter | scarves, hair, crowns, tails, flags | — | damped wobble; trails sampled back in time |
| pop-up rise | delight | each land's entrance | — | piece by piece with outBack, folding back in reverse at the end |
| impact ladder | a hit with weight | fights, landings | everywhere | S / M / L / MAX shake 8 / 14 / 22 / 32 px with a matching flash; MAX once |
| camera drift | it is never dead | always | — | a gentle drift; pushes on emotion; a bump on steps and hits, not on every beat |
| tracking shot | the journey | long walks, outbound left → right, home right → left | — | the camera follows the hero |
| transition by the incoming shot | the page makes the cut | between chapters | dissolves (none) | page turn reflected across the fold, shape reveal, whip curtain with speed lines, burning edge, paper tear, split screen |
| shape-match cut | a rhyme | once or twice | — | moon ↔ coin, sword flash ↔ star, eye ↔ cave mouth |
| fixed reaction framing | repetition as the joke | recurring reactions | — | the same framing each time; paired reactions mirrored |

**The motion feel:** calm, crafted, cue-locked. Gentle drift, pop-ups that spring, follow-through on everything that
hangs, big hits only where they count. Beat bumps on every beat make it feel like a visualiser.

## 4. Let the song choose

All of this is the identity; the song decides:
- what the quest is for, and which line is the boss;
- which lands appear, and what material each name becomes;
- which running gags grow;
- whether the lyrics live in the dialogue box or in the world.

## 5. How the reference film was made

- A cue table first, then the engine and the tools.
- Three storyboard proposals from different stances (continuity, comedy, production), two judges, 20 best ideas and
  12 to avoid, one synthesis.
- Twelve parallel asset groups with model sheets and API notes, and a lineup sheet across the cast.
- A seam contract between blocks, then block builders working rough → polish → finish.
- Tools for cue sheets, jumps and seam diffs.

## 6. Craft notes

- Readable words: glyphs ≥ 48 px, still for ≥ 0.25 s.
- Nothing but decoration in the bottom band when subtitles are added.
- Invisible seams at the same place match to the pixel.
- Keep scale consistent (full shot ~260 px, medium ~420, close-up head ~360).

## 7. Avoid

- Ink outlines on paper pieces; gradients and glows without a paper source.
- Dissolves; beat bumps on every beat; fake 3D.
- Grey, muddy frames from texture multiplied over everything.
- Existing game characters, UIs or logos; the reference film's song, cast or story.

## 8. Where it lives

Search `grep '"papercraft"' index/index.jsonl`:
- the scenes `scene:pcBook`, `scene:pcWorld` (with layer `shadow / tint / sat / blur`), `scene:pcMap`,
  `scene:pcBattle`;
- the doll `helper:PC.doll`;
- paper drawing with `PC.cut`, `PC.poly`, `PC.blob`, `PC.ribbon`, `PC.shade`;
- the camera `PC.cam` and `PC.applyCam`;
- the RPG kit (`PC.dialog`, `PC.panel`, `PC.nameTab`, `PC.bar`, `PC.lvUp`, `PC.coins`, `PC.menu`, `PC.map`);
- the `pageTurn` and `shapeReveal` transitions;
- `helper:Z.impact`.

Starter: `--style papercraft`, an example to rewrite.
