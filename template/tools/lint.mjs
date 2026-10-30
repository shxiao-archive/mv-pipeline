#!/usr/bin/env node
/* Before every render: the cheap checks that catch broken files.
 *   node tools/lint.mjs [paths...] [--no-lyrics-check]
 *
 *   SYNTAX     every .js / .mjs under engine/ and tools/ parses (node --check)
 *   MOJIBAKE   no U+FFFD replacement character in code, docs or analysis data (a write that lost CJK text)
 *   NONDET     no Math.random( / Date.now( / performance.now( / new Date( in engine code (frames are rendered in
 *              parallel and out of order: use Z.rnd / S.rng / the song time). A line may opt out with  // lint-ok
 *   LYRICS     node tools/check_no_lyrics.mjs (lyric text only in analysis/lyrics_mv.lrc)
 * With paths, only those files / folders are checked (a builder checking its own files). Exit 1 on any problem.
 *
 * mv-studio (MIT).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, cliFlag as flag, handleHelp } from './kit_env.mjs';

handleHelp(`lint.mjs -- syntax, mojibake (U+FFFD), non-determinism, lyric text in code
  node tools/lint.mjs [paths...] [--no-lyrics-check]`);

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const SKIP = new Set(['node_modules', 'vendor', 'render', '.git', '.cache', '_grok', '_novelai', 'fonts', '__pycache__']);
const TEXT = /\.(js|mjs|cjs|json|md|py|html|css|txt|lrc|sh|ps1)$/i;
const walk = (p, out = []) => {
  if (!fs.existsSync(p)) return out;
  const st = fs.statSync(p);
  if (st.isFile()) { out.push(p); return out; }
  for (const n of fs.readdirSync(p)) if (!SKIP.has(n)) walk(path.join(p, n), out);
  return out;
};
const targets = args.length ? args.map(a => path.resolve(ROOT, a)) : ['engine', 'tools', 'docs', 'analysis', 'plan', 'jizura'].map(d => path.join(ROOT, d));
const files = targets.flatMap(t => walk(t)).filter(f => TEXT.test(f) && fs.statSync(f).size < 8e6);
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
const problems = [];
const BAD = String.fromCharCode(0xfffd);   // a code, so this file does not trip its own check

for (const f of files.filter(f => /\.(m?js)$/.test(f) && !/jizura_engine\.js$/.test(f))) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) problems.push(`SYNTAX   ${rel(f)}: ${(r.stderr || '').split('\n').filter(Boolean).slice(0, 4).join(' | ').slice(0, 300)}`);
}
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(BAD)) continue;
  s.split(/\r?\n/).forEach((line, i) => { if (line.includes(BAD)) problems.push(`MOJIBAKE ${rel(f)}:${i + 1}: U+FFFD (text was lost when this file was written: rewrite the line)`); });
}
const NONDET = /\b(Math\.random|Date\.now|performance\.now)\s*\(|\bnew Date\s*\(/;
for (const f of files.filter(f => /\.js$/.test(f) && rel(f).startsWith('engine/'))) {
  let inBlock = false;                                 // inside a /* ... */ comment
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
    let code = '', k = 0;
    while (k < line.length) {
      if (inBlock) { const e = line.indexOf('*/', k); if (e < 0) break; inBlock = false; k = e + 2; continue; }
      const b = line.indexOf('/*', k);
      if (b < 0) { code += line.slice(k); break; }
      code += line.slice(k, b); inBlock = true; k = b + 2;
    }
    code = code.replace(/\/\/.*$/, m => (/lint-ok/.test(m) ? ' LINTOK' : ''));
    if (NONDET.test(code) && !/LINTOK/.test(code)) problems.push(`NONDET   ${rel(f)}:${i + 1}: ${line.trim().slice(0, 120)}`);
  });
}
let lyricsOk = true;
if (!flag('no-lyrics-check') && fs.existsSync(path.join(ROOT, 'tools', 'check_no_lyrics.mjs'))) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'check_no_lyrics.mjs')], { encoding: 'utf8', cwd: ROOT });
  lyricsOk = r.status === 0;
  if (!lyricsOk) problems.push(`LYRICS   ${(r.stderr || r.stdout || '').trim().split('\n').slice(-6).join(' | ').slice(0, 600)}`);
}
for (const p of problems) console.log(p);
console.log(`[lint] ${files.length} files: ${problems.length ? `FAIL (${problems.length} problems)` : 'ok'}`);
process.exit(problems.length ? 1 : 0);
