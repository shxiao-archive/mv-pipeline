/* engine/tests/kits.js — a test timeline for the shared kits (core/mg.js, core/typefx.js, Z.impact, MG.pixel, the post
 * options bloomSat / shoulder / halation). Open engine/index.html?tl=tests/kits.js, or render stills with
 * node tools/stills.mjs --url "engine/index.html?tl=tests/kits.js" --times 1,3,5,7,9,11,13,15
 * The words here are test copy, not lyrics.
 */
(() => {
  'use strict';
  const Z = window.Z, MG = Z.MG, TFX = Z.TFX, W = 1920, H = 1080;
  Z.TITLE = 'kits'; Z.TITLE_SUB = ''; Z.ARTIST = ''; Z.CREDIT = '';
  const INK = '#F1ECE2', ACC = '#EE5A36', GROUND = '#15171D';
  const ground = ctx => { ctx.fillStyle = GROUND; ctx.fillRect(0, 0, W, H); };

  Z.scene('kitShapes', { draw(ctx, S) {
    const t = S.t, hit = Z.impact(t, [1.0, [2.0, 'L'], [3.0, 'MAX']]);
    ground(ctx); ctx.save(); ctx.translate(hit.dx, hit.dy);
    MG.rings(ctx, t, 560, 520, { color: ACC, width: 5 });
    MG.arcs(ctx, t, 560, 520, { color: INK, width: 10, r: 260 });
    MG.cross(ctx, t, 1380, 360, { at: 1.0, color: ACC, size: 90 });
    MG.brackets(ctx, 1080, 600, 600, 200, Z.clamp((t - 0.5) / 0.3), { color: INK, break: Z.clamp((t - 3.2) / 0.5) });
    TFX.pop(ctx, 'POP TEST', 1380, 700, { t, at: 0.6, stagger: 0.06, size: 84, color: INK });
    ctx.restore();
    if (hit.flash) { ctx.fillStyle = `rgba(255,250,240,${hit.flash})`; ctx.fillRect(0, 0, W, H); }
  } });
  Z.scene('kitType', { draw(ctx, S) {
    const t = S.t;
    ground(ctx);
    MG.stripes(ctx, t, 0, 900, W, 120, { a: GROUND, b: ACC, width: 46 });
    MG.speed(ctx, t, { color: INK, alpha: 0.5, inner: 420 });
    const flash = TFX.slam(ctx, 'SLAM', 960, 420, { t, at: 4.5, size: 220, color: INK });
    TFX.scramble(ctx, 'DECODE 2026', 960, 700, { t, at: 5.6, dur: 0.6, size: 72, color: ACC });
    TFX.ghosts(ctx, [{ text: 'ONE', x: 420, y: 800, at: 6 }, { text: 'TWO', x: 420, y: 800, at: 6.5 }, { text: 'THREE', x: 420, y: 800, at: 7 }], t, { size: 64, color: INK });
    if (flash) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, W, H); }
  } });
  Z.scene('kitChaos', { draw(ctx, S) {
    ground(ctx);
    TFX.chaos(ctx, 'CHAOS TEST', S.t, { color: INK, ground: ACC, size: 110 });
    MG.block(ctx, S.t, { hits: [[10.0, ACC], [11.0, INK]] });
  } });
  Z.scene('kitPixel', { draw(ctx, S) {
    MG.pixel(ctx, (c) => {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2B2F6B'); g.addColorStop(1, '#F07A4A'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = '#FFE2A0'; c.beginPath(); c.arc(960, 620 - 60 * S.p, 220, 0, Math.PI * 2); c.fill();
    }, { scale: 6, palette: ['#1B1D3A', '#3C3F82', '#8E4C7A', '#E0664A', '#F4A65A', '#FFE7B0'], dither: 0.8 });
  } });

  Z.setup = async (audio) => {
    await document.fonts.load(TFX.font(84), 'A0');
    const shot = (id, t0, t1, scene, post) => ({ id, t0, t1, scene, args: {}, lyric: 'none', hud: false, moment: `kit test: ${scene}`, post });
    Z.SHOTS = [shot('k1', 0, 4, 'kitShapes'), shot('k2', 4, 8, 'kitType'), shot('k3', 8, 12, 'kitChaos'),
      shot('k4', 12, 16, 'kitPixel', { bloom: 0.6, bloomThreshold: 0.6, bloomSat: 1, shoulder: 0.8, halation: 0.5, grain: 0.02, boil: 0 })];
    Z.VERTICAL_CFG = { full: [], planMap: {}, quiet: [], title: Z.TITLE, sub: '', artist: '', credits: [0, 16] };
    window.__zankoMeta.duration = 16;
  };
})();
