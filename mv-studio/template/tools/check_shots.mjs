#!/usr/bin/env node
/* Every shot renders: sample each shot of the live timeline and report page errors, black / flat frames and fonts
 * that failed to load. Fast (no video): run it after every change, before stills and renders.
 *
 *   node tools/check_shots.mjs [--url engine/index.html] [--samples 3] [--only s12,s13] [--json render/check_shots.json]
 *
 * Per shot it renders `samples` times spread over the shot (first frame, ..., last frame) and flags
 *   ERROR  a page error while drawing it · a BLACK frame (mean < 3 %, almost no detail) unless the shot says
 *          allowBlack: true or it is within 0.5 s of the film's start or end (fades) · the scene is not registered
 *   WARN   a FLAT frame (one colour, no detail) · a font face that failed to load
 *          · SPRITE PING-PONG: the main character sprite (the largest one drawn) goes A -> B -> A within 2 s, or changes
 *            3+ times in 3 s (inside a shot or across short shots); sampled at --sprite-fps (default 4, 0 = off);
 *            an ERROR with --strict
 *          · LYRICS OUTSIDE THE SAFE AREA: lyric-layer pixels (JIZURA + shot.text, not the HUD) in the outer 5 % of the frame,
 *            over 2 % of them, in the same pass (an ERROR with --strict). Words a scene draws itself are not seen; a
 *            JIZURA cut is judged while its words hold (glyphs flying off the frame in an enter / exit are motion)
 *          · LYRIC OVERLAP: a JIZURA cut comes in by one of JIZURA's own transitions, which draws the outgoing and the
 *            incoming line on top of each other (TEXT_TRANS in timeline.js); an ERROR with --strict
 * Exit 1 on any ERROR.
 *
 * mv-studio (MIT).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, cliArg as arg, cliFlag as flag, handleHelp } from './kit_env.mjs';
import { openEngine } from './engine_page.mjs';

handleHelp(`check_shots.mjs -- render samples of every shot; report errors, black / flat frames, failed fonts
  node tools/check_shots.mjs [--url engine/index.html] [--samples 3] [--only id1,id2] [--json FILE] [--sprite-fps 4] [--strict] [--selftest]`);

// samples [{ t, p (main sprite path or null), id }] -> [{ id, t, kind, msg }]
export function spriteFlips(samples) {
  const runs = [];
  for (const s of samples) {
    if (!s.p) continue;                                        // nothing drawn: the last sprite is still the one in mind
    const r = runs[runs.length - 1];
    if (r && r.p === s.p) r.t1 = s.t; else runs.push({ p: s.p, t0: s.t, t1: s.t, id: s.id });
  }
  const out = [], seen = new Set(), add = (id, t, kind, msg) => { if (!seen.has(id + kind)) { seen.add(id + kind); out.push({ id, t, kind, msg }); } };
  for (let i = 0; i + 2 < runs.length; i++)
    if (runs[i + 2].p === runs[i].p && runs[i + 2].t0 - runs[i].t1 <= 2.0)
      add(runs[i + 1].id, runs[i + 1].t0, 'pingpong', `${short(runs[i].p)} -> ${short(runs[i + 1].p)} -> back within ${(runs[i + 2].t0 - runs[i].t1).toFixed(1)} s`);
  for (let i = 0; i + 3 < runs.length; i++)
    if (runs[i + 3].t0 - runs[i].t0 <= 3.0) add(runs[i + 1].id, runs[i + 1].t0, 'rapid', `${runs.slice(i, i + 4).map(r => short(r.p)).join(' -> ')} within 3 s`);
  return out;
}
const short = p => p.split('/').pop().replace(/\.\w+$/, '');

// shots [{ id, t0, t1, plan }] (plan null = no JIZURA lyrics), cuts { plan: [{ index, start, trans }] } (trans = a
// registered JIZURA transition or null) -> [{ id, t, msg }]
export function lyricOverlaps(shots, cuts) {
  const out = [];
  for (const s of shots) for (const c of (s.plan && cuts[s.plan]) || [])
    if (c.trans && c.index > 0 && c.start >= s.t0 && c.start < s.t1) out.push({ id: s.id, t: c.start, msg: `cut ${c.index} comes in by the JIZURA transition '${c.trans}' over the previous line` });
  return out;
}
// a cut's words come in or go out (enter / exit, plus a frame or two of ghost lag)
export const moving = (c, t) => !!c && (t - c.start < c.inDur + 0.1 || c.end - t < c.outDur + 0.1);

if (flag('selftest')) {
  const seq = (ps, id = 's1', dt = 0.25) => ps.map((p, i) => ({ t: i * dt, p, id }));
  const ok = [
    spriteFlips(seq(['a', 'a', 'b', 'b', 'a', 'a'])).some(f => f.kind === 'pingpong'),                 // A B A in 1 s
    spriteFlips(seq(['a', null, null, 'a', 'b'])).length === 0,                                          // a gap is not a change
    spriteFlips(seq(['a', 'b', 'c', 'd'], 's1', 0.6)).some(f => f.kind === 'rapid'),                  // 4 sprites in 1.8 s
    spriteFlips(seq(['a', 'b', 'a'], 's1', 3)).length === 0,                                             // a return after 3 s is a motif
    lyricOverlaps([{ id: 's1', t0: 0, t1: 4, plan: 'main' }], { main: [{ index: 0, start: 0, trans: 'x' }, { index: 1, start: 2, trans: 'x' }] }).length === 1,
    lyricOverlaps([{ id: 's1', t0: 0, t1: 4, plan: null }], { main: [{ index: 1, start: 2, trans: 'x' }] }).length === 0,
    moving({ start: 0, end: 2, inDur: 0.3, outDur: 0.4 }, 1.7) && !moving({ start: 0, end: 2, inDur: 0.3, outDur: 0.4 }, 1.0),
  ];
  console.log(`[check_shots] selftest ${ok.every(Boolean) ? 'ok' : 'FAIL ' + JSON.stringify(ok)}`); process.exit(ok.every(Boolean) ? 0 : 1);
}

const n = Math.max(1, +arg('samples', 3));
const only = arg('only', '') ? new Set(arg('only').split(',')) : null;
const E = await openEngine({ url: arg('url', 'engine/index.html'), quiet: true });
const P = await E.plan();
const fps = P.fps || 30, shots = P.shots.slice().sort((a, b) => a.t0 - b.t0);
const bootErrors = E.errors.splice(0);
const report = [], errors = [], warns = [];
bootErrors.forEach(e => errors.push(`boot: ${e.msg}`));
for (let k = 0; k < shots.length; k++) {
  const s = shots[k];
  if (only && !only.has(s.id)) continue;
  const end = shots[k + 1] ? shots[k + 1].t0 : s.t1;
  const times = n === 1 ? [(s.t0 + end) / 2] : Array.from({ length: n }, (_, i) => s.t0 + 1 / fps * 0.5 + (end - s.t0 - 1 / fps) * (i / (n - 1)));
  const row = { id: s.id, scene: s.scene, t0: s.t0, samples: [] };
  if (!s.known) errors.push(`${s.id}: scene '${s.scene}' is not registered`);
  for (const t of times) {
    const before = E.errors.length;
    await E.frame(t);
    const g = await E.thumb(96, 54);
    const mean = g.reduce((a, b) => a + b, 0) / g.length;
    const sd = Math.sqrt(g.reduce((a, b) => a + (b - mean) ** 2, 0) / g.length);
    const errs = E.errors.slice(before).map(e => e.msg);
    const black = mean < 8 && sd < 4, flat = !black && sd < 1.5;
    row.samples.push({ t: +t.toFixed(3), mean: +(mean / 255).toFixed(3), sd: +(sd / 255).toFixed(4), black, flat, errors: errs });
    errs.forEach(m => errors.push(`${s.id} @${t.toFixed(2)}: ${m}`));
    const fade = t < 0.5 || t > P.duration - 0.5;             // fade in from / out to black at the very start and end
    if (black && !s.allowBlack && !fade) errors.push(`${s.id} @${t.toFixed(2)}: BLACK frame (mean ${(mean / 2.55).toFixed(1)} %; mark allowBlack: true if intended)`);
    if (flat) warns.push(`${s.id} @${t.toFixed(2)}: FLAT frame (one colour, sd ${(sd / 2.55).toFixed(2)} %)`);
  }
  report.push(row);
}
const spriteFps = +arg('sprite-fps', 4);
if (spriteFps > 0) {                                           // which sprite is the main one, every 1/spriteFps s
  const samples = [], unsafe = new Map();
  for (let k = 0; k < shots.length; k++) {
    const s = shots[k], end = shots[k + 1] ? shots[k + 1].t0 : s.t1;
    if (only && !only.has(s.id)) continue;
    for (let t = s.t0 + 0.5 / fps; t < end; t += 1 / spriteFps) {
      const { p, out, all } = await E.page.evaluate(async t => {
        let best = null, out = 0, all = 0;
        window.Z.onSprite = (p, h) => { if (p && (!best || h > best.h)) best = { p, h }; };
        window.Z.onText = (c, shot) => {                           // lyric pixels outside the 90 % title-safe box
          const L = shot && (shot.lyric === undefined ? 'front' : shot.lyric), name = L && typeof L === 'object' ? L.plan || 'main' : shot && (shot.plan || 'main');
          const P = window.JZ && window.JZ.plans && window.JZ.plans[name], tl = t - (window.Z.LYRIC_OFFSET || 0), cut = P && window.J.cutAt(P.plan, tl);
          if (cut && (tl - cut.start < cut.inDur + 0.1 || cut.end - tl < cut.outDur + 0.1)) return;   // = moving(): words in motion
          const s = window.__safe || (window.__safe = Object.assign(document.createElement('canvas'), { width: 192, height: 108 }));
          const x = s.getContext('2d', { willReadFrequently: true }); x.clearRect(0, 0, 192, 108); x.drawImage(c, 0, 0, 192, 108);
          const a = x.getImageData(0, 0, 192, 108).data;
          for (let i = 3, n = 0; i < a.length; i += 4, n++) if (a[i] > 127) { all++; const u = n % 192, v = (n / 192) | 0; if (u < 10 || u >= 182 || v < 5 || v >= 103) out++; }
        };
        try { await window.renderFrame(t); } finally { window.Z.onSprite = null; window.Z.onText = null; }
        return { p: best && best.p, out, all };
      }, t);
      samples.push({ t, p, id: s.id });
      if (out >= 6 && out > 0.02 * all && !unsafe.has(s.id)) unsafe.set(s.id, { t, share: out / all });
    }
  }
  for (const [id, u] of unsafe) (flag('strict') ? errors : warns).push(`${id} @${u.t.toFixed(2)}: LYRICS OUTSIDE THE SAFE AREA (${(u.share * 100).toFixed(0)} % of the lyric pixels in the outer 5 %; a camera push or a big layout crops words: pick a calmer plan or reframe)`);
  const jz = await E.page.evaluate(() => {
    const Z = window.Z, JZ = window.JZ, out = { shots: [], cuts: {} };
    if (!JZ || !JZ.plans) return out;
    for (const [name, P] of Object.entries(JZ.plans))
      out.cuts[name] = P.plan.cuts.map(c => ({ index: c.index, start: c.start + (Z.LYRIC_OFFSET || 0), trans: c.trans && window.J.TRANS[c.trans] ? c.trans : null }));
    for (const s of Z.SHOTS || []) {
      const L = s.lyric === undefined ? 'front' : s.lyric;
      out.shots.push({ id: s.id, t0: s.t0, t1: s.t1, plan: !L || L === 'none' ? null : typeof L === 'object' ? L.plan || 'main' : s.plan || 'main' });
    }
    return out;
  });
  for (const o of lyricOverlaps(jz.shots.filter(s => !only || only.has(s.id)), jz.cuts)) (flag('strict') ? errors : warns).push(`${o.id} @${o.t.toFixed(2)}: LYRIC OVERLAP ${o.msg} (TEXT_TRANS = false in timeline.js; references/06)`);
  for (const f of spriteFlips(samples)) (flag('strict') ? errors : warns).push(`${f.id} @${f.t.toFixed(2)}: SPRITE ${f.kind === 'pingpong' ? 'PING-PONG' : 'RAPID SWAPS'} ${f.msg} (hold one pose per shot; faces change with chars[].anim; styles/vocaloid/STYLE.md, One pose per shot)`);
}
const badFonts = await E.page.evaluate(() => [...document.fonts].filter(f => f.status === 'error').map(f => `${f.family} ${f.weight}`));
badFonts.forEach(f => warns.push(`font failed to load: ${f}`));
await E.close();
const out = arg('json', 'render/check_shots.json');
fs.mkdirSync(path.dirname(path.resolve(ROOT, out)), { recursive: true });
fs.writeFileSync(path.resolve(ROOT, out), JSON.stringify({ shots: report, errors, warns }, null, 1));
errors.forEach(e => console.log('ERROR ' + e));
warns.forEach(w => console.log('WARN  ' + w));
console.log(`[check_shots] ${report.length} shots x ${n} samples: ${errors.length ? 'FAIL' : 'PASS'} (${errors.length} errors, ${warns.length} warnings) -> ${out}`);
process.exit(errors.length ? 1 : 0);
