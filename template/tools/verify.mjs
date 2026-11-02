#!/usr/bin/env node
/* Every automated check, in order, printing only what fails (with the tail of its output) and one line per pass.
 *   node tools/verify.mjs --quick          the build checks: lint, no lyrics in code, storyboard, every shot renders
 *   node tools/verify.mjs                  the same, then pops (a pre-render check: it renders the engine's frames small,
 *                                          not a video file, so it cannot see a render's worker seams)
 *   node tools/verify.mjs render/mv.mp4    all of that, then on the render: flash safety, sync, and static stretches
 *                                          (motion: listed as INFO, not a failure; stillness can be meant). The
 *                                          shots and pops run on the page and start that render used (its manifest,
 *                                          render/mv.render.json from render_final.mjs); a render without one fails
 *                                          unless --any-render (then a portrait video checks engine/vertical.html)
 * First it lists what is out of date (tools/stale.mjs): analysis older than the song or lyrics, or a render older
 * than the files it was made from, fails -- re-run analyze_audio.py / make_cues.py / render_final.mjs.
 * With a render it also WARNs when Z.CREDIT is empty or Z.TITLE is still 'untitled' (engine/timeline.js, engine/scenes/).
 * Exit 1 when any check fails. A check that passes with warnings (sync: lyric lines to listen to) prints WARN and its
 * output: resolve or accept each item. The checks guard technical defects; none decides what the film should look like.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { FFPROBE, ROOT } from './kit_env.mjs';
import { staleFiles } from './stale.mjs';

const args = process.argv.slice(2), mp4 = args.find(a => a.endsWith('.mp4'));
const py = process.platform === 'win32' ? 'python' : 'python3';
if (mp4 && !existsSync(mp4)) { console.error(`[verify] no such file: ${mp4}`); process.exit(1); }
const pre = [];                                                  // [level, name, detail lines] before the steps
const { stale, unknown, manifests } = staleFiles();
const manRel = mp4 && path.relative(ROOT, path.resolve(mp4)).split(path.sep).join('/').replace(/\.mp4$/, '.render.json');
const man = mp4 && manifests[manRel];
for (const [f, why] of Object.entries(stale)) {
  pre.push([f.startsWith('analysis/') || f === manRel ? 'FAIL' : 'INFO', `out of date: ${f}`, why]);   // others: not this check's
}
if (unknown.length) pre.push(['INFO', `not tracked: ${unknown.join(', ')}`, ['made before tools/stale.mjs; re-run its tool to track it']]);
if (mp4 && !man) pre.push([args.includes('--any-render') ? 'WARN' : 'FAIL', `no render manifest for ${mp4}`,
  [`${manRel} is written by render_final.mjs: re-render, or pass --any-render to check the video against today's page`]]);
if (man?.patched && JSON.stringify(man.base_inputs) !== JSON.stringify(man.inputs)) pre.push(['WARN', `${mp4} is patched`,
  [`only ${man.patched.map(r => r.join('-')).join(', ')} s were rendered with today's files; the rest is an earlier render's`]]);
if (mp4) {   // SKILL.md: never forget the credit. The starters ship Z.CREDIT = '' and Z.TITLE = 'untitled'
  const src = ['engine/timeline.js', ...(existsSync(path.join(ROOT, 'engine/scenes')) ? readdirSync(path.join(ROOT, 'engine/scenes')).map(n => `engine/scenes/${n}`) : [])]
    .map(f => path.join(ROOT, f)).filter(f => /\.js$/.test(f) && existsSync(f)).map(f => readFileSync(f, 'utf8')).join('\n');
  const last = k => [...src.matchAll(new RegExp(`Z\\.${k}\\s*=\\s*(['"\`])((?:\\\\.|(?!\\1).)*)\\1`, 'g'))].map(m => m[2]).pop();
  const credit = last('CREDIT'), title = last('TITLE'), miss = [];
  if (!credit?.trim()) miss.push("Z.CREDIT is empty: set the artist's credit line in engine/timeline.js (also README.md)");
  if (title === 'untitled') miss.push("Z.TITLE is still the starter's 'untitled'");
  if (miss.length) pre.push(['WARN', 'credit', miss]);
}
const dims = mp4 && !man ?`${spawnSync(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', mp4], { encoding: 'utf8' }).stdout || ''}`.trim().split(',').map(Number) : [];
// the page that drew this render (its ?shutter only blurs), else a portrait video's 9:16 build
const page = man ? man.url.replace(/([?&])shutter=[^&]*&?/, '$1').replace(/[?&]$/, '') : dims[1] > dims[0] ? 'engine/vertical.html' : null;
const vertical = !!page && /vertical\.html/.test(page), start = man && man.start ? ['--start', String(man.start)] : [];
const steps = [
  ['index', 'node', ['tools/build_index.mjs'], 'index/README.md in the skill'],
  ['lint', 'node', ['tools/lint.mjs'], 'references/09 §7'],
  ['no lyrics in code', 'node', ['tools/check_no_lyrics.mjs', '--strict'], 'SKILL.md "Laws"'],
  ['storyboard', 'node', ['tools/storyboard.mjs', '--quiet'], 'references/05 §3'],
  ['hand-made pictures', py, ['tools/gen_table.py', 'local', 'assets/gen/table.json'], 'references/04 §1'],
  ['shots' + (vertical ? ' (9:16)' : ''), 'node', ['tools/check_shots.mjs', '--strict', ...(page ? ['--url', page] : [])], 'references/09 §6'],
];
if (!args.includes('--quick')) steps.push(['pops (engine, pre-render)', 'node', ['tools/pops.mjs', '--strict', ...(page ? ['--url', page] : [])], 'references/09 §7']);
if (mp4) {
  steps.push(
    ['flash safety', py, ['tools/check_flash.py', mp4, ...start], 'references/09 §6'],
    ['sync', py, ['tools/check_sync.py', mp4, ...start], 'references/03 §12'],
    ['motion', py, ['tools/motion_check.py', mp4, '--quiet', ...start], 'references/09 §6', 'info'],
  );
} else if (!args.includes('--quick')) console.log('[verify] no render given: build checks and pops only (pass render/mv.mp4 for the rest)');

let failed = 0, warned = 0, partial = 0;
for (const [level, name, lines] of pre) {
  if (level === 'FAIL') failed++; else if (level === 'WARN') warned++;
  console.log(`${level}  ${name}  (see references/09 §6)`);
  for (const l of lines) console.log(`      ${l}`);
}
for (const [name, cmd, a, see, info] of steps) {
  const r = spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (info) { console.log(`INFO  ${name}  ${`${r.stdout || ''}`.trim().split('\n').filter(l => /^\[/.test(l)).pop() || '(no summary)'}`); continue; }
  const out = `${r.stdout || ''}${r.stderr || ''}${r.error ? r.error.message : ''}`.trim().split('\n');
  const warn = r.status === 0 && out.some(l => /\bWARN\b/.test(l));
  const skip = out.filter(l => /SKIPPED|not checked/.test(l));
  if (r.status === 0 && !warn) {
    if (skip.length) partial++;
    console.log(`PASS  ${name}${skip.length ? '  (partly: a step did not run)' : ''}`);
    for (const l of skip) console.log(`      ${l}`);
    continue;
  }
  if (warn) warned++; else failed++;
  console.log(`${warn ? 'WARN' : 'FAIL'}  ${name}  (${cmd} ${a.join(' ')}; see ${see})`);
  for (const l of out.slice(-20)) console.log(`      ${l}`);
}
const n = steps.filter(s => !s[4]).length + pre.filter(p => p[0] === 'FAIL').length;
const w = (warned ? `, ${warned} with warnings to review (above)` : '') + (partial ? `, ${partial} with steps not run (above)` : '');
console.log(failed ? `[verify] ${failed} of ${n} checks failed${w}` : w ? `[verify] no check failed${w}` : `[verify] all ${n} checks pass`);
process.exit(failed ? 1 : 0);
