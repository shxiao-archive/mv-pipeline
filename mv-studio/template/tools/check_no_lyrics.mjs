#!/usr/bin/env node
/* Lyric text belongs to its rights holders and to ONE file: analysis/lyrics_mv.lrc (plus the user's own lyric file
 * in audio/ or lyrics/). Code never contains it — scenes take line INDICES and read Z.line(i).text at draw time — so a
 * project can be shared or published without republishing the lyrics. This scans the project for any run of 4+
 * consecutive words (or 6+ CJK characters) of a lyric line and prints only file:line, never the lyric.
 *
 *   node tools/check_no_lyrics.mjs            code (engine/, tools/, blender/, jizura/app/, assets prompts) -> errors;
 *                                             docs/ and README files -> warnings (fine for your OWN song's notes)
 *   node tools/check_no_lyrics.mjs --strict   docs count as errors too (someone else's song: publish no lyric text)
 * Exit 1 on errors.  mv-studio (MIT); adapted from world-execute-me-lyric-mv (MIT, (c) 2026 Nyankomint).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
const LRC = path.join(ROOT, 'analysis', 'lyrics_mv.lrc');
if (!fs.existsSync(LRC)) { console.log('[check:lyrics] no analysis/lyrics_mv.lrc yet: nothing to check'); process.exit(0); }
const text = fs.readFileSync(LRC, 'utf8').replace(/^﻿/, '');
const CJK = /[぀-ヿ㐀-䶿一-鿿가-힯]/u;
const norm = s => s.normalize('NFKC').toLowerCase().replace(/[*\/!]/g, ' ');
const frags = new Set();
for (const row of text.split(/\r?\n/)) {
  if (!/^\s*\[\d+:/.test(row)) continue;
  const t = norm(row.replace(/\[[^\]]*\]/g, ''));
  const words = t.match(/[\p{L}\p{N}']+/gu) ?? [];
  for (let i = 0; i + 4 <= words.length; i++) frags.add('w:' + words.slice(i, i + 4).join(' '));
  const han = [...t].filter(c => CJK.test(c)).join('');
  for (let i = 0; i + 6 <= han.length; i++) frags.add('c:' + han.slice(i, i + 6));
}
const SKIP_DIRS = new Set(['node_modules', 'vendor', 'render', '.git', '.venv', '__pycache__', 'analysis', 'audio', 'lyrics', 'fonts', '_grok', 'demo']);
const EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.json', '.jsonl', '.md', '.html', '.css', '.py', '.txt', '.lrc', '.srt', '.yml', '.yaml']);
const errors = [], warnings = [];
const isDoc = rel => /^(docs[\\/]|readme|project_readme)/i.test(rel);
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name), rel = path.relative(ROOT, p);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && rel !== path.join('jizura', 'app', 'jizura_engine.js')) walk(p); continue; }
    const ext = path.extname(e.name).toLowerCase();
    if (rel === path.join('docs', 'AUDIO_MAP.md')) continue;   // generated from analysis/sections.json (analysis/ is skipped)
    if (rel.startsWith(path.join('docs', 'review') + path.sep)) continue;   // the jury's reviews quote the lines they judge (references/09 §8)
    if (!EXT.has(ext) || e.name === 'jizura_engine.js') continue;
    const bucket = isDoc(rel) && !strict ? warnings : errors;
    if (ext === '.lrc' || ext === '.srt') { bucket.push(`${rel}: a lyric file outside analysis/ (move it to analysis/ or audio/)`); continue; }
    fs.readFileSync(p, 'utf8').split(/\r?\n/).some((row, n) => {
      const t = norm(row), words = t.match(/[\p{L}\p{N}']+/gu) ?? [];
      for (let i = 0; i + 4 <= words.length; i++) if (frags.has('w:' + words.slice(i, i + 4).join(' '))) { bucket.push(`${rel}:${n + 1}`); return true; }
      const han = [...t].filter(c => CJK.test(c)).join('');
      for (let i = 0; i + 6 <= han.length; i++) if (frags.has('c:' + han.slice(i, i + 6))) { bucket.push(`${rel}:${n + 1}`); return true; }
      return false;
    });
  }
}
walk(ROOT);
if (warnings.length) console.log(`[check:lyrics] lyric text in ${warnings.length} doc line(s) (ok for your own song; for someone else's song keep docs index-only, --strict):\n  ` + warnings.join('\n  '));
if (errors.length) { console.error(`[check:lyrics] lyric text in code / prompts in ${errors.length} place(s) — use line indices (Z.line(i).text):\n  ` + errors.join('\n  ')); process.exit(1); }
console.log('[check:lyrics] code clean: no lyric fragments outside analysis/');
