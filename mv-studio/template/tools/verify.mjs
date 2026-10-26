#!/usr/bin/env node
/* Every automated check, in order, printing only what fails (with the tail of its output) and one line per pass.
 *   node tools/verify.mjs --quick          the build checks: lint, no lyrics in code, storyboard, every shot renders
 *   node tools/verify.mjs                  the same, then pops (a pre-render check: it renders the engine's frames small,
 *                                          not a video file, so it cannot see a render's worker seams)
 *   node tools/verify.mjs render/mv.mp4    all of that, then on the render: flash safety, sync, and static stretches
 *                                          (motion: listed as INFO, not a failure; stillness can be meant). A portrait
 *                                          render (mv_vertical.mp4) checks the shots on engine/vertical.html
 * Exit 1 when any check fails. A check that passes with warnings (sync: lyric lines to listen to) prints WARN and its
 * output: resolve or accept each item. The checks guard technical defects; none decides what the film should look like.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { FFPROBE } from './kit_env.mjs';

const args = process.argv.slice(2), mp4 = args.find(a => a.endsWith('.mp4'));
const py = process.platform === 'win32' ? 'python' : 'python3';
const dims = mp4 ? `${spawnSync(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', mp4], { encoding: 'utf8' }).stdout || ''}`.trim().split(',').map(Number) : [];
const vertical = dims[1] > dims[0];                              // a 9:16 render: its layout lives in engine/vertical.html
const steps = [
  ['index', 'node', ['tools/build_index.mjs'], 'index/README.md in the skill'],
  ['lint', 'node', ['tools/lint.mjs'], 'references/09 §7'],
  ['no lyrics in code', 'node', ['tools/check_no_lyrics.mjs', '--strict'], 'SKILL.md "Laws"'],
  ['storyboard', 'node', ['tools/storyboard.mjs', '--quiet'], 'references/05 §3'],
  ['shots' + (vertical ? ' (9:16)' : ''), 'node', ['tools/check_shots.mjs', '--strict', ...(vertical ? ['--url', 'engine/vertical.html'] : [])], 'references/09 §6'],
];
if (!args.includes('--quick')) steps.push(['pops (engine, pre-render)', 'node', ['tools/pops.mjs', '--strict'], 'references/09 §7']);
if (mp4) {
  if (!existsSync(mp4)) { console.error(`[verify] no such file: ${mp4}`); process.exit(1); }
  steps.push(
    ['flash safety', py, ['tools/check_flash.py', mp4], 'references/09 §6'],
    ['sync', py, ['tools/check_sync.py', mp4], 'references/03 §12'],
    ['motion', py, ['tools/motion_check.py', mp4, '--quiet'], 'references/09 §6', 'info'],
  );
} else if (!args.includes('--quick')) console.log('[verify] no render given: build checks and pops only (pass render/mv.mp4 for the rest)');

let failed = 0, warned = 0, partial = 0;
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
const n = steps.filter(s => !s[4]).length;
const w = (warned ? `, ${warned} with warnings to review (above)` : '') + (partial ? `, ${partial} with steps not run (above)` : '');
console.log(failed ? `[verify] ${failed} of ${n} checks failed${w}` : w ? `[verify] no check failed${w}` : `[verify] all ${n} checks pass`);
process.exit(failed ? 1 : 0);
