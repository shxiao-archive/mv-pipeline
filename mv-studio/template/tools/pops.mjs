#!/usr/bin/env node
/* Continuity check: render every frame (small) and find picture changes the edit did not plan.
 *
 *   node tools/pops.mjs [--from 0 --to <end>] [--fps 30] [--thresh 0.06] [--url engine/index.html] [--strict]
 *
 *   JUMP   the picture changes a lot between two frames inside a shot (not at a cut, not inside a transition):
 *          a layer popping in, a camera snapping, a scene restarting, a parameter switching
 *   POP    for 1-3 frames the picture changes and then comes back to what it was: a short flash, a missing
 *          frame, a glitch that escaped (signal-style glitches are deliberate: check they are the planned ones)
 *   HIT    a jump within one frame of a beat, a lyric cut, a line's start or end, or a cue: an accent the edit asked
 *          for (a beat pulse, a slam, a JIZURA entrance or exit). Listed, never a failure: a check that failed hits
 *          sanded the punch out of the iteration-6 film (pulses replaced by soft waves, hard JIZURA parts denied)
 * Cuts come from the live shot list; the frames within one frame of a cut and inside a transition are exempt.
 * Grain is switched off while measuring. Writes render/pops.json; exit 1 with --strict on any JUMP or POP.
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
const onHit = t => hits.some(h => Math.abs(h - t) <= 1.01 / fps);
const shotAt = t => { let s = null; for (const x of P.shots) if (x.t0 <= t + 1e-6) s = x; return s; };
const frames = [];
const t0 = Date.now();
for (let i = Math.round(from * fps); i / fps < to; i++) {
  const t = i / fps;
  await E.frame(t);
  frames.push({ t, g: await E.thumb(96, 54) });
  if (frames.length % 300 === 0) console.log(`  ${t.toFixed(1)} s (${((Date.now() - t0) / frames.length).toFixed(0)} ms/frame)`);
}
await E.close();
const diff = (a, b) => { let s = 0; for (let k = 0; k < a.length; k++) s += Math.abs(a[k] - b[k]); return s / a.length / 255; };
const d = frames.map((f, i) => (i ? diff(frames[i - 1].g, f.g) : 0));
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)] || 0; };
const found = [];
for (let i = 1; i < frames.length; i++) {
  const t = frames[i].t;
  if (planned(t)) continue;
  const local = median(d.slice(Math.max(1, i - 15), i + 15));
  const lim = Math.max(thresh, 4 * local);
  if (d[i] <= lim) continue;
  // a POP: within 1-3 frames the picture comes back to what it was before the change
  let back = 0;
  for (let k = 1; k <= 3 && i + k < frames.length; k++) if (diff(frames[i - 1].g, frames[i + k].g) < lim / 3) { back = k; break; }
  if (back) { found.push({ kind: 'POP', t: +t.toFixed(3), frames: back, d: +d[i].toFixed(3), shot: shotAt(t)?.id }); i += back; continue; }
  found.push({ kind: onHit(t) ? 'HIT' : 'JUMP', t: +t.toFixed(3), d: +d[i].toFixed(3), local: +local.toFixed(3), shot: shotAt(t)?.id });
}
fs.mkdirSync(path.join(ROOT, 'render'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'render', 'pops.json'), JSON.stringify({ fps, thresh, from, to, found }, null, 1));
for (const f of found.filter(f => f.kind !== 'HIT')) console.log(`${f.kind.padEnd(4)}  ${f.t.toFixed(3)} s  shot ${f.shot}  change ${(f.d * 100).toFixed(1)} %${f.frames ? ` for ${f.frames} frame(s)` : ''}${f.local != null ? ` (around it ${(f.local * 100).toFixed(1)} %)` : ''}`);
const n = k => found.filter(f => f.kind === k).length, bad = n('JUMP') + n('POP');
console.log(`[pops] ${frames.length} frames ${from.toFixed(1)}-${to.toFixed(1)} s: ${n('JUMP')} jump(s), ${n('POP')} pop(s), ${n('HIT')} hit(s) on beats / lyric cuts / cues -> render/pops.json${bad ? ' (look at each: stills.mjs --times <t-1/fps>,<t>,<t+1/fps>)' : ''}`);
process.exit(flag('strict') && bad ? 1 : 0);
