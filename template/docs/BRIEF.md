# Brief

The rules of this film. Everyone who builds a shot reads this first; change it only with the director (the user).
Lyric lines are referred to by number (analysis/lyrics_mv.lrc): never copy lyric text into this file.

## 1. Hard rules

- **Timing:** cuts on the beat grid or a named cue (`node tools/storyboard.mjs` checks it); the key action of a line
  lands within 0.15 s of its cue; a word is never shown highlighted before it is sung.
- **Text on screen:** the lyrics (from the LRC only), the title and credit, and: _(list any other words allowed: UI
  copy, sound effects, names; or "nothing else")_.
- **Safety:** at most 3 large flashes per second, no saturated-red flicker (`check_flash.py` must PASS).
- **Determinism:** every frame is a function of song time only (`node tools/lint.mjs`).
- **Originality:** original characters and designs only; no real product UI, logo or brand; no existing artwork.
- _(add the film's own: e.g. "the singer's face is never shown", "no hard cuts in verse 1")_

## 2. Style

One paragraph on the look (the style block of docs/CONCEPT.md), then what is specific to this film:
materials, line, light direction, texture, grain.

## 3. Cast, places, objects

| who / where / what | look (one line) | role in the story |
|---|---|---|
|  |  |  |

Screen direction: _(e.g. the journey always moves left to right; home is on the left)_.

## 4. Colour script

| section | palette / state / heat | light | what changes it |
|---|---|---|---|
|  |  |  |  |

## 5. Motion

The motion-feel and editing-rhythm slots of docs/CONCEPT.md: how the camera moves (or stays), how things ease, where
hits land, what quiet looks like.

## 6. Continuity devices

What carries the eye across cuts: a recurring object, a shape match, a colour bridge, a motif that returns.

## 7. Not in this film

The clichés to avoid for this song: e.g. generic glowing particles, lens-flare soup, purple/cyan neon, code rain,
stock "AI" imagery, a lyric repeated as a caption over a picture of the same thing.

## 8. Reserved zones

Where the words live (if anywhere) and what must stay clear of them; any reserved corners; title-safe margins.
