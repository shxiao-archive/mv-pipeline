/* mv-studio engine — stroke.js: single-stroke (pen-plotter / engraving) fonts, so a line can be WRITTEN by a moving point.
 *
 *   await Z.stroke.load(['script', 'sans'])   fonts from engine/fonts/stroke (README there: sans script serif readable allure)
 *   Z.stroke.layout(text, font, size, o)       -> st { strokes: [[[x, y], ...], ...], len (total pen path, px), width, at[k] }
 *                       size = CAP HEIGHT in px; baseline at y = 0, starting at x = 0 (o.align 'center' | 'right' moves it);
 *                       o.tracking (em). at[k] = the pen length where character k starts. Latin text only (no CJK glyphs).
 *   Z.stroke.draw(ctx, st, x, y, o)            draws the first o.len px of pen path (all if absent); returns the pen head
 *                       [x, y] (where the spark sits). o: { color, width 2, alpha, glow (px of shadow blur) }
 *   Z.stroke.at(st, len)                       the pen head after len px of path, relative to the layout origin
 *   Z.stroke.lenAt(st, i, t, o)                how much of lyric line i's text is written at t: each character is written
 *                       from its sung time (Z.charTimes, else spread like Z.charsAt), over at most o.per 0.3 s; o.lead 0.1 s
 *
 * The fonts have no kerning tables. shortcut: no optical kerning (To, AV leave a hole); set a title's pairs by eye, or add
 * pdoom-video's profile kerning if a film needs it.
 * mv-studio (MIT). After pdoom-video's stroke.ts (MIT, Giacomo Magnanini).
 */
(() => {
  'use strict';
  const Z = window.Z;
  const FILES = { sans: 'HersheySans1.svg', script: 'HersheyScript1.svg', serif: 'HersheySerifMed.svg', readable: 'EMSReadability.svg', allure: 'EMSAllure.svg' };
  const fonts = new Map();

  // SVG path d -> polylines (y up in font units): M L H V C Q Z, absolute and relative; curves flattened
  function parsePath(d) {
    const tok = d.match(/[MLHVCQZmlhvcqz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [], out = [];
    let cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = 'M', i = 0;
    const num = () => +tok[i++];
    while (i < tok.length) {
      if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
      if (C === 'Z') { if (cur) cur.push([sx, sy]); x = sx; y = sy; cur = null; continue; }
      if (C === 'M') { x = ox + num(); y = oy + num(); sx = x; sy = y; cur = [[x, y]]; out.push(cur); cmd = rel ? 'l' : 'L'; continue; }
      if (!cur) { cur = [[x, y]]; out.push(cur); }
      if (C === 'L') { x = ox + num(); y = oy + num(); cur.push([x, y]); }
      else if (C === 'H') { x = ox + num(); cur.push([x, y]); }
      else if (C === 'V') { y = (rel ? y : 0) + num(); cur.push([x, y]); }
      else if (C === 'C' || C === 'Q') {
        const p = C === 'C' ? [ox + num(), oy + num(), ox + num(), oy + num()] : [ox + num(), oy + num()], ex = ox + num(), ey = oy + num();
        for (let k = 1; k <= 8; k++) {
          const u = k / 8, v = 1 - u;
          cur.push(C === 'C' ? [v * v * v * x + 3 * v * v * u * p[0] + 3 * v * u * u * p[2] + u * u * u * ex, v * v * v * y + 3 * v * v * u * p[1] + 3 * v * u * u * p[3] + u * u * u * ey]
            : [v * v * x + 2 * v * u * p[0] + u * u * ex, v * v * y + 2 * v * u * p[1] + u * u * ey]);
        }
        x = ex; y = ey;
      } else i++;                                                           // unknown command: skip a number
    }
    return out.filter(s => s.length > 1);
  }
  function parseFont(txt) {
    const doc = new DOMParser().parseFromString(txt, 'image/svg+xml'), f = doc.querySelector('font'), defAdv = +(f.getAttribute('horiz-adv-x') || 500), glyphs = new Map();
    doc.querySelectorAll('glyph').forEach(g => { const u = g.getAttribute('unicode'); if (u != null) glyphs.set(u, { adv: +(g.getAttribute('horiz-adv-x') || defAdv), strokes: parsePath(g.getAttribute('d') || '') }); });
    let cap = 700; const H = glyphs.get('H'); if (H && H.strokes.length) cap = Math.max(...H.strokes.flat().map(p => p[1])) - Math.min(...H.strokes.flat().map(p => p[1]));
    const base = H && H.strokes.length ? Math.min(...H.strokes.flat().map(p => p[1])) : 0;
    return { glyphs, defAdv, cap, base };
  }
  const plen = s => { let l = 0; for (let k = 1; k < s.length; k++) l += Math.hypot(s[k][0] - s[k - 1][0], s[k][1] - s[k - 1][1]); return l; };

  Z.stroke = {
    FILES,
    async load(names = Object.keys(FILES)) {
      await Promise.all(names.filter(n => !fonts.has(n)).map(async n => {
        if (!FILES[n]) throw new Error('Z.stroke: no font ' + n + ' (have ' + Object.keys(FILES).join(' ') + ')');
        const r = await fetch('fonts/stroke/' + FILES[n]); if (!r.ok) throw new Error('Z.stroke: fonts/stroke/' + FILES[n] + ' ' + r.status);
        fonts.set(n, parseFont(await r.text()));
      }));
    },
    layout(text, font = 'sans', size = 60, { tracking = 0, align = 'left' } = {}) {
      const F = fonts.get(font); if (!F) throw new Error('Z.stroke: font ' + font + ' not loaded (await Z.stroke.load([...]) in the scene init)');
      const k = size / F.cap, strokes = [], at = [];
      let x = 0, len = 0;
      for (const ch of String(text)) {
        at.push(len);
        const g = F.glyphs.get(ch) || (ch === '’' ? F.glyphs.get("'") : ch === '“' || ch === '”' ? F.glyphs.get('"') : null);
        if (g) for (const s of g.strokes) { const p = s.map(([u, v]) => [x + u * k, -(v - F.base) * k]); strokes.push(p); len += plen(p); }
        x += (g ? g.adv : F.defAdv) * k + tracking * size;
      }
      const width = Math.max(0, x - tracking * size), dx = align === 'center' ? -width / 2 : align === 'right' ? -width : 0;
      if (dx) for (const s of strokes) for (const p of s) p[0] += dx;
      return { strokes, len, width, at, text: String(text) };
    },
    draw(ctx, st, x, y, { len = Infinity, color = '#EEE9DF', width = 2, alpha = 1, glow = 0 } = {}) {
      let left = len, head = null;
      ctx.save(); ctx.translate(x, y);
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha *= alpha;
      if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
      ctx.beginPath();
      for (const s of st.strokes) {
        if (left <= 0) break;
        ctx.moveTo(s[0][0], s[0][1]); head = s[0];
        for (let k = 1; k < s.length && left > 0; k++) {
          const d = Math.hypot(s[k][0] - s[k - 1][0], s[k][1] - s[k - 1][1]);
          if (d <= left) { ctx.lineTo(s[k][0], s[k][1]); head = s[k]; left -= d; }
          else { const u = left / d; head = [s[k - 1][0] + (s[k][0] - s[k - 1][0]) * u, s[k - 1][1] + (s[k][1] - s[k - 1][1]) * u]; ctx.lineTo(head[0], head[1]); left = 0; }
        }
      }
      ctx.stroke(); ctx.restore();
      return head ? [x + head[0], y + head[1]] : [x, y];
    },
    at(st, len) {                                                           // the pen head after len px of path (relative to the layout)
      let left = len, head = st.strokes.length ? st.strokes[0][0] : [0, 0];
      for (const s of st.strokes) for (let k = 1; k < s.length; k++) {
        const d = Math.hypot(s[k][0] - s[k - 1][0], s[k][1] - s[k - 1][1]);
        if (d >= left) { const u = d ? left / d : 0; return [s[k - 1][0] + (s[k][0] - s[k - 1][0]) * u, s[k - 1][1] + (s[k][1] - s[k - 1][1]) * u]; }
        left -= d; head = s[k];
      }
      return head;
    },
    lenAt(st, i, t, { lead = 0.1, per = 0.3 } = {}) {
      const L = Z.line(i), n = st.at.length; if (!n) return 0;
      let T = Z.charTimes ? Z.charTimes(i) : null;
      if (!T || T.length !== n) { const over = Math.min(0.6 * (L.end - L.t), 0.09 * n); T = Array.from({ length: n }, (_, k) => L.t + (over * k) / n); }
      let len = 0;
      for (let k = 0; k < n; k++) {
        const a = T[k] - lead, b = Math.min(k + 1 < n ? T[k + 1] - lead : a + per, a + per), end = k + 1 < n ? st.at[k + 1] : st.len;
        if (t < a) break;
        len = st.at[k] + (end - st.at[k]) * Z.clamp((t - a) / Math.max(1e-3, b - a));
      }
      return len;
    },
  };
})();
