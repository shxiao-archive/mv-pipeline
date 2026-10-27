/* styles/signal — signal.js: a recording device failing in heat / radiation. HEAT drives the grade, DISTORTION drives
 * the degradation layer; both are pure functions of song time.
 *
 *   Z.SIG.heatKeys = [[t, h], ...]       heat 0..1 over the film (piecewise linear; set it in the timeline)
 *   Z.SIG.heat(t)                        the heat at t
 *   Z.SIG.boost = { label: d }           extra distortion per section label (sprint sections run hotter on the signal)
 *   Z.SIG.kicks = [t, ...]               cut / hit times: a short burst of distortion after each (cuts() fills it)
 *   Z.SIG.distort(t)                     d 0..1 = floor + gain * heat^1.3 + section boost * (0.5 + heat) + kick
 *   Z.SIG.cfg                            { floor 0.04, gain 0.6, tearText true, hotPixels 220, sparkles 1, grade true, gradeMix 0.85 }
 *   Z.SIG.spans = null | [[t0, t1], ...] where the device is failing (null = the whole film; a vocaloid film that
 *                                        collapses into signal for its bridge sets the bridge here)
 *   Z.SIG.install()                      chains Z.layerFX: the degradation below inside the spans — call it once in Z.setup
 *   Z.SIG.grade(P, t)                    heat -> gradient map: cold (navy) -> warm (amber) -> hot (vermilion) -> over (white-hot)
 *                                        (install() calls it; ramps 'sigCold' 'sigWarm' 'sigHot' 'sigOver' are in the LUT atlas)
 *
 * The degradation layer (Canvas2D, over the finished scene layer; the text layer takes the tears only):
 *   analog   horizontal tear bands (wide, bursts of 1-4 frames, a bright edge), a rolling interference band that shears
 *            the rows it passes, vertical-hold jumps (1-2 frames), multipath ghost; chroma shift through post `hca`
 *   sensor   white sparkles (more with heat), hot pixels that ACCUMULATE over the film (the device is being damaged and
 *            never recovers), CCD column smear, row dropouts
 * Nothing here flashes the whole frame: tears and bands are local and mostly dark-neutral (references: <skill>/styles/vocaloid/STYLE.md §B).
 *
 * mv-studio (MIT). Written for this kit from a description of the look of a fan PV's "signal degradation" style; no code
 * from that project is used.
 */
(() => {
  'use strict';
  const Z = window.Z, SIG = (Z.SIG = Z.SIG || {}), W = 1920, H = 1080;
  SIG.cfg = { floor: 0.04, gain: 0.6, tearText: true, hotPixels: 220, sparkles: 1, grade: true, gradeMix: 0.85, ghost: 1, band: 1 };
  SIG.heatKeys = [[0, 0]];
  SIG.boost = {};
  SIG.kicks = [];

  // gradient maps (luma -> colour). Generated art should come out NEUTRAL (natural colour, mid contrast): the grade
  // colours everything from one number, so the whole film shifts together as it heats up.
  Z.RAMPS = Object.assign(Z.RAMPS || {}, {
    sigCold: [[0, '#05070b'], [0.04, '#0b1320'], [0.3, '#1d3147'], [0.62, '#5f7a90'], [0.85, '#b9c7cf'], [1, '#eef2f4']],
    sigWarm: [[0, '#070504'], [0.04, '#1a0f08'], [0.3, '#4a2410'], [0.6, '#c2410c'], [0.82, '#f2a34a'], [1, '#fff1d6']],
    sigHot:  [[0, '#080303'], [0.04, '#250707'], [0.3, '#6e0f0c'], [0.58, '#d8321a'], [0.8, '#ff7a45'], [1, '#ffe2cc']],
    sigOver: [[0, '#140404'], [0.04, '#3a0a08'], [0.25, '#a0170f'], [0.5, '#ff5a2a'], [0.72, '#ffc08a'], [1, '#ffffff']],
  });
  const RAMP_ORDER = ['sigCold', 'sigWarm', 'sigHot', 'sigOver'];

  SIG.heat = t => {
    const k = SIG.heatKeys; if (!k.length) return 0;
    if (t <= k[0][0]) return k[0][1];
    for (let i = 1; i < k.length; i++) if (t < k[i][0]) return Z.lerp(k[i - 1][1], k[i][1], Z.inv(k[i - 1][0], k[i][0], t));
    return k[k.length - 1][1];
  };
  SIG.kick = t => { let v = 0; for (const k of SIG.kicks) { const d = t - k; if (d >= 0 && d < 0.4) v = Math.max(v, Math.exp(-d * 14)); } return v; };
  SIG.distort = t => {
    const h = SIG.heat(t), sec = Z.sectionAt ? Z.sectionAt(t) : null, b = (sec && SIG.boost[sec.label]) || 0, c = SIG.cfg;
    return Z.clamp(c.floor + c.gain * Math.pow(h, 1.3) + b * (0.5 + h) + 0.5 * SIG.kick(t) * (0.3 + 0.7 * Math.min(1, h + 0.3)));
  };
  SIG.grade = (P, t) => {
    const h = Z.clamp(SIG.heat(t)) * 3, i = Math.min(2, Math.floor(h)), k = h - i;
    P.lutA = Z.LUT[RAMP_ORDER[i]]; P.lutB = Z.LUT[RAMP_ORDER[i + 1]]; P.lutBlend = k;
    P.lutMix = Math.max(P.lutMix || 0, SIG.cfg.gradeMix);
  };

  // ---------------------------------------------------------------- the degradation layer
  function tears(f, d, kick) {
    const out = [];
    for (let back = 0; back < 4; back++) {                       // a burst starts on frame b and lasts 1..4 frames
      const b = f - back, len = 1 + Math.floor(Z.rnd(b, 701) * 4);
      if (back >= len) continue;
      if (Z.rnd(b, 702) > 0.01 + d * 0.45 + kick * 0.6) continue;
      const n = 1 + Math.floor(Z.rnd(b, 703) * (1 + d * 5 + kick * 3));
      for (let i = 0; i < n; i++) {
        const thin = Z.rnd(b, i, 704) < 0.25;
        const h = thin ? 3 + Z.rnd(b, i, 705) * 12 : 10 + Math.pow(Z.rnd(b, i, 705), 1.5) * (70 + d * 300 + kick * 200);
        out.push({ y: Z.rnd(b, i, 706) * H, h, dx: Z.rnds(b, i, 707) * (12 + d * 160 + kick * 120) });
      }
    }
    return out;
  }
  function shiftBands(ctx, src, bands, lit) {
    for (const b of bands) {
      const y = Math.max(0, Math.floor(b.y)), h = Math.min(H - y, Math.ceil(b.h)); if (h <= 0) continue;
      ctx.drawImage(src, 0, y, W, h, b.dx, y, W, h);
      if (b.dx > 0) ctx.drawImage(src, W - b.dx, y, b.dx, h, 0, y, b.dx, h); else if (b.dx < 0) ctx.drawImage(src, 0, y, -b.dx, h, W + b.dx, y, -b.dx, h);
      if (lit) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, y, W, h); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, y, W, 1); }
    }
  }
  SIG.vhold = (f, d) => Z.rnd(f, 711) < 0.006 + d * 0.03;      // a vertical-hold jump on frame f (tools/pops.mjs reads it as planned)
  SIG.layerFX = (L, t) => {
    const c = SIG.cfg, P = L.P, f = Math.floor(t * 30 + 1e-6), d = SIG.distort(t), kick = SIG.kick(t), h = SIG.heat(t);
    if (c.grade) SIG.grade(P, t);
    P.hca = (P.hca || 0) + 2 + d * 10 + kick * 10;                // chroma shift: a floor of 2 px, more when hot and on cuts
    P.grain = Math.max(P.grain || 0, 0.05 + 0.06 * d);
    if (SIG.vhold(f, d)) P.shake = [(P.shake ? P.shake[0] : 0), (P.shake ? P.shake[1] : 0) + Z.rnds(f, 712) * (40 + 120 * d)];   // vertical-hold jump
    const sc = L.scene, snap = Z.scratch[0], sx = snap.getContext('2d');
    sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalAlpha = 1; sx.globalCompositeOperation = 'copy'; sx.drawImage(sc.canvas, 0, 0); sx.globalCompositeOperation = 'source-over';
    sc.save(); sc.setTransform(1, 0, 0, 1, 0, 0);
    // multipath ghost: a faint copy to the right
    if (c.ghost) { sc.globalAlpha = (0.05 + 0.12 * d) * c.ghost; sc.globalCompositeOperation = 'screen'; sc.drawImage(snap, 6 + 18 * d, 0); sc.globalAlpha = 1; sc.globalCompositeOperation = 'source-over'; }
    // tear bands
    const bands = tears(f, d, kick);
    shiftBands(sc, snap, bands, true);
    // the rolling interference band: a wide bright band that crawls down the frame, shearing the rows it passes
    if (c.band && d > 0.06) {
      const per = 7 - 3 * d, y0 = ((t % per) / per) * (H + 300) - 150, bh = 70 + 120 * d;
      for (let y = Math.max(0, y0); y < Math.min(H, y0 + bh); y += 6) {
        const k = Math.sin(((y - y0) / bh) * Math.PI), dx = Math.sin(y * 0.05 + t * 9) * 14 * d * k;
        sc.drawImage(snap, 0, y, W, 6, dx, y, W, 6);
      }
      sc.globalCompositeOperation = 'lighter'; sc.fillStyle = `rgba(255,255,255,${0.04 + 0.08 * d})`; sc.fillRect(0, y0, W, bh);
      sc.fillStyle = `rgba(255,255,255,${0.2 + 0.3 * d})`; sc.fillRect(0, y0 + bh * 0.62, W, 1.5); sc.globalCompositeOperation = 'source-over';
    }
    // sensor: sparkles, accumulating hot pixels, a CCD column smear, a dropped row
    const nSp = Math.floor((10 + 260 * h + 120 * kick) * c.sparkles);
    sc.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < nSp; i++) { const s = 1 + Math.floor(Z.rnd(f, i, 721) * 3); sc.fillRect(Math.floor(Z.rnd(f, i, 722) * W), Math.floor(Z.rnd(f, i, 723) * H), s, s); }
    const dur = (window.__zankoMeta && window.__zankoMeta.duration) || 240, nHot = Math.floor(c.hotPixels * Z.clamp(t / dur) * (0.4 + 0.6 * h) + 3);
    for (let i = 0; i < nHot; i++) {
      const tone = Z.rnd(i, 733); sc.fillStyle = tone < 0.6 ? 'rgba(255,255,255,0.85)' : tone < 0.8 ? 'rgba(255,80,60,0.8)' : 'rgba(80,255,120,0.7)';
      sc.fillRect(Math.floor(Z.rnd(i, 731) * W), Math.floor(Z.rnd(i, 732) * H), 2, 2);
    }
    if (Z.rnd(f, 741) < 0.02 + 0.08 * d) { sc.fillStyle = 'rgba(255,255,255,0.35)'; sc.fillRect(Math.floor(Z.rnd(f, 742) * W), 0, 1, H); }
    if (Z.rnd(f, 743) < 0.02 + 0.1 * d) { sc.fillStyle = Z.rnd(f, 744) < 0.5 ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.25)'; sc.fillRect(0, Math.floor(Z.rnd(f, 745) * H), W, 1 + Math.floor(Z.rnd(f, 746) * 3)); }
    sc.restore();
    // the lyric layer tears with the picture (only the bands, never the rolling band or noise: text stays readable)
    if (c.tearText && bands.length) {
      const tx = L.text, s2 = Z.scratch[1], x2 = s2.getContext('2d');
      x2.setTransform(1, 0, 0, 1, 0, 0); x2.globalCompositeOperation = 'copy'; x2.drawImage(tx.canvas, 0, 0); x2.globalCompositeOperation = 'source-over';
      tx.save(); tx.setTransform(1, 0, 0, 1, 0, 0);
      for (const b of bands) { const y = Math.max(0, Math.floor(b.y)), hh = Math.min(H - y, Math.ceil(b.h)); if (hh <= 0) continue; tx.clearRect(0, y, W, hh); tx.drawImage(s2, 0, y, W, hh, b.dx * 0.6, y, W, hh); }
      tx.restore();
    }
    if (SIG.extraFX) SIG.extraFX(L, t, d);
  };
  SIG.spans = null;
  SIG.on = t => !SIG.spans || SIG.spans.some(([a, b]) => t >= a && t < b);
  SIG.install = () => { const prev = Z.layerFX; Z.layerFX = (L, t) => { if (prev) prev(L, t); if (SIG.on(t)) SIG.layerFX(L, t); }; };
})();
