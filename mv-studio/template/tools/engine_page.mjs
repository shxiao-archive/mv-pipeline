/* Shared by the review tools (storyboard, check_shots, cues_sheet, pops, regress): serve the project on a free
 * localhost port, open an engine page headless, wait for window.ready, collect page errors.
 *
 *   import { openEngine } from './engine_page.mjs';
 *   const E = await openEngine({ url: 'engine/index.html', width: 1920, height: 1080 });
 *   await E.frame(12.5);                 // renderFrame(t)
 *   const png = await E.png();           // Buffer of the canvas
 *   const info = await E.plan();         // shots / lines / cues / beats as plain data (no lyric text)
 *   await E.close();
 *
 * mv-studio (MIT).
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { ROOT, launchBrowser, gpuArgs } from './kit_env.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.lrc': 'text/plain; charset=utf-8', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };

export function serveRoot(root = ROOT) {
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

export async function openEngine({ url = 'engine/index.html', width = 1920, height = 1080, canvas = 'out', quiet = false } = {}) {
  const { server, origin } = await serveRoot();
  const browser = await launchBrowser({ headless: true, args: [...gpuArgs(), '--enable-gpu-rasterization'] });
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  let at = null;                                         // song time being rendered, for the error log
  // optional data files the engine probes for: a 404 there is not an error
  const OPTIONAL = /\/(project\.json|analysis\/(cues|lyric_timing|envelope_30fps)\.json)$/;
  page.on('response', r => { if (r.status() >= 400 && !OPTIONAL.test(new URL(r.url()).pathname)) { errors.push({ t: at, msg: `HTTP ${r.status()} ${new URL(r.url()).pathname}` }); if (!quiet) console.log(`[page] HTTP ${r.status()} ${r.url()}`); } });
  page.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) { errors.push({ t: at, msg: m.text().slice(0, 300) }); if (!quiet) console.log(`[page error] ${m.text().slice(0, 200)}`); } });
  page.on('pageerror', e => { errors.push({ t: at, msg: String(e).slice(0, 300) }); if (!quiet) console.log('[pageerror]', String(e).slice(0, 200)); });
  await page.goto(`${origin}/${url.replace(/^\/+/, '')}`);
  const meta = await page.evaluate(() => window.ready);
  return {
    page, meta, errors, origin,
    async frame(t) { at = t; await page.evaluate(async t => { await window.renderFrame(t); }, t); },
    async png() { const b64 = await page.evaluate(id => document.getElementById(id).toDataURL('image/png').split(',')[1], canvas); return Buffer.from(b64, 'base64'); },
    /** tiny greyscale copy of the canvas (w x h, values 0..255) for statistics, computed in the page */
    async thumb(w = 96, h = 54) {
      return page.evaluate(({ id, w, h }) => {
        const c = window.__thumbC || (window.__thumbC = Object.assign(document.createElement('canvas'), { width: w, height: h }));
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
        const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(document.getElementById(id), 0, 0, w, h);
        const d = x.getImageData(0, 0, w, h).data, out = new Array(w * h);
        for (let i = 0; i < w * h; i++) out[i] = Math.round(0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]);
        return out;
      }, { id: canvas, w, h });
    },
    /** the edit as data: shots (with the line indices they show), lines (times and lengths only), cues, beats */
    async plan() {
      return page.evaluate(() => {
        const Z = window.Z;
        const showsOf = (v, acc = new Set(), depth = 0) => {        // every `line` / `lines` index inside scene args
          if (!v || depth > 6) return acc;
          if (Array.isArray(v)) { v.forEach(x => showsOf(x, acc, depth + 1)); return acc; }
          if (typeof v === 'object') for (const [k, x] of Object.entries(v)) {
            if ((k === 'line' || k === 'lines') && (typeof x === 'number' || Array.isArray(x))) [].concat(x).forEach(n => typeof n === 'number' && acc.add(n));
            else showsOf(x, acc, depth + 1);
          }
          return acc;
        };
        const jz = !!(window.JZ && Object.keys(window.JZ.plans || {}).length);
        const shots = (Z.shotList ? Z.shotList() : Z.SHOTS || []).map(s => {
          const lyric = typeof s.lyric === 'function' ? 'fn' : (s.lyric === undefined ? 'front' : (typeof s.lyric === 'object' ? s.lyric.mode || 'front' : s.lyric));
          const shows = [...showsOf(s.args)].concat(s.line == null ? [] : [].concat(s.line));
          const chars = (s.args && Array.isArray(s.args.chars) ? s.args.chars : []).concat(s.args && s.args.char ? [{}] : []);
          return { id: s.id, t0: s.t0, t1: s.t1, scene: s.scene, known: !!Z.SCENES[s.scene], moment: s.moment || '', cue: s.cue || null,
            line: s.line == null ? null : [].concat(s.line), shows: [...new Set(shows)].sort((a, b) => a - b),
            lyric, jizura: jz && lyric !== 'none', text: !!s.text || !!(Z.hud && Z.hudShowsLyrics && s.hud !== false), trans: s.trans ? { type: s.trans.type, dur: s.trans.dur } : null,
            offgrid: s.offgrid || null, insert: !!s.insert || s.kind === 'ins', allowBlack: !!s.allowBlack, kind: s.kind || null,
            faces: chars.length, animFaces: chars.filter(c => c && c.anim && (c.anim.blink || c.anim.mouth || c.anim.expr)).length, hold: !!s.hold,
            // shortcut: a pin's u is a point of the bg image, not of the screen (the camera crop moves it a little)
            place: chars.map(c => c && (c.x != null ? +(c.x / (Z.W || 1920)).toFixed(3) : c.pin ? +c.pin[0] : null)).filter(u => u != null) };
        });
        const lines = (Z.LYR || []).map(L => ({ i: L.i, t: L.t, end: L.end, n: [...L.text].length, kime: L.kime, source: L.source || null, conf: L.conf ?? null }));
        const cues = Z.cues ? Z.cues().map(c => ({ id: c.id, t: c.t, kind: c.kind, hint: c.hint || '', source: c.source || '' })) : [];
        // song times where a JIZURA lyric cut starts inside a shot that shows that plan (split lines included)
        const lyricCuts = new Set();
        if (jz) for (const s of Z.SHOTS || []) {
          const L = s.lyric === undefined ? 'front' : s.lyric, P = L && L !== 'none' && window.JZ.plans[typeof L === 'object' ? L.plan || 'main' : s.plan || 'main'];
          if (P) for (const c of P.plan.cuts) { const t = c.start + (Z.LYRIC_OFFSET || 0); if (c.index > 0 && t > s.t0 && t < s.t1) lyricCuts.add(+t.toFixed(3)); }
        }
        return { shots, lines, cues, lyricCuts: [...lyricCuts].sort((a, b) => a - b), beats: (Z.audio && Z.audio.beats) || [], duration: window.__zankoMeta.duration,
          fps: window.__zankoMeta.fps || 30, project: Z.PROJECT || {}, offset: Z.OFFSET || 0 };
      });
    },
    async close() { await browser.close(); server.close(); },
  };
}
