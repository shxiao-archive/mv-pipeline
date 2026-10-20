#!/usr/bin/env node
/* Before / after a change to a SHARED file (engine/core, a scene used by many shots, a style pack, the timeline
 * helpers): snapshot small frames of the whole film, change the code, snapshot again, and list every frame that
 * changed -- so a fix in one section cannot silently break a finished one.
 *
 *   node tools/regress.mjs snap before [--every 0.5] [--from 0 --to END] [--url engine/index.html]
 *   ... edit ...
 *   node tools/regress.mjs snap after
 *   python tools/compare_sheets.py before after          # changed frames, by time and shot, + a sheet of them
 *
 * Frames: every `every` seconds plus the middle of every shot, 480x270 PNG in render/regress/<name>/ (grain off).
 * Renders of the same code agree to within a level or two (GPU), which compare_sheets.py ignores.
 *
 * mv-studio (MIT).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, cliArg as arg, handleHelp } from './kit_env.mjs';
import { openEngine } from './engine_page.mjs';

handleHelp(`regress.mjs -- snapshot the film before / after a change; compare with tools/compare_sheets.py
  node tools/regress.mjs snap <name> [--every 0.5] [--from 0 --to END] [--url engine/index.html]`);

const [step, name] = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (step !== 'snap' || !name) { console.error('usage: node tools/regress.mjs snap <name> [--every 0.5]'); process.exit(1); }
const dir = path.join(ROOT, 'render', 'regress', name.replace(/[^\w.-]/g, '_'));
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const E = await openEngine({ url: arg('url', 'engine/index.html'), quiet: true });
await E.page.evaluate(() => { const g = window.Z.globalFX; window.Z.globalFX = (P, t) => { if (g) g(P, t); P.grain = 0; }; });
const P = await E.plan();
const every = +arg('every', 0.5), from = +arg('from', 0), to = Math.min(+arg('to', P.duration), P.duration);
const shots = P.shots.slice().sort((a, b) => a.t0 - b.t0);
const times = new Set();
for (let t = from; t < to; t += every) times.add(+t.toFixed(3));
shots.forEach((s, k) => { const e = shots[k + 1] ? shots[k + 1].t0 : s.t1; const m = (s.t0 + e) / 2; if (m >= from && m < to) times.add(+m.toFixed(3)); });
const list = [...times].sort((a, b) => a - b), index = [];
for (const t of list) {
  await E.frame(t);
  const b64 = await E.page.evaluate(() => {
    const c = window.__rgC || (window.__rgC = Object.assign(document.createElement('canvas'), { width: 480, height: 270 }));
    const src = document.getElementById('out'); if (src.height > src.width) { c.width = 270; c.height = 480; }
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c.toDataURL('image/png').split(',')[1];
  });
  const f = `t${t.toFixed(3).padStart(8, '0')}.png`;
  fs.writeFileSync(path.join(dir, f), Buffer.from(b64, 'base64'));
  let s = null; for (const x of shots) if (x.t0 <= t + 1e-6) s = x;
  index.push({ t, file: f, shot: s ? s.id : null });
}
await E.close();
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ name, every, from, to, frames: index }, null, 1));
console.log(`[regress] ${index.length} frames -> render/regress/${path.basename(dir)}/  (compare: python tools/compare_sheets.py <a> <b>)`);
