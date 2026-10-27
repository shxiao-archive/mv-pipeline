/* The glyph tracker: hooks fillText/strokeText/drawImage in the page so every glyph's box on every canvas is known
 * (window.__glyph). Run as a page init script (page.addInitScript(glyphTracker)): check_shots.mjs, jizura_cover.mjs.
 * mv-studio (MIT). */
// In the page, before the engine loads: every fillText / strokeText records a box per character on its canvas, and
// drawImage carries a canvas's boxes into the canvas it is drawn on (mapped, cut where the source rect cuts them), so
// the frame's layers know where each glyph landed, however many offscreen caches it went through.
// shortcut: maxWidth squeeze, rtl, putImageData, OffscreenCanvas and WebGL passes are not followed, and a partial erase
// keeps its boxes; upgrade if a film's type is drawn that way.
export function glyphTracker() {
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
