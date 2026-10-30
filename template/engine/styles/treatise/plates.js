/* styles/treatise — plates.js: seven PLATES, each its own drawing idiom; every plate sets its lyric line its own way.
 * args.line = the lyric line index (text read from Z.LYR at draw time; never in code). args.cam = TR.cam spec.
 *
 * 'trSheet'   the bookend: a construction sheet with crop marks; the spark writes the title. { title, sub, close (crop
 *             marks fly in and the sheet closes: the last frame matches the first) }
 * 'trPlot'    a chart: axes draw in, the spark draws the curve, the line rides it word by word. { line, mode 'drop' |
 *             'exp' | 'walk', inv (bone paper), xl, yl }
 * 'trScope'   an oscilloscope under glass: the trace is the song (Z.env), echoes fade; the line rides the wave. { line }
 * 'trForm'    bureaucracy on bone paper: the line is typed into a form as sung; a stamp slams on a word. { line, form,
 *             field, stamp ('APPROVED'), stampWord (index; default the last), boxes (4 checkbox labels) }
 * 'trPrompt'  a prompt field: the line typed as tokens, each with a tiny next-token distribution (the other candidates
 *             are other words of the song), then the return key. { line, rings, label ('> prompt') }
 * 'trHook'    the hook slam: one word per sung word, full frame, then the running number takes the frame and rolls to
 *             its next value. { line, n 1..4 (escalation: clean / signal field / hairline / maximal), foot (its footnote) }
 * 'trContour' a topographic engraving: the camera drifts over contour lines, the spark travels, the words are map
 *             labels with leaders. { line, seed }
 *
 * mv-studio (MIT). Plates after pdoom-video by Giacomo Magnanini (MIT; ideas and idioms, code written for this engine).
 */
(() => {
  'use strict';
  const Z = window.Z, TR = (Z.TR = Z.TR || {}), E = Z.ease, W = 1920, H = 1080, TAU = Math.PI * 2;
  const P = TR.PAL;
  const fonts = { async init() { await Promise.all(TR.fontsToLoad.map(f => document.fonts.load(f, 'Aa0あ'))); } };
  const ground = (c, inv) => { c.fillStyle = inv ? P.bone : P.ink; c.fillRect(0, 0, W, H); };
  const ink = inv => (inv ? P.ink : P.bone);

  // ---------------------------------------------------------------- trSheet: the bookend
  Z.scene('trSheet', Object.assign({}, fonts, {
    draw(c, S) {
      const a = S.args, k = a.close ? 1 - E.inOutCubic(Z.clamp(S.lt / S.dur)) : E.outExpo(Z.clamp(S.lt / 0.9));
      ground(c, false);
      c.save(); TR.cam(c, S, a.cam || (a.close ? { from: { zoom: 1.0 }, to: { zoom: 1.4 }, ease: 'inOutCubic' } : { from: { zoom: 1.4 }, to: { zoom: 1.0 }, ease: 'inOutSine' }));   // the close ends on the opening's first framing: the film loops
      const X = 220, Y = 150, w = 1480, h = 780;
      c.fillStyle = P.ink2; c.fillRect(X, Y, w, h);
      TR.grid(c, X, Y, w, h, 40, { major: 5, reveal: E.outExpo(Z.clamp((S.lt - 0.2) / 1.2)) * k });
      TR.cropMarks(c, X, Y, w, h, { k });
      // construction: an axis and a compass arc, then the spark writes the title (revealed at the spark's x)
      const title = a.title ?? Z.TITLE ?? '', px = 170, tw = title ? TR.measure(c, title, px, { weight: 900, width: 112 }) : 0, tx = 960 - tw / 2, ty = 600;
      const wr = Math.max(1, S.dur * 0.75 - 0.5), u = a.close ? 1 : E.inOutCubic(Z.clamp((S.lt - 0.5) / wr));   // the closing sheet keeps the title written
      c.save(); c.strokeStyle = P.bone; c.globalAlpha = 0.5 * k; c.lineWidth = 1;
      c.beginPath(); c.arc(960, ty - 60, 330, Math.PI * 1.05, Math.PI * (1.05 + 0.9 * u)); c.stroke();
      c.beginPath(); c.moveTo(tx - 40, ty + 30); c.lineTo(tx - 40 + (tw + 80) * u, ty + 30); c.stroke(); c.restore();
      if (title) {
        c.save(); c.beginPath(); c.rect(0, 0, tx + tw * u, H); c.clip();
        TR.text(c, title, tx, ty, px, { weight: 900, width: Z.lerp(125, 112, E.outExpo(u)), alpha: k }); c.restore();
        if (u > 0 && u < 1) TR.spark(c, tx + tw * u, ty + 30, S.t, { particles: tt => ({ x: tx + tw * E.inOutCubic(Z.clamp((tt - S.shot.t0 - 0.5) / wr)), y: ty + 30 }) });
      }
      const sub = a.sub ?? Z.TITLE_SUB ?? '';
      if (sub) TR.text(c, sub, 960, ty + 110, 52, { face: 'serif', italic: true, weight: 500, align: 'center', alpha: k * Z.clamp((u - 0.6) * 3) });
      if (Z.CREDIT) TR.text(c, Z.CREDIT, X + 24, Y + h - 24, 20, { face: 'mono', col: P.ash, alpha: k * Z.clamp((u - 0.8) * 5) });
      c.save(); c.globalAlpha *= k; TR.readout(c, X + w - 190, Y + h - 70, 40, S.t); c.restore();   // fades with the sheet: last frame = first
      c.restore();
    },
  }));

  // ---------------------------------------------------------------- trPlot: the spark draws the curve, the line rides it
  const CURVES = {
    drop: u => (u < 0.55 ? 0.78 - 0.04 * u + 0.025 * Z.noise1(u * 40, 3) : 0.78 - 0.62 * E.outExpo(Z.clamp((u - 0.55) / 0.12)) + 0.015 * Z.noise1(u * 40, 5)),
    exp: u => 0.06 + 0.86 * (Math.exp(4 * u) - 1) / (Math.exp(4) - 1) + 0.01 * Z.noise1(u * 50, 2),
    walk: u => 0.45 + 0.3 * Z.fbm1(u * 6, 11, 3),
  };
  Z.scene('trPlot', Object.assign({}, fonts, {
    draw(c, S) {
      const a = S.args, inv = !!a.inv, col = ink(inv), f = CURVES[a.mode || 'drop'] || CURVES.drop;
      const X = 200, Y = 170, w = 1520, h = 640, kx = E.outExpo(Z.clamp(S.lt / 0.5));
      const u = E.inOutSine(Z.clamp((S.lt - 0.15) / (S.dur - 0.3))), pt = q => [X + w * q, Y + h - h * f(q)];
      ground(c, inv);
      c.save(); TR.cam(c, S, a.cam || Object.assign({ follow: pt(u) }, (a.mode === 'drop' ? { from: { zoom: 1.0, x: -100 }, to: { zoom: 1.1, x: 90, y: 40 }, ease: 'linear' } : { from: { zoom: 1.0, x: 140 }, to: { zoom: 1.1, x: -80, y: -30 } })));
      TR.grid(c, X, Y, w, h, 64, { col: inv ? P.ash : P.graphite, a: 0.3 });
      TR.axes(c, X, Y, w, h, { col, k: kx, xl: a.xl || 'step', yl: a.yl || 'value' });
      const pts = []; for (let q = 0; q <= u + 1e-6; q += 0.004) pts.push(pt(Math.min(q, u)));
      TR.trail(c, pts, { w: 2.5, glow: !inv });
      if (a.line != null) {                                   // the line rides the curve in reading order, each word lit as sung
        let x = X + 20;
        TR.lineWords(c, a.line, S.t, 0, 0, 56, { weight: 800, width: 96, lead: 0.3, dimCol: col, sungCol: col,
          place: (wd) => { const ww = TR.measure(c, wd.w, 56, { weight: 800, width: 96 }), q = Z.clamp((x + ww / 2 - X) / w), y = Y + h - h * f(q) - 34; const r = { x, y }; x += ww + 22; return r; } });
      }
      const [hx, hy] = pt(u); TR.spark(c, hx, hy, S.t, { light: inv ? 0.15 : 1, particles: tt => { const q = E.inOutSine(Z.clamp((tt - S.shot.t0 - 0.15) / (S.dur - 0.3))); const [x, y] = pt(q); return { x, y }; } });
      TR.readout(c, X + w - 170, Y + 10, 34, S.t, { col: inv ? P.graphite : P.ash });
      c.restore();
    },
  }));

  // ---------------------------------------------------------------- trScope: the song as a trace under glass
  Z.scene('trScope', Object.assign({}, fonts, {
    draw(c, S) {
      const a = S.args, X = 160, Y = 140, w = 1600, h = 760, cy = Y + h / 2;
      ground(c, false);
      c.save(); TR.cam(c, S, a.cam || { snap: 0 });   // locked: the trace is the motion
      c.fillStyle = P.ink2; c.fillRect(X, Y, w, h);
      TR.grid(c, X, Y, w, h, 80, { major: 5, a: 0.28 });
      const wave = (t, x) => { const e = S.env.rms(t), v = S.env.vocal ? S.env.vocal(t) : 0, q = (x - X) / w; return cy - h * 0.32 * (0.25 + e) * Math.sin(q * TAU * (2 + 3 * v) + t * 7) * Math.sin(q * Math.PI) - 40 * S.clock.pulse(t, 9) * Math.sin(q * TAU * 9); };
      for (let echo = 4; echo >= 0; echo--) {
        const te = S.t - echo * 0.06, pts = []; for (let x = X; x <= X + w; x += 8) pts.push([x, wave(te, x)]);
        if (echo) { c.save(); c.strokeStyle = Z.rgba(P.signal, 0.18 / echo); c.lineWidth = 2; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); c.restore(); }
        else TR.trail(c, pts, { w: 2.2 });
      }
      TR.text(c, 'CH1  ' + (S.env.rms(S.t) * 2).toFixed(2) + ' V/div   TIME 5 ms/div', X + 24, Y + h - 24, 20, { face: 'mono', col: P.ash });
      TR.readout(c, X + w - 190, Y + 30, 34, S.t);
      // the line rides the wave: words laid left to right, each sitting on the trace where it falls
      if (a.line != null) {
        let x = X + 90;
        for (const wd of TR.words(a.line)) {
          const ww = TR.measure(c, wd.w, 62, { weight: 700 }), on = S.t >= wd.t0, cur = on && S.t < wd.t1;
          if (S.t >= Z.line(a.line).t - 0.4) TR.text(c, wd.w, x, wave(S.t, x + ww / 2) - 30, 62, { weight: 700, col: cur ? P.signal : P.bone, alpha: on ? 1 : 0.3 });
          x += ww + 26; if (x > X + w - 200) x = X + 90;
        }
      }
      c.restore();
    },
  }));

  // ---------------------------------------------------------------- trForm: bureaucracy (bone paper)
  Z.scene('trForm', Object.assign({}, fonts, {
    draw(c, S) {
      const a = S.args, X = 300, Y = 110, w = 1320, h = 860;
      const n = a.line != null ? [...Z.line(a.line).text].length : 0, head = n ? Z.charsAt(a.line, S.t, { lead: 0 }) / n : S.p;
      ground(c, true);
      c.save(); TR.cam(c, S, a.cam || { from: { zoom: 1.05, rot: -0.03 }, to: { zoom: 1.15, rot: 0.02 }, follow: [X + 120 + (w - 240) * head, Y + 300 + 90 * Math.floor(head * 1.6)], followK: 0.3 });
      const words = a.line != null ? TR.words(a.line) : [], sw = words[a.stampWord ?? words.length - 1], hit = sw ? S.t - sw.t0 : -1;
      if (hit > 0 && hit < 0.25) { const [dx, dy] = [Z.rnds(Math.floor(S.t * 30), 1) * 8, Z.rnds(Math.floor(S.t * 30), 2) * 8]; c.translate(dx, dy); }
      c.fillStyle = '#F6F2EA'; c.fillRect(X, Y, w, h); c.strokeStyle = P.ink; c.lineWidth = 2; c.strokeRect(X, Y, w, h);
      TR.text(c, a.form || 'FORM 2-A', X + 40, Y + 70, 30, { face: 'mono', weight: 600, col: P.ink });
      TR.text(c, 'STATEMENT OF RECORD · FILE IN TRIPLICATE', X + 40, Y + 110, 20, { face: 'mono', col: P.graphite });
      c.strokeStyle = P.ink; c.lineWidth = 1;
      for (let r = 0; r < 6; r++) { const yy = Y + 200 + r * 90; c.beginPath(); c.moveTo(X + 40, yy + 60); c.lineTo(X + w - 40, yy + 60); c.stroke(); }
      TR.text(c, (a.field || 'ITEM 1 · STATEMENT') + ':', X + 40, Y + 180, 20, { face: 'mono', col: P.graphite });
      // checkboxes tick on the beats
      for (let b = 0; b < 4; b++) {
        const bx = X + 40 + b * 300, by = Y + h - 110; c.strokeRect(bx, by, 28, 28);
        TR.text(c, (a.boxes || ['REVIEWED', 'NOTED', 'FILED', 'FORWARDED'])[b] || '', bx + 42, by + 22, 18, { face: 'mono', col: P.ink });
        if (S.clock.beat(S.t) - S.clock.beat(S.shot.t0) > b) { c.save(); c.strokeStyle = P.signal; c.lineWidth = 3; c.beginPath(); c.moveTo(bx + 4, by + 14); c.lineTo(bx + 12, by + 24); c.lineTo(bx + 26, by + 2); c.stroke(); c.restore(); }
      }
      if (a.line != null) TR.lineWords(c, a.line, S.t, X + 60, Y + 250, 60, { face: 'mono', weight: 600, maxW: w - 140, lh: 1.5, dimCol: P.ink, sungCol: P.ink, dimA: 0.18 });
      if (sw) TR.stamp(c, a.stamp || 'APPROVED', X + w - 380, Y + 560, 76, hit);   // on the empty rows, never over the line
      TR.readout(c, X + w - 220, Y + h - 190, 30, S.t, { col: P.graphite });
      c.restore();
    },
  }));

  // ---------------------------------------------------------------- trPrompt: the line typed as tokens
  Z.scene('trPrompt', Object.assign({}, fonts, {
    draw(c, S) {
      const a = S.args, words = a.line != null ? TR.words(a.line) : [], L = Z.line(a.line ?? -1);
      ground(c, false);
      const fx = 260, fy = 600, fw = 1400, adv = wd => TR.measure(c, wd.w + ' ', 40, { face: 'mono' });
      const total = words.reduce((s, wd) => s + adv(wd), 0), shift = Math.max(0, total - (fw - 120));
      const x0 = fx + 30 - shift * Z.clamp((S.t - (words[0] ? words[0].t0 : 0)) / Math.max(0.1, L.end - L.t));
      // the camera follows the caret, which eases after each sung word
      let caret = x0; for (const wd of words) if (S.t >= wd.t0) caret += adv(wd) * E.outExpo(Z.clamp((S.t - wd.t0) / 0.45));
      c.save(); TR.cam(c, S, a.cam || { from: { zoom: 1.4 }, to: { zoom: 1.5 }, follow: [caret - 120, fy - 20], followK: 0.55 });
      // engraved rings behind, pulling in; on the return key they rush at the camera
      const ret = Z.clamp((S.t - (L.end || S.shot.t1)) / 0.35), rush = E.inExpo(Z.clamp((S.lt - (S.dur - 0.35)) / 0.35));
      c.save(); c.strokeStyle = P.graphite; c.lineWidth = 1;
      for (let r = 0; r < 24; r++) { const rr = ((r * 60 - S.t * 140) % 1440 + 1440) % 1440 * (1 + 6 * rush); c.globalAlpha = 0.8 * (1 - rr / 2200); c.beginPath(); c.arc(960, 540, rr + 20, 0, TAU); c.stroke(); }
      c.restore();
      c.strokeStyle = P.bone; c.lineWidth = 1.5; c.strokeRect(fx, fy - 70, fw, 100);
      let x = x0, cur = null;
      c.save(); c.beginPath(); c.rect(fx, fy - 70, fw, 100); c.clip();
      for (const wd of words) {
        if (S.t < wd.t0) break;
        const ww = TR.measure(c, wd.w, 40, { face: 'mono' });
        TR.text(c, wd.w, x, fy, 40, { face: 'mono', col: S.t < wd.t1 ? P.signal : P.bone }); cur = { wd, x, ww };
        x += ww + TR.measure(c, ' ', 40, { face: 'mono' });
      }
      if (Math.floor(S.t * 2.5) % 2 === 0) { c.fillStyle = P.bone; c.fillRect(x, fy - 34, 18, 40); }
      c.restore();
      // the next-token distribution over the newest token: the sung word wins; the others are other words of the song
      if (cur && S.t - cur.wd.t0 < 0.7) {
        const pool = Z.LYR.flatMap(l => l.text.split(/\s+/)).filter(s => s && s !== cur.wd.w), n = 3, al = Z.clamp((S.t - cur.wd.t0) * 8) * (1 - Z.smooth(0.5, 0.7, S.t - cur.wd.t0));
        const cands = [[cur.wd.w, 0.35 + 0.4 * Z.rnd(a.line, cur.wd.i, 1)]];
        for (let j = 0; j < n && pool.length; j++) cands.push([pool[Math.floor(Z.rnd(a.line, cur.wd.i, j + 5) * pool.length)], 0.03 + 0.2 * Z.rnd(a.line, cur.wd.i, j + 9) * (1 - j * 0.25)]);
        const bx = Math.min(fx + fw - 330, cur.x), by = fy - 110 - 34 * cands.length;
        c.save(); c.globalAlpha = al;
        cands.forEach(([s, p], j) => {
          const yy = by + j * 34; c.fillStyle = j ? P.graphite : P.signal; c.fillRect(bx, yy - 14, 120 * p / cands[0][1], 10);
          TR.text(c, s, bx + 132, yy - 2, 22, { face: 'mono', col: j ? P.ash : P.bone }); TR.text(c, p.toFixed(2), bx + 300, yy - 2, 20, { face: 'mono', col: P.graphite });
        });
        c.restore();
      }
      if (ret > 0) TR.text(c, '⏎', fx + fw - 60, fy - 2, 48, { face: 'mono', col: P.signal, alpha: ret });
      TR.text(c, a.label ?? '> prompt', fx, fy - 90, 20, { face: 'mono', col: P.ash });
      c.restore();
      if (rush > 0) { c.fillStyle = Z.rgba(P.bone, rush * 0.9); c.fillRect(0, 0, W, H); }
    },
  }));

  // ---------------------------------------------------------------- trHook: one word per hit, then the number takes the frame
  Z.scene('trHook', Object.assign({}, fonts, {
    draw(c, S) {
      const a = S.args, n = a.n || 1, words = a.line != null ? TR.words(a.line) : [], L = Z.line(a.line ?? -1);
      const field = n === 2 ? P.signal : P.ink, fg = n === 2 ? P.ink : P.bone;
      c.fillStyle = field; c.fillRect(0, 0, W, H);
      let wd = null; for (const x of words) if (S.t >= x.t0) wd = x;
      const numT = L.end ? Math.min(L.end, S.shot.t1 - 1.0) : S.shot.t1 - 1.0;
      c.save();
      if (S.t < numT || !words.length) {
        if (wd) {
          const age = S.t - wd.t0, sl = E.outExpo(Z.clamp(age / 0.18)), sc = Z.lerp(1.35, 1, sl), px = n === 3 ? 120 : 330;
          const fit = Math.min(1, 1700 / Math.max(1, TR.measure(c, wd.w.toUpperCase(), px, { weight: n === 3 ? 300 : 900, width: 62 })));
          const width = Z.clamp(62 + 63 * fit, 62, 125);
          if (n === 4 && age < 0.25) { const [dx, dy] = [Z.rnds(Math.floor(S.t * 30), 3) * 14, Z.rnds(Math.floor(S.t * 30), 4) * 14]; c.translate(dx, dy); }
          c.translate(960, 560); c.scale(sc, sc);
          const o = { weight: n === 3 ? 300 : 900, width, align: 'center', col: fg, baseline: 'middle' };
          if (n === 4) for (let r = 4; r >= 1; r--) { c.save(); c.globalAlpha = 0.18 * (5 - r) / 4; c.translate(0, -r * 26 * (1 - sl * 0.5)); TR.text(c, wd.w.toUpperCase(), 0, 0, px * fit, Object.assign({}, o, { col: P.signal })); c.restore(); }
          TR.text(c, wd.w.toUpperCase(), 0, 0, px * fit, o);
        }
      } else {
        // the number: big mono digits rolling to the new value, a hairline bar, a deadpan footnote
        const k = E.outExpo(Z.clamp((S.t - numT) / 0.4)), v = TR.value(S.t);
        TR.text(c, (TR.NUM.label || 'p') + ' =', 140, 300, 90, { face: 'serif', italic: true, weight: 500, col: fg, alpha: k });
        TR.text(c, TR.fmt(v), 120, 760, 420 * Z.lerp(0.6, 1, k), { face: 'mono', weight: 600, col: n === 2 ? P.ink : P.signal });
        c.strokeStyle = fg; c.lineWidth = 2; c.beginPath(); c.moveTo(140, 880); c.lineTo(140 + 1640 * Z.clamp(v) * k, 880); c.stroke();
        const foot = a.foot ?? 'updated on chorus ' + n;                  // write the film's own footnote (args.foot)
        if (foot) TR.text(c, foot, 140, 940, 24, { face: 'mono', col: n === 2 ? P.ink : P.ash, alpha: k });
      }
      c.restore();
    },
  }));

  // ---------------------------------------------------------------- trContour: a survey map; the words are its labels
  Z.scene('trContour', Object.assign({}, fonts, {
    draw(c, S) {
      const a = S.args;
      const path = q => [180 + 1500 * q, 560 + 260 * Math.sin(q * 5 + (a.seed || 3)) * (1 - q * 0.4)], u = E.inOutSine(Z.clamp(S.lt / S.dur));
      ground(c, false);
      c.save(); TR.cam(c, S, a.cam || { from: { zoom: 1.05, rot: 0.03 }, to: { zoom: 1.18, rot: -0.04 }, follow: path(u), followK: 0.5 });
      TR.contours(c, -400, -300, W + 800, H + 600, { seed: a.seed || 3, t: S.t, alpha: 0.7 });
      const pts = []; for (let q = 0; q <= u; q += 0.005) pts.push(path(q));
      c.save(); c.setLineDash([10, 8]); TR.trail(c, pts, { w: 2, glow: false }); c.restore();
      const [hx, hy] = path(u); TR.spark(c, hx, hy, S.t, { scale: 0.8, particles: tt => { const [x, y] = path(E.inOutSine(Z.clamp((tt - S.shot.t0) / S.dur))); return { x, y }; } });
      let qPrev = -1;
      if (a.line != null) TR.words(a.line).forEach((wd, j) => {
        const q = Math.max(Z.clamp((wd.t0 - S.shot.t0) / S.dur), qPrev + 0.11); qPrev = q;   // labels keep their distance along the path
        if (S.t < wd.t0 - 0.05) return;
        const [x, y] = path(E.inOutSine(Math.min(1, q))), up = j % 2 ? 1 : -1;
        TR.callout(c, x, y, x + 40, y + up * 90, wd.w.toUpperCase(), { px: 34, col: S.t < wd.t1 ? P.signal : P.bone, alpha: E.outExpo(Z.clamp((S.t - wd.t0) / 0.2)) });
      });
      TR.readout(c, 1560, 120, 34, S.t);
      c.restore();
    },
  }));
})();
