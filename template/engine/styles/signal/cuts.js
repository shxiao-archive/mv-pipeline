/* styles/signal — cuts.js: the cut engine. In this style SPEED IS EDITING: a single frame may be full, but the overload
 * comes from how often the picture changes. Meaningful images (motifs) are interleaved with meaningless frames
 * (fillers) and 1-2 frame inserts, on a beat grid, deterministically.
 *
 *   Z.SIG.cuts(o) -> shot objects for Z.SHOTS (push them with S.push(...Z.SIG.cuts({...})))
 *     t0, t1          span (song seconds; use B(n) / line times)
 *     beats           audio.beats (the grid; cuts land on beats or subdivisions of them)
 *     tier            1 | 2 | 3 | 'hold'  presets below (override any field)
 *     div             grid subdivisions per beat (T1: 2 = half beats, T2: 1, T3: 0.25 = every 4 beats)
 *     motifs          [{ scene, args, lyric?, post? }, ...]  the meaningful shots, used in order (wrapping)
 *     anchor          T2: motifs[0] returns every other slot (A-B-A-C-A...): the image the phrase is anchored to
 *     fillers         [{ scene, args }, ...] (default Z.SIG.FILLERS: terminal junk, fragments, abstract fields)
 *     fill            probability that a slot is a filler instead of a motif
 *     ins             probability of a 1-2 frame insert at the start of a slot (dark inserts only: see safety)
 *     trans           probability that a cut is a fast move (whip / push / zoomThru / slice / spin, 3-4 frames)
 *     moves           allowed fast moves;  enter: entrance of motif shots ('punch' | 'shake' | 'none' | 'mix')
 *     seed            any number (change it to re-roll the edit)
 *     id              shot id prefix
 *     kick            add each cut to Z.SIG.kicks (a burst of distortion on the cut)   [true]
 *     moment          what this run of cuts is for (copied onto every shot; tools/storyboard.mjs lists it)
 *     maxCutsPerSec   safety cap on hard changes per second [6]; inserts never closer than 0.34 s
 *   Tiers: T1 sprint (div 2, fill .3, ins .2, trans .16) · T2 one gear lower (div 1, fill .18, ins .1, trans .14, anchor)
 *          T3 slow (div .25, no fillers / inserts, xfade or signal transitions) · 'hold' one motif for the whole span.
 *
 * Fast moves registered here (Z.transition): whipL whipR whipU whipD (directional slide with streaks), zoomThru, spin,
 * sigTear (a signal-loss transition: B tears in through bands). Use them anywhere via trans: { type, dur }.
 *
 * mv-studio (MIT). Written for this kit from a description of the "signal degradation" fan-PV look; no code from that
 * project is used.
 */
(() => {
  'use strict';
  const Z = window.Z, SIG = (Z.SIG = Z.SIG || {}), W = 1920, H = 1080, F = 1 / 30;
  const TIERS = {
    1: { div: 2, fill: 0.3, ins: 0.2, trans: 0.16, anchor: false, enter: 'mix' },
    2: { div: 1, fill: 0.18, ins: 0.1, trans: 0.14, anchor: true, enter: 'mix' },
    3: { div: 0.25, fill: 0, ins: 0, trans: 0, anchor: false, enter: 'none', soft: true },
    hold: { div: 0, fill: 0, ins: 0, trans: 0, anchor: false, enter: 'none' },
  };
  SIG.TIERS = TIERS;
  SIG.MOVES = ['whipL', 'whipR', 'whipU', 'whipD', 'push', 'zoomThru', 'slices', 'spin'];
  const snap = t => Math.round(t * 30) / 30;

  SIG.cuts = (o) => {
    const T = Object.assign({}, TIERS[o.tier ?? 1], o), seed = T.seed ?? 1, id = T.id || 'sig';
    const beats = T.beats || (Z.audio && Z.audio.beats) || [];
    const motifs = T.motifs || [], fillers = T.fillers || SIG.FILLERS, moves = T.moves || SIG.MOVES;
    // the grid: beats inside the span, subdivided (div > 1) or thinned (div < 1)
    let grid = [];
    if (T.div > 0) {
      const inside = beats.filter(b => b >= T.t0 - 1e-3 && b < T.t1 - 1e-3);
      if (T.div >= 1) {
        for (let i = 0; i < inside.length; i++) {
          const a = inside[i], b = inside[i + 1] ?? Math.min(T.t1, a + (inside[1] - inside[0] || 0.5));
          for (let k = 0; k < T.div; k++) grid.push(a + ((b - a) * k) / T.div);
        }
      } else { const step = Math.round(1 / T.div); grid = inside.filter((_, i) => i % step === 0); }
    }
    grid = [T.t0, ...grid.filter(g => g > T.t0 + 0.05)].map(snap);
    const out = [];
    let mi = 0, lastIns = -1e9, lastCut = -1e9;
    const pickMotif = slot => { if (!motifs.length) return null; if (T.anchor && slot % 2 === 0) return motifs[0]; const m = motifs[(T.anchor ? 1 + (mi % Math.max(1, motifs.length - 1)) : mi % motifs.length)]; mi++; return m; };
    for (let s = 0; s < grid.length; s++) {
      const a = grid[s], b = s + 1 < grid.length ? grid[s + 1] : snap(T.t1);
      if (b - a < F * 0.99) continue;
      if (a - lastCut < 1 / (T.maxCutsPerSec || 6) - 1e-3 && s > 0) { if (out.length) out[out.length - 1].t1 = b; continue; }   // safety cap
      const r = k => Z.rnd(seed, s, k);
      const isFill = s > 0 && fillers.length && r(1) < T.fill;
      const base = isFill ? fillers[Math.floor(r(2) * fillers.length)] : pickMotif(s) || fillers[0];
      const enter = T.enter === 'mix' ? (r(3) < 0.45 ? 'punch' : r(3) < 0.7 ? 'shake' : 'none') : T.enter;
      const shotArgs = Object.assign({}, base.args, { seed: (base.args && base.args.seed) ?? Math.floor(r(4) * 9973), enter: base.args && base.args.enter ? base.args.enter : enter });
      const shot = { id: `${id}${s}`, t0: a, t1: b, scene: base.scene, args: shotArgs, lyric: base.lyric ?? 'none', post: base.post, hud: base.hud, kind: isFill ? 'fill' : 'motif', moment: base.moment || (o.moment ? `${o.moment}${isFill ? ' (filler)' : ''}` : ''), line: base.line ?? (base.args && base.args.line) };
      if (s > 0 && r(5) < T.trans && b - a > F * 5) shot.trans = { type: moves[Math.floor(r(6) * moves.length)], dur: F * (3 + Math.floor(r(7) * 2)) };
      else if (s > 0 && T.soft) shot.trans = { type: r(6) < 0.5 ? 'xfade' : 'sigTear', dur: Math.min(0.5, (b - a) * 0.25) };
      out.push(shot); lastCut = a;
      if (T.kick !== false) SIG.kicks.push(a);
      // a 1-2 frame insert at the start of the slot (never two within 0.34 s: <= 3 flickers per second)
      if (s > 0 && T.ins > 0 && r(8) < T.ins && a - lastIns > 0.34 && b - a > F * 4) {
        const ins = (T.inserts || SIG.INSERTS)[Math.floor(r(9) * (T.inserts || SIG.INSERTS).length)], n = 1 + (r(10) < 0.5 ? 1 : 0);
        out.splice(out.length - 1, 0, { id: `${id}${s}i`, t0: a, t1: snap(a + n * F), scene: ins.scene, args: Object.assign({}, ins.args, { seed: Math.floor(r(11) * 9973) }), lyric: 'none', kind: 'ins', insert: true, moment: o.moment ? `${o.moment} (dark insert)` : '' });
        shot.t0 = snap(a + n * F); delete shot.trans; lastIns = a;
      }
    }
    return out;
  };

  // ---------------------------------------------------------------- fast moves (transitions, 3-4 frames)
  const streak = (ctx, img, dx, dy, k, n = 6) => {
    for (let i = n; i >= 0; i--) { ctx.globalAlpha = i === 0 ? 1 : 0.18 * (1 - i / (n + 1)); ctx.drawImage(img, dx - (dx ? Math.sign(dx) * i * 26 * Math.sin(k * Math.PI) : 0), dy - (dy ? Math.sign(dy) * i * 22 * Math.sin(k * Math.PI) : 0)); }
    ctx.globalAlpha = 1;
  };
  const whip = (sx, sy) => (ctx, A, B, k) => {
    const e = Z.ease.inOutCubic(k);
    ctx.save(); streak(ctx, A, -sx * W * e, -sy * H * e, k); streak(ctx, B, sx * W * (1 - e), sy * H * (1 - e), k); ctx.restore();
  };
  Z.transition('whipL', whip(-1, 0)); Z.transition('whipR', whip(1, 0)); Z.transition('whipU', whip(0, -1)); Z.transition('whipD', whip(0, 1));
  Z.transition('zoomThru', (ctx, A, B, k) => {
    const e = Z.ease.inCubic(k), s = 1 + 3 * e;
    ctx.save(); ctx.globalAlpha = 1 - e; ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.drawImage(A, -W / 2, -H / 2); ctx.restore();
    ctx.save(); ctx.globalAlpha = Z.clamp(k * 1.6); const s2 = 0.6 + 0.4 * Z.ease.outCubic(k); ctx.translate(W / 2, H / 2); ctx.scale(s2, s2); ctx.drawImage(B, -W / 2, -H / 2); ctx.restore();
  });
  Z.transition('spin', (ctx, A, B, k) => {
    const e = Z.ease.inOutCubic(k), img = k < 0.5 ? A : B, a = (k < 0.5 ? e : e - 1) * 0.9, s = 1 + 0.6 * Math.sin(k * Math.PI);
    ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.translate(W / 2, H / 2); ctx.rotate(a); ctx.scale(s, s); ctx.drawImage(img, -W / 2, -H / 2); ctx.restore();
  });
  // signal loss: B arrives through torn horizontal bands that widen
  Z.transition('sigTear', (ctx, A, B, k, o) => {
    ctx.drawImage(A, 0, 0);
    const n = 18, seed = Math.floor((o.t || 0) * 30);
    for (let i = 0; i < n; i++) {
      const y = (i / n) * H, h = H / n, on = Z.rnd(i, 801) < k * 1.3;
      if (!on) continue;
      const dx = Z.rnds(i, seed, 802) * 120 * (1 - k);
      ctx.drawImage(B, 0, y, W, h + 1, dx, y, W, h + 1);
    }
  });
})();
