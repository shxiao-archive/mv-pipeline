#!/usr/bin/env node
/* Lyric timing editor: play the song, tap or nudge each line's start, save into analysis/lyrics_mv.lrc.
 *
 *   node tools/lyric_editor/server.mjs [--port 5178]      then open http://127.0.0.1:5178/
 *
 * Local only (binds 127.0.0.1). Reads analysis/lyrics_mv.lrc (through tools/lrc.py, the engine's own parsing),
 * analysis/lyric_timing.json and analysis/audio.json (beats, voice onsets); plays audio/song.wav. Saving backs the
 * LRC up to analysis/backup/, rewrites the edited start times and marks those lines source "editor"
 * (python tools/lyric_timing.py apply). Keys are listed on the page.
 *
 * mv-studio (MIT). Idea after netsu-ijou-pv's lyric editor (CC BY-NC 4.0; no code taken).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, cliArg as arg, pythonCmd } from '../kit_env.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const port = +arg('port', 5178);
const py = (code, ...args) => { const [cmd, ...pre] = pythonCmd(); return execFileSync(cmd, [...pre, '-c', code, ...args], { cwd: ROOT, encoding: 'utf8' }); };

function data() {
  const lines = JSON.parse(py(`
import sys, json; sys.path.insert(0, 'tools')
from lrc import LRC, parse_lrc
sys.stdout.reconfigure(encoding='utf-8')
print(json.dumps([{k: L[k] for k in ('i', 't', 'end', 'text', 'kime')} for L in parse_lrc(LRC)], ensure_ascii=False))`));
  const timing = fs.existsSync(path.join(ROOT, 'analysis/lyric_timing.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'analysis/lyric_timing.json'), 'utf8')) : { lines: [] };
  for (const L of lines) { const r = timing.lines.find(x => x.i === L.i && Math.abs((x.start ?? L.t) - L.t) <= 0.02); L.source = r ? r.source : 'lrc'; L.conf = r ? r.conf : null; }
  let beats = [], vocal = [], duration = 0;
  const ap = path.join(ROOT, 'analysis/audio.json');
  if (fs.existsSync(ap)) { const A = JSON.parse(fs.readFileSync(ap, 'utf8')); beats = A.beats || []; duration = A.duration || 0; vocal = ((A.onsets || {}).vocal || []).map(x => x[0]); }
  return { lines, beats, vocal, duration };
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  try {
    if (url === '/' || url === '/index.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(path.join(HERE, 'index.html'))); }
    if (url === '/audio') {
      const f = path.join(ROOT, 'audio/song.wav');
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no audio/song.wav'); }
      res.writeHead(200, { 'content-type': 'audio/wav', 'content-length': fs.statSync(f).size }); return fs.createReadStream(f).pipe(res);
    }
    if (url === '/api/data') { res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); return res.end(JSON.stringify(data())); }
    if (url === '/api/save' && req.method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
      req.on('end', () => {
        try {
          const edits = JSON.parse(body);
          const tmp = path.join(os.tmpdir(), `lyric_edits_${process.pid}.json`);
          fs.writeFileSync(tmp, JSON.stringify({ starts: edits.starts || {} }));
          const [cmd, ...pre] = pythonCmd();
          const out = execFileSync(cmd, [...pre, path.join(ROOT, 'tools', 'lyric_timing.py'), 'apply', tmp], { cwd: ROOT, encoding: 'utf8' });
          fs.unlinkSync(tmp);
          res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, log: out.trim() }));
        } catch (e) { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: String(e.message || e).slice(0, 400) })); }
      });
      return;
    }
    res.writeHead(404); res.end();
  } catch (e) { res.writeHead(500); res.end(String(e.message || e)); }
});
server.listen(port, '127.0.0.1', () => console.log(`[lyric_editor] http://127.0.0.1:${port}/  (Ctrl+C to stop; saving writes analysis/lyrics_mv.lrc, backup in analysis/backup/)`));
