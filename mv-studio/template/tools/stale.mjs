#!/usr/bin/env node
// Which generated files are out of date: each one records the hashes of what it was made from ("inputs":
// analysis/audio.json <- the song (+ sections / meter), analysis/cues.json <- audio.json + the lyrics,
// render/<name>.render.json <- engine/, assets/, analysis/ ...). A file is stale when one of its inputs changed or is
// itself stale (a new song makes the cues and every render stale); a file recording no inputs is "unknown".
//
//   node tools/stale.mjs            # list them (exit 1 when something is stale)
//   node tools/stale.mjs --selftest
//
// verify.mjs fails on stale analysis or a stale render it is asked to check. Re-run in order: analyze_audio.py,
// make_cues.py, render_final.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, fileSig, isMain, handleHelp } from './kit_env.mjs';

const read = rel => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return null; } };

const tracked = () => ['analysis/audio.json', 'analysis/cues.json', ...(fs.existsSync(path.join(ROOT, 'render'))
  ? fs.readdirSync(path.join(ROOT, 'render')).filter(f => f.endsWith('.render.json')).sort().map(f => 'render/' + f) : [])];

// files: producers before their consumers -> { stale: {rel: [reasons]}, unknown: [rel], manifests: {rel: manifest} }
export function staleFiles(files = tracked()) {
  const stale = {}, unknown = [], manifests = {};
  for (const rel of files) {
    const d = read(rel);
    if (!d) continue;
    if (rel.endsWith('.render.json')) manifests[rel] = d;
    if (!d.inputs || typeof d.inputs !== 'object') { unknown.push(rel); continue; }
    const why = [];
    for (const [inp, sig] of Object.entries(d.inputs)) {
      if (fileSig(inp) !== sig) why.push(`${inp} changed`);
      else {
        const up = Object.keys(stale).find(s => s === inp || (inp.endsWith('/') && s.startsWith(inp)));
        if (up) why.push(`${up} is stale`);
      }
    }
    if (why.length) stale[rel] = why;
  }
  // shortcut: a flash report is judged by its file time against its video, not by hashes; enough while check_flash is the only one kept
  for (const rel of Object.keys(manifests)) {
    const v = manifests[rel].video, rep = v && v.replace(/\.mp4$/, '_flash.json');
    const t = f => { try { return fs.statSync(path.join(ROOT, f)).mtimeMs; } catch { return null; } };
    if (rep && t(rep) != null && (t(v) > t(rep) || stale[rel])) stale[rep] = [stale[rel] ? `${rel} is stale` : `${v} is newer`];
  }
  return { stale, unknown, manifests };
}

function selftest() {
  const tmp = fs.mkdtempSync(path.join(ROOT, '.stale-test-')), r = path.relative(ROOT, tmp).split(path.sep).join('/');
  try {
    const w = (f, v) => fs.writeFileSync(path.join(tmp, f), typeof v === 'string' ? v : JSON.stringify(v));
    const sig = f => fileSig(`${r}/${f}`);
    // a.json <- song.wav;  b.json <- a.json + in.lrc;  c.render.json <- the folder sub/;  d.json records nothing
    fs.mkdirSync(path.join(tmp, 'sub')); w('song.wav', 'a'); w('in.lrc', 'x'); w('sub/x.js', '1');
    w('a.json', { inputs: { [`${r}/song.wav`]: sig('song.wav') } });
    w('b.json', { inputs: { [`${r}/a.json`]: sig('a.json'), [`${r}/in.lrc`]: sig('in.lrc') } });
    w('c.render.json', { inputs: { [`${r}/sub/`]: fileSig(`${r}/sub/`) } }); w('d.json', {});
    const files = ['a.json', 'b.json', 'c.render.json', 'd.json'].map(f => `${r}/${f}`), run = () => staleFiles(files);
    let s = run();
    const ok = [!Object.keys(s.stale).length, s.unknown.join() === `${r}/d.json`, `${r}/c.render.json` in s.manifests];
    w('song.wav', 'b'); s = run();                                 // the song changed: a is stale, so b is too
    ok.push(s.stale[`${r}/a.json`]?.[0] === `${r}/song.wav changed`, s.stale[`${r}/b.json`]?.[0] === `${r}/a.json is stale`);
    w('sub/x.js', '2'); s = run();                                 // a file inside a tracked folder
    ok.push(!!s.stale[`${r}/c.render.json`], fileSig(`${r}/nope`) === null);
    if (ok.every(Boolean)) console.log('[stale] selftest ok'); else { console.error('[stale] selftest FAIL', ok); process.exit(1); }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

if (isMain(import.meta.url)) {
  handleHelp('node tools/stale.mjs [--selftest]: which generated files are out of date (see the header)');
  if (process.argv.includes('--selftest')) selftest();
  else {
    const { stale, unknown } = staleFiles();
    for (const [f, why] of Object.entries(stale)) console.log(`STALE    ${f}: ${why.join(', ')}`);
    for (const f of unknown) console.log(`UNKNOWN  ${f}: records no inputs (made before tools/stale.mjs; re-run its tool to track it)`);
    if (!Object.keys(stale).length) console.log(`[stale] nothing is out of date${unknown.length ? ` (${unknown.length} untracked)` : ''}`);
    process.exit(Object.keys(stale).length ? 1 : 0);
  }
}
