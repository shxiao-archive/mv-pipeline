#!/usr/bin/env node
/* Every automated check, in order, printing only what fails (with the tail of its output) and one line per pass.
 *   node tools/verify.mjs --quick          the build checks: lint, no lyrics in code, storyboard, every shot renders
 *   node tools/verify.mjs                  the same, then pops (renders every frame small from the engine: no video needed)
 *   node tools/verify.mjs render/mv.mp4    all of that, then on the render: flash safety, sync, and static stretches
 *                                          (motion: listed as INFO, not a failure; stillness can be meant)
 * Exit 1 when any check fails. The checks guard technical defects; none decides what the film should look like.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2), mp4 = args.find(a => a.endsWith('.mp4'));
const py = process.platform === 'win32' ? 'python' : 'python3';
const steps = [
  ['index', 'node', ['tools/build_index.mjs'], 'index/README.md in the skill'],
  ['lint', 'node', ['tools/lint.mjs'], 'references/09 §7'],
  ['no lyrics in code', 'node', ['tools/check_no_lyrics.mjs', '--strict'], 'SKILL.md "Laws"'],
  ['storyboard', 'node', ['tools/storyboard.mjs', '--quiet'], 'references/05 §3'],
  ['shots', 'node', ['tools/check_shots.mjs', '--strict'], 'references/09 §6'],
];
if (!args.includes('--quick')) steps.push(['pops', 'node', ['tools/pops.mjs', '--strict'], 'references/09 §7']);
if (mp4) {
  if (!existsSync(mp4)) { console.error(`[verify] no such file: ${mp4}`); process.exit(1); }
  steps.push(
    ['flash safety', py, ['tools/check_flash.py', mp4], 'references/09 §6'],
    ['sync', py, ['tools/check_sync.py', mp4], 'references/03 §12'],
    ['motion', py, ['tools/motion_check.py', mp4, '--quiet'], 'references/09 §6', 'info'],
  );
} else if (!args.includes('--quick')) console.log('[verify] no render given: build checks and pops only (pass render/mv.mp4 for the rest)');

let failed = 0;
for (const [name, cmd, a, see, info] of steps) {
  const r = spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (info) { console.log(`INFO  ${name}  ${`${r.stdout || ''}`.trim().split('\n').filter(l => /^\[/.test(l)).pop() || '(no summary)'}`); continue; }
  if (r.status === 0) { console.log(`PASS  ${name}`); continue; }
  failed++;
  const out = `${r.stdout || ''}${r.stderr || ''}${r.error ? r.error.message : ''}`.trim().split('\n');
  console.log(`FAIL  ${name}  (${cmd} ${a.join(' ')}; see ${see})`);
  for (const l of out.slice(-20)) console.log(`      ${l}`);
}
const n = steps.filter(s => !s[4]).length;
console.log(failed ? `[verify] ${failed} of ${n} checks failed` : `[verify] all ${n} checks pass`);
process.exit(failed ? 1 : 0);
