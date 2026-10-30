/* styles/magazine — layout.js: the magazine's type and editorial furniture, drawn into the press layers (press.js).
 * Type and rules go into the INK layer I in a channel colour (MZ.ink(MZ.K | MZ.A | MZ.B, alpha)); pictures into the
 * PROOF layer P. Scene coordinates 1920x1080.
 *
 * type
 *   MZ.FONT                         { min (Shippori Mincho B1), goth (Zen Kaku Gothic New), dela (Dela Gothic One),
 *                                     serif (Cormorant Garamond: italic glosses), mono (IBM Plex Mono) }
 *   MZ.text(c, s, x, y, o)          horizontal: { font, color, align, base, tracking, alpha, rot }; returns the width
 *   MZ.vtext(c, s, x, y, size, o)   vertical Japanese (x = column centre, y = top): small kana and 、。 set in the corner,
 *                                   long marks / brackets / Latin turned; { weight 800, fam, color, gap .05, reveal n
 *                                   (float: the last character fades), pop (a character grows in as it appears) };
 *                                   returns the height
 *   MZ.vheight(s, size, gap)        the height vtext will take
 *   MZ.vruby(c, reading, x, y, baseLen, size, o)   ruby beside a vertical run (for your own words: titles, stamps)
 *   MZ.lyricV(c, i, t, x, y, size, o)   lyric line i set vertically, revealed as sung (Z.charsAt: per character when
 *                                   analysis/lyric_timing.json has character times); o as vtext + { lead }
 *   MZ.lyricH(c, i, t, x, y, size, o)   the same, horizontal (x = left, y = baseline; o.align 'center')
 * furniture (each a quiet, exact mark; the sung word is the only big thing on the page)
 *   MZ.folio(c, t, o)               page number = bar number (Z.clock.meter) + a running head: { side, head, y, color }
 *   MZ.caption(c, lines, x, y, o)   mono caption block;  MZ.gloss(c, s, x, y, o): an italic serif gloss (your words)
 *   MZ.fig(c, n, x, y, tx, ty, label, o)   "fig. n — label" with a leader line to (tx, ty)
 *   MZ.cropMarks(c, x, y, w, h, o)  Japanese double trim marks (トンボ);  MZ.regMark(c, x, y, r, o)
 *   MZ.proofCircle(c, cx, cy, rx, ry, seed, p, o)   a proofreader's hand-drawn ring, drawn as p goes 0..1
 *   MZ.strike(c, x0, y0, x1, y1, p, o)   a deletion stroke + トル in the margin (o.mark: your own mark)
 *   MZ.genko(c, x, y, cols, rows, cell, o)   manuscript squares;  MZ.grid(c, x, y, w, h, cols, rows, o)
 *   MZ.barcode(c, x, y, w, h, digits12, o)   a real EAN-13 (o.reveal 0..1)
 *   MZ.meterGlyph(c, meter, x, y, size, o)   a time signature as stacked numerals
 *   MZ.ruler(c, t, x, y, w, o)      a 16th ruler that runs with the music: bar lines with their metre, group starts, a
 *                                   playhead; past ticks solid, coming ones faint; { span 32, lead 8, color }
 *   MZ.gauge(c, x, y0, y1, v0, v1, value, o)   a measuring column (height, depth, temperature...) up to value
 * proof layer
 *   MZ.photo(c, src, x, y, w, h, o) an image (path or canvas) covering the rect: { crop [sx, sy, sw, sh] (0..1), fx, fy
 *                                   focal point, zoom, rot, alpha, flipX, filter, contain }
 *   MZ.tint(c, color, x, y, w, h, a)   a flat screened tint block (multiply)
 * paths
 *   MZ.dropPath(c, cx, cy, r, seed, spikes)   an ink drop / burn hole;  MZ.tornPath(c, x0, x1, y, amp, seed, down)
 *
 * mv-studio (MIT). After he-drowns-mv-v2's js/draw.js and js/scenes/common.js (longruizhi2-beep, MIT).
 */
(() => {
  'use strict';
  const Z = window.Z, MZ = (Z.MZ = Z.MZ || {}), W = 1920, H = 1080, TAU = Math.PI * 2;
  const clamp = Z.clamp, lerp = Z.lerp, E = Z.ease;
  const K = () => MZ.ink(MZ.K), A = () => MZ.ink(MZ.A);

  MZ.FONT = { min: '"Shippori Mincho B1"', goth: '"Zen Kaku Gothic New"', dela: '"Dela Gothic One"', serif: '"Cormorant Garamond"', mono: '"IBM Plex Mono"' };
  const FALL = ', "Shippori Mincho B1", "Noto Serif JP", serif';
  MZ.fontsToLoad = ['800 40px "Shippori Mincho B1"', '500 40px "Shippori Mincho B1"', '900 40px "Zen Kaku Gothic New"', '400 40px "Zen Kaku Gothic New"',
    '400 40px "Dela Gothic One"', 'italic 400 40px "Cormorant Garamond"', '400 40px "IBM Plex Mono"', '500 40px "IBM Plex Mono"'];
  MZ.fontsReady = null;
  MZ.loadFonts = () => MZ.fontsReady || (MZ.fontsReady = Promise.all(MZ.fontsToLoad.map(f => document.fonts.load(f, 'Aa0あ一'))));

  // ---------------------------------------------------------------- type
  const SMALL = 'ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ', PUNCT = '、。，．', TURN = 'ー〜～…‥―－-「」『』（）()［］[]【】〈〉《》';
  const isCJK = ch => /[　-鿿＀-￯]/.test(ch);

  MZ.text = (c, s, x, y, o = {}) => {
    c.save();
    c.font = o.font || `400 16px ${MZ.FONT.mono}`;
    c.fillStyle = o.color || K(); c.textAlign = o.align || 'left'; c.textBaseline = o.base || 'alphabetic';
    if (o.tracking) c.letterSpacing = o.tracking + 'px';
    if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
    if (o.rot) { c.translate(x, y); c.rotate(o.rot); x = 0; y = 0; }
    c.fillText(s, x, y);
    const w = c.measureText(s).width;
    c.restore();
    return w;
  };
  MZ.vtext = (c, s, x, y, size, o = {}) => {
    const chars = [...s], step = size * (1 + (o.gap ?? 0.05)), rev = o.reveal ?? chars.length;
    c.save();
    c.font = o.font || `${o.weight ?? 800} ${size}px ${o.fam || MZ.FONT.min}${FALL}`;
    c.fillStyle = o.color || K(); c.textAlign = 'center'; c.textBaseline = 'middle';
    if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
    let cy = y + size / 2;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i], vis = clamp(rev - i);
      if (vis <= 0) break;
      c.save();
      c.globalAlpha *= vis;
      let dx = 0, dy = 0;
      if (PUNCT.includes(ch)) { dx += size * 0.55; dy -= size * 0.55; } else if (SMALL.includes(ch)) { dx += size * 0.1; dy -= size * 0.1; }
      c.translate(x + dx, cy + dy);
      if (TURN.includes(ch) || (!isCJK(ch) && ch !== ' ')) c.rotate(Math.PI / 2);
      if (o.pop) { const k = 1 + (1 - E.outCubic(vis)) * 0.35; c.scale(k, k); }
      c.fillText(ch, 0, size * 0.04);
      c.restore();
      cy += PUNCT.includes(ch) ? step * 0.55 : step;
    }
    c.restore();
    return cy - size / 2 - y;
  };
  MZ.vheight = (s, size, gap = 0.05) => { let h = 0; for (const ch of s) h += PUNCT.includes(ch) ? size * (1 + gap) * 0.55 : size * (1 + gap); return h; };
  MZ.vruby = (c, reading, x, y, baseLen, size, o = {}) => {
    const rs = size * 0.36, n = [...reading].length, span = baseLen * size * (1 + (o.gap ?? 0.05)), step = Math.min(rs * 1.05, span / n), top = y + (span - step * n) / 2;
    c.save();
    c.font = `500 ${rs}px ${MZ.FONT.min}${FALL}`; c.fillStyle = o.color || K(); c.textAlign = 'center'; c.textBaseline = 'middle';
    if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
    [...reading].forEach((ch, i) => { const sm = SMALL.includes(ch); c.fillText(ch, x + size * 0.5 + rs * 0.62 + (sm ? rs * 0.1 : 0), top + step * (i + 0.5) - (sm ? rs * 0.1 : 0)); });
    c.restore();
  };
  // a lyric line, revealed as sung: the reveal is a float so the newest character fades / pops in over ~70 ms
  const reveal = (i, t, o) => {
    const L = Z.line(i), lead = o.lead ?? 0.05, ct = Z.charTimes(i);
    if (ct) { let n = 0; for (const s of ct) { if (s - lead > t) break; n++; } const last = ct[n - 1]; return n ? n - 1 + clamp((t - (last - lead)) / 0.07) : 0; }
    const n = Z.charsAt(i, t, { lead }), len = [...L.text].length;
    return n >= len ? len : n ? n - 1 + clamp(((t - L.t + lead) % 0.09) / 0.07) : 0;
  };
  MZ.lyricV = (c, i, t, x, y, size, o = {}) => MZ.vtext(c, Z.line(i).text, x, y, size, Object.assign({ pop: true }, o, { reveal: o.reveal ?? reveal(i, t, o) }));
  MZ.lyricH = (c, i, t, x, y, size, o = {}) => {
    const chars = [...Z.line(i).text], n = o.reveal ?? reveal(i, t, o), track = (o.track ?? 0.02) * size;
    c.save();
    c.font = `${o.weight ?? 800} ${size}px ${o.fam || MZ.FONT.min}${FALL}`; c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.fillStyle = o.color || K();
    if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
    const ws = chars.map(ch => c.measureText(ch).width), total = ws.reduce((a, b) => a + b + track, -track);
    let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    chars.forEach((ch, k) => {
      const vis = clamp(n - k);
      if (vis > 0) { c.save(); c.globalAlpha *= vis; const s = o.pop === false ? 1 : 1 + (1 - E.outCubic(vis)) * 0.3; c.translate(cx + ws[k] / 2, y - size * 0.35); c.scale(s, s); c.fillText(ch, -ws[k] / 2, size * 0.35); c.restore(); }
      cx += ws[k] + track;
    });
    c.restore();
    return total;
  };

  // ---------------------------------------------------------------- furniture
  const stroke = (c, col, lw, f) => { c.save(); c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); f(); c.stroke(); c.restore(); };
  MZ.line = (c, x1, y1, x2, y2, lw = 1, col = K()) => stroke(c, col, lw, () => { c.moveTo(x1, y1); c.lineTo(x2, y2); });
  MZ.folio = (c, t, o = {}) => {
    const m = Z.clock ? Z.clock.meter(t) : { bar: 0 }, col = o.color || K(), y = o.y ?? 1040, left = o.side !== 'right', fx = left ? 60 : W - 60;
    MZ.text(c, String(Math.max(0, m.bar + 1)).padStart(3, '0'), fx, y, { font: `500 15px ${MZ.FONT.mono}`, color: col, align: left ? 'left' : 'right' });
    if (o.head) MZ.text(c, o.head, left ? fx + 52 : fx - 52, y, { font: `400 13px ${MZ.FONT.mono}`, color: col, align: left ? 'left' : 'right', tracking: 1.5 });
  };
  MZ.caption = (c, lines, x, y, o = {}) => { const size = o.size ?? 14, lh = size * (o.lh ?? 1.45); lines.forEach((s, i) => MZ.text(c, s, x, y + i * lh, { font: o.font || `400 ${size}px ${MZ.FONT.mono}`, color: o.color, align: o.align, alpha: o.alpha })); };
  MZ.gloss = (c, s, x, y, o = {}) => MZ.text(c, s, x, y, { font: `italic 400 ${o.size ?? 28}px ${MZ.FONT.serif}`, color: o.color, align: o.align, alpha: o.alpha });
  MZ.fig = (c, n, x, y, tx, ty, label, o = {}) => {
    const col = o.color || K(), p = o.p ?? 1;
    MZ.line(c, x, y, lerp(x, tx, p), lerp(y, ty, p), 1, col);
    if (p >= 1) { c.save(); c.fillStyle = col; c.beginPath(); c.arc(tx, ty, 3, 0, TAU); c.fill(); c.restore(); }
    MZ.text(c, `fig.${n} — ${label}`, x + (tx < x ? 8 : -8), y - 8, { font: `400 ${o.size ?? 14}px ${MZ.FONT.mono}`, color: col, align: tx < x ? 'left' : 'right' });
  };
  MZ.cropMarks = (c, x, y, w, h, o = {}) => {
    const len = o.len ?? 28, gap = o.gap ?? 10;
    stroke(c, o.color || K(), o.lw ?? 1, () => {
      for (const [cx, cy, sx, sy] of [[x, y, -1, -1], [x + w, y, 1, -1], [x, y + h, -1, 1], [x + w, y + h, 1, 1]]) {
        c.moveTo(cx + sx * gap, cy); c.lineTo(cx + sx * (gap + len), cy); c.moveTo(cx, cy + sy * gap); c.lineTo(cx, cy + sy * (gap + len));
        c.moveTo(cx + sx * gap, cy + sy * 9); c.lineTo(cx + sx * (gap + len), cy + sy * 9); c.moveTo(cx + sx * 9, cy + sy * gap); c.lineTo(cx + sx * 9, cy + sy * (gap + len));
      }
    });
  };
  MZ.regMark = (c, x, y, r = 14, o = {}) => {
    const col = o.color || K();
    stroke(c, col, o.lw ?? 1, () => { c.arc(x, y, r * 0.62, 0, TAU); c.moveTo(x - r, y); c.lineTo(x + r, y); c.moveTo(x, y - r); c.lineTo(x, y + r); });
    c.save(); c.fillStyle = col; c.beginPath(); c.arc(x, y, r * 0.3, 0, TAU); c.fill(); c.restore();
  };
  MZ.proofCircle = (c, cx, cy, rx, ry, seed, p = 1, o = {}) => {
    const n = 90, a0 = Z.rnd(seed, 1) * TAU, steps = Math.max(2, Math.floor(n * clamp(p)));
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    stroke(c, o.color || A(), o.lw ?? 3, () => {
      for (let i = 0; i <= steps; i++) {
        const u = i / n, a = a0 + u * TAU * 1.12, wob = 1 + (Z.noise1(u * 5, seed) - 0.5) * 0.14 + u * 0.06;
        const x = cx + Math.cos(a) * rx * wob, y = cy + Math.sin(a) * ry * wob;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
    });
    c.restore();
  };
  MZ.strike = (c, x0, y0, x1, y1, p = 1, o = {}) => {
    const col = o.color || A(), q = E.outCubic(clamp(p));
    MZ.line(c, x0, y0, lerp(x0, x1, q), lerp(y0, y1, q), o.lw ?? 3, col);
    if (p >= 1 && o.mark !== false) MZ.text(c, o.mark || 'トル', x1 + 14, y1 + 8, { font: `400 ${o.size ?? 22}px ${MZ.FONT.min}`, color: col });
  };
  MZ.genko = (c, x, y, cols, rows, cell, o = {}) => {
    stroke(c, o.color || MZ.ink(MZ.A, 0.55), o.lw ?? 1, () => {
      for (let k = 0; k < cols; k++) {
        const cx = x - k * cell * 1.25;
        c.rect(cx - cell, y, cell, rows * cell);
        for (let r = 1; r < rows; r++) { c.moveTo(cx - cell, y + r * cell); c.lineTo(cx, y + r * cell); }
      }
    });
  };
  MZ.grid = (c, x, y, w, h, cols, rows, o = {}) => stroke(c, o.color || MZ.ink(MZ.K, 0.35), o.lw ?? 1, () => {
    for (let i = 0; i <= cols; i++) { const xx = Math.round(x + (w * i) / cols) + 0.5; c.moveTo(xx, y); c.lineTo(xx, y + h); }
    for (let j = 0; j <= rows; j++) { const yy = Math.round(y + (h * j) / rows) + 0.5; c.moveTo(x, yy); c.lineTo(x + w, yy); }
  });
  const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
  const EAN_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
  const EAN_P = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
  MZ.ean13 = digits12 => {
    const d = String(digits12).padStart(12, '0').slice(0, 12).split('').map(Number);
    d.push((10 - (d.reduce((s, v, i) => s + v * (i % 2 ? 3 : 1), 0) % 10)) % 10);
    let bits = '101';
    for (let i = 1; i <= 6; i++) bits += (EAN_P[d[0]][i - 1] === 'L' ? EAN_L : EAN_G)[d[i]];
    bits += '01010';
    for (let i = 7; i <= 12; i++) bits += EAN_R[d[i]];
    return { bits: bits + '101', digits: d.join('') };
  };
  MZ.barcode = (c, x, y, w, h, digits12, o = {}) => {
    const { bits, digits } = MZ.ean13(digits12), m = w / (bits.length + 14), n = Math.floor(bits.length * (o.reveal ?? 1));
    c.save(); c.fillStyle = o.color || K();
    for (let i = 0; i < n; i++) if (bits[i] === '1') { const guard = i < 3 || (i >= 45 && i < 50) || i >= 92; c.fillRect(x + (i + 7) * m, y, m + 0.2, h - (guard ? 0 : m * 5)); }
    if ((o.reveal ?? 1) >= 1) { c.font = `500 ${m * 7}px ${MZ.FONT.mono}`; c.fillText(digits[0], x + m, y + h + m); c.fillText(digits.slice(1, 7), x + 10 * m, y + h + m); c.fillText(digits.slice(7), x + 56 * m, y + h + m); }
    c.restore();
  };
  MZ.meterGlyph = (c, meter, x, y, size, o = {}) => {
    if (!meter || !meter.includes('/')) return;
    const [a, b] = meter.split('/');
    c.save(); c.fillStyle = o.color || K(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `600 ${size}px ${o.fam || MZ.FONT.serif}, serif`;
    c.fillText(a, x, y - size * 0.4); c.fillText(b, x, y + size * 0.4); c.restore();
  };
  MZ.ruler = (c, t, x, y, w, o = {}) => {
    if (!Z.clock) return;
    const col = o.color || K(), span = o.span ?? 32, lead = o.lead ?? 8, m = Z.clock.meter(t), tat = m.tatum;
    c.save(); c.fillStyle = col;
    for (let j = -lead; j < span - lead; j++) {
      const tj = t + (j - (m.q % 1)) * tat, mj = Z.clock.meter(tj + 1e-4), onBar = Math.round(mj.q) % Math.max(1, mj.len) === 0 && mj.bar >= 0;
      let s = 0, onGroup = false; for (const g of mj.groups) { if (Math.abs(mj.q - s) < 0.5) onGroup = true; s += g; }
      const xx = x + ((j + lead - (m.q % 1)) / span) * w, h = onBar ? 22 : onGroup ? 13 : Math.round(mj.q) % 2 === 0 ? 8 : 5;
      c.globalAlpha = j <= 0 ? 1 : 0.4;
      c.fillRect(Math.round(xx), y - h, onBar ? 2 : 1, h);
      if (onBar) { c.font = `500 11px ${MZ.FONT.mono}`; c.fillText(mj.meter, xx + 4, y - 12); }
    }
    c.globalAlpha = 1; c.fillRect(x + (lead / span) * w - 1, y + 4, 3, 6);
    c.restore();
  };
  MZ.gauge = (c, x, y0, y1, v0, v1, value, o = {}) => {
    const col = o.color || K(), colA = o.accent || A(), step = o.step ?? 1, every = Math.max(1, Math.round((o.lab ?? 2) / step)), n = Math.round((v1 - v0) / step);
    MZ.line(c, x, y0, x, y1, 1.5, col);
    for (let i = 0; i <= n; i++) {
      const v = v0 + i * step, y = lerp(y0, y1, i / n), major = i % every === 0;
      MZ.line(c, x - (major ? 22 : 10), y, x, y, major ? 2 : 1, col);
      if (major) MZ.text(c, o.fmt ? o.fmt(v) : String(v), x - 30, y + 5, { font: `500 14px ${MZ.FONT.mono}`, color: col, align: 'right' });
    }
    const vy = lerp(y0, y1, clamp((value - v0) / (v1 - v0)));
    c.save(); c.fillStyle = colA; c.fillRect(x - 3, Math.min(vy, y0), 6, Math.abs(y0 - vy));
    c.beginPath(); c.moveTo(x + 6, vy); c.lineTo(x + 24, vy - 10); c.lineTo(x + 24, vy + 10); c.closePath(); c.fill(); c.restore();
    if (o.label) MZ.text(c, o.label, x + 24, y1 - 26, { font: `500 13px ${MZ.FONT.mono}`, color: col, align: 'right' });
    if (o.readout) MZ.text(c, o.readout, x - 34, vy - 16, { font: `500 20px ${MZ.FONT.mono}`, color: colA, align: 'right' });
  };

  // ---------------------------------------------------------------- proof layer
  MZ.photo = (c, src, x, y, w, h, o = {}) => {
    const im = typeof src === 'string' ? Z.imgSync(src) : src;
    if (!im) return;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    const [sx, sy, sw, sh] = o.crop ? [o.crop[0] * iw, o.crop[1] * ih, o.crop[2] * iw, o.crop[3] * ih] : [0, 0, iw, ih];
    c.save();
    if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
    if (o.filter) c.filter = o.filter;
    let dx = x, dy = y, dw = w, dh = h, cx = sx, cy = sy, cw = sw, ch = sh;
    if (o.contain) { const s = Math.min(w / sw, h / sh); dw = sw * s; dh = sh * s; dx = x + (w - dw) / 2; dy = y + (h - dh) / 2; }
    else {
      const ra = w / h; if (sw / sh < ra) { cw = sw; ch = sw / ra; } else { ch = sh; cw = sh * ra; }
      cw /= o.zoom ?? 1; ch /= o.zoom ?? 1;
      cx = clamp(sx + (o.fx ?? 0.5) * sw - cw / 2, sx, sx + sw - cw); cy = clamp(sy + (o.fy ?? 0.5) * sh - ch / 2, sy, sy + sh - ch);
    }
    if (o.rot || o.flipX) { c.translate(dx + dw / 2, dy + dh / 2); if (o.rot) c.rotate(o.rot); if (o.flipX) c.scale(-1, 1); dx = -dw / 2; dy = -dh / 2; }
    c.drawImage(im, cx, cy, cw, ch, dx, dy, dw, dh);
    c.restore();
  };
  MZ.tint = (c, color, x, y, w, h, a = 1) => { c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = a; c.fillStyle = color; c.fillRect(x, y, w, h); c.restore(); };

  // ---------------------------------------------------------------- paths
  MZ.dropPath = (c, cx, cy, r, seed, spikes = 0) => {
    c.beginPath();
    for (let i = 0, n = 72; i <= n; i++) {
      const a = (i / n) * TAU;
      let rr = r * (1 + (Z.noise1(i / n * 6, seed) - 0.5) * 0.18);
      if (spikes) rr += r * spikes * Math.max(0, Z.noise1(i / n * 23, seed + 3) - 0.62) * 2.2;
      i ? c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : c.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    c.closePath();
  };
  MZ.tornPath = (c, x0, x1, y, amp, seed, down = true) => {
    c.beginPath(); c.moveTo(x0, down ? y + 2000 : y - 2000);
    const n = Math.max(8, Math.floor((x1 - x0) / 9));
    for (let i = 0; i <= n; i++) c.lineTo(lerp(x0, x1, i / n), y + (Z.noise1(i * 0.37, seed) - 0.5) * amp + (Z.rnd(i, seed) - 0.5) * amp * 0.35);
    c.lineTo(x1, down ? y + 2000 : y - 2000); c.closePath();
  };
})();
