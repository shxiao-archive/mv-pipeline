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
 * Exit 1 on any ERROR.
 *
 * mv-studio (MIT).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, cliArg as arg, handleHelp } from './kit_env.mjs';
import { openEngine } from './engine_page.mjs';

handleHelp(`check_shots.mjs -- render samples of every shot; report errors, black / flat frames, failed fonts
  node tools/check_shots.mjs [--url engine/index.html] [--samples 3] [--only id1,id2] [--json FILE]`);

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
