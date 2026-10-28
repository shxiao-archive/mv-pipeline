# Stage — a watercolour picture-book show (preset)

Use this preset only when the user asked for it: a picture-book or watercolour stage show, a cute cartoon MV with a
puppet troupe, "stage" (SKILL.md). The technical manual is `styles/stage/STYLE.md`; `styles/stage/look.jpg` shows what
its starters render with no art of yours (look at it once: a floor to rise above, not the target).

**Reads as:** a cartoon stage show painted like a picture book. An original troupe of puppets acts the song out gag
by gag on painted sets; the show goes off the rails as it grows; the curtain that opened it closes it, and the twist
is that it was all a play.

## 1. The feel

1. **A show, not an illustration.** The song puts on a performance with a beginning (the curtain rises), a middle that
   gets out of hand, and an end (the bow). *Why:* the frame of a show makes absurd escalation charming instead of
   random. The audience laughs because it is a play.
2. **Something happens in every shot.** One readable gag per shot, a cartoon action: something breaks, transforms,
   chases, falls, grows. *Why:* shots are 1.4–4 s long; a picture that only illustrates a word is dead air.
3. **The story spine is escalation of size and stakes.** The lead grows (a doodle → stage-sized → planet-sized → back
   to cute), or a running prop climbs every chorus (a meter, a pile, a crack). *Why:* the choruses become one
   story, and the finale has something to pay off.
4. **Big worlds the camera travels through; the stage only frames them.** Each chapter goes to its own painted place,
   and the stage returns only for the curtain, the choruses and the bow (about one shot in five). A set isn't a card. The camera tilts up through the fly loft into the
   sky, pushes into an eye, chases a rocket, with ink speed streaks that scale with the camera's real speed. *Why:*
   scale and travel are what make a painted show feel like a film.
5. **Stagecraft you can see.** Flats, strings, trapdoors, costumes, spotlights, a painted backdrop that wobbles. *Why:*
   it plants the twist ("it was all a play") and makes the hand-made world endearing.
6. **Faces that act.** A face never snaps. A blink closes the old face, the body takes (a squash, then a rebound),
   the emote springs in, the new face opens. Comic timing: the straight man reacts half a beat late.
7. **Text-light.** The karaoke ribbon carries the lyric, and a handful of big painted sound effects punctuate the
   whole film. *Why:* the jokes are told with pictures and acting.
8. **A picture-book palette arc.** Warm lamplight → sky → violet night → alarm red → back to warm gold, never pure
   black or white.

## 2. Art construction (what makes a frame look hand-made and finished)

- **Every kind of character has its own silhouette:** a human on the person rig, an animal on four legs, a creature
  built from what it is. One puppet body recoloured for every role reads as one creature repeated.
- **Characters stay flat and readable:** a flat wash, a lighter pool at the top left, a darker settle along the
  bottom, then one continuous tapered ink line. Watercolour granulation, bleeds and hatching are kept for
  backgrounds, light and shade.
- **Backgrounds** are bleeding watercolour glazes, mostly without outline, with sparse dry-brush hatching.
- **Linework boils** at about 12 redraws a second; big backgrounds stay still so they don't shimmer.
- **Paper under everything:** the paper is painted first, and a tooth and a warm vignette are multiplied over the
  frame. Lettering sits *inside* the painting (under the grain and the wipes), not floating on top.
- **Shadows behave:** they stay on the floor and thin as a character jumps.
- **Contrast between character and set is always clear:** soft saturated colour.
- **Finished versus amateur:** a finished frame has a lead that reads at a glance, a set with depth and light pools,
  and paper you can feel. An amateur frame is a vector mascot pasted on a gradient, with a caption.

## 3. Motion vocabulary

| move | feel | when | not when | size |
|---|---|---|---|---|
| the take | a reaction that lands | every mood change | — | blink ~0.07 s, squash ~0.18 s, rebound ~0.18 s; the emote springs in at 0.1–0.3 s and fades by 1.7 s |
| beat dances | the troupe performing | choruses, dance breaks | acting shots | bounce, hop, sway, spin, wave, roof, stomp, shimmy; a squash on each landing |
| beat-locked prop | a machine in the song | the running prop | — | the down-stroke on the beat (a long rise, a short slam), an aftershock riding through it |
| gag phases | a joke with a set-up | every story shot | — | anticipation (crouch, wind-up, the fuse) → action fast → hold for the laugh → reaction |
| the late straight man | comic timing | chorus lines in sync | — | one character half a beat late |
| camera travel | scale, adventure | transitions between sets, the climax | quiet verses | tilts and pushes of thousands of px, with speed streaks |
| squash and stretch | rubber, life | jumps, hits, landings | static poses | stretch on the rise, squash on landing |
| action-carried cut | the joke moves the edit | inside a chapter | — | a chomp to black, a fall, a pop, a zoom through an eye, an iris into a mouth or a heart |
| brush wipe | a chapter turns | only at chapter breaks (~4 per film) | inside a chapter | ~0.6 s |
| sound effect | a punch line | a handful in the film | on every gag | springs in, jiggles, fades in ~1.2 s |

**The motion feel:** rubbery cartoon timing on the beat for dances, cue-locked for acting; everything moves (a push,
pan, tilt or on-beat bump on every shot); boil on the lines; the camera is bold.

## 4. Let the song choose

All of this is the identity; the song decides:
- how far the show goes off the rails;
- what grows (the lead, a prop, a number);
- which painted worlds the chapters travel through (the stage frames them; it is not where the film lives);
- where the twist lands.

## 5. How the reference film was made

- A first version in flat vector, then a full rewrite with brush strokes and an instruction that every scene hands
  off into the next.
- An animation guide briefed parallel chapter builders, with shared files frozen.
- Contact sheets at the first and last frame of each shot, every 0.1 s around the hits, the hand-offs and the karaoke
  band.
- A budget of about 2.5 s per frame.
- Iterate until each shot is charming, readable, lively and on-model.

## 6. Craft notes

- Nothing important under the karaoke ribbon.
- The karaoke never runs ahead of the voice.
- The lead stays on-model in every shot.
- Alarm washes and flashes are soft and rare (`check_flash.py`).

## 7. Avoid

- Shots where nothing happens; gags that need a caption; signs that repeat the lyric.
- A film that never leaves the stage: backdrops flown in behind the proscenium are not worlds.
- Faces that snap; dances off the beat.
- Choruses that repeat instead of growing; an ending that just stops.
- Any existing character or mascot (the reference film's mascot belongs to a company). The troupe is designed for each
  film.
- The reference film's code, characters or palette (it has no licence: ideas only).

## 8. Where it lives

Search `grep '"stage"' index/index.jsonl`:
- the scenes `scene:stShow`, `scene:stSet`, `scene:stTitle`;
- `helper:ST.person` for humans, `helper:ST.puppet` (an original gumdrop puppet) for a mascot lead and its troupe; every
  other kind of character is a draw function of your own;
- `helper:ST.mood`, `helper:ST.move`;
- painting with `ST.paint` and `ST.ink`;
- the set (`ST.curtains`, `ST.spot`, `ST.floor`, `ST.sunburst`), `ST.sfx`, `ST.confetti`;
- the `brushWipe` and `irisInk` transitions; `ST.karaoke`.

Starter: `--style stage`, an example to rewrite.
