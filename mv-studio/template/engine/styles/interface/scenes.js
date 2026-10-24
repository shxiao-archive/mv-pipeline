/* styles/interface — scenes.js: three scenes for an "interface" film (the song as a conversation on a screen).
 * Lyric text never appears in code: pass line INDICES (`line: 3`) and the scene reads Z.line(3).text at draw time.
 * Every time is song time; a list [[t, value], ...] means "value from t on" (states, presence, toggles, drawer).
 *
 * 'ifChat'  the chat window: { state, title, sub, presence, brand, user, items, side, drawer, open:[t0,dur],
 *            msgs:[{ who:'me'|'you'|'sys', line | text, at, hot, tone, status, note, thinking:[t0,t1], typing:[t0,t1], ghost, outAt }],
 *              (status / note / noteColor / tone may be [[t, value], ...]: a reply that goes 'sending' -> 'failed')
 *            compose:{ text|line, from, at, placeholder } (the user typing in the box, sent at `at`), cursor:[{t,x,y,click}],
 *            toasts:[{ at, until, title, body, code, tone }], settings:[{ label, hint, kind:'toggle'|'slider'|'segmented', v, opts }],
 *            backdrop: 'assets/bg/room.png' | { img, blur 24, alpha .55, drift, pan } (the place, blurred, drifting behind / through
                    the window: the textured moving layer a dark UI needs), glass (window opacity, .86 with a backdrop),
            camera: 'follow' (default: re-frames on every new message, frames the composer while the user types, floats)
                    | { follow: true, zoom, move, beat, focus: [[t, { x, y, zoom }], ...] } | { from:{x,y,zoom,rot}, to:{...}, ease },
            fx(ink, S, L, items) (extra drawing on top) }
 *     'me' lines type out with the voice (Z.charsAt; `words: true`: word by word, Z.wordsAt); a 'you' message in msgs simply arrives at `at`.
 * 'ifPlate' a full-frame print: { state ('paper'), ground:{...IF.ground options}, camera, misreg (px of out-of-register jitter),
 *            layers:[ { kind:'keyword', line|text, at, step, x, y, maxW, maxSize, color, off, font }
 *                    | { kind:'band', line|text, x, y, size, align, color }
 *                    | { kind:'glyph', img, rect:[x,y,w,h], cell, reveal:[t0,t1], decode:[t0,t1], inks, ramp }
 *                    | { kind:'print', img, x, y, h, color, shadow:[dx,dy], shade, anchor, in:{at,dur,dy} }   (a flat-ink silhouette)
 *                    | { kind:'inks', img, x, y, h, anchor, roles:['text','me','panel'], reveal:[[t0,t1,dir] | null, ...],
 *                        offset:[[dx,dy], ...] (default: misreg, each plate further out), keyline, flip }   (the art's ink plates,
 *                        each in a palette role: IF.inks in kit.js)
 *                    | { kind:'limp', line|text, x, y, size (fit to maxW 1700), sag:[t0,t1], amount .7, drop 24, side 'left'|'right', font, color }
 *                        (the word sags: kit.js IF.limp)
 *                    | { kind:'custom', fn(ink, S) } ] }
 * 'ifCode'  code / terminal underneath: { state, listing:{ x, y, lines:[str], current:[[t,i]], size, hi }, terminal:{ rect:[x,y,w,h],
 *            entries:[{ at, text|line, role, typeOver }], size, prompt }, odometer:{ x, y, from, to, t0, t1, digits, size }, camera }
 * Z.IF.post   post params for clean UI type (no boil, low bloom): post: Z.IF.post  or  post: Object.assign({}, Z.IF.post, {...})
 * Z.IF.at(list, t, dflt)  value in force at t from [[t, v], ...]
 */
(() => {
  'use strict';
  const Z = window.Z, IF = (Z.IF = Z.IF || {}), E = Z.ease;
  IF.post = { boil: 0, bloom: 0.14, bloomThreshold: 0.86, grain: 0.035, vignette: 0.18, lutMix: 0, ca: 0 };

  IF.at = (list, t, dflt) => { if (!Array.isArray(list) || !Array.isArray(list[0])) return list ?? dflt; let v = dflt; for (const [t0, x] of list) if (t >= t0) v = x; return v; };
  // a numeric value over time from [[t, v], ...]: eased between keys over `dur` seconds (a toggle flick, a drawer)
  IF.anim = (list, t, dur = 0.35, ease = E.outCubic) => {
    if (!Array.isArray(list)) return list ?? 0;
    let v = list[0][1], prev = v, t0 = -1e9;
    for (const [tk, x] of list) if (t >= tk) { prev = v; v = x; t0 = tk; }
    return Z.lerp(prev, v, ease(Z.clamp((t - t0) / dur)));
  };
  const stateOf = (st, t) => (Array.isArray(st) && Array.isArray(st[0]) ? IF.stateAt(st, t) : st || 'on');
  const textOf = m => (m.line != null ? Z.line(m.line).text : m.text || '');
  const camera = (ctx, cam, S) => {
    if (!cam) cam = { from: { zoom: 1.0, x: -60 }, to: { zoom: 1.1, x: 60 } };     // default: never still — a slide + push
    const k = (E[cam.ease || 'inOutSine'] || E.inOutSine)(S.p), a = cam.from || {}, b = cam.to || a;
    const z = Z.lerp(a.zoom ?? 1, b.zoom ?? 1, k), x = Z.lerp(a.x || 0, b.x || 0, k), y = Z.lerp(a.y || 0, b.y || 0, k), r = Z.lerp(a.rot || 0, b.rot || 0, k);
    const push = (cam.beat ?? 0) * S.clock.pulse(S.t, 8);
    ctx.translate(960, 540); ctx.rotate(r); ctx.scale(z * (1 + push), z * (1 + push)); ctx.translate(-960 - x, -540 - y);
  };
  // 'follow' camera for ifChat (the default): it frames the NEWEST message (from a dry layout of the thread), re-frames
  // on every arrival (eased; alternating close / wider), frames the composer while the user types, and in between keeps
  // travelling — a lateral pan inside the slack the text leaves (never cropping the lines) plus a slow push.
  // Measured: a UI held in one framing reads, and measures, as a still picture.
  const follow = (ctx, S, a, L, items) => {
    const cam = typeof a.camera === 'object' ? a.camera : {}, t = S.t, base = cam.zoom ?? 1.26, th = L.thread, win = L.win;
    const live = items.filter(it => !it.thinking || true), n = live.length, last = live[n - 1];
    const arr = live.map(it => it.at).filter(x => Number.isFinite(x));
    const tk = arr.length ? arr[arr.length - 1] : S.shot.t0, since = t - tk, mv = cam.move ?? 0.8;
    const nextAt = (a.msgs || []).map(m => (m.at ?? (m.line != null ? Z.line(m.line).t - 0.15 : null))).filter(x => x != null && x > t).sort((p, q) => p - q)[0];
    const gap = Math.max(1, (nextAt ?? Math.max(S.shot.t1, tk + 3)) - tk);
    const zf = k => base * (k % 2 ? 1.14 : 0.94);
    const cyOf = it => (it ? it.y + it.h * 0.5 - 110 : th.y + 200);
    const prev = live[n - 2];
    const e = E.inOutCubic(Z.clamp(since / mv));
    let z = Z.lerp(zf(n - 1), zf(n), e), cy = Z.lerp(cyOf(prev) - (last ? last.h + 22 : 0) * (1 - e) * 0, cyOf(last), e);
    const half = 960 / z, slack = Math.max(0, half - th.w / 2 - 40), dir = n % 2 ? 1 : -1;
    const hold = Z.clamp((since - mv * 0.5) / gap);
    let cx = th.x + th.w / 2 + dir * slack * (0.5 - hold) * 1.1;              // a lateral pan across the slack, one way per line
    z *= 1 + (cam.creep ?? 0.07) * hold;
    const c = a.compose; if (c) { const from = c.from ?? c.at - 1.6, w = Z.smooth(from - 0.6, from, t) * (1 - Z.smooth(c.at + 0.2, c.at + 0.8, t)); cy = Z.lerp(cy, L.composer.y + 20, w); z = Z.lerp(z, base * 1.05, w); }
    const halfH = 540 / z; cy = Z.clamp(cy, win.y + halfH - 60, win.y + win.h - halfH + 60);
    if (cam.focus) { const f = IF.at(cam.focus, t, null); if (f) { cx = f.cx ?? cx; cy = f.cy ?? cy; z = f.zoom ?? z; } }
    cx += 8 * Math.sin(t * 0.37 + 1.3); cy += 6 * Math.sin(t * 0.29 + 0.4);
    const r = 0.004 * Math.sin(t * 0.23), push = (cam.beat ?? 0.008) * S.clock.pulse(t, 8);
    ctx.translate(960, 540); ctx.rotate(r); ctx.scale(z * (1 + push), z * (1 + push)); ctx.translate(-cx, -cy);
  };
  let fontsReady = null;
  const loadFonts = () => fontsReady || (fontsReady = Promise.all(IF.fontsToLoad.map(f => document.fonts.load(f, 'Aa0あ一'))));

  // ================================================================ ifChat
  Z.scene('ifChat', {
    history: true,                                                    // the thread keeps earlier lines (check_shots)
    preload: a => [a.backdrop && (a.backdrop.img || a.backdrop)].filter(x => typeof x === 'string'),
    init: loadFonts,
    draw(ctx, S) {
      const a = S.args, t = S.t, ink = IF.ink(ctx, stateOf(a.state, t)), sz = Object.assign({}, IF.SIZES);
      if (a.sizes) Object.assign(IF.SIZES, a.sizes);
      const L = IF.chatLayout({ side: IF.anim(a.side ?? 1, t), drawer: IF.anim(a.drawer ?? 0, t, 0.45) });
      // the conversation
      const msgs = [];
      for (const m of a.msgs || []) {
        const L0 = m.line != null ? Z.line(m.line) : null, at = m.at ?? (L0 ? L0.t - 0.15 : -1e9);
        if (m.thinking && t >= m.thinking[0] && t < m.thinking[1]) msgs.push({ who: 'me', thinking: true, at: m.thinking[0] });
        if (m.typing && t >= m.typing[0] && t < m.typing[1]) msgs.push({ who: 'you', typing: true, at: m.typing[0] });
        const txt = textOf(m); if (!txt) continue;
        const o = Object.assign({}, m, { text: txt, at, hot: m.hot ?? (L0 ? L0.kime : false) }); delete o.thinking; delete o.typing;
        for (const k of ['status', 'note', 'noteColor', 'tone']) if (Array.isArray(m[k])) o[k] = IF.at(m[k], t, undefined);   // per-time: status: [[t, 'sending'], [t2, 'failed']]
        if (m.who === 'me' && L0 && m.n == null && m.instant !== true) o.n = (m.words ? Z.wordsAt : Z.charsAt)(m.line, t, { lead: 0.15 });
        if (m.thinking && t < m.thinking[1]) continue;                          // still thinking: the line is not out yet
        msgs.push(o);
      }
      ctx.save();
      if (!a.camera || a.camera === 'follow' || a.camera.follow) follow(ctx, S, a, L, IF.drawThread(ink, L.thread, msgs, t, { dry: true })); else camera(ctx, a.camera, S);
      IF.room(ink, { t, dim: a.dim ?? 0.5, backdrop: a.backdrop || null });
      const open = a.open ? E.outCubic(Z.inv(a.open[0], a.open[0] + (a.open[1] || 0.6), t)) : 1;
      IF.windowFrame(ink, L, { k: open, glass: a.glass ?? (a.backdrop ? 0.86 : 1) });
      if (open > 0.3) {
        const pres = IF.at(a.presence, t, null);
        IF.sidebar(ink, L, { k: Z.clamp((open - 0.3) / 0.7), items: a.items || [], active: a.active ?? 0, t, user: a.user || 'you', presence: pres, brand: a.brand || '' });
        IF.header(ink, L, { title: a.title || '', sub: a.sub || null, presence: a.sidebarPresence ? null : pres, t });
        const items = IF.drawThread(ink, L.thread, msgs, t);
        // the composer: the user typing (from -> at), then the box empties as the message is sent
        const c = a.compose; let typed = '', send = 'idle';
        if (c) {
          const s = textOf(c), from = c.from ?? c.at - Math.min(1.6, 0.06 * s.length);
          if (t >= from && t < c.at) { typed = [...s].slice(0, Math.ceil([...s].length * Z.inv(from, c.at - 0.12, t))).join(''); send = 'ready'; }
        }
        const comp = IF.composer(ink, L.composer, { text: typed, placeholder: a.placeholder ?? 'Reply…', focus: c && t >= (c.from ?? -1e9) - 0.3 ? 1 : 0, t, send, k: Z.clamp((open - 0.5) * 2) });
        // the settings drawer
        const dr = IF.drawer(ink, L, { title: a.drawerTitle || 'Settings' });
        if (dr && a.settings) ink.clip(dr.clip, () => a.settings.forEach((row, i) => {
          const r = { x: dr.x, y: dr.y + i * 96, w: dr.w, h: 96 }, { slot } = IF.settingRow(ink, r, { label: row.label, hint: row.hint || '', active: IF.anim(row.active ?? 0, t) });
          if (row.kind === 'slider') IF.slider(ink, slot, IF.anim(row.v, t, 0.5));
          else if (row.kind === 'segmented') IF.segmented(ink, slot, row.opts || ['A', 'B'], IF.anim(row.v, t, 0.3), { size: 17 });
          else IF.toggle(ink, slot.x + slot.w - 70, slot.y + 5, IF.anim(row.v, t, 0.22));
        }));
        // toasts sit above the composer, never over the thread's lines (a lyric must stay readable)
        for (const tt of a.toasts || []) if (t >= tt.at && t < (tt.until ?? 1e9) + 0.4)
          IF.toast(ink, tt.rect || { x: L.composer.x + L.composer.w / 2 - 330, y: L.composer.y - 118, w: 660, h: 96 }, Object.assign({}, tt, { k: Z.inv(tt.at, tt.at + 0.35, t), out: tt.until ? Z.inv(tt.until, tt.until + 0.35, t) : 0 }));
        if (a.fx) a.fx(ink, S, L, items, comp);
        if (a.cursor) IF.drawCursor(ink, a.cursor, t);
      }
      ctx.restore(); Object.assign(IF.SIZES, sz);
    },
  });

  // ================================================================ ifPlate
  Z.scene('ifPlate', {
    preload: a => (a.layers || []).filter(l => l.img && typeof l.img === 'string').map(l => l.img),
    init: loadFonts,
    draw(ctx, S) {
      const a = S.args, t = S.t, ink = IF.ink(ctx, stateOf(a.state || 'paper', t));
      ctx.save(); camera(ctx, a.camera || { from: { zoom: 1.0, x: -90 }, to: { zoom: 1.12, x: 90 }, ease: 'linear' }, S);   // default: a steady slide + push (a still plate reads as a slide)
      IF.ground(ink, a.ground || {});
      const mis = a.misreg ? [Z.rnds(Math.floor(t * 12), 3) * a.misreg, Z.rnds(Math.floor(t * 12), 5) * a.misreg] : [0, 0];
      for (const l of a.layers || []) {
        if (l.from != null && t < l.from) continue; if (l.until != null && t >= l.until) continue;
        if (l.kind === 'keyword') {
          const L0 = l.line != null ? Z.line(l.line) : null, s = textOf(l), n = [...s].length;
          const at = l.at ?? (L0 ? L0.t - 0.05 : S.shot.t0), step = l.step ?? (L0 ? Math.min(0.12, (0.5 * (L0.end - L0.t)) / Math.max(1, n)) : 0);
          const off = l.off || [12 + mis[0], 12 + mis[1]];
          IF.keyword(ink, l.upper ? s.toUpperCase() : s, t, Object.assign({}, l, { at, step, off }));
        } else if (l.kind === 'band') {
          const L0 = l.line != null ? Z.line(l.line) : null, s = textOf(l);
          IF.band(ink, s, Object.assign({}, l, { n: L0 ? (l.words ? Z.wordsAt : Z.charsAt)(l.line, t, { lead: 0.15 }) : null }));
        } else if (l.kind === 'glyph') {
          const [x, y, w, h] = l.rect || [360, 90, 1200, 900];
          const rv = l.reveal ? E.outCubic(Z.inv(l.reveal[0], l.reveal[1], t)) : 1, dc = l.decode ? 1 - Z.inv(l.decode[0], l.decode[1], t) : 0;
          IF.glyphPlate(ink, l.img, { x, y, w, h }, Object.assign({}, l, { reveal: rv, decode: dc, t }));
        } else if (l.kind === 'print') {
          const img = Z.imgSync(l.img); if (!img) continue;
          const ia = l.in ? E.outExpo(Z.inv(l.in.at, l.in.at + (l.in.dur || 0.4), t)) : 1, dy = l.in ? (1 - ia) * (l.in.dy ?? 60) : 0;
          const draw = (col, dx, dyy) => Z.draw.sprite(ctx, Z.tinted(img, ink.col(col), 'ifp' + col + l.img + ink.p[col]), l.x + dx, l.y + dy + dyy, l.h, { anchor: l.anchor || [0.5, 1], alpha: ia, sway: l.sway ?? 0.004, t });
          const sh = l.shadow || [14, 14];
          draw(l.shade || 'bg', sh[0] + mis[0], sh[1] + mis[1]); draw(l.color || 'me', 0, 0);
        } else if (l.kind === 'inks') {
          const img = Z.imgSync(l.img); if (!img) continue;
          const n = l.roles ? l.roles.length : 3, h = l.h ?? 900, w = l.w ?? h * img.width / img.height;
          const [ax, ay] = l.anchor || [0.5, 1], rect = { x: (l.x ?? 960) - w * ax, y: (l.y ?? 1080) - h * ay, w, h };
          const reveal = l.reveal && l.reveal.map(r => (r ? { k: E.outCubic(Z.inv(r[0], r[1], t)), dir: r[2] || 'down' } : null));
          const offset = l.offset || Array.from({ length: n }, (_, j) => [mis[0] * j, mis[1] * j]);   // misreg: each plate a little further out
          IF.inks(ink, img, rect, Object.assign({}, l, { reveal, offset }));
        } else if (l.kind === 'limp') {
          const s = textOf(l), k = l.sag ? E.inOutSine(Z.inv(l.sag[0], l.sag[1], t)) : 1, amt = l.amount ?? 0.7;
          const size = Math.min(l.size ?? 200, ink.fit(s, l.maxW ?? 1700, { font: l.font || 'serif', weight: l.weight ?? 400 }));
          IF.limp(ink, s, l.x ?? 960, l.y ?? 640, Object.assign({}, l, { size,
            squash: u => k * amt * Math.pow(Math.sin(Math.PI * u), 1.5) * (l.side === 'right' ? u : l.side === 'left' ? 1 - u : 1),
            shift: u => [0, k * (l.drop ?? 24) * Math.sin(Math.PI * u)],
          }));
        } else if (l.kind === 'custom' && l.fn) l.fn(ink, S, mis);
      }
      ctx.restore();
    },
  });

  // ================================================================ ifCode
  Z.scene('ifCode', {
    init: loadFonts,
    draw(ctx, S) {
      const a = S.args, t = S.t, ink = IF.ink(ctx, stateOf(a.state, t));
      ctx.save(); camera(ctx, a.camera, S);
      IF.codeGround(ink, a.ground || {});
      if (a.listing) {
        const l = a.listing, cur = l.current ? IF.anim(l.current, t, 0.16) : null;
        IF.listing(ink, l.x ?? 160, l.y ?? 220, l.lines.map(s => (typeof s === 'number' ? '"' + Z.line(s).text + '"' : s)), Object.assign({}, l, { current: cur, hot: l.current ? Math.exp(-8 * Math.max(0, t - (IF.at(l.current.map(([tk]) => [tk, tk]), t, -9)))) : 0 }));
      }
      if (a.terminal) {
        const T = a.terminal, [x, y, w, h] = T.rect || [160, 560, 1600, 420];
        IF.terminal(ink, { x, y, w, h }, T.entries.map(e => Object.assign({}, e, { text: textOf(e) })), t, T);
      }
      if (a.odometer) { const o = a.odometer; IF.odometer(ink, o.x ?? 1300, o.y ?? 300, Z.lerp(o.from ?? 0, o.to ?? 1, E.inOutSine(Z.inv(o.t0, o.t1, t))), o); }
      if (a.fx) a.fx(ink, S);
      ctx.restore();
    },
  });
})();
