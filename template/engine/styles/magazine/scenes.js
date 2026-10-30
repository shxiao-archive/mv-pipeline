/* styles/magazine — scenes.js: the experimental print magazine's stock scenes. Every scene composes a page into the
 * press layers (layout.js) and prints it (press.js). Lyric text never appears in code: `line` holds line indices.
 *
 * common args: img / imgs (paths; none = a stand-in picture, MZ.stand), head (running head: your words), line [i, ...],
 *   press { ...F } (press settings for this shot: inks by MZ.INKS name or '#hex', mode, cell, ...), react 0 (1 = strong drum accents punch the page and slip the plates: the shots that hit, not every shot)
 * The film's own inks / paper: MZ.LOOK = { inkA: 'red', inkB: 'teal', paper: '#efebe2', ... } in the timeline.
 *
 * 'mzSpread'   a two-page spread: a picture on one page, the sung line set in a vertical column on the other beside
 *              empty manuscript squares; folio, crop marks. { img, side 'left' (picture side), line, head, caption [..], gloss, fig { n, label, at } }
 * 'mzContents' a contents page: the song's sections as chapters, page numbers = their bar numbers; rows set on beats,
 *              the current chapter in spot A. { img, title (your words) }
 * 'mzStrips'   the bar cut into its beat groups (Z.clock.meter: 3+3+2, 4+3+3 ...): the group being played develops,
 *              the rest is paper with its count. { img, vertical true, line }
 * 'mzGrid'     the next few bars as page cells sized by their length in tatums; each develops on its own downbeat;
 *              open true: the last cell opens to the whole page. { imgs, bars 4, open, line }
 * 'mzSlam'     a hard cut on every beat group (audio.group_starts, else beats): the next picture and one stamped
 *              character (your words). { imgs, words ['目', ...], hits [t, ...], every 1 }
 * 'mzBurn'     ink-drop holes burn through the page and show the world behind it, raw. { img, world (path | stand),
 *              at [t, ...] (default: strong kicks), max 9, line }
 * 'mzTear'     the page tears across on a cue and parts: the world shows through. { img, world, at, line, head }
 * 'mzContact'  a contact sheet: one frame lights per tatum; windows show the world; a proof ring picks a frame.
 *              { imgs, cols 6, rows 4, windows [k, ...], world, pick k, pickAt t }
 * 'mzDecon'    a character taken apart: { parts: [{ ch, dx, dy, size, exit [dx, dy, rot] | null, at }], result (the
 *              character left), resultAt, size 520 } -- the parts leave as bubbles, the result prints in spot A
 * 'mzFlash'    one full-page picture, key-only negative (or mode 3 raw): MZ.flash(t, args) -> an insert for
 *              Z.withInserts lasting one tatum (a subliminal frame: a picture from before or after, for memory)
 * MZ.stand(kind)   stand-in pictures drawn in code ('horizon' | 'figure' | 'flora' | 'city' | 'deep'): REPLACE with your art
 * MZ.post          the engine's post for a printed film (the press grains and vignettes itself)
 *
 * mv-studio (MIT). Idioms after he-drowns-mv-v2 (longruizhi2-beep, MIT): metre-as-layout strips and grids, the
 * contents page, slam montage, burn holes, torn page, contact sheet, kanji decomposition, subliminal frames; its
 * song, pictures and sea are not used.
 */
(() => {
  'use strict';
  const Z = window.Z, MZ = (Z.MZ = Z.MZ || {}), W = 1920, H = 1080, TAU = Math.PI * 2;
  const clamp = Z.clamp, lerp = Z.lerp, E = Z.ease, ink = MZ.ink;
  const NUM = '〇一二三四五六七八九十';

  MZ.post = { boil: 0, bloom: 0, grain: 0, vignette: 0, lutMix: 0 };
  MZ.LOOK = MZ.LOOK || {};
  const fonts = { init: () => MZ.loadFonts() };
  const preload = a => [a.img, a.world, ...(a.imgs || [])].filter(p => typeof p === 'string' && /\.(png|jpe?g|webp)$/i.test(p));

  // ---------------------------------------------------------------- stand-in pictures (cached canvases)
  const stands = new Map();
  MZ.stand = (kind = 'horizon') => {
    if (stands.has(kind)) return stands.get(kind);
    const cv = Z.canvas(1600, 1000), g = cv.getContext('2d'), w = 1600, h = 1000, r = (k, s = 0) => Z.rnd(k, s, kind.length);
    const grad = (stops, y0 = 0, y1 = h) => { const q = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([k, c]) => q.addColorStop(k, c)); return q; };
    if (kind === 'figure') {
      g.fillStyle = grad([[0, '#e9e4dc'], [1, '#9aa6ad']]); g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,250,240,.7)'; g.beginPath(); g.arc(w * 0.62, h * 0.32, 260, 0, TAU); g.fill();
      g.fillStyle = '#3a2422';
      g.beginPath(); g.ellipse(w * 0.5, h * 0.3, 70, 86, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(w * 0.5 - 60, h * 0.4); g.bezierCurveTo(w * 0.5 - 190, h * 0.46, w * 0.5 - 170, h * 0.8, w * 0.5 - 250, h);
      g.lineTo(w * 0.5 + 250, h); g.bezierCurveTo(w * 0.5 + 170, h * 0.8, w * 0.5 + 190, h * 0.46, w * 0.5 + 60, h * 0.4); g.fill();
      g.fillStyle = '#8c1f22'; g.beginPath(); g.moveTo(w * 0.5 - 120, h * 0.62); g.lineTo(w * 0.5 + 120, h * 0.62); g.lineTo(w * 0.5 + 210, h); g.lineTo(w * 0.5 - 210, h); g.fill();
    } else if (kind === 'flora') {
      g.fillStyle = '#ece6da'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 46; k++) {
        const x = r(k, 1) * w, y = r(k, 2) * h, s = 50 + r(k, 3) * 150, hue = [['#c8323a', '#7d1420'], ['#1f7f86', '#0d4d55'], ['#d9a441', '#8a5a12']][k % 3];
        for (let p = 0; p < 6; p++) { g.fillStyle = hue[0]; g.globalAlpha = 0.75; g.beginPath(); g.ellipse(x + Math.cos(p) * s * 0.5, y + Math.sin(p) * s * 0.5, s * 0.5, s * 0.28, p, 0, TAU); g.fill(); }
        g.globalAlpha = 1; g.fillStyle = hue[1]; g.beginPath(); g.arc(x, y, s * 0.2, 0, TAU); g.fill();
      }
    } else if (kind === 'city') {
      g.fillStyle = grad([[0, '#0b1020'], [1, '#26324a']]); g.fillRect(0, 0, w, h);
      for (let k = 0; k < 40; k++) {
        const bw = 40 + r(k, 1) * 110, bh = 200 + r(k, 2) * 600, x = (k / 40) * w + r(k, 3) * 30, y = h - bh;
        g.fillStyle = '#060912'; g.fillRect(x, y, bw, bh);
        for (let yy = y + 14; yy < h - 10; yy += 22) for (let xx = x + 8; xx < x + bw - 8; xx += 16) if (r(xx, yy) > 0.62) { g.fillStyle = r(yy, xx) > 0.5 ? '#ffcf6a' : '#ff8a3d'; g.fillRect(xx, yy, 7, 10); }
      }
    } else if (kind === 'deep') {
      g.fillStyle = grad([[0, '#2b6d78'], [0.5, '#0f2f3d'], [1, '#050b12']]); g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 9; k++) { const x = r(k, 1) * w; const q = g.createLinearGradient(x, 0, x + 260, h); q.addColorStop(0, 'rgba(160,230,230,.22)'); q.addColorStop(1, 'rgba(160,230,230,0)'); g.fillStyle = q; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 60 + r(k, 2) * 80, 0); g.lineTo(x + 380, h); g.lineTo(x + 200, h); g.fill(); }
      for (let k = 0; k < 160; k++) { g.fillStyle = `rgba(200,240,240,${0.2 + r(k, 4) * 0.5})`; g.beginPath(); g.arc(r(k, 5) * w, r(k, 6) * h, 1 + r(k, 7) * 4, 0, TAU); g.fill(); }
    } else {                                                                  // horizon: sky, a pale disc, the sea in bands
      g.fillStyle = grad([[0, '#c9d3d8'], [0.55, '#eef0ec'], [0.551, '#5d7584'], [1, '#1d2f3a']]); g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(w * 0.66, h * 0.3, 70, 0, TAU); g.fill();
      for (let k = 0; k < 140; k++) { const y = h * 0.56 + Math.pow(r(k, 1), 1.6) * h * 0.44; g.strokeStyle = `rgba(${r(k, 2) > 0.7 ? '235,240,240' : '10,25,35'},${0.25 + r(k, 3) * 0.4})`; g.lineWidth = 1 + (y - h * 0.55) / 90; g.beginPath(); const x = r(k, 4) * w; g.moveTo(x, y); g.lineTo(x + 80 + r(k, 5) * 400, y); g.stroke(); }
    }
    stands.set(kind, cv);
    return cv;
  };
  const pic = (src, k = 0) => (typeof src === 'string' && /\.(png|jpe?g|webp)$/i.test(src) ? src : MZ.stand(src || ['horizon', 'figure', 'flora', 'city'][k % 4]));
  const world = a => { const cv = Z.scratch[2], g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.clearRect(0, 0, W, H); MZ.photo(g, pic(a.world || 'deep'), 0, 0, W, H); return cv; };

  // ---------------------------------------------------------------- a page: begin, the film's look + the shot's press, print
  const look = F => { for (const [k, v] of Object.entries(MZ.LOOK)) F[k] = Array.isArray(v) ? v.slice() : v; };
  const named = F => { for (const k of ['paper', 'outside', 'inkK', 'inkA', 'inkB', 'lightK', 'lightA', 'lightB']) if (MZ.INKS[F[k]]) F[k] = MZ.INKS[F[k]]; };
  const page = (ctx, S, draw) => {
    const L = MZ.begin(); look(L.F);
    const back = draw(L.P, L.I, L.F) || null;
    if (S.args.press) Object.assign(L.F, S.args.press);
    named(L.F);
    MZ.react(L.F, S.t, S.args.react ?? 0);
    MZ.print(ctx, L.F, S.t, back);
  };
  const paper = P => { P.fillStyle = '#fff'; P.fillRect(0, 0, W, H); };
  const fit = (i, size, room) => Math.min(size, room / Math.max(1, MZ.vheight(Z.line(i).text, 1)));   // a long line is set smaller to fit the column
  const current = (lines, t) => { let k = -1; (lines || []).forEach((i, j) => { if (Z.line(i).t - 0.25 <= t) k = j; }); return k; };
  const meter = t => (Z.clock ? Z.clock.meter(t) : { bar: 0, meter: '4/4', len: 16, q: 0, group: 0, groups: [4, 4, 4, 4], gq: 0, gPhase: 0, tatum: 0.125 });
  const hitsIn = (list, a, b) => (list || []).filter(x => x >= a - 1e-6 && x <= b);
  // the sung line on a paper band over a picture (the band is bare paper in the proof, so the key ink always reads)
  const band = (P, I, lines, t, y = H - 120, size = 60) => {
    const k = current(lines, t); if (k < 0) return;
    const txt = Z.line(lines[k]).text; I.save(); I.font = `800 ${size}px ${MZ.FONT.min}`; const w = I.measureText(txt).width + 0.02 * size * [...txt].length; I.restore();
    P.save(); P.globalCompositeOperation = 'source-over'; P.fillStyle = '#fff'; P.fillRect(W / 2 - w / 2 - 40, y - size * 1.05, w + 80, size * 1.45); P.restore();
    MZ.lyricH(I, lines[k], t, W / 2, y, size, { align: 'center', color: MZ.ink(MZ.K) });
  };

  // ---------------------------------------------------------------- mzSpread
  Z.scene('mzSpread', {
    preload, init: fonts.init,
    draw(ctx, S) {
      const a = S.args, left = (a.side || 'left') === 'left', t = S.t;
      page(ctx, S, (P, I) => {
        paper(P);
        const px = left ? 0 : W / 2;
        MZ.photo(P, pic(a.img), px + 70, 70, W / 2 - 140, H - 160, { zoom: 1 + 0.04 * S.p, fy: 0.45 });
        MZ.line(I, W / 2, 40, W / 2, H - 40, 1, ink(MZ.K, 0.4));                    // the gutter
        MZ.cropMarks(I, px + 70, 70, W / 2 - 140, H - 160, { color: ink(MZ.K, 0.7) });
        const tx = left ? W / 2 : 0, lines = a.line || [], k = current(lines, t);
        if (k >= 0) {
          MZ.lyricV(I, lines[k], t, tx + W / 2 - 260, 150, fit(lines[k], 92, H - 300), { color: ink(MZ.K) });
          MZ.genko(I, tx + W / 2 - 380, 170, 6, 14, 48, { color: ink(MZ.A, 0.35) });     // one sung line per frame: the columns before it are empty squares
        }
        if (a.caption) MZ.caption(I, a.caption, tx + 90, H - 190, { size: 13 });
        if (a.gloss) MZ.gloss(I, a.gloss, tx + 90, H - 110, { color: ink(MZ.A) });
        if (a.fig) MZ.fig(I, a.fig.n || 1, left ? W / 2 + 60 : W / 2 - 60, 120, px + (W / 4), H * 0.42, a.fig.label || '', { p: clamp((t - (a.fig.at ?? S.shot.t0)) / 0.4) });
        MZ.folio(I, t, { side: left ? 'right' : 'left', head: a.head });
      });
    },
  });

  // ---------------------------------------------------------------- mzContents
  Z.scene('mzContents', {
    preload, init: fonts.init,
    draw(ctx, S) {
      const a = S.args, t = S.t, secs = ((Z.audio && Z.audio.sections) || []).filter(s => s.label !== 'tail').slice(0, 12);
      page(ctx, S, (P, I) => {
        paper(P);
        MZ.photo(P, pic(a.img, 1), 70, 70, W / 2 - 140, H - 160);
        MZ.line(I, W / 2, 40, W / 2, H - 40, 1, ink(MZ.K, 0.4));
        MZ.vtext(I, a.title || '目次', W - 150, 110, 64, { color: ink(MZ.K) });
        const beats = Z.clock ? Z.clock.beats.filter(b => b >= S.shot.t0) : [];
        secs.forEach((s, j) => {
          const due = beats[j] ?? S.shot.t0 + j * 0.3, vis = clamp((t - due) / 0.12);
          if (vis <= 0) return;
          const x = W - 270 - j * 92, on = t >= s.start && t < s.end, col = ink(on ? MZ.A : MZ.K, vis);
          MZ.vtext(I, j < 10 ? NUM[j + 1] : String(j + 1), x, 120, 34, { color: col, weight: 800 });
          MZ.vtext(I, String(s.name || s.label).slice(0, 14), x, 190, 26, { color: col, weight: 500, gap: 0.08 });
          const bar = (s.bars && s.bars[0]) || 0;
          MZ.text(I, String(bar).padStart(3, '0'), x, H - 150, { font: `500 15px ${MZ.FONT.mono}`, color: col, align: 'center' });
        });
        MZ.folio(I, t, { side: 'right', head: a.head });
      });
    },
  });

  // ---------------------------------------------------------------- mzStrips
  Z.scene('mzStrips', {
    preload, init: fonts.init,
    draw(ctx, S) {
      const a = S.args, t = S.t, m = meter(t), vert = a.vertical !== false, n = m.len || 16;
      page(ctx, S, (P, I, F) => {
        paper(P);
        let s = 0;
        m.groups.forEach((g, k) => {
          const u0 = s / n, u1 = (s + g) / n; s += g;
          const [x, y, w, h] = vert ? [70 + u0 * (W - 140), 70, (u1 - u0) * (W - 140), H - 160] : [70, 70 + u0 * (H - 160), W - 140, (u1 - u0) * (H - 160)];
          const on = k === m.group, past = k < m.group;
          if (on || past) {
            P.save(); P.beginPath(); P.rect(x, y, w, h); P.clip();
            MZ.photo(P, pic(a.img), 70, 70, W - 140, H - 160, { zoom: 1.05, alpha: on ? 1 : 0.22 });
            P.restore();
          }
          MZ.line(I, x, y, vert ? x : x + w, vert ? y + h : y, 2, ink(MZ.K));
          MZ.text(I, `${k + 1}/${m.groups.length}`, x + 14, y + 30, { font: `500 16px ${MZ.FONT.mono}`, color: ink(on ? MZ.A : MZ.K) });
          MZ.text(I, '·'.repeat(g / 2 | 0 || 1), x + 14, y + 52, { font: `500 16px ${MZ.FONT.mono}`, color: ink(MZ.K, 0.6) });
        });
        MZ.meterGlyph(I, m.meter, W - 120, H - 140, 46, { color: ink(MZ.A) });
        band(P, I, a.line, t, H - 120, 64);
        MZ.ruler(I, t, 70, H - 40, 720);
        MZ.folio(I, t, { side: 'right', head: a.head });
        F.flash = [1, 1, 1, 0.25 * (Z.clock ? Z.clock.groupPulse(t, 18) : 0)];
      });
    },
  });

  // ---------------------------------------------------------------- mzGrid
  const barsFrom = (t, n) => {
    const out = []; let m = meter(t + 1e-3), t0 = t + 1e-3 - m.q * m.tatum;
    for (let k = 0; k < n; k++) { m = meter(t0 + 1e-3); const len = m.len || 16; out.push({ t0, len, meter: m.meter }); t0 += len * m.tatum; }
    return out;
  };
  Z.scene('mzGrid', {
    preload, init: fonts.init,
    draw(ctx, S) {
      const a = S.args, t = S.t, bars = barsFrom(S.shot.t0, a.bars || 4), total = bars.reduce((s, b) => s + b.len, 0), imgs = a.imgs || [];
      page(ctx, S, (P, I) => {
        paper(P);
        let s = 0;
        bars.forEach((b, k) => {
          const x = 70 + (s / total) * (W - 140), w = (b.len / total) * (W - 140); s += b.len;
          const last = k === bars.length - 1, open = a.open && last ? E.inOutCubic(clamp((t - b.t0) / 0.5)) : 0;
          const [rx, ry, rw, rh] = [lerp(x, 0, open), lerp(150, 0, open), lerp(w, W, open), lerp(H - 300, H, open)];
          if (t >= b.t0) { P.save(); P.beginPath(); P.rect(rx, ry, rw, rh); P.clip(); MZ.photo(P, pic(imgs[k], k), rx, ry, rw, rh, { zoom: 1 + 0.05 * clamp((t - b.t0) / 2) }); P.restore(); }
          if (open < 1) {
            MZ.line(I, x, 120, x, H - 120, 1, ink(MZ.K));
            MZ.text(I, b.meter, x + 10, 140, { font: `500 14px ${MZ.FONT.mono}`, color: ink(MZ.K) });
            MZ.text(I, String(b.len), x + w - 10, H - 130, { font: `500 14px ${MZ.FONT.mono}`, color: ink(MZ.A), align: 'right' });
          }
        });
        band(P, I, a.line, t, H - 50, 52);
        MZ.folio(I, t, { side: 'left', head: a.head, y: 60 });
      });
    },
  });

  // ---------------------------------------------------------------- mzSlam
  Z.scene('mzSlam', {
    preload, init: fonts.init,
    draw(ctx, S) {
      const a = S.args, t = S.t, imgs = a.imgs || ['horizon', 'figure', 'flora', 'city'], words = a.words || [];
      const list = a.hits || (Z.audio && Z.audio.group_starts) || (Z.clock ? Z.clock.beats : []);
      const hs = hitsIn(list, S.shot.t0, t).filter((_, j) => j % (a.every || 1) === 0), idx = Math.max(0, hs.length - 1), since = hs.length ? t - hs[hs.length - 1] : S.lt;
      page(ctx, S, (P, I, F) => {
        paper(P);
        MZ.photo(P, pic(imgs[idx % imgs.length], idx), 0, 0, W, H, { fx: 0.3 + 0.4 * Z.rnd(idx, 3), zoom: 1.1 });
        F.mode = [0, 2, 0, 3][idx % 4]; F.monoInk = idx % 2 ? 1 : 0; F.cell = 6 + (idx % 3) * 2;
        const word = words.length ? words[idx % words.length] : '';
        if (word) {
          const sc = lerp(2.4, 1, E.outExpo(clamp(since / 0.22)));
          I.save(); I.translate(W * (0.3 + 0.4 * Z.rnd(idx, 5)), H * 0.5); I.scale(sc, sc);
          I.font = `400 520px ${MZ.FONT.dela}, sans-serif`; I.textAlign = 'center'; I.textBaseline = 'middle';
          I.globalAlpha = clamp(since / 0.04); I.fillStyle = ink(idx % 2 ? MZ.A : MZ.K); I.fillText(word, 0, 0); I.restore();
        }
        band(P, I, a.line, t);
        MZ.text(I, String(idx + 1).padStart(2, '0'), 60, 80, { font: `500 18px ${MZ.FONT.mono}`, color: ink(MZ.K) });
        MZ.folio(I, t, { side: 'right', head: a.head });
      });
    },
  });

  // ---------------------------------------------------------------- mzBurn
  Z.scene('mzBurn', {
    preload, init: fonts.init,
    draw(ctx, S) {
      const a = S.args, t = S.t, max = a.max ?? 9;
      const kicks = ((Z.audio && Z.audio.onsets && Z.audio.onsets.kick) || []).filter(o => o[1] >= 0.8).map(o => o[0]);
      const at = hitsIn(a.at || kicks, S.shot.t0, t).slice(0, max);
      page(ctx, S, (P, I, F) => {
        paper(P);
        MZ.photo(P, pic(a.img, 1), 70, 70, W / 2 - 140, H - 160);
        const k = current(a.line, t);
        if (k >= 0) MZ.lyricV(I, a.line[k], t, W - 300, 150, fit(a.line[k], 92, H - 300), { color: ink(MZ.K) });
        MZ.folio(I, t, { side: 'right', head: a.head });
        at.forEach((t0, j) => {
          const r = (90 + 150 * Z.rnd(j, 11)) * E.outCubic(clamp((t - t0) / 0.35)), x = 160 + Z.rnd(j, 12) * (W - 320), y = 140 + Z.rnd(j, 13) * (H - 280);
          if (r < 1) return;
          I.save(); I.globalCompositeOperation = 'source-over';
          MZ.dropPath(I, x, y, r * 1.1, j, 0.5); I.fillStyle = ink(MZ.K, 0.6); I.fill();               // the scorched rim
          MZ.dropPath(I, x, y, r, j, 0.5); I.fillStyle = '#000'; I.fill(); I.restore();
          P.save(); P.globalCompositeOperation = 'destination-out'; MZ.dropPath(P, x, y, r, j, 0.5); P.fill(); P.restore();
        });
        F.backMode = 1;
        return world(a);
      });
    },
  });

  // ---------------------------------------------------------------- mzTear
  const tearLayer = (c, cut, seed, gap, blackOut) => {
    const tmp = Z.scratch[1], g = tmp.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'copy'; g.drawImage(c.canvas, 0, 0); g.globalCompositeOperation = 'source-over';
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over';
    if (blackOut) { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); } else c.clearRect(0, 0, W, H);
    for (const [down, dy, rot] of [[false, -gap / 2, -gap / 9000], [true, gap / 2, gap / 12000]]) {
      c.save(); c.translate(W / 2, cut + dy); c.rotate(rot); c.translate(-W / 2, -cut);
      MZ.tornPath(c, -60, W + 60, cut, 46, seed, down); c.clip(); c.drawImage(tmp, 0, 0); c.restore();
    }
    c.restore();
  };
  Z.scene('mzTear', {
    preload, init: fonts.init,
    draw(ctx, S) {
      const a = S.args, t = S.t, at = a.at ?? S.shot.t0 + S.dur * 0.5, q = E.outCubic(clamp((t - at) / 0.6)), gap = q * H * (a.open ?? 0.55);
      page(ctx, S, (P, I, F) => {
        paper(P);
        MZ.photo(P, pic(a.img, 2), 0, 0, W, H, { alpha: 0.9 });
        MZ.folio(I, t, { side: 'left', head: a.head });
        if (gap > 0.5) { tearLayer(P, H * 0.5, 7, gap, false); tearLayer(I, H * 0.5, 7, gap, true); }
        band(P, I, a.line, t, gap > 0.5 ? H * 0.5 + 34 : H * 0.32, 96);            // the sung line survives on a scrap of paper
        F.backMode = 1;
        return world(a);
      });
    },
  });

  // ---------------------------------------------------------------- mzContact
  Z.scene('mzContact', {
    preload, init: fonts.init,
    draw(ctx, S) {
      const a = S.args, t = S.t, cols = a.cols || 6, rows = a.rows || 4, N = cols * rows, imgs = a.imgs || ['horizon', 'figure', 'flora', 'city'];
      const tat = meter(t).tatum, lit = Math.floor(S.lt / tat) % N, win = new Set(a.windows || []);
      const fw = (W - 200) / cols, fh = (H - 220) / rows;
      page(ctx, S, (P, I, F) => {
        P.fillStyle = '#2a2826'; P.fillRect(0, 0, W, H);                                   // the film rebate prints dark
        for (let k = 0; k < N; k++) {
          const x = 100 + (k % cols) * fw, y = 110 + Math.floor(k / cols) * fh;
          if (win.has(k)) { P.save(); P.globalCompositeOperation = 'destination-out'; P.fillRect(x + 6, y + 6, fw - 12, fh - 24); P.restore(); }
          else MZ.photo(P, pic(imgs[k % imgs.length], k), x + 6, y + 6, fw - 12, fh - 24, { fx: Z.rnd(k, 2), zoom: 1.2, filter: k === lit ? 'none' : 'brightness(.55)' });
          MZ.text(I, String(k + 1).padStart(2, '0') + (k === lit ? ' ▶' : ''), x + 8, y + fh - 4, { font: `500 13px ${MZ.FONT.mono}`, color: ink(MZ.A) });
        }
        band(P, I, a.line, t, H - 30, 44);
        if (a.pick != null) { const x = 100 + (a.pick % cols) * fw + fw / 2, y = 110 + Math.floor(a.pick / cols) * fh + fh / 2 - 9; MZ.proofCircle(I, x, y, fw * 0.55, fh * 0.55, 3, clamp((t - (a.pickAt ?? S.shot.t0 + S.dur * 0.6)) / 0.4)); }
        MZ.folio(I, t, { side: 'right', head: a.head });
        F.backMode = 1; F.cell = 5;
        return win.size ? world(a) : null;
      });
    },
  });

  // ---------------------------------------------------------------- mzDecon
  Z.scene('mzDecon', {
    init: fonts.init,
    draw(ctx, S) {
      const a = S.args, t = S.t, size = a.size || 520, parts = a.parts || [], cx = W / 2, cy = H / 2;
      const lastAt = Math.max(S.shot.t0, ...parts.filter(p => p.exit).map(p => p.at ?? S.shot.t0)), rAt = a.resultAt ?? lastAt + 0.3, rk = E.outCubic(clamp((t - rAt) / 0.4));
      page(ctx, S, (P, I) => {
        paper(P);
        MZ.grid(I, cx - size * 0.6, cy - size * 0.6, size * 1.2, size * 1.2, 4, 4, { color: ink(MZ.K, 0.25) });
        for (const p of parts) {
          const go = p.exit ? E.inOutCubic(clamp((t - (p.at ?? S.shot.t0)) / 0.9)) : rk;
          const [ex, ey, er] = p.exit || [0, 0, 0], x = cx + (p.dx || 0) + ex * go, y = cy + (p.dy || 0) + ey * go;
          I.save(); I.translate(x, y); I.rotate(er * go);
          I.font = `800 ${p.size || size}px ${MZ.FONT.min}, serif`; I.textAlign = 'center'; I.textBaseline = 'middle';
          I.fillStyle = ink(MZ.K, 1 - go); I.fillText(p.ch, 0, 0); I.restore();
          if (p.exit && go > 0 && go < 1) for (let b = 0; b < 7; b++) {                    // it leaves as bubbles
            const u = clamp(go - b * 0.07), bx = cx + (p.dx || 0) + ex * u + Math.sin(b * 2.1 + t * 3) * 14, by = cy + (p.dy || 0) + ey * u;
            I.save(); I.strokeStyle = ink(MZ.K, 0.7 * (1 - go)); I.lineWidth = 2; I.beginPath(); I.arc(bx, by, 4 + b * 2, 0, TAU); I.stroke(); I.restore();
          }
        }
        const lk = current(a.line, t);
        if (lk >= 0) MZ.lyricV(I, a.line[lk], t, W - 220, 130, fit(a.line[lk], 72, H - 260), { color: ink(MZ.K) });
        if (a.result && rk > 0) { I.save(); I.font = `800 ${size}px ${MZ.FONT.min}, serif`; I.textAlign = 'center'; I.textBaseline = 'middle'; I.fillStyle = ink(MZ.A, rk); I.fillText(a.result, cx, cy); I.restore(); }
        MZ.folio(I, t, { side: 'right', head: a.head });
      });
    },
  });

  // ---------------------------------------------------------------- mzFlash + MZ.flash (a subliminal insert)
  Z.scene('mzFlash', {
    preload, init: fonts.init,
    draw(ctx, S) {
      const a = S.args;
      page(ctx, S, (P, I, F) => {
        paper(P);
        MZ.photo(P, pic(a.img, 3), 0, 0, W, H, { crop: a.crop, filter: a.raw ? 'none' : 'grayscale(1) contrast(1.5)' });
        MZ.text(I, '*', 40, 70, { font: `500 28px ${MZ.FONT.mono}`, color: ink(MZ.K) });
        F.mode = a.raw ? 3 : 2; F.monoInk = 0; F.neg = a.raw ? 0 : 1; F.cell = 8;
      });
    },
  });
  MZ.flash = (t, args = {}) => { const tat = (Z.clock ? Z.clock.meter(t).tatum : 0.125) || 0.125; return { t0: t, t1: t + tat, shot: { scene: 'mzFlash', args, lyric: 'none' } }; };
})();
