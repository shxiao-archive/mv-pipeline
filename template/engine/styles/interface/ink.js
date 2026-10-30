/* styles/interface — ink.js: colour STATES and a role-palette drawing wrapper (the `Ink`) for code-drawn pictures.
 *
 * In the interface style colour is story state, not decoration: every component is coloured by ROLE
 * (bg panel raised line text sub mute me meHot meDim err errDim), and a shot picks a STATE that maps roles to colours.
 * The same chat window greys out, warms up or turns red when the story says so, without any code change.
 *
 *   Z.IF.STATES                 { off, on, warm, error, ash, dead, paper }  (override / add your own in the timeline)
 *   Z.IF.resolve(spec)          'on' | palette object | ['on', 'warm', k] (blend) -> palette object
 *   Z.IF.stateAt(list, t)       list = [[t0, spec], [t1, spec], ...] -> the spec in force at t (blends over `fade` s)
 *   Z.IF.ink(ctx, spec)         -> Ink: text / measure / fit / wrap / line / poly / rect / rrect / circle / gradRect /
 *                               radial / glow / clip / at / brackets / col / cw — all coloured by role names
 *   Z.IF.FONTS                  { serif, sans, mono } family stacks (roles: serif = "me", sans = "you" + UI, mono = system)
 *
 * Roles (fixed meaning for the whole film): me = the speaker of the lyrics (accent colour), text = "you" / primary UI
 * text (cream), err = error (red: keep it out of the film until the first error event), mute/sub = absence, secondary.
 *
 * Ported and adapted from world-execute-me-lyric-mv (src/engine/draw.js, MIT, (c) 2026 Nyankomint) onto the
 * vocaloid-style-mv engine (MIT, (c) 2026 NikusonP). The default palettes are original to mv-studio.
 */
(() => {
  'use strict';
  const Z = window.Z, IF = (Z.IF = Z.IF || {});

  // Original palettes. Hue of "me" is teal so the default look is nobody's product UI; set your own per film.
  IF.STATES = {
    off:   { bg: '#202122', panel: '#161718', raised: '#2c2d2f', line: '#46484b', text: '#e3e2de', sub: '#a7a7a3', mute: '#6c6d6c', me: '#9c9e9e', meHot: '#cfd1d1', meDim: '#5a5c5c', err: '#9c9e9e', errDim: '#535455' },
    on:    { bg: '#1e2125', panel: '#16181c', raised: '#2a2e34', line: '#3d434b', text: '#f3f0e8', sub: '#bcbfc3', mute: '#787d85', me: '#4fc7b5', meHot: '#86e6d6', meDim: '#2b6a61', err: '#ff5468', errDim: '#7f2433' },
    warm:  { bg: '#24231f', panel: '#1b1a17', raised: '#33312b', line: '#565246', text: '#fff9ee', sub: '#d9d1c2', mute: '#8f877a', me: '#62dcc8', meHot: '#a3f4e6', meDim: '#317a6e', err: '#ff5468', errDim: '#7f2433' },
    error: { bg: '#1c1416', panel: '#150e10', raised: '#2c1c1f', line: '#543236', text: '#f6f1ec', sub: '#c9b3b1', mute: '#7f6062', me: '#4fc7b5', meHot: '#86e6d6', meDim: '#2b6a61', err: '#ff5468', errDim: '#86243a' },
    ash:   { bg: '#1b1b1b', panel: '#151515', raised: '#262626', line: '#3b3b3a', text: '#cdcbc6', sub: '#94938f', mute: '#686866', me: '#6f9a93', meHot: '#8db7b0', meDim: '#3f504d', err: '#8c5561', errDim: '#4a343a' },
    dead:  { bg: '#050505', panel: '#050505', raised: '#0c0c0c', line: '#161616', text: '#8a8880', sub: '#55544f', mute: '#2c2c2a', me: '#3e4645', meHot: '#5b6463', meDim: '#222626', err: '#4a4844', errDim: '#262624' },
    // the paper of a plate: warm near-black stock; prints use three flat inks (me, text, bg) on it
    paper: { bg: '#0f0e0c', panel: '#1d1a16', raised: '#2a2620', line: '#3d372e', text: '#efe7d6', sub: '#bdb3a0', mute: '#7b7364', me: '#4fc7b5', meHot: '#86e6d6', meDim: '#2b6a61', err: '#ff5468', errDim: '#7f2433' },
  };
  const ROLES = Object.keys(IF.STATES.on);

  const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const hex = c => '#' + c.map(v => Math.round(Z.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const cache = new Map();
  IF.resolve = spec => {
    if (!spec) return IF.STATES.on;
    if (typeof spec === 'string') { if (!IF.STATES[spec]) console.warn('[interface] unknown state ' + spec); return IF.STATES[spec] || IF.STATES.on; }
    if (Array.isArray(spec)) {
      const [a, b, k0] = spec, k = Z.clamp(k0), key = a + '|' + b + '|' + k.toFixed(3);
      if (typeof a === 'string' && typeof b === 'string' && cache.has(key)) return cache.get(key);
      const A = IF.resolve(a), B = IF.resolve(b), out = {};
      for (const r of ROLES) out[r] = hex(Z.mix3(rgb(A[r] || '#000000'), rgb(B[r] || '#000000'), k));
      if (cache.size > 4000) cache.clear();
      if (typeof a === 'string' && typeof b === 'string') cache.set(key, out);
      return out;
    }
    return Object.assign({}, IF.STATES.on, spec);
  };
  // the state in force at t from [[t0, spec], ...]: each change blends in over `fade` seconds (0 = hard switch, on a cut)
  IF.stateAt = (list, t, fade = 0.6) => {
    let cur = list[0][1], prev = null, since = 1e9;
    for (const [t0, s] of list) if (t >= t0) { prev = cur; cur = s; since = t - t0; }
    return prev && prev !== cur && fade > 0 && since < fade ? [prev, cur, Z.ease.inOutSine(since / fade)] : cur;
  };

  IF.FONTS = { serif: '"Noto Serif JP"', sans: '"Inter", "Noto Sans JP"', mono: '"IBM Plex Mono", "DotGothic16"' };
  // Chinese lyrics: call Z.IF.useChinese() in the timeline (the JP families would draw Japanese glyph shapes)
  IF.useChinese = () => { IF.FONTS.serif = '"Noto Serif SC"'; IF.FONTS.sans = '"Inter", "Noto Sans SC"'; };
  IF.fontsToLoad = ['400 40px "Noto Serif JP"', '700 40px "Noto Serif JP"', '900 40px "Noto Serif JP"', '400 40px "Inter"', '500 40px "Inter"', '600 40px "Inter"', '700 40px "Inter"',
    '400 40px "IBM Plex Mono"', '700 40px "IBM Plex Mono"', '400 40px "Noto Serif SC"', '700 40px "Noto Serif SC"', '900 40px "Noto Serif SC"', '400 40px "Noto Sans SC"'];

  class Ink {
    constructor(g, pal) { this.g = g; this.p = pal; this.canvas = g.canvas; this.scale = 1; }
    col(role, a = 1) { const c = this.p[role] || role; const [r, gg, b] = rgb(c.length === 7 ? c : '#ff00ff'); return `rgba(${r},${gg},${b},${a})`; }
    font(size, weight = 400, family = 'sans', italic = false) { this.g.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${IF.FONTS[family] || family}, serif`; }
    cw(size) { return size * 0.6; }                                               // IBM Plex Mono advance = 0.6 em
    measure(str, { size = 24, weight = 400, font = 'sans', spacing = 0, italic = false } = {}) {
      this.font(size, weight, font, italic); return this.g.measureText(String(str)).width + spacing * [...String(str)].length;
    }
    fit(str, maxW, { font = 'serif', weight = 700, spacingEm = 0, maxSize = 2000 } = {}) {
      const w = this.measure(str, { size: 100, weight, font, spacing: spacingEm * 100 }); return Math.min(maxSize, (100 * maxW) / Math.max(1, w));
    }
    // greedy wrap: on spaces for Latin text, per character for CJK (no spaces)
    wrap(str, maxW, o = {}) {
      str = String(str || ''); const words = /\s/.test(str) ? str.split(/(\s+)/) : [...str];
      const out = []; let line = '';
      for (const w of words) {
        const test = line + w;
        if (line && this.measure(test.trimEnd(), o) > maxW) { out.push(line.trimEnd()); line = w.trimStart(); } else line = test;
      }
      if (line.trim() || !out.length) out.push(line.trimEnd());
      return out;
    }
    text(str, x, y, { size = 24, weight = 400, color = 'text', alpha = 1, align = 'left', spacing = 0, font = 'sans', stroke = 0, italic = false } = {}) {
      if (!(alpha > 0.003) || str == null || str === '') return;
      const g = this.g; this.font(size, weight, font, italic);
      g.letterSpacing = `${spacing}px`; g.textAlign = align; g.textBaseline = 'alphabetic';
      if (stroke > 0) { g.strokeStyle = this.col(color, Math.min(1, alpha)); g.lineWidth = stroke; g.lineJoin = 'round'; g.strokeText(String(str), x, y); }
      else { g.fillStyle = this.col(color, Math.min(1, alpha)); g.fillText(String(str), x, y); }
      g.letterSpacing = '0px';
    }
    line(x1, y1, x2, y2, { color = 'text', alpha = 1, width = 2 } = {}) {
      if (!(alpha > 0.003)) return; const g = this.g;
      g.strokeStyle = this.col(color, alpha); g.lineWidth = width; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    poly(pts, { color = 'text', alpha = 1, width = 2, close = false, fill = false } = {}) {
      if (!(alpha > 0.003) || pts.length < 2) return; const g = this.g;
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close || fill) g.closePath();
      if (fill) { g.fillStyle = this.col(color, alpha); g.fill(); } else { g.strokeStyle = this.col(color, alpha); g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
    }
    rect(x, y, w, h, { color = 'text', alpha = 1, width = 2, fill = false } = {}) {
      if (!(alpha > 0.003)) return; const g = this.g;
      if (fill) { g.fillStyle = this.col(color, alpha); g.fillRect(x, y, w, h); } else { g.strokeStyle = this.col(color, alpha); g.lineWidth = width; g.strokeRect(x, y, w, h); }
    }
    rrect(x, y, w, h, r, { fill = 'raised', stroke = null, alpha = 1, width = 1.5, fillAlpha = 1, strokeAlpha = 1, shadow = 0 } = {}) {
      if (!(alpha > 0.003) || w <= 0 || h <= 0) return; const g = this.g; r = Math.max(0, Math.min(r, w / 2, h / 2));
      g.beginPath(); g.roundRect(x, y, w, h, r);
      if (fill) {
        if (shadow > 0) { g.save(); g.shadowColor = `rgba(0,0,0,${0.45 * shadow * alpha})`; g.shadowBlur = 34 * shadow; g.shadowOffsetY = 12 * shadow; }
        g.fillStyle = this.col(fill, alpha * fillAlpha); g.fill();
        if (shadow > 0) g.restore();
      }
      if (stroke) { g.strokeStyle = this.col(stroke, alpha * strokeAlpha); g.lineWidth = width; g.stroke(); }
    }
    circle(x, y, r, { color = 'text', alpha = 1, width = 2, fill = false, a0 = 0, a1 = Math.PI * 2 } = {}) {
      if (!(alpha > 0.003) || r <= 0) return; const g = this.g;
      g.beginPath(); if (fill && a1 - a0 < Math.PI * 2 - 1e-6) g.moveTo(x, y); g.arc(x, y, r, a0, a1);
      if (fill) { g.fillStyle = this.col(color, alpha); g.fill(); } else { g.strokeStyle = this.col(color, alpha); g.lineWidth = width; g.stroke(); }
    }
    gradRect(x, y, w, h, stops, dir = 'v') {
      const g = this.g, gr = dir === 'h' ? g.createLinearGradient(x, 0, x + w, 0) : g.createLinearGradient(0, y, 0, y + h);
      for (const [k, role, a] of stops) gr.addColorStop(Z.clamp(k), this.col(role, a ?? 1));
      g.fillStyle = gr; g.fillRect(x, y, w, h);
    }
    radial(x, y, r, role, alpha) {
      const g = this.g, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, this.col(role, alpha)); gr.addColorStop(1, this.col(role, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    glow(color, radius, fn, alpha = 1) {
      const g = this.g; g.save(); g.shadowColor = this.col(color, alpha); g.shadowBlur = radius; fn(); g.restore();
    }
    brackets(r, { len = 22, color = 'mute', alpha = 1, width = 2, k = 1 } = {}) {
      const l = len * Z.clamp(k), o = { color, alpha, width };
      for (const [x, y, sx, sy] of [[r.x, r.y, 1, 1], [r.x + r.w, r.y, -1, 1], [r.x + r.w, r.y + r.h, -1, -1], [r.x, r.y + r.h, 1, -1]]) { this.line(x, y, x + sx * l, y, o); this.line(x, y, x, y + sy * l, o); }
    }
    clip(r, fn, radius = 0) {
      const g = this.g; g.save(); g.beginPath(); if (radius) g.roundRect(r.x, r.y, r.w, r.h, radius); else g.rect(r.x, r.y, r.w, r.h); g.clip(); fn(); g.restore();
    }
    at(x, y, fn, { rot = 0, scale = 1, sx = scale, sy = scale, alpha = 1 } = {}) {
      const g = this.g; g.save(); g.translate(x, y); if (rot) g.rotate(rot); if (sx !== 1 || sy !== 1) g.scale(sx, sy); g.globalAlpha *= alpha; fn(); g.restore();
    }
    // draw fn at several past instants (motion blur by sampling the past): fn(tau) for tau = n*dt .. 0
    trail(n, dt, fn, strength = 0.5) {
      const g = this.g;
      for (let i = n; i >= 1; i--) { g.save(); g.globalAlpha *= strength * (1 - i / (n + 1)); fn(i * dt); g.restore(); }
      fn(0);
    }
    withPal(spec, fn) { const p = this.p; this.p = IF.resolve(spec); fn(); this.p = p; }
  }
  IF.Ink = Ink;
  IF.ink = (g, spec) => new Ink(g, IF.resolve(spec));
})();
