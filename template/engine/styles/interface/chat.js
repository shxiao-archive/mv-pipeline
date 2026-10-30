/* styles/interface — chat.js: a chat client drawn in code (no screenshots), the stage of an "interface" film.
 * Every function is a pure function of its arguments, in 1920x1080 px, coloured by ROLE through an Ink (ink.js).
 *
 *   IF.chatLayout({ win, side, drawer })    rectangles: win, main, head, thread, composer, side, drawer
 *   IF.room(ink, o)                         the wall behind the window (never black: lit, dot grid, faint rings)
 *   IF.windowFrame(ink, L, o)               page + sidebar surfaces, hairlines, soft shadow; k = opening 0..1
 *   IF.sidebar / IF.header / IF.composer    chrome (composer returns { caret, send, box } anchors)
 *   IF.drawThread(ink, rect, msgs, t, o)    the conversation; returns laid-out messages (x, y, w, h) for cursor / camera
 *   IF.toggle / segmented / slider / settingRow / drawer / pill / toast / card / iconButton / presence / skeleton
 *   IF.mark(ink, x, y, r, o)                the speaker's avatar mark;  IF.thinking(...) its "thinking" pulse
 *   IF.cursorAt(way, t) / IF.pointer / IF.drawCursor(ink, way, t, o)   the user's pointer (the only body "you" has)
 *
 * A message: { who: 'me' | 'you' | 'sys', text, at, n (chars typed so far), hot (keyword: bigger), tone ('err'),
 *              status ('sent' | 'sending' | 'failed'), time / note (label under it), thinking, typing, ghost 0..1, outAt }
 * Type roles are fixed: serif = the speaker ("me"), sans = the interface and the user, mono = the system.
 *
 * Ported and adapted from world-execute-me-lyric-mv (src/components/chat.js, cursor.js, motif.js; MIT, (c) 2026
 * Nyankomint). The product branding of the original is removed: the window has no brand unless the film gives one,
 * and the avatar mark is a plain disc (do not imitate a real product's logo or UI).
 */
(() => {
  'use strict';
  const Z = window.Z, IF = (Z.IF = Z.IF || {});
  const clamp = Z.clamp, lerp = Z.lerp, easeOut = Z.ease.outCubic, easeInOut = Z.ease.inOutCubic, easeBack = Z.ease.outBack;
  const prog = (t, a, b) => Z.inv(a, b, t);

  const WIN = (IF.WIN = { x: 110, y: 66, w: 1700, h: 948, r: 26 });
  const DRAWER_W = (IF.DRAWER_W = 440), SIDE_W = 292, HEAD_H = 66;

  IF.chatLayout = ({ win = WIN, side = 1, drawer = 0 } = {}) => {
    const sw = SIDE_W * side, dw = DRAWER_W * drawer;
    const main = { x: win.x + sw, y: win.y, w: win.w - sw - dw, h: win.h };
    const head = { x: main.x, y: main.y, w: main.w, h: HEAD_H };
    const cw = Math.min(940, main.w - 120);
    const composer = { x: main.x + (main.w - cw) / 2, y: win.y + win.h - 34 - 118, w: cw, h: 118 };
    const thread = { x: composer.x + 8, y: head.y + head.h + 18, w: cw - 16, h: composer.y - (head.y + head.h) - 40 };
    return { win, main, head, composer, thread, side: { x: win.x, y: win.y, w: sw, h: win.h }, drawer: { x: win.x + win.w - dw, y: win.y, w: dw, h: win.h } };
  };

  // ---------------------------------------------------------------- motifs
  IF.mark = (ink, x, y, r, { color = 'me', alpha = 1, pulse = 0, lit = 1 } = {}) => {
    if (alpha <= 0.003) return;
    const s = 1 + 0.12 * pulse;
    ink.circle(x, y, r * 0.58 * s, { fill: true, color, alpha: alpha * (0.35 + 0.65 * lit) });
    ink.circle(x, y, r * s, { color, alpha: alpha * 0.8, width: Math.max(1.5, r * 0.12) });
  };
  IF.thinking = (ink, cx, cy, r, t, { color = 'me', alpha = 1, speed = 1, stuck = 0 } = {}) => {
    const q = 12 - 9 * clamp(stuck), tt = stuck > 0 ? Math.floor(t * q) / q : t;   // stuck: the pulse stalls and stutters
    for (let i = 0; i < 3; i++) {
      const k = 0.5 + 0.5 * Math.sin(tt * 7 * speed - i * 0.9);
      ink.circle(cx + i * r * 0.9, cy - 4 * k, r * 0.22 * (0.8 + 0.4 * k), { fill: true, color, alpha: alpha * (0.45 + 0.55 * k) });
    }
  };
  IF.burst = (ink, x, y, r, k, { color = 'text', alpha = 1 } = {}) => {        // a click: a ring that opens and fades
    if (k >= 1) return; const e = easeOut(clamp(k));
    ink.circle(x, y, r * (0.3 + 0.7 * e), { color, alpha: alpha * (1 - e), width: 3 * (1 - e) + 1 });
  };

  // ---------------------------------------------------------------- backdrop + window
  const BLEED = { x: -1500, y: -1000, w: 4920, h: 3080 };
  // backdrop: an optional picture of the place the conversation happens in (a room, a street, a sea), blurred and
  // drifting with parallax behind the window — the textured, moving layer a dark UI needs (and through `glass` < 1 it
  // shows faintly through the window too). Cached as a small canvas: drawing it scaled up is the blur.
  const blurCache = new Map();
  const blurred = (img, path, px) => { const k = path + px; let c = blurCache.get(k); if (c) return c; const w = Math.max(16, Math.round(img.width / px)), h = Math.max(9, Math.round(img.height / px)); c = Z.canvas(w, h); c.getContext('2d').drawImage(img, 0, 0, w, h); blurCache.set(k, c); return c; };
  IF.room = (ink, { light = [960, 420], dim = 0.5, rings = 1, t = 0, backdrop = null } = {}) => {
    ink.rect(BLEED.x, BLEED.y, BLEED.w, BLEED.h, { fill: true, color: 'panel' });
    if (backdrop) {
      const bd = typeof backdrop === 'string' ? { img: backdrop } : backdrop, img = Z.imgSync(bd.img);
      if (img) {
        const g = ink.g, c = blurred(img, bd.img, bd.blur ?? 24), W2 = 2400, H2 = W2 * img.height / img.width;
        const dx = -240 + (bd.drift ?? 0) * Math.sin(t * 0.11) - ((bd.pan ?? 0) * t) % W2, dy = -160 + 0.75 * (bd.drift ?? 0) * Math.sin(t * 0.07);   // still unless the place moves
        g.save(); g.globalAlpha *= bd.alpha ?? 0.55; g.imageSmoothingEnabled = true; g.drawImage(c, dx - 240, dy, W2, H2); g.drawImage(c, dx - 240 + W2, dy, W2, H2); g.restore();
      }
    }
    ink.radial(light[0], light[1], 1300, 'raised', backdrop ? 0.5 : 0.95);       // a pool of light so the wall has depth
    ink.radial(light[0], light[1], 520, 'line', 0.35);
    if (rings > 0) for (let i = 0; i < 3; i++) ink.circle(1640, 180, 260 + i * 150 + 6 * Math.sin(t * 0.4 + i), { color: 'raised', alpha: 0.35 * rings, width: 2 });
    ink.gradRect(BLEED.x, BLEED.y, BLEED.w, BLEED.h, [[0, 'panel', dim * 0.85], [0.5, 'panel', dim * 0.2], [1, 'panel', dim]]);
    const g = ink.g; g.fillStyle = ink.col('line', 0.55);                         // faint dot grid: a surface, not a void
    for (let y = -30; y < 1140; y += 60) for (let x = 30; x < 1920; x += 60) g.fillRect(x, y, 2, 2);
  };
  IF.windowFrame = (ink, L, { k = 1, alpha = 1, shadow = 1, sideTint = 'panel', glass = 1, stroke = 'line' } = {}) => {
    if (k <= 0 || alpha <= 0.003) return;
    const { win, side, drawer } = L, s = k >= 1 ? 1 : 0.9 + 0.1 * easeOut(k);
    ink.at(win.x + win.w / 2, win.y + win.h / 2, () => {
      const x = -win.w / 2, y = -win.h / 2;
      ink.rrect(x, y, win.w, win.h, win.r, { fill: 'bg', fillAlpha: glass, stroke, shadow, width: 1.5 });
      ink.clip({ x, y, w: win.w, h: win.h }, () => {
        if (side.w > 1) { ink.rect(x, y, side.w, win.h, { fill: true, color: sideTint, alpha: 0.5 + 0.5 * glass }); ink.line(x + side.w, y, x + side.w, y + win.h, { color: 'line', width: 1.5 }); }
        if (drawer.w > 1) { ink.rect(x + win.w - drawer.w, y, drawer.w, win.h, { fill: true, color: 'panel' }); ink.line(x + win.w - drawer.w, y, x + win.w - drawer.w, y + win.h, { color: 'line', width: 1.5 }); }
      }, win.r);
    }, { scale: s, alpha: alpha * clamp(k * 3) });
  };
  IF.skeleton = (ink, x, y, w, h, t, { alpha = 1, r = h / 2, seed = 0 } = {}) => {
    ink.rrect(x, y, w, h, r, { fill: 'raised', alpha });
    const ph = ((t * 0.55 + seed * 0.17) % 1) * (w + 160) - 80;
    ink.clip({ x, y, w, h }, () => ink.gradRect(x + ph - 80, y, 160, h, [[0, 'line', 0], [0.5, 'line', 0.9 * alpha], [1, 'line', 0]], 'h'), r);
  };
  IF.presence = (ink, x, y, state, { alpha = 1, size = 17, label = true } = {}) => {
    if (alpha <= 0.003) return;
    if (state === 'online') ink.glow('text', 10, () => ink.circle(x, y, 5.5, { fill: true, color: 'text', alpha }), 0.5 * alpha);
    else if (state === 'away') { ink.circle(x, y, 5.5, { color: 'sub', alpha, width: 2 }); ink.circle(x, y, 5.5, { fill: true, color: 'sub', alpha, a0: Math.PI / 2, a1: Math.PI * 1.5 }); }
    else ink.circle(x, y, 5.5, { color: 'mute', alpha, width: 2 });
    if (label) ink.text(state, x + 14, y + size * 0.34, { size, weight: 500, color: state === 'online' ? 'text' : state === 'away' ? 'sub' : 'mute', alpha });
  };
  IF.sidebar = (ink, L, { k = 1, loaded = 1, items = [], active = -1, t = 0, lit = 1, user = 'you', presence: pres = null, brand = '' } = {}) => {
    const s = L.side;
    if (s.w < 40 || k <= 0) return;
    ink.clip(s, () => {
      const x = s.x + 22, a0 = clamp(k * 6);
      IF.mark(ink, x + 15, s.y + 34, 13, { lit, alpha: a0 });
      if (brand) ink.text(brand, x + 40, s.y + 43, { size: 25, weight: 600, font: 'serif', color: 'text', alpha: a0 * loaded });
      if (loaded < 1) IF.skeleton(ink, x + 40, s.y + 24, 96, 20, t, { alpha: a0 * (1 - loaded) });
      const a1 = clamp(k * 6 - 0.6);
      ink.rrect(x - 6, s.y + 76, s.w - 32, 46, 12, { fill: 'raised', stroke: 'line', alpha: a1 });
      ink.line(x + 12, s.y + 99, x + 28, s.y + 99, { color: 'sub', alpha: a1, width: 2 }); ink.line(x + 20, s.y + 91, x + 20, s.y + 107, { color: 'sub', alpha: a1, width: 2 });
      ink.text('New chat', x + 44, s.y + 107, { size: 20, weight: 500, color: 'text', alpha: a1 * loaded });
      ink.text('Recents', x, s.y + 164, { size: 16, weight: 600, color: 'mute', alpha: a1 * loaded, spacing: 0.6 });
      items.forEach((label, i) => {
        const ai = clamp(k * (items.length + 4) - 2 - i), y = s.y + 184 + i * 44;
        if (ai <= 0) return;
        const dx = (1 - easeOut(ai)) * -18;
        if (i === active) ink.rrect(x - 6 + dx, y, s.w - 32, 38, 10, { fill: 'raised', alpha: ai * loaded });
        if (loaded < 1) IF.skeleton(ink, x + 6 + dx, y + 11, 120 + ((i * 53) % 90), 16, t, { alpha: ai * (1 - loaded), seed: i });
        let str = label; const maxW = s.w - 60;
        while (str.length > 3 && ink.measure(str, { size: 19 }) > maxW) str = str.slice(0, -2);
        if (str !== label) str = str.trimEnd() + '…';
        ink.text(str, x + 6 + dx, y + 26, { size: 19, color: i === active ? 'text' : 'sub', alpha: ai * loaded });
      });
      const a2 = clamp(k * 6 - 4.5), yb = s.y + s.h - 62;
      ink.line(s.x, yb - 10, s.x + s.w, yb - 10, { color: 'line', alpha: a2, width: 1.5 });
      ink.circle(x + 16, yb + 20, 16, { fill: true, color: 'raised', alpha: a2 });
      ink.text(user[0].toUpperCase(), x + 16, yb + 27, { size: 18, weight: 600, align: 'center', color: 'text', alpha: a2 * loaded });
      ink.text(user, x + 44, yb + 27, { size: 19, weight: 500, color: 'text', alpha: a2 * loaded });
      if (pres) IF.presence(ink, s.x + s.w - 108, yb + 20, pres, { alpha: a2 * loaded, size: 15 });
    });
  };
  IF.header = (ink, L, { title = '', k = 1, presence: pres = null, t = 0, loaded = 1, sub = null } = {}) => {
    const h = L.head, a = clamp(k * 3);
    if (a <= 0) return;
    ink.line(h.x, h.y + h.h, h.x + h.w, h.y + h.h, { color: 'line', alpha: a, width: 1.5 });
    if (loaded < 1) IF.skeleton(ink, h.x + 30, h.y + 24, 220, 18, t, { alpha: a * (1 - loaded) });
    ink.text(title, h.x + 30, h.y + 41, { size: 22, weight: 500, color: 'text', alpha: a * loaded });
    if (sub) ink.text(sub, h.x + 30 + ink.measure(title, { size: 22, weight: 500 }) + 16, h.y + 41, { size: 18, color: 'mute', alpha: a * loaded });
    if (pres) IF.presence(ink, h.x + h.w - 128, h.y + 34, pres, { alpha: a * loaded });
  };
  IF.composer = (ink, r, { text = '', placeholder = '', focus = 0, k = 1, t = 0, send = 'idle', caret = true, color = 'text', size = 28, shake = 0, label = '' } = {}) => {
    const a = clamp(k * 2), e = k >= 1 ? 1 : easeOut(k), y = r.y + (1 - e) * 46 + shake;
    const sendC = [r.x + r.w - 44, y + r.h - 40, 20], tx = r.x + 30, ty = y + 48;
    if (a <= 0) return { caret: [tx, ty - 10], send: sendC, box: r };
    const err = send === 'error';
    const shown = ink.wrap(text, r.w - 60, { size }).slice(-2), up = (shown.length - 1) * size * 1.3;
    ink.rrect(r.x, y - up, r.w, r.h + up, 26, { fill: 'raised', stroke: err ? 'err' : focus > 0.5 ? 'sub' : 'line', alpha: a, shadow: 0.5, width: err ? 2.5 : 1.5 });
    if (text) shown.forEach((ln, i) => ink.text(ln, tx, ty - up + i * size * 1.3, { size, color, alpha: a }));
    else ink.text(placeholder, tx, ty, { size, color: 'mute', alpha: a });
    const cx = tx + (text ? ink.measure(shown[shown.length - 1], { size }) + 3 : 0), cy = ty;
    if (caret && focus > 0.5 && Math.floor(t * 2.2) % 2 === 0) ink.rect(cx, cy - size * 0.84, 2.5, size * 1.05, { fill: true, color, alpha: a });
    ink.circle(r.x + 40, y + r.h - 40, 16, { color: 'line', alpha: a, width: 1.5 });
    ink.line(r.x + 33, y + r.h - 40, r.x + 47, y + r.h - 40, { color: 'sub', alpha: a, width: 2 }); ink.line(r.x + 40, y + r.h - 47, r.x + 40, y + r.h - 33, { color: 'sub', alpha: a, width: 2 });
    if (label) ink.text(label, sendC[0] - 40, y + r.h - 33, { size: 17, weight: 500, color: 'mute', alpha: a, align: 'right' });
    const on = send === 'ready' || send === 'busy', sc = [sendC[0], y + r.h - 40];
    if (on) ink.glow('me', 18, () => ink.circle(sc[0], sc[1], 20, { fill: true, color: 'me', alpha: a }), 0.55 * a);
    else ink.circle(sc[0], sc[1], 20, { fill: true, color: err ? 'err' : 'line', alpha: a });
    if (send === 'busy') ink.rrect(sc[0] - 6, sc[1] - 6, 12, 12, 3, { fill: 'bg', alpha: a });
    else { ink.line(sc[0], sc[1] + 8, sc[0], sc[1] - 8, { color: on ? 'bg' : 'mute', alpha: a, width: 3 }); ink.poly([[sc[0] - 7, sc[1] - 2], [sc[0], sc[1] - 9], [sc[0] + 7, sc[1] - 2]], { color: on ? 'bg' : 'mute', alpha: a, width: 3 }); }
    return { caret: [cx, cy - size * 0.3], send: [sc[0], sc[1], 20], box: { x: r.x, y: y - up, w: r.w, h: r.h + up } };
  };

  // ---------------------------------------------------------------- thread
  // type sizes: an MV is read at a glance, so the defaults are larger than a real client's (34 / 28). Per shot: args.sizes
  IF.SIZES = { me: 46, hot: 64, you: 34 };
  const AI = { lh: 1.34 }, YOU = { lh: 1.32 };
  const noteOf = m => {
    const failed = m.status === 'failed', busy = m.status === 'sending' ? 'Sending…' : '';
    const str = m.note ?? (m.who === 'me' ? m.time ?? busy : failed ? 'Not delivered' : busy || (m.time ?? (m.status === 'sent' ? 'Delivered' : '')));
    return [str || '', m.noteColor ?? (failed ? 'err' : 'mute')];
  };
  function measureMsg(ink, m, W) {
    if (m.who === 'sys') return { h: 44, lines: [m.text], w: W };
    if (m.thinking || m.typing) return { h: m.who === 'me' ? 52 : 58, lines: [], w: 96 };
    if (m.who === 'me') {
      const size = m.size ?? (m.hot ? IF.SIZES.hot : IF.SIZES.me), weight = m.weight ?? (m.hot ? 700 : 400), o = { size, weight, font: 'serif', italic: !!m.italic };
      const lines = ink.wrap(m.text, W - 58, o);
      return { h: lines.length * size * AI.lh + 10 + (noteOf(m)[0] || m.status === 'failed' ? 24 : 0), lines, size, weight, w: Math.max(...lines.map(l => ink.measure(l, o))) };
    }
    const size = m.size ?? IF.SIZES.you, weight = m.weight ?? 400, o = { size, weight, font: 'sans', italic: !!m.italic };
    const lines = ink.wrap(m.text, W * 0.62 - 52, o);
    const w = Math.max(...lines.map(l => ink.measure(l, o))) + 52;
    return { h: lines.length * size * YOU.lh + 30 + (m.status || m.time || m.note ? 30 : 0), lines, size, weight, w };
  }
  IF.drawThread = (ink, rect, msgs, t, { alpha = 1, fadeTop = 60, bottomPad = 6, gap = 22, anchor = 'bottom', dim = null, scroll = 0, dry = false } = {}) => {
    const live = msgs.filter(m => t >= (m.at ?? -Infinity));
    let total = 0;
    const items = live.map(m => {
      const ms = measureMsg(ink, m, rect.w), e = Number.isFinite(m.at) ? easeOut(prog(t, m.at, m.at + 0.3)) : 1;
      const out = m.outAt != null ? 1 - easeOut(prog(t, m.outAt, m.outAt + 0.35)) : 1;
      const it = Object.assign({}, m, ms, { e, out, top: total + (m.gap ?? 0) * e * out });
      total = it.top + (ms.h + gap) * e * out;
      return it;
    });
    const y0 = anchor === 'top' ? rect.y - scroll : rect.y + Math.min(0, rect.h - bottomPad - total) - scroll;
    const zone = Math.min(fadeTop, rect.y - y0 - (items[0] ? items[0].top : 0));
    const fade = zone > 0 ? (top, h) => clamp((top + Math.min(h, zone) / 2 - rect.y) / zone) : () => 1;
    for (const it of items) { it.y = y0 + it.top + (1 - it.e) * 26; it.x = it.who === 'you' ? rect.x + rect.w - it.w : rect.x; }
    if (dry) return items;                                                  // layout only (a camera that follows the newest line)
    ink.clip({ x: rect.x - 20, y: rect.y, w: rect.w + 40, h: rect.h }, () => {
      for (const it of items) {
        const y = it.y, a = alpha * it.e * it.out * (dim ? dim(it) : 1);
        if (a <= 0.003 || y > rect.y + rect.h || y + it.h < rect.y - 40) continue;
        drawMsg(ink, it, rect, y, a, t, fade);
      }
    });
    return items;
  };
  function drawMsg(ink, m, rect, y, a, t, fade) {
    const shown = (lines, n) => {                                         // typed prefix across wrapped lines
      if (n == null) return lines;
      const out = []; let left = n;
      for (const l of lines) { if (left <= 0) break; const ch = [...l]; out.push(ch.slice(0, left).join('')); left -= ch.length + (/\s/.test(m.text) ? 1 : 0); }
      return out;
    };
    if (m.who === 'sys') {
      const w = ink.measure(m.text, { size: 17, font: 'mono' }), as = a * fade(y, 40);
      ink.line(rect.x, y + 20, rect.x + rect.w / 2 - w / 2 - 18, y + 20, { color: 'line', alpha: as, width: 1.5 });
      ink.line(rect.x + rect.w / 2 + w / 2 + 18, y + 20, rect.x + rect.w, y + 20, { color: 'line', alpha: as, width: 1.5 });
      ink.text(m.text, rect.x + rect.w / 2, y + 26, { size: 17, font: 'mono', color: m.tone === 'err' ? 'err' : 'mute', alpha: as, align: 'center' });
      return;
    }
    if (m.who === 'me') {
      const ghost = m.ghost ?? 0, col = m.tone === 'err' ? 'err' : m.hot ? 'meHot' : 'me';
      if (m.thinking) { IF.thinking(ink, rect.x + 20, y + 24, 20, t, { alpha: a * fade(y, 48), stuck: m.stuck ?? 0 }); return; }
      IF.mark(ink, rect.x + 17, y + m.size * 0.62, 13, { alpha: a * fade(y + m.size * 0.62 - 15, 30) * (1 - 0.6 * ghost), color: m.tone === 'err' ? 'err' : 'me' });
      const ls = shown(m.lines, m.n), o = { size: m.size, weight: m.weight, font: 'serif', italic: !!m.italic };
      ls.forEach((ln, i) => {
        const yy = y + (i + 0.78) * m.size * AI.lh, al = a * fade(yy - m.size * 0.8, m.size);
        ink.text(ln, rect.x + 54, yy, Object.assign({}, o, { color: col, alpha: al * (1 - 0.72 * ghost) }));
        if (ghost > 0) ink.line(rect.x + 54, yy - m.size * 0.3, rect.x + 54 + ink.measure(ln, o) * ghost, yy - m.size * 0.3, { color: 'mute', alpha: al, width: 2 });
      });
      if (m.n != null && m.n < [...m.text].length && ls.length) {           // the speaker's caret while the line is still arriving
        const lw = ink.measure(ls[ls.length - 1], o), cy = y + (ls.length - 1 + 0.52) * m.size * AI.lh;
        ink.circle(rect.x + 54 + lw + m.size * 0.3, cy, m.size * 0.17, { fill: true, color: col, alpha: a * fade(cy - m.size * 0.5, m.size) });
      }
      const [note, noteCol] = noteOf(m), an = a * fade(y + m.h - 22, 20);
      if (note) ink.text(note, rect.x + 54, y + m.h - 6, { size: 16, color: noteCol, alpha: an, weight: 500 });
      else if (m.status === 'failed') { ink.circle(rect.x + 63, y + m.h - 12, 9, { fill: true, color: noteCol, alpha: an }); ink.text('!', rect.x + 63, y + m.h - 7, { size: 14, weight: 800, align: 'center', color: 'bg', alpha: an }); }
      return;
    }
    const x = rect.x + rect.w - m.w, bh = m.h - (m.status || m.time || m.note ? 30 : 0), au = a * fade(y, bh);
    if (m.typing) { ink.rrect(rect.x + rect.w - 96, y, 96, 52, 26, { fill: 'raised', alpha: au }); for (let i = 0; i < 3; i++) ink.circle(rect.x + rect.w - 68 + i * 20, y + 26 - 5 * Math.max(0, Math.sin(t * 7 - i * 0.9)), 5, { fill: true, color: 'text', alpha: au * 0.85 }); return; }
    const failed = m.status === 'failed', [note, noteCol] = noteOf(m);
    ink.rrect(x, y, m.w, bh, 24, { fill: 'raised', stroke: failed ? 'err' : null, alpha: au, width: 2 });
    shown(m.lines, m.n).forEach((ln, i) => ink.text(ln, x + 26, y + 15 + (i + 0.76) * m.size * YOU.lh, { size: m.size, weight: m.weight, font: 'sans', italic: !!m.italic, color: 'text', alpha: au }));
    if (note) ink.text(note, rect.x + rect.w - 6, y + bh + 22, { size: 16, weight: 500, color: noteCol, alpha: au, align: 'right' });
  }

  // ---------------------------------------------------------------- controls
  IF.toggle = (ink, x, y, v, { w = 62, h = 34, alpha = 1, on = 'me', off = 'line' } = {}) => {
    const k = clamp(v);
    ink.rrect(x, y, w, h, h / 2, { fill: off, alpha }); ink.rrect(x, y, w, h, h / 2, { fill: on, alpha: alpha * k });
    const kx = x + h / 2 + (w - h) * k, squash = 1 + 0.25 * Math.sin(Math.PI * k);   // the knob stretches mid-flick
    ink.at(kx, y + h / 2, () => ink.rrect(-(h / 2 - 4), -(h / 2 - 4), h - 8, h - 8, h, { fill: 'text', alpha, shadow: 0.35 }), { sx: squash, sy: 1 / Math.sqrt(squash) });
  };
  IF.segmented = (ink, r, opts, sel, { alpha = 1, size = 22, hot = false, pillColor = null } = {}) => {
    const n = opts.length, w = r.w / n;
    ink.rrect(r.x, r.y, r.w, r.h, r.h / 2, { fill: 'panel', stroke: 'line', alpha });
    const px = r.x + clamp(sel, 0, n - 1) * w, stretch = Math.abs(sel - Math.round(sel)) * 2;
    ink.rrect(px + 4 - stretch * 10, r.y + 4, w - 8 + stretch * 20, r.h - 8, r.h / 2, { fill: pillColor ?? (hot ? 'me' : 'raised'), stroke: hot ? null : 'line', alpha, shadow: 0.3 });
    opts.forEach((o, i) => { const near = clamp(1 - Math.abs(sel - i)); ink.text(o, r.x + (i + 0.5) * w, r.y + r.h / 2 + size * 0.35, { size, weight: 600, align: 'center', color: near > 0.5 ? (hot ? 'bg' : 'text') : 'mute', alpha }); });
  };
  IF.slider = (ink, r, v, { alpha = 1, ticks = 0, fill = 'me', labels = null } = {}) => {
    const y = r.y + r.h / 2, kx = r.x + r.w * clamp(v);
    ink.rrect(r.x, y - 3, r.w, 6, 3, { fill: 'line', alpha }); ink.rrect(r.x, y - 3, kx - r.x, 6, 3, { fill, alpha });
    for (let i = 0; i < ticks; i++) ink.line(r.x + (r.w * i) / (ticks - 1), y + 12, r.x + (r.w * i) / (ticks - 1), y + (i % 5 === 0 ? 24 : 18), { color: 'mute', alpha, width: 1.5 });
    if (labels) labels.forEach((l, i) => ink.text(l, r.x + (r.w * i) / (labels.length - 1), y + 48, { size: 16, weight: 500, color: 'mute', alpha, align: 'center' }));
    ink.circle(kx, y, 13, { fill: true, color: 'text', alpha }); ink.circle(kx, y, 13, { color: 'bg', alpha: alpha * 0.5, width: 1.5 });
    return [kx, y];
  };
  IF.settingRow = (ink, r, { label, hint = '', alpha = 1, k = 1, active = 0 } = {}) => {
    const e = k >= 1 ? 1 : easeOut(k), x = r.x + (1 - e) * 40, a = alpha * e;
    if (active > 0) ink.rrect(r.x - 14, r.y + 4, r.w + 28, r.h - 8, 14, { fill: 'raised', alpha: a * active });
    ink.text(label, x, r.y + r.h / 2 - (hint ? 4 : -8), { size: 23, weight: 500, color: 'text', alpha: a });
    if (hint) ink.text(hint, x, r.y + r.h / 2 + 22, { size: 16, color: 'mute', alpha: a });
    ink.line(r.x, r.y + r.h, r.x + r.w, r.y + r.h, { color: 'line', alpha: a * 0.7, width: 1 });
    return { slot: { x: r.x + r.w - 220, y: r.y + r.h / 2 - 22, w: 220, h: 44 }, a };
  };
  IF.drawer = (ink, L, { title = 'Settings', sub = '', alpha = 1, full = DRAWER_W } = {}) => {
    const d = L.drawer;
    if (d.w < 60) return null;
    ink.clip(d, () => { ink.text(title, d.x + 34, d.y + 54, { size: 26, weight: 600, color: 'text', alpha }); if (sub) ink.text(sub, d.x + 34, d.y + 82, { size: 17, color: 'mute', alpha }); });
    ink.line(d.x, d.y + 104, d.x + d.w, d.y + 104, { color: 'line', alpha, width: 1.5 });
    return { x: d.x + 34, y: d.y + 112, w: Math.max(full, d.w) - 68, h: d.h - 140, clip: d };
  };
  IF.pill = (ink, x, y, str, { size = 17, color = 'sub', fill = 'raised', stroke = 'line', alpha = 1, font = 'sans', weight = 500, padX = 14, align = 'left' } = {}) => {
    const w = ink.measure(str, { size, font, weight }) + padX * 2, h = size * 1.9, x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    ink.rrect(x0, y - h / 2, w, h, h / 2, { fill, stroke, alpha }); ink.text(str, x0 + padX, y + size * 0.35, { size, font, weight, color, alpha });
    return w;
  };
  IF.toast = (ink, r, { title, body = '', code = '', k = 1, out = 0, tone = 'err', alpha = 1, icon = '!', codeColor = null } = {}) => {
    if (k <= 0 || out >= 1) return;
    const e = k >= 1 ? 1 : easeBack(clamp(k)), a = alpha * clamp(k * 3) * (1 - out), acc = tone === 'err' ? 'err' : 'sub';
    ink.at(r.x + r.w / 2, r.y + r.h / 2 - (1 - e) * 30 + out * -26, () => {
      const x = -r.w / 2, y = -r.h / 2;
      ink.rrect(x, y, r.w, r.h, 16, { fill: 'raised', stroke: tone === 'err' ? 'errDim' : 'line', alpha: a, shadow: 0.8 });
      ink.rrect(x, y, 6, r.h, 3, { fill: acc, alpha: a });
      ink.circle(x + 40, y + r.h / 2, 15, { fill: true, color: acc, alpha: a });
      ink.text(icon, x + 40, y + r.h / 2 + 8, { size: 22, weight: 800, align: 'center', color: 'raised', alpha: a });
      ink.text(title, x + 70, y + (body ? 34 : r.h / 2 + 8), { size: 22, weight: 600, color: 'text', alpha: a });
      if (body) ink.text(body, x + 70, y + 62, { size: 18, color: 'sub', alpha: a });
      if (code) ink.text(code, x + r.w - 20, y + 30, { size: 15, font: 'mono', color: codeColor ?? acc, alpha: a, align: 'right' });
    }, { scale: 0.94 + 0.06 * e });
  };
  IF.card = (ink, r, { title = '', subtitle = '', k = 1, alpha = 1, tag = '', stroke = 'line', fill = 'raised' } = {}) => {
    if (k <= 0) return null;
    const e = k >= 1 ? 1 : easeOut(k), a = alpha * clamp(k * 2.5), y = r.y + (1 - e) * 40;
    ink.rrect(r.x, y, r.w, r.h, 22, { fill, stroke, alpha: a, shadow: 0.7 });
    if (title) ink.text(title, r.x + 34, y + 62, { size: 40, weight: 700, font: 'serif', color: 'me', alpha: a });
    if (subtitle) ink.text(subtitle, r.x + 34, y + 94, { size: 19, font: 'serif', italic: true, color: 'sub', alpha: a });
    if (tag) IF.pill(ink, r.x + r.w - 30, y + 46, tag, { align: 'right', alpha: a, size: 15, font: 'mono' });
    if (title) ink.line(r.x + 34, y + 116, r.x + r.w - 34, y + 116, { color: 'line', alpha: a, width: 1.5 });
    return { x: r.x + 34, y: y + (title ? 132 : 30), w: r.w - 68, h: r.h - (title ? 162 : 60), a };
  };
  IF.iconButton = (ink, x, y, kind, { r = 20, alpha = 1, color = 'sub', fill = null, stroke = 'line', press = 0 } = {}) => {
    ink.at(x, y, () => {
      if (fill || stroke) ink.circle(0, 0, r, { fill: !!fill, color: fill ?? stroke, alpha, width: 1.5 });
      const w = Math.max(2, r * 0.12), o = { color, alpha, width: w }, q = r * 0.42;
      if (kind === 'close') { ink.line(-q, -q, q, q, o); ink.line(q, -q, -q, q, o); }
      else if (kind === 'retry') { ink.circle(0, 0, q, Object.assign({}, o, { a0: -0.4, a1: Math.PI * 1.45 })); ink.poly([[q * 0.25, -q * 1.25], [q * 0.98, -q * 0.6], [q * 0.2, -q * 0.2]], o); }
      else if (kind === 'stop') ink.rrect(-q * 0.8, -q * 0.8, q * 1.6, q * 1.6, 3, { fill: color, alpha });
      else if (kind === 'copy') { ink.rrect(-q, -q * 0.6, q * 1.3, q * 1.6, 3, { fill: null, stroke: color, alpha, width: w }); ink.poly([[-q * 0.4, -q * 0.6], [-q * 0.4, -q * 1.1], [q, -q * 1.1], [q, q * 0.5], [q * 0.3, q * 0.5]], o); }
      else { const f = kind === 'down' ? -1 : 1; ink.poly([[-q, q * 0.9 * f], [-q, -q * 0.1 * f], [-q * 0.2, -q * 0.1 * f], [q * 0.1, -q * 1.05 * f], [q * 0.55, -q * 0.9 * f], [q * 0.4, -q * 0.1 * f], [q * 1.05, -q * 0.1 * f], [q * 0.8, q * 0.9 * f]], Object.assign({}, o, { close: true })); }
    }, { scale: 1 - 0.12 * press });
  };

  // ---------------------------------------------------------------- the user's pointer
  // position along waypoints [{ t, x, y, click }]: moves ease in/out and bow slightly sideways, like a hand
  IF.cursorAt = (way, t, { dwell = 0.3, bow = 0.07 } = {}) => {
    if (!way.length) return [960, 540];
    if (t <= way[0].t) return [way[0].x, way[0].y];
    for (let i = 1; i < way.length; i++) {
      if (t <= way[i].t) {
        const a = way[i - 1], b = way[i], span = b.t - a.t, t0 = a.t + span * dwell;
        const k = easeInOut(clamp((t - t0) / Math.max(1e-6, b.t - t0))), dx = b.x - a.x, dy = b.y - a.y, arc = Math.sin(k * Math.PI) * bow;
        return [lerp(a.x, b.x, k) - dy * arc, lerp(a.y, b.y, k) + dx * arc];
      }
    }
    const z = way[way.length - 1]; return [z.x, z.y];
  };
  IF.pointer = (ink, x, y, { kind = 'arrow', color = 'text', alpha = 1, scale = 1, down = 0 } = {}) => {
    if (alpha <= 0.003) return;
    ink.at(x, y, () => {
      const g = ink.g; g.shadowColor = `rgba(0,0,0,${0.45 * alpha})`; g.shadowBlur = 10; g.shadowOffsetY = 3;
      if (kind === 'text') {
        ink.poly([[-6, -15], [-2, -13], [0, -11], [2, -13], [6, -15]], { color, alpha, width: 2.6 }); ink.line(0, -11, 0, 11, { color, alpha, width: 2.6 });
        ink.poly([[-6, 15], [-2, 13], [0, 11], [2, 13], [6, 15]], { color, alpha, width: 2.6 });
      } else {
        const pts = kind === 'hand' ? [[0, 0], [5, 2], [5, 11], [9, 10], [13, 11], [17, 13], [17, 22], [14, 30], [3, 30], [-3, 21], [-6, 15], [-2, 14], [0, 16]]
          : [[0, 0], [0, 25], [6.5, 19.5], [11, 29.5], [15.5, 27.5], [11, 18], [19, 18]];
        ink.poly(pts, { close: true, fill: true, color, alpha });
        g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetY = 0;
        ink.poly(pts, { close: true, color: 'bg', alpha: alpha * 0.9, width: 1.6 });
      }
      g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetY = 0;
    }, { scale: scale * (1 - 0.1 * down) });
  };
  IF.drawCursor = (ink, way, t, { kind = 'arrow', color = 'text', alpha = 1, scale = 1.5, blur = 5, pathOpts = {} } = {}) => {
    const now = IF.cursorAt(way, t, pathOpts);
    if (alpha <= 0.003) return now;
    let hit = null; for (const w of way) if (w.click && t >= w.t) hit = w;
    const sc = hit ? t - hit.t : Infinity, before = IF.cursorAt(way, t - 0.03, pathOpts), speed = Math.hypot(now[0] - before[0], now[1] - before[1]) / 0.03;
    if (sc < 0.45) IF.burst(ink, hit.x, hit.y, 34 * scale, sc / 0.45, { color, alpha });
    const k = clamp((speed - 400) / 600);
    ink.trail(k > 0 ? blur : 0, 0.011, tau => { const p = IF.cursorAt(way, t - tau, pathOpts); IF.pointer(ink, p[0], p[1], { kind, color, alpha, scale, down: sc < 0.12 ? 1 : 0 }); }, 0.42 * k);
    return now;
  };
})();
