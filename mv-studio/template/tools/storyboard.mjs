#!/usr/bin/env node
/* The storyboard, generated from the LIVE shot list (engine/timeline.js), so it can never drift from the film, and
 * checked. Writes plan/shots.json (text-free) and docs/STORYBOARD.md; exit 1 when a check fails.
 *
 *   node tools/storyboard.mjs [--url engine/index.html] [--strict] [--quiet]
 *
 * Shot fields the checks read (timeline.js; all optional except the first four):
 *   id, t0, t1, scene     as always
 *   moment: '...'         what this shot shows and why, in your own words (never lyric text)    [required by --strict]
 *   line: 3 | [3, 4]      the lyric line(s) this picture answers (args with line / lines indices count as shown)
 *   cue: 'L03'            the cue the cut is placed on: the cut must sit within review.cueTolerance of it
 *   offgrid: 'reason'     this cut is deliberately off the beat grid (a pickup, a rubato hold): skip the grid check
 *   insert: true          a 1-2 frame insert: skip the minimum-length check
 *   allowBlack: true      a deliberately black shot (check_shots.mjs)
 *   hold: true            a deliberate still (a held breath, a stop): motion_check.py does not count it, up to 8 % of the film
 * Checks (ERROR fails the run, WARN is listed):
 *   ERROR  unknown scene · a gap with no shot (black) · a cut off the grid (beats, half-beats, cues, line onsets)
 *          · a cut far from its declared cue · a shot shorter than review.minShotFrames · a sung line no shot shows
 *          (no JIZURA layer, no text hook, no line index in its args)
 *   WARN   a shot without `moment` (ERROR with --strict) · a line no shot declares it answers · a line too short to read
 *          (< max(0.7 s, 0.09 s per character)) · line cues without a picture hint (analysis/cues.json)
 *          · a vocaloid film whose characters never blink or sing (no `chars[].anim`; ERROR with --strict)
 *          · characters placed the same way (ERROR with --strict): over half of the character shots centred (|u - 0.5| < 0.08), or a third
 *            of the frame never used (u < 0.4 / u > 0.6), with 4+ character shots (args.chars x or pin)
 * Tolerances from project.json -> review: { cutTolerance: 0.04, cueTolerance: 0.15, grid: 'half' | 'beat', minShotFrames: 3 }.
 *
 * mv-studio (MIT).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, cliArg as arg, cliFlag as flag, handleHelp } from './kit_env.mjs';
import { openEngine } from './engine_page.mjs';

handleHelp(`storyboard.mjs -- docs/STORYBOARD.md + plan/shots.json from the live shot list, with checks
  node tools/storyboard.mjs [--url engine/index.html] [--strict] [--quiet]`);

const strict = flag('strict');
const E = await openEngine({ url: arg('url', 'engine/index.html'), quiet: flag('quiet') });
const P = await E.plan();
const loadErrors = E.errors.slice();
await E.close();

const R = Object.assign({ cutTolerance: 0.04, cueTolerance: 0.15, grid: 'half', minShotFrames: 3 }, (P.project && P.project.review) || {});
const fps = P.fps || 30, shots = P.shots.slice().sort((a, b) => a.t0 - b.t0), lines = P.lines, cues = P.cues;
const cueById = Object.fromEntries(cues.map(c => [c.id, c]));
const errors = [], warns = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`), warn = (id, msg) => warns.push(`${id}: ${msg}`);
const fmt = t => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; };

// the grid: beats (+ half beats), every cue, every line onset, the start and the end
const grid = [0, P.duration];
P.beats.forEach((b, k) => { grid.push(b); if (R.grid === 'half' && k + 1 < P.beats.length) grid.push((b + P.beats[k + 1]) / 2); });
cues.forEach(c => grid.push(c.t)); lines.forEach(L => grid.push(L.t));
grid.sort((a, b) => a - b);
const nearest = t => { let best = Infinity; for (const g of grid) { const d = Math.abs(g - t); if (d < best) best = d; } return best; };

if (!shots.length) err('timeline', 'no shots (Z.SHOTS is empty)');
loadErrors.forEach(e => err('page', e.msg));
shots.forEach((s, k) => {
  const next = shots[k + 1], end = next ? next.t0 : s.t1, dur = end - s.t0;
  if (!s.known) err(s.id, `unknown scene '${s.scene}'`);
  if (k === 0 && s.t0 > 0.05) err(s.id, `the film starts with ${s.t0.toFixed(2)} s of black (first shot at ${fmt(s.t0)})`);
  if (next && s.t1 < next.t0 - 1 / fps) err(s.id, `gap ${fmt(s.t1)}-${fmt(next.t0)}: the previous shot keeps drawing past its t1 (set t1 = next t0)`);
  if (!s.insert && dur < R.minShotFrames / fps - 1e-6) err(s.id, `${(dur * fps).toFixed(1)} frames long (minimum ${R.minShotFrames}; mark 1-2 frame inserts insert: true)`);
  if (k > 0 && !s.offgrid && !shots[k - 1].insert) { const d = nearest(s.t0); if (d > R.cutTolerance) err(s.id, `cut at ${fmt(s.t0)} is ${(d * 1000).toFixed(0)} ms off the grid (beats${R.grid === 'half' ? ' / half-beats' : ''}, cues, line onsets); fix it or mark offgrid: 'why'`); }
  if (s.cue) {
    const c = cueById[s.cue];
    if (!c) err(s.id, `cue '${s.cue}' is not in analysis/cues.json`);
    else if (Math.abs(c.t - s.t0) > R.cueTolerance) err(s.id, `cut ${fmt(s.t0)} is ${(Math.abs(c.t - s.t0) * 1000).toFixed(0)} ms from its cue ${s.cue} (${fmt(c.t)}; tolerance ${R.cueTolerance * 1000} ms)`);
  }
  if (!s.moment) (strict ? err : warn)(s.id, 'no `moment` (what this shot shows and why)');
});
const last = shots[shots.length - 1];
if (last && last.t1 < P.duration - 0.05) err(last.id, `the film runs to ${fmt(P.duration)} but the last shot ends at ${fmt(last.t1)}`);

lines.forEach(L => {
  const span = shots.filter(s => s.t0 < L.end && (s.t1 > L.t));
  const shownBy = span.filter(s => s.jizura || s.text || s.lyric === 'fn' || s.shows.includes(L.i));
  if (!shownBy.length) err(`line ${L.i}`, `sung at ${fmt(L.t)} but no shot shows it (lyric layer off, no text hook, no line index in args)`);
  if (!shots.some(s => s.line && s.line.includes(L.i))) warn(`line ${L.i}`, 'no shot declares it answers this line (shot.line)');
  const need = Math.max(0.7, 0.09 * L.n);
  if (L.end - L.t < need - 1e-3) warn(`line ${L.i}`, `on screen ${(L.end - L.t).toFixed(2)} s, needs ${need.toFixed(2)} s to be read`);
});
const noHint = cues.filter(c => c.kind === 'line' && !c.hint).length;
if (noHint) warn('cues', `${noHint} line cue(s) without a picture hint (analysis/cues.json "hint")`);
const withFaces = shots.filter(s => s.faces);
const placed = shots.filter(s => s.place && s.place.length).map(s => s.place[0]);   // the first char of a shot: the lead
if (placed.length >= 4) {
  const centred = placed.filter(u => Math.abs(u - 0.5) < 0.08).length, left = placed.filter(u => u < 0.4).length, right = placed.filter(u => u > 0.6).length;
  if (centred > placed.length / 2 || !left || !right)
    (strict ? err : warn)('placement', `characters: ${centred} of ${placed.length} shots centred, ${left} on the left third, ${right} on the right: put most on a third (x ~ 640 / 1280, pin u ~ 0.33 / 0.67), facing into the open side (flip), and keep the centre for frontal singing and kime shots (styles/vocaloid/STYLE.md, Placement varies)`);
}
if (/^(vocaloid|tegaki|signal)/.test((P.project && P.project.style) || '') && withFaces.length && !withFaces.some(s => s.animFaces))
  (strict ? err : warn)('faces', `${withFaces.length} shot(s) show characters but none blinks or sings: make an expression sheet (references/04 §0) and give chars an anim (styles/vocaloid/STYLE.md, Characters with a living face)`);

// ---- outputs
const rows = shots.map((s, k) => {
  const end = shots[k + 1] ? shots[k + 1].t0 : s.t1;
  return { n: k + 1, id: s.id, t0: s.t0, t1: end, dur: +(end - s.t0).toFixed(3), scene: s.scene,
    line: s.line, shows: s.shows, cue: s.cue, moment: s.moment, lyric: s.lyric, trans: s.trans, offgrid: s.offgrid, hold: s.hold || undefined, animFaces: s.animFaces || undefined };
});
fs.mkdirSync(path.join(ROOT, 'plan'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'plan', 'shots.json'), JSON.stringify({ generator: 'tools/storyboard.mjs', duration: P.duration, fps, shots: rows }, null, 1) + '\n');
const esc = s => String(s ?? '').replace(/\|/g, '\\|');
const md = [
  '# Storyboard', '',
  `Generated by \`node tools/storyboard.mjs\` from engine/timeline.js (do not edit: change the shots, then run it again).`,
  `${rows.length} shots, ${fmt(P.duration)}; lines are LRC line numbers (the text lives only in analysis/lyrics_mv.lrc).`, '',
  `Checks: ${errors.length} error(s), ${warns.length} warning(s).`, '',
  '| # | id | time | dur | line | shows | cue | scene | moment | in |', '|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map(r => `| ${r.n} | ${r.id} | ${fmt(r.t0)} | ${r.dur.toFixed(2)} | ${r.line ? r.line.join(',') : ''} | ${r.shows.join(',')} | ${r.cue || ''} | ${r.scene} | ${esc(r.moment)} | ${r.trans ? `${r.trans.type} ${r.trans.dur}s` : 'cut'} |`),
  '', '## Lines', '', '| line | time | on screen | source | conf | cue hint |', '|---|---|---|---|---|---|',
  ...lines.map(L => { const c = cues.find(x => x.kind === 'line' && Math.abs(x.t - L.t) < 1e-3); return `| ${L.i} | ${fmt(L.t)} | ${(L.end - L.t).toFixed(2)} s | ${L.source || 'lrc'} | ${L.conf ?? ''} | ${esc(c ? c.hint : '')} |`; }),
  '', errors.length ? '## Errors\n\n' + errors.map(e => `- ${esc(e)}`).join('\n') : '', warns.length ? '\n## Warnings\n\n' + warns.map(e => `- ${esc(e)}`).join('\n') : '', '',
].join('\n');
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs', 'STORYBOARD.md'), md);
for (const e of errors) console.log('ERROR ' + e);
for (const w of warns.slice(0, 40)) console.log('WARN  ' + w);
if (warns.length > 40) console.log(`WARN  ... ${warns.length - 40} more in docs/STORYBOARD.md`);
console.log(`[storyboard] ${rows.length} shots, ${lines.length} lines -> docs/STORYBOARD.md, plan/shots.json: ${errors.length ? 'FAIL' : 'PASS'} (${errors.length} errors, ${warns.length} warnings)`);
process.exit(errors.length ? 1 : 0);
