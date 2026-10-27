#!/usr/bin/env node
/* Every shot renders: sample each shot of the live timeline and report page errors, black / flat frames and fonts
 * that failed to load. Fast (no video): run it after every change, before stills and renders.
 *
 *   node tools/check_shots.mjs [--url engine/index.html] [--samples 3] [--only s12,s13] [--json render/check_shots.json]
 *   node tools/check_shots.mjs --url engine/vertical.html   the 9:16 build: frames of #vout, its own lyric layout
 *
 * Per shot it renders `samples` times spread over the shot (first frame, ..., last frame) and flags
 *   ERROR  a page error while drawing it · a BLACK frame (mean < 3 %, almost no detail) unless the shot says
 *          allowBlack: true or it is within 0.5 s of the film's start or end (fades) · the scene is not registered
 *   WARN   a FLAT frame (one colour, no detail) · a font face that failed to load
 *          · SPRITE PING-PONG: the main character sprite (the largest one drawn) goes A -> B -> A within 2 s, or changes
 *            3+ times in 3 s (inside a shot or across short shots); sampled at --sprite-fps (default 4, 0 = off);
 *            an ERROR with --strict
 *          · LYRICS OUTSIDE THE SAFE AREA: lyric-layer pixels (JIZURA + shot.text, not the HUD) in the outer 5 % of the frame,
 *            over 2 % of them, in the same pass (an ERROR with --strict). Words a scene draws itself are not seen; a
 *            JIZURA cut is judged while its words hold (glyphs flying off the frame in an enter / exit are motion).
 *            Fix: lyric: { mode, safe: 0.9 } scales the layer into the box; a shot with crop: true crops on purpose
 *          · LYRICS HIDDEN: over 5 % of the lyric's pixels under the foreground layer (a character drawn in front of the
 *            words), while the words hold (an ERROR with --strict)
 *          · LYRICS LOW CONTRAST: the glyphs against the ring of picture around them below 3:1 (WCAG, large text),
 *            while the words hold (an ERROR with --strict). Both are measured on the lyric layer (JIZURA + shot.text)
 *          · FIGURE CUT BY THE FRAME: the main character sprite (D.sprite) has over 10 % of its height (the head) above
 *            the top edge, or over 30 % of its width past a side, after the camera; FIGURE CUT IN ITS IMAGE: an edge of its
 *            picture is opaque along over 15 % of its length (a cut-out cropped by its own canvas, a background left in)
 *            while that edge is inside the frame: the figure ends in a straight line. An ERROR with --strict; a shot with
 *            crop: true crops on purpose. The frame's bottom edge is not judged (a waist shot)
 *          · LYRIC OVERLAP: more than one lyric drawn in one frame, recorded while the frame is drawn (the JIZURA cuts
 *            the renderer draws, and the lines the film's own code reads with Z.line(i).text before the HUD), on every
 *            frame from 3 before to 3 after each shot cut and each JIZURA cut, and every 0.5 s: a transition, a
 *            cut's exit running into the next shot, the same line set by JIZURA and by the film's own type; an ERROR
 *            with --strict
 *          · GLYPH NEVER WHOLE: a character of the lyrics or the title shows in a shot but is never once wholly on screen
 *            there: always past the frame edge, cut by a canvas it was drawn through, or over 25 % under a figure drawn
 *            after it. Every glyph lands whole at least once, then may crop or push (見切れ). Seen wherever the
 *            film draws text (fillText / strokeText, followed through drawImage into the frame), scene type included;
 *            crop: true does not exempt it. Suspect shots are sampled again at full fps. An ERROR with --strict
 *          · OVERSIZED TYPE: glyphs over half the frame high in more than 2 places (adjacent shots are one place): a
 *            peak move, kept for the song's emotional peaks, once each. An ERROR with --strict
 * Exit 1 on any ERROR.
 *
 * mv-studio (MIT).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, cliArg as arg, cliFlag as flag, handleHelp } from './kit_env.mjs';
import { openEngine } from './engine_page.mjs';

handleHelp(`check_shots.mjs -- render samples of every shot; report errors, black / flat frames, failed fonts
  node tools/check_shots.mjs [--url engine/index.html] [--samples 3] [--only id1,id2] [--json FILE] [--sprite-fps 4] [--strict] [--selftest]`);

// One frame's lyric legibility from RGBA arrays (w x h): the lyric layer, the foreground layer (drawn over the lyrics)
// and the picture the viewer sees (scene + lyrics + foreground). -> { px: glyph pixels, hidden: share of them under the
// foreground, contrast: WCAG ratio between the glyphs (their light or dark end, so an outline doesn't count against a
// fill) and the median of the ring of picture within r px around them, or inside the lyric's own plate / outline; null when too few pixels to judge }.
// Runs in node (selftest) and in the page (its source is sent there).
export function legibility(text, fg, comp, w, h, r = 3) {
  const n = w * h, G = new Uint8Array(n);
  let px = 0, hid = 0;
  // covered = under a near-opaque foreground (a character); a translucent overlay dims the words: that is contrast
  for (let i = 0; i < n; i++) if (text[4 * i + 3] > 200) { G[i] = 1; px++; if (fg && fg[4 * i + 3] >= 230) hid++; }
  if (!px) return { px: 0, hidden: 0, contrast: null };
  const dil = (src, horiz) => {                                // box dilation by r along one axis (prefix sums)
    const out = new Uint8Array(n), len = horiz ? w : h, lines = horiz ? h : w, cs = new Int32Array(len + 1);
    for (let a = 0; a < lines; a++) {
      const at = k => (horiz ? a * w + k : k * w + a);
      for (let k = 0; k < len; k++) cs[k + 1] = cs[k] + src[at(k)];
      for (let k = 0; k < len; k++) out[at(k)] = cs[Math.min(len, k + r + 1)] - cs[Math.max(0, k - r)] > 0 ? 1 : 0;
    }
    return out;
  };
  const near = dil(dil(G, true), false);
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = i => 0.2126 * lin(comp[4 * i]) + 0.7152 * lin(comp[4 * i + 1]) + 0.0722 * lin(comp[4 * i + 2]);
  const g = [], b = [];
  for (let i = 0; i < n; i++) {
    if (G[i]) { if (!(fg && fg[4 * i + 3] >= 230)) g.push(lum(i)); }
    else if (near[i]) b.push(lum(i));
  }
  if (g.length < 50 || b.length < 50) return { px, hidden: hid / px, contrast: null };
  g.sort((x, y) => x - y); b.sort((x, y) => x - y);
  const q = (xs, f) => xs[Math.min(xs.length - 1, Math.floor(f * xs.length))], bg = q(b, 0.5);
  const ratio = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  // a lyric that carries its own plate, outline or shadow reads against that: its light end against its dark end
  return { px, hidden: hid / px, contrast: Math.max(ratio(q(g, 0.85), bg), ratio(q(g, 0.15), bg), ratio(q(g, 0.85), q(g, 0.15))) };
}

// a figure on screen { x0, y0, x1, y1 (its opaque box), W, H, edges: { top|left|right|bottom: opaque share of that edge
// of its picture, for the edges that land inside the frame } } -> what cuts it, or null
export function figureCut(b) {
  const w = b.x1 - b.x0, h = b.y1 - b.y0;
  if (w <= 0 || h <= 0) return null;
  const top = Math.max(0, -b.y0) / h, side = Math.max(0, -b.x0, b.x1 - b.W) / w;
  if (top > 0.1) return `FIGURE CUT BY THE FRAME (the top ${(top * 100).toFixed(0)} % of the figure is above the frame)`;
  if (side > 0.3) return `FIGURE CUT BY THE FRAME (${(side * 100).toFixed(0)} % of the figure's width is past a side)`;
  const e = Object.entries(b.edges || {}).filter(([, v]) => v > 0.15).map(([k, v]) => `${k} ${(v * 100).toFixed(0)} %`);
  if (e.length) return `FIGURE CUT IN ITS IMAGE (opaque along its picture's ${e.join(', ')}, inside the frame: the figure ends in a straight line; generate it with room around the figure, or frame that edge off the screen)`;
  return null;
}

// samples [{ t, p (main sprite path or null), id }] -> [{ id, t, kind, msg }]
export function spriteFlips(samples) {
  const runs = [];
  for (const s of samples) {
    if (!s.p) continue;                                        // nothing drawn: the last sprite is still the one in mind
    const r = runs[runs.length - 1];
    if (r && r.p === s.p) r.t1 = s.t; else runs.push({ p: s.p, t0: s.t, t1: s.t, id: s.id });
  }
  const out = [], seen = new Set(), add = (id, t, kind, msg) => { if (!seen.has(id + kind)) { seen.add(id + kind); out.push({ id, t, kind, msg }); } };
  for (let i = 0; i + 2 < runs.length; i++)
    if (runs[i + 2].p === runs[i].p && runs[i + 2].t0 - runs[i].t1 <= 2.0)
      add(runs[i + 1].id, runs[i + 1].t0, 'pingpong', `${short(runs[i].p)} -> ${short(runs[i + 1].p)} -> back within ${(runs[i + 2].t0 - runs[i].t1).toFixed(1)} s`);
  for (let i = 0; i + 3 < runs.length; i++)
    if (runs[i + 3].t0 - runs[i].t0 <= 3.0) add(runs[i + 1].id, runs[i + 1].t0, 'rapid', `${runs.slice(i, i + 4).map(r => short(r.p)).join(' -> ')} within 3 s`);
  return out;
}
const short = p => p.split('/').pop().replace(/\.\w+$/, '');

// frames [{ id, t, jz: ['<line>:<words>' per JIZURA cut drawn], code: [line indices the film's code read] }]
// -> [{ id, t, msg }]: the first frame per shot that draws more than one lyric (line numbers only, never the words)
export function drawnOverlaps(frames) {
  const out = [], seen = new Set();
  for (const f of frames)
    if (f.jz.length + f.code.length > 1 && !seen.has(f.id)) {
      seen.add(f.id);
      out.push({ id: f.id, t: f.t, msg: [...f.jz.map(k => `JIZURA line ${k.split(':')[0]}`), ...f.code.map(i => `own type line ${i}`)].join(' + ') });
    }
  return out;
}
// a cut's words come in or go out (enter / exit, plus a frame or two of ghost lag)
export const moving = (c, t) => !!c && (t - c.start < c.inDur + 0.1 || c.end - t < c.outDur + 0.1);

// one sighting of a glyph { x0, y0, x1, y1 (frame px), cut, layer, seq } is whole: inside the W x H frame, not cut by a
// canvas it passed through, and not over 25 % under a figure box drawn after it (or in the foreground layer)
export function glyphWhole(g, W, H, figs = []) {
  if (g.cut || g.x0 < -1 || g.y0 < -1 || g.x1 > W + 1 || g.y1 > H + 1) return false;
  const area = Math.max(1, (g.x1 - g.x0) * (g.y1 - g.y0));
  return !figs.some(f => (f.layer === 'fg' ? g.layer !== 'fg' || f.seq > g.seq : f.layer === g.layer && f.seq > g.seq)
    && Math.max(0, Math.min(g.x1, f.x1) - Math.max(g.x0, f.x0)) * Math.max(0, Math.min(g.y1, f.y1) - Math.max(g.y0, f.y0)) > 0.25 * area);
}
// per character of a shot, the sizes (round(4 log2 px)) it showed at whole / not whole -> how many characters showed at
// a size never seen whole: a whole sighting within 4x counts (the glyph pushed in or pulled back), a small copy does not
// a glyph cut on every frame of a shot, at a size never seen whole there (within 4x); `near` are the neighbouring
// shots' sightings, since a slam's lead-in or a transition puts the next shot's type on this shot's frames
export const neverWhole = (seen, ...near) => [...seen].filter(([ch, o]) => [...o.not].some(q => ![o, ...near.map(m => m && m.get(ch))]
  .some(x => x && [...x.whole].some(w => Math.abs(w - q) <= 8)))).length;
// shots with oversized type [{ k: shot index, id, t }] sorted by k -> places (runs of adjacent shots)
export function oversizeMoments(hits) {
  const out = [];
  for (const h of hits) { const m = out[out.length - 1]; if (m && h.k - m[m.length - 1].k <= 1) m.push(h); else out.push([h]); }
  return out;
}

// In the page, before the engine loads: every fillText / strokeText records a box per character on its canvas, and
// drawImage carries a canvas's boxes into the canvas it is drawn on (mapped, cut where the source rect cuts them), so
// the frame's layers know where each glyph landed, however many offscreen caches it went through.
// shortcut: maxWidth squeeze, rtl, putImageData, OffscreenCanvas and WebGL passes are not followed, and a partial erase
// keeps its boxes; upgrade if a film's type is drawn that way.
function glyphTracker() {
  const R = new WeakMap(), G = window.__glyph = { R, seq: 0, final: new Set(), fg: null, want: new Set() };
  const P = CanvasRenderingContext2D.prototype;
  // a canvas keeps its last 1000 boxes; past that, copies already cut go first (a flame or smear pass copies a glyph many times)
  const add = (c, g) => {
    let r = R.get(c); if (!r) R.set(c, r = []); r.push(g);
    if (r.length > 1000) { const k = r.filter(q => !q.cut); R.set(c, k.length > 800 ? k.slice(-800) : k); }
  };
  const box = (m, x0, y0, x1, y1) => {
    const xs = [], ys = [];
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) { xs.push(m.a * x + m.c * y + m.e); ys.push(m.b * x + m.d * y + m.f); }
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  };
  const covers = (x, a, b, w, h) => { const q = box(x.getTransform(), a, b, a + w, b + h); return q.x0 <= 0 && q.y0 <= 0 && q.x1 >= x.canvas.width && q.y1 >= x.canvas.height; };
  for (const fn of ['fillText', 'strokeText']) {
    const orig = P[fn];
    P[fn] = function (str, x, y, ...rest) {
      const s = String(str), al = this.textAlign;
      if (/\S/.test(s)) try {
        this.textAlign = 'left';
        const m = this.getTransform(), tw = this.measureText(s).width;
        const x0 = al === 'center' ? x - tw / 2 : al === 'right' || al === 'end' ? x - tw : x;
        let pre = '';
        for (const ch of s) {
          if (/\S/.test(ch)) {
            const q = this.measureText(ch), px = x0 + this.measureText(pre).width;
            add(this.canvas, { ch, ...box(m, px - q.actualBoundingBoxLeft, y - q.actualBoundingBoxAscent, px + q.actualBoundingBoxRight, y + q.actualBoundingBoxDescent), cut: false, a: this.globalAlpha, seq: ++G.seq });
          }
          pre += ch;
        }
      } catch (e) { /* measuring never breaks the draw */ } finally { this.textAlign = al; }
      return orig.call(this, str, x, y, ...rest);
    };
  }
  const di = P.drawImage;
  P.drawImage = function (img, ...a) {
    const src = R.get(img), op = this.globalCompositeOperation;
    if (op === 'copy') R.delete(this.canvas);
    if (src && src.length && !/^destination-(in|out|atop)$/.test(op)) try {
      const iw = img.width, ih = img.height;
      const [sx, sy, sw, sh, dx, dy, dw, dh] = a.length >= 8 ? a : a.length >= 4 ? [0, 0, iw, ih, ...a] : [0, 0, iw, ih, a[0], a[1], iw, ih];
      const kx = dw / sw, ky = dh / sh, m = this.getTransform(), fin = G.final.has(this.canvas), al = this.globalAlpha;
      for (const g of src.slice()) {
        const cut = g.cut || g.x0 < sx - 1 || g.y0 < sy - 1 || g.x1 > sx + sw + 1 || g.y1 > sy + sh + 1;
        // a frame layer keeps the order the glyph had in the layer it came from (a figure drawn after it covers it)
        add(this.canvas, { ...g, ...box(m, dx + (g.x0 - sx) * kx, dy + (g.y0 - sy) * ky, dx + (g.x1 - sx) * kx, dy + (g.y1 - sy) * ky), cut, a: g.a * al, seq: fin ? g.seq : ++G.seq });
      }
    } catch (e) { /* as above */ }
    return di.call(this, img, ...a);
  };
  const cr = P.clearRect, fr = P.fillRect;
  P.clearRect = function (x, y, w, h) { if (covers(this, x, y, w, h)) R.delete(this.canvas); return cr.call(this, x, y, w, h); };
  // an opaque fill over the whole canvas (the getter gives '#rrggbb' for an opaque colour) paints the glyphs out
  P.fillRect = function (x, y, w, h) { if (this.globalAlpha >= 0.999 && this.globalCompositeOperation === 'source-over' && String(this.fillStyle)[0] === '#' && covers(this, x, y, w, h)) R.delete(this.canvas); return fr.call(this, x, y, w, h); };
  for (const k of ['width', 'height']) {
    const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, k);
    Object.defineProperty(HTMLCanvasElement.prototype, k, { ...d, set(v) { R.delete(this); d.set.call(this, v); } });
  }
  // the frame's visible glyphs of the lyrics and the title, per layer
  G.read = (text, fg, scene) => {
    const out = [];
    for (const [layer, cv] of [['scene', scene], ['text', text], ['fg', fg]]) for (const g of (cv && R.get(cv)) || []) if (g.a >= 0.5 && G.want.has(g.ch)) out.push({ ...g, layer });
    return out;
  };
  // the figure boxes of a frame (Z.onSpriteBox), in the order drawn
  G.fig = (figs, img, c, x0, y0, w, h) => {
    const a = window.__abox && window.__abox(img); if (!a) return;
    const m = c.getTransform(), q = box(m, x0 + a.u0 * w, y0 + a.v0 * h, x0 + a.u1 * w, y0 + a.v1 * h);
    figs.push({ ...q, layer: c.canvas === G.fg ? 'fg' : 'scene', seq: ++G.seq });
  };
}

if (flag('selftest')) {
  const seq = (ps, id = 's1', dt = 0.25) => ps.map((p, i) => ({ t: i * dt, p, id }));
  const ok = [
    spriteFlips(seq(['a', 'a', 'b', 'b', 'a', 'a'])).some(f => f.kind === 'pingpong'),                 // A B A in 1 s
    spriteFlips(seq(['a', null, null, 'a', 'b'])).length === 0,                                          // a gap is not a change
    spriteFlips(seq(['a', 'b', 'c', 'd'], 's1', 0.6)).some(f => f.kind === 'rapid'),                  // 4 sprites in 1.8 s
    spriteFlips(seq(['a', 'b', 'a'], 's1', 3)).length === 0,                                             // a return after 3 s is a motif
    drawnOverlaps([{ id: 's1', t: 1, jz: ['2:a'], code: [] }, { id: 's1', t: 2, jz: ['2:a', '3:b'], code: [] }, { id: 's1', t: 3, jz: ['3:b'], code: [3] }]).length === 1,
    drawnOverlaps([{ id: 's2', t: 1, jz: ['4:c'], code: [] }, { id: 's3', t: 2, jz: [], code: [5] }]).length === 0,
    moving({ start: 0, end: 2, inDur: 0.3, outDur: 0.4 }, 1.7) && !moving({ start: 0, end: 2, inDur: 0.3, outDur: 0.4 }, 1.0),
    /above/.test(figureCut({ x0: 600, y0: -200, x1: 1300, y1: 1200, W: 1920, H: 1080 })),                   // head off the top
    figureCut({ x0: 600, y0: 40, x1: 1300, y1: 1500, W: 1920, H: 1080, edges: { top: 0.05 } }) === null,    // a waist shot
    /left 60/.test(figureCut({ x0: 600, y0: 40, x1: 1300, y1: 1080, W: 1920, H: 1080, edges: { left: 0.6 } })),  // a cropped cut-out
    glyphWhole({ x0: 100, y0: 100, x1: 900, y1: 980, layer: 'scene', seq: 5 }, 1920, 1080),                          // a big glyph, whole
    !glyphWhole({ x0: 100, y0: -80, x1: 1300, y1: 1100, layer: 'scene', seq: 5 }, 1920, 1080),                        // 見切れ
    !glyphWhole({ x0: 100, y0: 100, x1: 900, y1: 980, cut: true, layer: 'scene', seq: 5 }, 1920, 1080),               // cut by its canvas
    !glyphWhole({ x0: 100, y0: 100, x1: 900, y1: 980, layer: 'scene', seq: 5 }, 1920, 1080, [{ x0: 500, y0: 0, x1: 1500, y1: 1080, layer: 'scene', seq: 9 }]),  // a figure over half of it
    glyphWhole({ x0: 100, y0: 100, x1: 900, y1: 980, layer: 'scene', seq: 5 }, 1920, 1080, [{ x0: 500, y0: 0, x1: 1500, y1: 1080, layer: 'scene', seq: 2 }]),   // the figure behind it
    glyphWhole({ x0: 100, y0: 100, x1: 900, y1: 980, layer: 'text', seq: 5 }, 1920, 1080, [{ x0: 500, y0: 0, x1: 1500, y1: 1080, layer: 'scene', seq: 9 }]),   // lyrics over the picture
    !glyphWhole({ x0: 100, y0: 100, x1: 900, y1: 980, layer: 'text', seq: 5 }, 1920, 1080, [{ x0: 500, y0: 0, x1: 1500, y1: 1080, layer: 'fg', seq: 1 }]),     // under the foreground
    oversizeMoments([{ k: 2 }, { k: 3 }, { k: 7 }]).length === 2,                                                     // shots 2-3 are one place
    neverWhole(new Map([['a', { whole: new Set([39]), not: new Set([42]) }]])) === 0,                                  // landed whole, then pushed in
    neverWhole(new Map([['a', { whole: new Set([19]), not: new Set([42]) }]])) === 1,                                  // only a small copy was whole
    neverWhole(new Map([['a', { whole: new Set(), not: new Set([42]) }]]), null, new Map([['a', { whole: new Set([41]), not: new Set() }]])) === 0, // whole across the cut
  ];
  {                                                             // legibility: a 20x10 glyph block on a 60x40 picture
    const w = 60, h = 40, img = (f) => { const a = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a.set(f(x, y), 4 * (y * w + x)); return a; };
    const inG = (x, y) => x >= 20 && x < 40 && y >= 15 && y < 25;
    const text = img((x, y) => inG(x, y) ? [235, 235, 235, 255] : [0, 0, 0, 0]);
    const none = img(() => [0, 0, 0, 0]), half = img((x, y) => x < 30 ? [10, 10, 10, 255] : [0, 0, 0, 0]);
    const clear = legibility(text, none, img((x, y) => inG(x, y) ? [235, 235, 235, 255] : [25, 20, 40, 255]), w, h);
    const muddy = legibility(text, none, img((x, y) => inG(x, y) ? [70, 50, 90, 255] : [55, 40, 75, 255]), w, h);
    const covered = legibility(text, half, img((x, y) => inG(x, y) ? [235, 235, 235, 255] : [25, 20, 40, 255]), w, h);
    // gold words on their own navy ribbon (both in the lyric layer) over an olive field: legible
    const inRib = (x, y) => x >= 14 && x < 46 && y >= 11 && y < 29, gold = [224, 168, 74, 255], navy = [40, 40, 80, 255];
    const rib = (x, y) => inG(x, y) && (x + y) % 3 ? gold : inRib(x, y) ? navy : null;
    const ribbon = legibility(img((x, y) => rib(x, y) || [0, 0, 0, 0]), none, img((x, y) => rib(x, y) || [95, 100, 60, 255]), w, h);
    ok.push(clear.contrast > 7 && clear.hidden === 0, muddy.contrast < 1.5, Math.abs(covered.hidden - 0.5) < 0.01, ribbon.contrast > 3);
  }
  console.log(`[check_shots] selftest ${ok.every(Boolean) ? 'ok' : 'FAIL ' + JSON.stringify(ok)}`); process.exit(ok.every(Boolean) ? 0 : 1);
}

const n = Math.max(1, +arg('samples', 3));
const only = arg('only', '') ? new Set(arg('only').split(',')) : null;
const url = arg('url', 'engine/index.html'), vertical = /vertical\.html/.test(url);   // the 9:16 build draws into #vout
const E = await openEngine({ url, quiet: true, canvas: vertical ? 'vout' : 'out', width: vertical ? 1080 : 1920, height: vertical ? 1920 : 1080, init: glyphTracker });
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
const spriteFps = +arg('sprite-fps', 4);
const LEG = { hidden: 0.05, contrast: 3 };                     // the lyric: <= 5 % covered; WCAG 3:1 (large text)
if (spriteFps > 0) {                                           // which sprite is the main one, every 1/spriteFps s
  const samples = [], unsafe = new Map(), hidden = new Map(), dim = new Map(), cut = new Map();
  const glyphs = new Map(), big = new Map();                  // shot id -> Map(char -> sizes seen whole / not); shot index -> oversized
  await E.page.evaluate(async t => {                          // the frame layers, and the characters judged (lyrics + title)
    const G = window.__glyph, Z = window.Z;
    G.want = new Set([...(Z.LYR || []).map(l => l.text || '').join('') + (Z.TITLE || '')].filter(ch => /[\p{L}\p{N}]/u.test(ch)));
    Z.onText = (c, s, fg, scene) => { G.final = new Set([c, fg, scene]); G.fg = fg; };
    try { await window.renderFrame(t); } finally { Z.onText = null; }
  }, shots[0] ? shots[0].t0 : 0);
  const seeGlyphs = (s, k, t, gl) => {
    if (!gl) return;
    const seen = glyphs.get(s.id) || new Map(); glyphs.set(s.id, seen);
    for (const g of gl.gs) {
      const h = Math.max(g.x1 - g.x0, g.y1 - g.y0), o = seen.get(g.ch) || { whole: new Set(), not: new Set() };
      seen.set(g.ch, o); o[glyphWhole(g, gl.W, gl.H, gl.figs) ? 'whole' : 'not'].add(Math.round(4 * Math.log2(Math.max(1, h))));
      if (h > 0.5 * gl.H && !big.has(k)) big.set(k, { k, id: s.id, t });
    }
  };
  await E.page.evaluate(src => { window.__legib = (0, eval)('(' + src + ')'); }, legibility.toString());
  await E.page.evaluate(() => {                                 // a picture's opaque box in 0..1, and each edge's opaque share
    const C = new WeakMap();
    window.__abox = img => {
      if (C.has(img)) return C.get(img);
      const w = 96, h = Math.max(1, Math.round(96 * img.height / img.width)), x = Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h).data, A = (i, j) => d[4 * (j * w + i) + 3] > 64; let u0 = w, v0 = h, u1 = -1, v1 = -1;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (A(i, j)) { u0 = Math.min(u0, i); u1 = Math.max(u1, i); v0 = Math.min(v0, j); v1 = j; }
      // an edge band 3 px deep (a feathered crop is still a straight line)
      const band = (n, at) => { let k = 0; for (let q = 0; q < n; q++) if ([0, 1, 2].some(z => at(q, z))) k++; return k / n; };
      const edges = { top: band(w, (q, z) => A(q, z)), bottom: band(w, (q, z) => A(q, h - 1 - z)), left: band(h, (q, z) => A(z, q)), right: band(h, (q, z) => A(w - 1 - z, q)) };
      const r = u1 < 0 ? null : { u0: u0 / w, u1: (u1 + 1) / w, v0: v0 / h, v1: (v1 + 1) / h, edges };
      C.set(img, r); return r;
    };
  });
  for (let k = 0; k < shots.length; k++) {
    const s = shots[k], end = shots[k + 1] ? shots[k + 1].t0 : s.t1;
    if (only && !only.has(s.id)) continue;
    for (let t = s.t0 + 0.5 / fps; t < end; t += 1 / spriteFps) {
      const { p, out, all, leg, fig, gl } = await E.page.evaluate(async t => {
        let best = null, out = 0, all = 0, leg = null, fig = null, gl = null;
        const G = window.__glyph, figs = [];
        window.Z.onSprite = (p, h) => { if (p && (!best || h > best.h)) best = { p, h }; };
        // shortcut: a layer the scene scales after drawing the sprite into it (a camera on a whole canvas) is not seen
        window.Z.onSpriteBox = (img, c, x0, y0, w, h) => {
          const a = window.__abox(img); if (!a) return;
          const m = c.getTransform(), xs = [], ys = [];
          for (const [u, v] of [[a.u0, a.v0], [a.u1, a.v0], [a.u0, a.v1], [a.u1, a.v1]]) { const px = x0 + u * w, py = y0 + v * h; xs.push(m.a * px + m.c * py + m.e); ys.push(m.b * px + m.d * py + m.f); }
          const W = c.canvas.width, H = c.canvas.height, edges = {};
          for (const [k, u, v] of [['top', 0.5, 0], ['bottom', 0.5, 1], ['left', 0, 0.5], ['right', 1, 0.5]]) {   // an edge whose middle is on screen shows
            const px = x0 + u * w, py = y0 + v * h, X = m.a * px + m.c * py + m.e, Y = m.b * px + m.d * py + m.f;
            if (X > 2 && X < W - 2 && Y > 2 && Y < H - 2) edges[k] = a.edges[k];
          }
          const b = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), W, H, edges };
          G.fig(figs, img, c, x0, y0, w, h);
          if (!fig || b.y1 - b.y0 > fig.y1 - fig.y0) fig = b;
        };
        window.Z.onText = (c, shot, fgc, scene, info) => {            // info: { plan, t } the engine drew the lyrics with
          gl = { gs: G.read(c, fgc, scene), figs, W: c.width, H: c.height };   // every glyph, before any early return
          const P = info.plan && window.JZ && window.JZ.plans && window.JZ.plans[info.plan], tl = info.t, cut = P && window.J.cutAt(P.plan, tl);
          if (cut && (tl - cut.start < cut.inDur + 0.1 || cut.end - tl < cut.outDur + 0.1)) return;   // = moving(): words in motion
          // legibility: the words uncovered and apart from the picture around them (480 x 270)
          const w = 480, h = Math.round(480 * c.height / c.width), cv = k => window['__lg' + k] || (window['__lg' + k] = Object.assign(document.createElement('canvas'), { width: w, height: h }));
          const rd = (k, ...src) => { const x = cv(k).getContext('2d', { willReadFrequently: true }); x.clearRect(0, 0, w, h); for (const q of src) if (q) x.drawImage(q, 0, 0, w, h); return x.getImageData(0, 0, w, h).data; };
          leg = window.__legib(rd(0, c), fgc ? rd(1, fgc) : null, rd(2, scene, c, fgc), w, h);
          if (shot && shot.crop) return;                          // a deliberate 見切れ: the shot says the frame crops its words
          // lyric pixels outside the 90 % title-safe box (192 wide, the frame's own aspect)
          const sw = 192, sh = Math.round(192 * c.height / c.width), m = Math.round(sh * 5 / 108);
          const s = window.__safe || (window.__safe = Object.assign(document.createElement('canvas'), { width: sw, height: sh }));
          const x = s.getContext('2d', { willReadFrequently: true }); x.clearRect(0, 0, sw, sh); x.drawImage(c, 0, 0, sw, sh);
          const a = x.getImageData(0, 0, sw, sh).data;
          for (let i = 3, n = 0; i < a.length; i += 4, n++) if (a[i] > 127) { all++; const u = n % sw, v = (n / sw) | 0; if (u < 10 || u >= sw - 10 || v < m || v >= sh - m) out++; }
        };
        try { await window.renderFrame(t); } finally { window.Z.onSprite = null; window.Z.onText = null; window.Z.onSpriteBox = null; }
        const sh = (window.Z.SHOTS || []).filter(x => x.t0 <= t).pop();
        return { p: best && best.p, out, all, leg, fig: sh && sh.crop ? null : fig, gl };
      }, t);
      samples.push({ t, p, id: s.id });
      seeGlyphs(s, k, t, gl);
      const fc = fig && figureCut(fig);
      if (fc && !cut.has(s.id)) cut.set(s.id, { t, msg: fc });
      if (out >= 6 && out > 0.02 * all && !unsafe.has(s.id)) unsafe.set(s.id, { t, share: out / all });
      if (leg && leg.px >= 150) {
        if (leg.hidden > LEG.hidden && !(hidden.get(s.id)?.v >= leg.hidden)) hidden.set(s.id, { t, v: leg.hidden });
        if (leg.contrast != null && leg.contrast < LEG.contrast && !(dim.get(s.id)?.v <= leg.contrast)) dim.set(s.id, { t, v: leg.contrast });
      }
    }
  }
  const lastGlyph = new Map();
  for (let k = 0; k < shots.length; k++) {                     // a glyph not yet seen whole: every frame of its shot
    const s = shots[k], seen = glyphs.get(s.id);
    if (!seen || !neverWhole(seen)) continue;
    const end = shots[k + 1] ? shots[k + 1].t0 : s.t1;
    let last = null;
    for (let t = s.t0 + 0.5 / fps; t < end && neverWhole(seen); t += 1 / fps) {
      const gl = await E.page.evaluate(async t => {
        const G = window.__glyph, figs = []; let gl = null;
        window.Z.onSpriteBox = (img, c, x0, y0, w, h) => G.fig(figs, img, c, x0, y0, w, h);
        window.Z.onText = (c, shot, fgc, scene) => { gl = { gs: G.read(c, fgc, scene), figs, W: c.width, H: c.height }; };
        try { await window.renderFrame(t); } finally { window.Z.onText = null; window.Z.onSpriteBox = null; }
        return gl;
      }, t);
      seeGlyphs(s, k, t, gl);
      if (gl && gl.gs.length) last = t;
    }
    lastGlyph.set(s.id, last);
  }
  for (let k = 0; k < shots.length; k++) {
    const s = shots[k], seen = glyphs.get(s.id), last = lastGlyph.get(s.id);
    if (!seen) continue;
    const never = neverWhole(seen, glyphs.get(shots[k - 1]?.id), glyphs.get(shots[k + 1]?.id));
    if (never) (flag('strict') ? errors : warns).push(`${s.id} @${(last ?? s.t0).toFixed(2)}: GLYPH NEVER WHOLE (${never} character${never > 1 ? 's' : ''} of the lyrics / title past the frame, cut or covered on every frame they show; let each land whole once, then crop or push)`);
  }
  const places = oversizeMoments([...big.values()].sort((a, b) => a.k - b.k));
  if (places.length > 2) (flag('strict') ? errors : warns).push(`OVERSIZED TYPE in ${places.length} places (${places.map(m => `${m[0].id} @${m[0].t.toFixed(2)}`).join(', ')}; glyphs over half the frame high): a peak move, keep it for the song's emotional peaks, one or two in a film, never the same move twice`);
  for (const [id, u] of unsafe) (flag('strict') ? errors : warns).push(`${id} @${u.t.toFixed(2)}: LYRICS OUTSIDE THE SAFE AREA (${(u.share * 100).toFixed(0)} % of the lyric pixels in the outer 5 %; a camera push or a big layout crops words there)`);
  for (const [id, u] of hidden) (flag('strict') ? errors : warns).push(`${id} @${u.t.toFixed(2)}: LYRICS HIDDEN (${(u.v * 100).toFixed(0)} % of the lyric under the foreground: the foreground covers the words there)`);
  for (const [id, u] of dim) (flag('strict') ? errors : warns).push(`${id} @${u.t.toFixed(2)}: LYRICS LOW CONTRAST (${u.v.toFixed(1)}:1 against the picture around them, needs ${LEG.contrast}:1 there; how the words reach it is the film's choice)`);
  for (const [id, u] of cut) (flag('strict') ? errors : warns).push(`${id} @${u.t.toFixed(2)}: ${u.msg}; crop: true on the shot if it is meant`);
  for (const f of spriteFlips(samples)) (flag('strict') ? errors : warns).push(`${f.id} @${f.t.toFixed(2)}: SPRITE ${f.kind === 'pingpong' ? 'PING-PONG' : 'RAPID SWAPS'} ${f.msg} (sprites swap back and forth inside one shot; faces change with chars[].anim)`);
}
{                                                              // which lyrics each frame draws, around every cut
  await E.page.evaluate(() => {
    const L = window.__lyr = { on: false, jz: new Set(), code: new Set() };
    const R = window.J && window.J.Renderer && window.J.Renderer.prototype;
    if (R) { const d = R.drawCut; R.drawCut = function (env) { const c = env.cut; if (L.on && c && c.text && !c.companion) L.jz.add(c.line + ':' + c.text); return d.call(this, env); }; }
    // shortcut: code that kept its own reference to Z.line before this hook is not seen; scenes call Z.line(i) per frame
    const line = window.Z.line;
    window.Z.line = i => { const o = line(i); return L.on && o && o.text ? new Proxy(o, { get: (x, k) => { if (k === 'text') L.code.add(i); return x[k]; } }) : o; };
  });
  const times = new Set();
  for (const b of [...shots.map(s => s.t0), ...(P.lyricCuts || [])]) for (let k = -3; k <= 3; k++) times.add(+(b + k / fps).toFixed(4));
  for (let t = 0.25; t < P.duration; t += 0.5) times.add(+t.toFixed(4));
  const frames = [];
  for (const t of [...times].filter(t => t >= 0 && t < P.duration).sort((a, b) => a - b)) {
    const k = shots.findLastIndex(s => s.t0 <= t), s = shots[k];
    if (!s || (only && !only.has(s.id))) continue;
    const r = await E.page.evaluate(async t => {
      const L = window.__lyr; L.jz.clear(); L.code.clear(); L.on = true;
      window.Z.onText = () => { L.on = false; };                   // the HUD comes after the lyrics: not counted
      try { await window.renderFrame(t); } finally { L.on = false; window.Z.onText = null; }
      // a scene that keeps earlier lines on screen as history (a chat thread: Z.scene(name, { history: true })) reads
      // several lines by design; only its newest one counts against the other lyric sources
      const sh = (window.Z.SHOTS || []).filter(x => x.t0 <= t).pop(), hist = sh && (window.Z.SCENES[sh.scene] || {}).history;
      const code = [...L.code];
      return { jz: [...L.jz], code: hist ? code.sort((x, y) => x - y).slice(-1) : code };
    }, t);
    frames.push({ id: s.id, t, ...r });
  }
  for (const o of drawnOverlaps(frames)) (flag('strict') ? errors : warns).push(`${o.id} @${o.t.toFixed(2)}: LYRIC OVERLAP ${o.msg} drawn in one frame (a transition, an exit running into the next shot, or one line set twice; references/06)`);
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
