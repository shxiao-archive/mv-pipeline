/* styles/interface — print.js: the two other kinds of picture next to the interface.
 *
 * PLATE: what the speaker means and feels, as a full-frame print on dark textured paper, built only from three flat
 * inks (me, text, bg) — shapes, glyph pictures, silhouettes and big type. No gradients inside a shape: depth comes from
 * a second ink or a shadow plate printed out of register.
 *   IF.ground(ink, o)        the paper: tone, a two-step pool of light, dot screen, grain, crop marks
 *   IF.marks(ink, o)         crop / registration marks alone
 *   IF.shadow(ink, dx, dy, fn)  fn(true) = the shadow plate in ONE flat ink, offset; then fn(false) = the thing itself
 *   IF.band(ink, str, o)     a caption band: a sung line in the speaker's serif on a flat strip of paper
 *   IF.keyword(ink, str, t, o)  a keyword as big type locked into the plate; letters land one by one (or by parts)
 *   IF.dashedRing(...)       the dashed outline left where an element was NOT printed
 *   IF.glyphPlate(ink, src, rect, o)  a picture printed in code characters, cell by cell, from an image's brightness
 * CODE: the machinery underneath, mono only.
 *   IF.codeGround(ink, o) · IF.tokens(str, hi) · IF.codeLine(...) · IF.listing(...) · IF.odometer(...) ·
 *   IF.terminal(ink, rect, entries, t, o) · IF.caret(...)
 *
 * Ported and adapted from world-execute-me-lyric-mv (src/components/plate.js, code.js, src/engine/ascii.js; MIT,
 * (c) 2026 Nyankomint). The code colouring is generic here: pass the words that belong to "me" / "you".
 */
(() => {
  'use strict';
  const Z = window.Z, IF = (Z.IF = Z.IF || {});
  const clamp = Z.clamp, easeOut = Z.ease.outCubic, prog = (t, a, b) => Z.inv(a, b, t);
  const FULL = { x: 0, y: 0, w: 1920, h: 1080 };

  let grainTile = null;
  const grain = () => {                                                  // paper fibres (alpha only), built once
    if (grainTile) return grainTile;
    const S = 384, c = Z.canvas(S, S), g = c.getContext('2d'), im = g.createImageData(S, S), d = im.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, v = Z.rnd(611, x, y), fibre = Z.rnd(613, x >> 3, y) > 0.86 ? 0.5 : 0;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v > 0.5 ? 255 : 0;
      d[i * 4 + 3] = Math.round(255 * clamp(Math.abs(v - 0.5) * 1.5 + fibre * Z.rnd(617, x, y)));
    }
    g.putImageData(im, 0, 0);
    return (grainTile = c);
  };

  IF.marks = (ink, { r = FULL, inset = 34, len = 30, color = 'mute', alpha = 0.7, width = 2, k = 1, target = true } = {}) => {
    if (!(alpha > 0.003) || k <= 0) return;
    const x0 = r.x + inset, y0 = r.y + inset, x1 = r.x + r.w - inset, y1 = r.y + r.h - inset, l = len * clamp(k), o = { color, alpha, width };
    for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x1, y1, -1, -1], [x0, y1, 1, -1]]) { ink.line(x, y + sy * 8, x, y + sy * (8 + l), o); ink.line(x + sx * 8, y, x + sx * (8 + l), y, o); }
    if (target) { const cx = r.x + r.w / 2, cy = y1 - 4; ink.circle(cx, cy, 9, { color, alpha, width: 1.5 }); ink.line(cx - 16, cy, cx + 16, cy, { color, alpha, width: 1.5 }); ink.line(cx, cy - 16, cx, cy + 16, { color, alpha, width: 1.5 }); }
  };
  IF.ground = (ink, { tone = 'panel', light = [960, 520, 620, 'raised', 1], dots = 1, grain: gr = 1, marks: mk = true, r = FULL } = {}) => {
    const g = ink.g;
    ink.rect(r.x - 400, r.y - 400, r.w + 800, r.h + 800, { fill: true, color: tone });
    if (light) {
      const [x, y, rad, role = 'raised', a = 1] = light;
      ink.circle(x, y, rad, { fill: true, color: role, alpha: 0.5 * a });            // two flat steps of light: a print, not a glow
      ink.circle(x, y, rad * 0.62, { fill: true, color: role, alpha: 0.5 * a });
    }
    if (dots > 0) {
      g.fillStyle = ink.col('line', 0.5 * dots); g.beginPath();
      for (let j = 0, y = r.y + 12; y < r.y + r.h; y += 24, j++) {
        const rad = 1.1 + 1.5 * ((y - r.y) / r.h);
        for (let x = r.x + 12 + (j % 2) * 12; x < r.x + r.w; x += 24) { g.moveTo(x + rad, y); g.arc(x, y, rad, 0, 6.2832); }
      }
      g.fill();
    }
    if (gr > 0) {
      const pat = g.createPattern(grain(), 'repeat'), a0 = g.globalAlpha;
      pat.setTransform(new DOMMatrix().scale(0.5));
      g.globalAlpha = a0 * 0.085 * gr; g.fillStyle = pat; g.fillRect(r.x, r.y, r.w, r.h); g.globalAlpha = a0;
    }
    if (mk) IF.marks(ink, Object.assign({ r }, typeof mk === 'object' ? mk : null));
  };
  IF.shadow = (ink, dx, dy, fn) => { if (dx || dy) ink.at(dx, dy, () => fn(true)); fn(false); };
  IF.band = (ink, str, { x = 120, y = 1000, size = 56, color = 'me', align = 'left', plate = true, maxW = 1680, n = null, font = 'serif' } = {}) => {
    if (!str) return;
    const o = { size, weight: 400, font }, s = Math.min(size, ink.fit(str, maxW, { font, weight: 400, maxSize: size })), w = ink.measure(str, Object.assign({}, o, { size: s }));
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, shown = n == null ? str : [...str].slice(0, n).join('');
    if (plate) ink.rect(x0 - 26, y - s * 0.98, w + 52, s * 1.36, { fill: true, color: 'panel', alpha: 0.86 });
    ink.text(shown, x0, y, Object.assign({}, o, { size: s, color }));
  };
  IF.keyword = (ink, str, t, { x = 960, y = 540, maxW = 1700, maxSize = 300, size = null, align = 'center', at = -1e9, step = 0, parts = null, color = 'me', shade = 'bg', off = [10, 10], hollow = 0, font = 'serif', weight = 900, spacingEm = 0.01, stroke = 0 } = {}) => {
    const chars = [...String(str)], s = size ?? ink.fit(str, maxW, { font, weight, spacingEm, maxSize }), sp = spacingEm * s, o = { size: s, weight, font };
    const w = ink.measure(str, Object.assign({}, o, { spacing: sp })) - sp, x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const landed = i => (parts ? ((parts.find(([a, z]) => i >= a && i < z) || [])[2] ?? at) : at + i * step);
    for (const pass of off && (off[0] || off[1]) ? [1, 0] : [0]) {
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] === ' ') continue;
        const cx = x0 + ink.measure(chars.slice(0, i + 1).join(''), o) + i * sp - ink.measure(chars[i], o) / 2, on = t >= landed(i);
        const px = cx + (pass ? off[0] : 0), py = y + (pass ? off[1] : 0);
        if (on) { const k = easeOut(prog(t, landed(i), landed(i) + 0.07)); ink.at(px, py, () => ink.text(chars[i], 0, 0, Object.assign({}, o, { align: 'center', color: pass ? shade : color, stroke })), { scale: 1.08 - 0.08 * k }); }
        else if (hollow > 0 && !pass) ink.text(chars[i], px, py, Object.assign({}, o, { align: 'center', color, stroke: Math.max(2, s * 0.012), alpha: hollow }));
      }
    }
    return { x: x0, y, w, size: s };
  };
  IF.dashedRing = (ink, x, y, r, { w = 0, h = 0, color = 'mute', width = 4, dash = 18, alpha = 1 } = {}) => {
    const g = ink.g; g.setLineDash([dash, dash * 0.8]);
    if (w && h) ink.rrect(x - w / 2, y - h / 2, w, h, r, { fill: null, stroke: color, width, alpha }); else ink.circle(x, y, r, { color, width, alpha });
    g.setLineDash([]);
  };

  // ---------------------------------------------------------------- glyph plate: a picture printed in characters
  // src: an image path (preloaded), an Image / canvas, or a function (g, w, h) that paints the subject (white on clear).
  // Brightness x alpha of each cell picks a glyph from `ramp`; cells under `threshold` stay empty (the paper shows).
  //   reveal 0..1 cells appear in a seeded order (or `revealDir: 'down'` row by row); decode 0..1 share of cells that
  //   still flicker through random glyphs (12 fps) before they settle; inks: [[level, role], ...] colour by brightness.
  const sampled = new Map();
  let srcId = 0;
  // brightness per cell; the subject is fitted (contain) into the cell grid in PIXEL space, so non-square cells
  // (a mono glyph is ~0.6 em wide) do not stretch it
  const sample = (src, cols, rows, cw, ch, key) => {
    const k = key + '|' + cols + 'x' + rows + '|' + cw.toFixed(2); if (sampled.has(k)) return sampled.get(k);
    const c = Z.canvas(cols, rows), g = c.getContext('2d', { willReadFrequently: true });
    if (typeof src === 'function') src(g, cols, rows);
    else {
      const s = Math.min((cols * cw) / src.width, (rows * ch) / src.height), dw = (src.width * s) / cw, dh = (src.height * s) / ch;
      g.drawImage(src, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
    }
    const d = g.getImageData(0, 0, cols, rows).data, v = new Float32Array(cols * rows);
    for (let i = 0; i < cols * rows; i++) v[i] = ((0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255) * (d[i * 4 + 3] / 255);
    sampled.set(k, v); return v;
  };
  IF.glyphPlate = (ink, src, rect, { cell = 18, ramp = ' .:-=+*#%@', inks = [[0, 'meDim'], [0.45, 'me'], [0.8, 'text']], threshold = 0.06, reveal = 1, revealDir = 'seed', decode = 0, t = 0, seed = 7, weight = 600, aspect = 1.0, key = null, alpha = 1 } = {}) => {
    const img = typeof src === 'string' ? Z.imgSync(src) : src; if (!img) return;
    const cw = cell * 0.62 * aspect, cols = Math.max(1, Math.floor(rect.w / cw)), rows = Math.max(1, Math.floor(rect.h / cell));
    if (typeof src !== 'string' && !img.__ifKey) img.__ifKey = 'src' + ++srcId;
    const v = sample(img, cols, rows, cw, cell, key || (typeof src === 'string' ? src : img.__ifKey));
    const g = ink.g; ink.font(cell, weight, 'mono'); g.textAlign = 'center'; g.textBaseline = 'middle';
    const q = Math.floor(t * 12), byRole = new Map();
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const b = v[j * cols + i]; if (b < threshold) continue;
      const gate = revealDir === 'down' ? j / rows : Z.rnd(i, j, seed);
      if (gate >= reveal) continue;
      let ch = ramp[Math.min(ramp.length - 1, Math.max(1, Math.round(b * (ramp.length - 1))))];
      if (decode > 0 && Z.rnd(i, j, seed + 1) < decode) ch = ramp[1 + Math.floor(Z.rnd(i, j, q) * (ramp.length - 1))];
      let role = inks[0][1]; for (const [lv, r] of inks) if (b >= lv) role = r;
      if (!byRole.has(role)) byRole.set(role, []);
      byRole.get(role).push([ch, rect.x + (i + 0.5) * cw, rect.y + (j + 0.5) * cell]);
    }
    for (const [role, list] of byRole) { g.fillStyle = ink.col(role, alpha); for (const [ch, x, y] of list) g.fillText(ch, x, y); }
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  };

  // ---------------------------------------------------------------- code
  const WORD = /^[A-Za-z_][A-Za-z0-9_]*/;
  IF.codeGround = (ink, { cols = 163, light = [760, 420, 760], alpha = 1 } = {}) => {
    const g = ink.g;
    ink.rect(-400, -400, 2720, 1880, { fill: true, color: 'panel' });
    if (light) { ink.circle(light[0], light[1], light[2], { fill: true, color: 'bg', alpha: 0.75 * alpha }); ink.circle(light[0], light[1], light[2] * 0.6, { fill: true, color: 'bg', alpha }); }
    g.fillStyle = ink.col('line', 0.22 * alpha); for (let x = 110; x < 1920; x += cols) g.fillRect(x, 0, 1.5, 1080);
    g.fillStyle = ink.col('line', 0.3 * alpha); for (let y = 27; y < 1080; y += 54) for (let x = 110; x < 1920; x += cols / 4) g.fillRect(x, y, 2, 2);
  };
  // colouring is the film's colour rule, not a syntax theme: hi = { me: [...words], you: [...words], hot: [...words] }
  IF.tokens = (str, hi = {}) => {
    const me = new Set(hi.me || ['me', 'self']), you = new Set(hi.you || ['you', 'your', 'yours']), hot = new Set(hi.hot || []), kw = new Set(hi.kw || ['while', 'for', 'if', 'else', 'return', 'of', 'in', 'let', 'const', 'def', 'fn']);
    const out = []; let i = 0;
    const push = (s, role, weight = 400) => out.push({ s, role, weight });
    while (i < str.length) {
      const rest = str.slice(i);
      if (rest.startsWith('//') || rest[0] === '#') { push(rest, 'mute'); break; }
      if (rest[0] === '"') { const j = rest.indexOf('"', 1), s = rest.slice(0, j < 0 ? rest.length : j + 1); push(s, 'text', 700); i += s.length; continue; }
      const w = (WORD.exec(rest) || [])[0];
      if (w) { push(w, hot.has(w) ? 'meHot' : me.has(w) ? 'me' : you.has(w) ? 'text' : kw.has(w) ? 'sub' : 'sub', hot.has(w) || me.has(w) ? 800 : you.has(w) || kw.has(w) ? 700 : 400); i += w.length; continue; }
      push(rest[0], rest[0] === ' ' ? 'sub' : 'mute'); i++;
    }
    return out;
  };
  IF.codeLine = (ink, str, x, y, { size = 34, alpha = 1, force = null, weight = null, hi = {} } = {}) => {
    const cw = ink.cw(size); let col = 0;
    for (const tk of IF.tokens(str, hi)) { if (tk.s.trim()) ink.text(tk.s, x + col * cw, y, { size, font: 'mono', weight: weight ?? tk.weight, color: force ?? tk.role, alpha }); col += tk.s.length; }
    return col * cw;
  };
  IF.listing = (ink, x, y, lines, { size = 34, lh = 1.5, current = null, hot = 0, dimmed = null, tags = null, tagGap = 2, tagSize = 0.8, first = 1, numbers = true, alpha = 1, bar = 'raised', rule = 'me', barW = null, hi = {} } = {}) => {
    const cw = ink.cw(size), LH = size * lh, gut = numbers ? 4 * cw : 0, lineY = i => y + i * LH, endX = i => x + gut + lines[i].length * cw;
    if (current != null) {
      const w = barW ?? gut + Math.max(...lines.map(l => l.length)) * cw + 2 * cw, by = lineY(current) - size * 1.02;
      ink.rrect(x - cw, by, w + cw, LH * 0.94, 8, { fill: bar, alpha: alpha * (0.75 + 0.25 * hot) }); ink.rect(x - cw, by, 6, LH * 0.94, { fill: true, color: rule, alpha });
    }
    lines.forEach((ln, i) => {
      const d = dimmed ? clamp(dimmed(i)) : 0, a = alpha * (1 - 0.72 * d), yy = lineY(i);
      if (numbers) ink.text(String(first + i).padStart(2, '0'), x, yy, { size, font: 'mono', color: 'mute', alpha: a * (current != null && Math.round(current) === i ? 1 : 0.8) });
      IF.codeLine(ink, ln, x + gut, yy, { size, alpha: a, force: d > 0.5 ? 'mute' : null, hi });
      const tg = tags && tags[i];
      if (tg && (tg.alpha ?? 1) > 0.003) ink.text(tg.text, endX(i) + tagGap * cw, yy, { size: size * tagSize, font: 'mono', weight: 700, color: tg.role ?? 'err', alpha: alpha * (tg.alpha ?? 1) * (0.5 + 0.5 * clamp(tg.k ?? 0)) });
    });
    return { x, y, cw, lh: LH, gut, lineY, endX };
  };
  IF.odometer = (ink, x, y, value, { digits = 4, size = 96, color = 'text', weight = 800, alpha = 1, overflow = 0, overColor = 'err' } = {}) => {
    const cw = ink.cw(size), v = Math.max(0, value), whole = Math.floor(v + 1e-9), frac = clamp(v - whole), n = Math.max(digits, String(whole).length);
    const str = String(whole).padStart(n, '0'), roll = easeOut(frac), rolling = []; let carry = true;
    for (let i = n - 1; i >= 0; i--) { rolling[i] = carry && frac > 0; carry = carry && str[i] === '9'; }
    const o = { size, font: 'mono', weight };
    for (let i = 0; i < n; i++) {
      const cx = x + i * cw;
      if (overflow > 0 && i < Math.ceil(overflow * n)) { ink.text('#', cx, y, Object.assign({}, o, { color: overColor, alpha })); continue; }
      if (!rolling[i]) { ink.text(str[i], cx, y, Object.assign({}, o, { color, alpha })); continue; }
      ink.clip({ x: cx - 2, y: y - size * 0.86, w: cw + 4, h: size * 1.08 }, () => {
        ink.text(str[i], cx, y - roll * size * 1.08, Object.assign({}, o, { color, alpha })); ink.text(String((+str[i] + 1) % 10), cx, y + (1 - roll) * size * 1.08, Object.assign({}, o, { color, alpha }));
      });
    }
    return n * cw;
  };
  IF.terminal = (ink, r, entries, t, { size = 26, lh = 1.5, push = 0.12, alpha = 1, prompt = '', fade = true } = {}) => {
    const LH = size * lh, live = entries.filter(e => t >= e.at), rows = Math.floor(r.h / LH);
    if (!live.length) return;
    const newest = live[live.length - 1], k = easeOut(prog(t, newest.at, newest.at + push));
    ink.clip(r, () => {
      live.slice(-(rows + 1)).reverse().forEach((e, j) => {
        const y = r.y + r.h - size * 0.4 - (j - (1 - k)) * LH, a = alpha * (fade ? clamp(1 - (j - 1 + k) / rows) : 1) * (j === 0 ? clamp(k * 3) : 1);
        const n = e.typeOver ? Math.floor(clamp((t - e.at) / e.typeOver) * e.text.length) : e.text.length;
        if (a > 0.003) ink.text(prompt + e.text.slice(0, n), r.x, y, { size, font: 'mono', color: e.role ?? 'sub', weight: e.weight ?? 400, alpha: a });
      });
    });
  };
  IF.caret = (ink, x, y, cols, t, { size = 34, color = 'sub', blink = 0.5, alpha = 1 } = {}) => {
    if (blink > 0 && Math.floor(t / blink) % 2) return;
    const cw = ink.cw(size); ink.rect(x + cols * cw + 2, y - size * 0.82, cw * 0.82, size * 1.0, { fill: true, color, alpha });
  };
})();
