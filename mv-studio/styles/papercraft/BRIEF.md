# Papercraft — a cut-paper collage picture book, read aloud (preset)

Use this preset only when the user asked for it: a picture book, cut paper, collage, a storybook, "papercraft" (SKILL.md).
The technical manual is `styles/papercraft/STYLE.md`; `styles/papercraft/look.jpg` shows what its starter renders
(look at it once: a floor to rise above, not the target).

**Reads as:** a children's picture book made of painted tissue paper, read aloud. Each shot is a spread of the open
book; the lyric line is the story's text, set on the page; the pages turn; the book opens on the first frame and
closes on the last. It is a book, not a game: no HUD, menus, battles, stat bars or dialogue boxes.

## 1. The feel

1. **Painted tissue, cut and laid down.** Every shape is a piece of hand-painted tissue (soft brush streaks of one
   colour) with a torn white edge and a soft shadow; nothing is outlined. *Why:* the material is the style; an ink
   outline turns it into a cartoon, a flat fill into clip art.
2. **Clean pages.** A clean gradient sky, puffy clouds, soft layered ranges, rolling hills, round lollipop trees, a
   path, a strip of grass in front. Paper fibre is one light pass over the frame; no mottles, stains or dirt multiplied
   onto the shapes. *Why:* a picture book is printed on fresh paper; texture on everything reads as dirt.
3. **The text is on the page.** The lyric line is set as the story's text in a soft hand-written face, on the page the
   picture leaves free, and inks in character by character as it is sung. *Why:* the song is being read aloud.
4. **The camera holds; the story moves.** Within a spread the frame is still: the characters walk across it, the
   clouds drift, the grass sways, a tail swings. Between spreads, the page turns. *Why:* a book does not pan; its
   motion is the page and what is drawn on it.
5. **Characters are paper figures that move like paper figures.** Two ways, the user picks after seeing both
   walk: the jointed paper doll drawn in code (small, chibi, about 2.5 heads; knees, elbows, a real walk cycle with
   planted feet; ears, a tail, a hat as pieces), or an illustration cut into a few pieces (a generated sheet: head,
   body, legs, a tail; legs swing at the hip, the head nods). *Why:* judged in motion, a rigid illustration swinging at
   the hip can read uncanny, and a user may prefer the small doll's walk; in a still, a bare doll can read as a
   placeholder. Show a walking clip, not a still, before casting.
6. **Literal and warm.** The pages show what the song is about, readable cold: who is travelling, where, with whom.
   One colour script across the book (a land or a light per section), a few gentle continuity devices (a satchel, a
   path that keeps going).

## 2. Art construction

- **Sets** after the reference film's journey: sky gradient, a sun on the side away from the text, two far ranges,
  near hills with trees, the ground, the path the cast walks on, tissue flowers, the grass strip. A land is a palette;
  write the film's own for its places (a market town, a wheat field, a harbour) with the same pieces plus its props.
- **Cast:** either jointed dolls (`PC.story.looks`: hair, outfit, trim, ears, tail; give each role a colour and one
  shape of its own) or a reference sheet per role from the image generator the user chose (picture-book proportions,
  about four heads tall; side view facing left and front view; flat contrasting background), the background removed,
  looked at, then cut with `tools/cut_puppet.py`. Set the cast's relative heights. Keep extras (tails, capes) as their
  own pieces.
- **Finished versus amateur:** a finished spread has tissue streaks in every piece, torn edges, soft shadows, the
  gutter's curve, clean sky, a character with a face you would remember, walking with planted feet. An amateur one has flat fills,
  outlines, mottled paper, a stick figure and sliding feet.

## 3. Motion vocabulary

| move | feel | when | size |
|---|---|---|---|
| walk across the spread | the journey | most spreads | a steady pace, left to right going out (right to left coming home) |
| page turn | the next part of the story | between spreads | 1–2 beats; never a dissolve |
| ink-in text | being read aloud | every line | per character, as sung |
| small life | the page breathes | always | clouds drift, grass sways, a tail or a cape swings |
| a look, a stop | acting | on a lyric cue | a nod, a turn to the other, a stop to point; hold ≥ 0.2 s |
| book open / close | bookends | the first and last frames | the cover is a hinge |

No camera pans, drifts, shakes or beat bumps.

## 4. Let the song choose

The story the pages tell, who travels and with whom, the places, what changes from the first spread to the last, and
which line gets the spread with no text.

## 5. Avoid

- RPG or game language (HUD, coins, LV UP, battles, menus) unless the user asks for it (the kit is still in the
  engine: STYLE.md §5).
- Ink outlines; mottled or dirty paper; glows without a paper source; dissolves; camera moves.
- Existing characters or illustrations; the reference film's song, cast or story.

## 6. Where it lives

`scene:pcStory` and `PC.story.*` (puppet, looks, land, cut, tissue), `PC.doll`, `tools/cut_puppet.py`, `scene:pcBook` (the bookends),
the `pageTurn` transition. Starter: `--style papercraft`, an example to rewrite.
