#!/usr/bin/env node
/* Continuity check: render every frame (small) and find picture changes the edit did not plan.
 *
 *   node tools/pops.mjs [--from 0 --to <end>] [--fps 30] [--thresh 0.06] [--url engine/index.html] [--strict]
 *
 *   JUMP   the picture changes a lot between two frames inside a shot (not at a cut, not inside a transition):
 *          a layer popping in, a camera snapping, a scene restarting, a parameter switching
 *          (a lot: over --thresh and over 4x the median change of the 30 frames around it in the same shot)
 *   POP    for 1-3 frames the picture changes and then comes back to what it was: a short flash, a missing
 *          frame, a glitch that escaped (signal-style glitches are deliberate: check they are the planned ones)
 *   HIT    a jump or pop within one frame of a beat, a lyric cut, a line's start or end, or a cue, or on a frame where
 *          the scene's code reads a drum hit still ringing (Z.hit or the magazine press's MZ.ring above 0.05), a signal cut's burst (Z.SIG.kick above
 *          0.05) or a signal vertical-hold jump (Z.SIG.vhold), or a change that goes away with the lyric layer off (the
 *          JIZURA part's own motion: its entrance, exit, layout move, fx event), or a change inside the entrance a shot
 *          declares (`enter: 4` on the shot: the 4 frames after its cut, a punch-in settling; at most 6 frames count):
 *          an accent the edit asked for (a beat pulse, a shake on the snare, a slam, a JIZURA
 *          entrance or exit). Listed, never a failure: a check that failed hits sanded
 *          the punch out of the iteration-6 film (pulses replaced by soft waves, hard JIZURA parts denied)
 * Cuts come from the live shot list; the frames within one frame of a cut and inside a transition are exempt.
 * Grain is switched off while measuring. Writes render/pops.json; exit 1 with --strict on any JUMP or POP.
 * Needs no render: run it on the changed ranges (--from / --to) before rendering them.
 *
 * mv-studio (MIT).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, cliArg as arg, cliFlag as flag, handleHelp } from './kit_env.mjs';
import { openEngine } from './engine_page.mjs';

handleHelp(`pops.mjs -- unplanned jumps and one-frame pops inside shots
  node tools/pops.mjs [--from 0 --to END] [--fps 30] [--thresh 0.06] [--strict]`);

const E = await openEngine({ url: arg('url', 'engine/index.html'), quiet: true });
await E.page.evaluate(() => { const g = window.Z.globalFX; window.Z.globalFX = (P, t) => { if (g) g(P, t); P.grain = 0; }; });
const P = await E.plan();
const fps = +arg('fps', P.fps || 30), thresh = +arg('thresh', 0.06);
const from = +arg('from', 0), to = Math.min(+arg('to', P.duration), P.duration);
const cuts = P.shots.map(s => s.t0), trans = P.shots.filter(s => s.trans && s.trans.dur > 0).map(s => [s.t0, s.t0 + s.trans.dur]);
const planned = t => cuts.some(c => Math.abs(c - t) <= 1.01 / fps) || trans.some(([a, b]) => t >= a - 1 / fps && t <= b + 1 / fps);
const hits = [...(P.beats || []), ...(P.groupStarts || []), ...(P.lyricCuts || []), ...P.lines.flatMap(L => [L.t, L.end]), ...P.cues.map(c => c.t)].filter(Number.isFinite);
// a declared entrance: the `enter` frames (at most MAX_ENTER) after a shot's cut answer the cut on purpose (a punch-in settling)
const MAX_ENTER = 6;
const enters = P.shots.filter(s => s.enter).map(s => [s.t0, s.t0 + (Math.min(s.enter, MAX_ENTER) + 0.01) / fps]);
const onHit = (t, i) => drum.has(i) || hits.some(h => Math.abs(h - t) <= 1.01 / fps) || enters.some(([a, b]) => t > a && t <= b);
// a frame whose code reads a drum hit still ringing (Z.hit above 0.05) answers the drum on purpose: its onset and its release
// shortcut: a real glitch within ~0.3 s of a hit in a drum-reading scene is hidden too; if that bites, compare against the frame with Z.hit forced to 0
await E.page.evaluate(() => {
  const Z = window.Z, h = Z.hit; window.__drum = 0;
  Z.hit = (k, t, tau) => { const v = h(k, t, tau); if (v > 0.05) window.__drum = 1; return v; };
  const kick = Z.SIG && Z.SIG.kick;
  if (kick) Z.SIG.kick = t => { const v = kick(t); if (v > 0.05) window.__drum = 1; return v; };
  const ring = Z.MZ && Z.MZ.ring;   // the magazine press's plate slip / page punch on kick and snare accents (MZ.react)
  if (ring) Z.MZ.ring = (t, ht, tau) => { const v = ring(t, ht, tau); if (v > 0.05) window.__drum = 1; return v; };
  // the signal layer's own vertical-hold jump is planned: the frame it fires on and the frame it snaps back on
  const vhold = Z.SIG && Z.SIG.vhold;
  if (vhold) Z.SIG.vhold = (f, d) => { const v = vhold(f, d); if (v || vhold(f - 1, d)) window.__drum = 1; return v; };
});
const drum = new Set();
const shotAt = t => { let s = null; for (const x of P.shots) if (x.t0 <= t + 1e-6) s = x; return s; };
const frames = [];
const t0 = Date.now();
for (let i = Math.round(from * fps); i / fps < to; i++) {
  const t = i / fps;
  await E.frame(t);
  if (await E.page.evaluate(() => { const d = window.__drum; window.__drum = 0; return d; })) drum.add(frames.length);
  frames.push({ t, g: await E.thumb(96, 54) });
  if (frames.length % 300 === 0) console.log(`  ${t.toFixed(1)} s (${((Date.now() - t0) / frames.length).toFixed(0)} ms/frame)`);
}
const diff = (a, b) => { let s = 0; for (let k = 0; k < a.length; k++) s += Math.abs(a[k] - b[k]); return s / a.length / 255; };
const d = frames.map((f, i) => (i ? diff(frames[i - 1].g, f.g) : 0));
const sh = frames.map(f => shotAt(f.t));
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)] || 0; };
const found = [];
for (let i = 1; i < frames.length; i++) {
  const t = frames[i].t;
  if (planned(t)) continue;
  // the motion around it, inside this shot only: a still (or black) shot next door must not lower the bar for a moving one
  const win = []; for (let j = Math.max(1, i - 15); j < Math.min(d.length, i + 15); j++) if (sh[j] === sh[i] && sh[j - 1] === sh[i]) win.push(d[j]);
  const local = median(win);
  const lim = Math.max(thresh, 4 * local);
  if (d[i] <= lim) continue;
  // a POP: within 1-3 frames the picture comes back to what it was before the change
  let back = 0;
  for (let k = 1; k <= 3 && i + k < frames.length; k++) if (diff(frames[i - 1].g, frames[i + k].g) < lim / 3) { back = k; break; }
  if (back) { found.push({ kind: onHit(t, i) ? 'HIT' : 'POP', t: +t.toFixed(3), frames: back, d: +d[i].toFixed(3), lim, i, shot: shotAt(t)?.id }); i += back; continue; }
  found.push({ kind: onHit(t, i) ? 'HIT' : 'JUMP', t: +t.toFixed(3), d: +d[i].toFixed(3), local: +local.toFixed(3), lim, i, shot: shotAt(t)?.id });
}
// the change gone with the lyric layer off: the JIZURA part's own motion (entrance, exit, layout move, fx event)
// shortcut: a glitch in the lyric layer itself passes too; if one slips through, check that part with jz_cuts_at.mjs + stills
await E.page.evaluate(() => { window.Z.NO_LYRICS = true; });
for (const f of found) {
  if (f.kind === 'HIT') { delete f.lim; delete f.i; continue; }
  const g = [];
  for (const k of [f.i - 1, f.i]) { await E.frame(frames[k].t); g.push(await E.thumb(96, 54)); }
  if (diff(g[0], g[1]) <= f.lim) f.kind = 'HIT';
  delete f.lim; delete f.i;
}
await E.close();
fs.mkdirSync(path.join(ROOT, 'render'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'render', 'pops.json'), JSON.stringify({ fps, thresh, from, to, found }, null, 1));
for (const f of found.filter(f => f.kind !== 'HIT')) console.log(`${f.kind.padEnd(4)}  ${f.t.toFixed(3)} s  shot ${f.shot}  change ${(f.d * 100).toFixed(1)} %${f.frames ? ` for ${f.frames} frame(s)` : ''}${f.local != null ? ` (around it ${(f.local * 100).toFixed(1)} %)` : ''}`);
const n = k => found.filter(f => f.kind === k).length, bad = n('JUMP') + n('POP');
console.log(`[pops] ${frames.length} frames ${from.toFixed(1)}-${to.toFixed(1)} s: ${n('JUMP')} jump(s), ${n('POP')} pop(s), ${n('HIT')} hit(s) on beats / drum hits / lyric cuts / cues / declared entries -> render/pops.json${bad ? ' (look at each: stills.mjs --times <t-1/fps>,<t>,<t+1/fps>)' : ''}`);
process.exit(flag('strict') && bad ? 1 : 0);
