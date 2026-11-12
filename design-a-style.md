# Design a style — the default path

Unless the user asked for a preset, the film gets a style of its own, designed from this song. This file is a
decision process: the questions to answer and the order to answer them in. It holds no answers. Every answer comes
from the song (`direction.md`), the user and you; none comes from a preset or an earlier film. Write the answers into
the style block of `docs/CONCEPT.md`; the jury judges the film against it.

## 1. Start from one mechanism

Name the one idea of this song that the film makes visible (`direction.md` §2). Then, for every signature effect you
consider, write the sentence "this is a form of the mechanism because …". An effect you can't finish that sentence
for doesn't belong to this film. The mechanism acts on what the film literally shows (the people, places and things
of the song: `direction.md` §2, Readable cold); it does not replace them.

## 2. The slots

Answer each slot in `docs/CONCEPT.md`. Each answer is a decision with its reason in the song (a line, a sound, a
section, the mechanism). "None" is a valid answer wherever it fits.

| slot | the question |
|---|---|
| reads as + traits | What would a viewer call this film in one line? Which 6–10 visible traits make it feel that way? |
| medium | What is the film made of, or pretending to be made of? What physics does that material have? |
| palette roles | Which colours, and what is each one's job? Is the film's one ground dark or light (`direction.md` §4)? How and when do the colours change over the film, on that ground? |
| type roles | Which faces, and what is each one's job? Where does type live in the frame: over, in, or as the picture? |
| shape and motif grammar | Which shapes and motifs recur, what does each mean, and how do their states change? |
| motion feel | What moves, how (cadence, easing, physics), and what stays still? What is locked to the beat and what is not? |
| impacts | What happens on the song's hits, at what sizes? How does the biggest one differ from the rest? |
| editing rhythm | What decides a cut (the bar, the voice, a cue, a long take)? How do pictures hand over to each other? |
| lyric system | How do the words appear: a kinetic layer (JIZURA), the scene's own type, burned into the pictures, sparse, none? |
| cast | Is there a character at all? If so, who, how many, how drawn, and where in the frame? |
| picture source | Where do the pictures come from: generated, code-drawn, the user's own, photographic, 3D, none? |
| ending | What is the last idea the film leaves? |

Answer them in this order of dependency: the mechanism and medium first, then palette, type and shapes, then motion,
editing and lyrics. Don't fill a slot with what the engine or a starter already happens to do: the starters are API
examples, and their values are placeholders. The generator the user names (an anime model, say) and the song's
language decide neither the cast nor the look: a generator draws whatever the slots ask for (places, objects,
textures, no one at all), and the cast slot is answered from the song like the others.

## 3. The look sheet ◆

Before production, render a look sheet: 4–6 frames of signature moments, the palette with its roles, the type roles,
a texture or material swatch. Show it to the user with the concept, and change the style now, while it is cheap.
Judge the frames as someone who has not read the concept: who is this, where are they, what is happening? If the
frames alone don't answer, change the pictures, not the explanation.

## 4. The distance review

Slot answers in words pass too easily: "an anime art-film" is not "a ボカロPV" on paper and can be one on screen.
So judge the look sheet's frames, not the text. For each preset, list which of its markers the frames show; a marker is
a thing you can point at in a frame.

| preset | markers |
|---|---|
| vocaloid | an illustrated (anime) character as the subject of most frames · the lyric line over the picture on a band, box or plate, in columns beside the subject, or as one monument kanji · HUD readouts, brackets or frame lines · kanji title slams · glowing line effects (crack webs, rays, sparks, embers, a rim light on the figure) · a dark ground lit by a few glowing accents |
| interface | a chat or app screen (bubbles, a cursor, typing) · technical plates (charts, oscilloscopes, forms, prompts, maps) · a mono "system" voice · colour states for who speaks |
| magazine | vertical mincho lyric columns · pictures separated into a few inks on paper · folios, proof or register marks · a page with a fate |

Markers are a review prompt, not a score. A single shared element that serves the song needs no justification. Judge
the combinations: where several of one preset's elements work together (its palette with its type system, its cast
with its devices), write in `docs/CONCEPT.md` one line on why the song wants that combination, with the frames. Redesign
those slots from the song and render the sheet again, or offer the user that preset by name, only when the frames read
as a preset's overall look with no reason from the song, or conflict with the concept.

## 5. Borrowing: shared elements yes, a preset's overall look no

- **Any film may use the library's techniques** (search `index/index.jsonl`): the JIZURA lyric layer, the
  transitions, camera and drawing helpers (`D.*`), `Z.withInserts`, the decay layer, shaders and hairlines
  (`Z.shade`, `Z.lineBatch`), written type (`Z.stroke`, Latin text only), the shape and type kits, paper and paint primitives. Each
  one is restyled to your slots; its defaults are not a look.
- **What makes up each preset's overall look** (its palette, type system, cast and signature devices working
  together; one item of it, restyled to your slots, is a shared element):
  - the ボカロPV look: an illustrated original singer at the centre of the frame, lyric columns flanking the subject,
    a band or plate behind the lyric line, the PV HUD, kanji slams, the 残光 palettes (P1–P5), and its light devices
    (crack webs, rays, embers, fireflies, feathers, a rim light: the preset's pack, `engine/styles/vocaloid/`);
  - the AI-chat voices and colour states;
  - the treatise's spark-and-number plates;
  - the three-ink magazine press with its folios, proof marks and vertical lyric columns;
  - the heat-grade recording device.

  If the song wants most of one of these, offer the user that preset rather than drifting into it.

## 6. Process

1. **Model sheets and check cards.** Every character, prop and recurring picture the film has, rendered alone,
   without lyrics. If it can't be named without the words, it fails.
2. **New shared effects default to off,** and are checked on regression sheets (`tools/regress.mjs`).
3. **Revisions with written reasons** in `docs/PROGRESS.md`, so the next round doesn't undo them.
4. **Every shot is consistent with the style block.** When a shot and the block disagree, change one of them on
   purpose and write down which.

The checks still apply whatever the style: the sung word whole and readable (`check_shots.mjs` LYRICS HIDDEN, LOW
CONTRAST), flash safety, sync. They measure; they don't decide the look.
