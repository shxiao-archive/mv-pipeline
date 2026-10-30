/* styles/signal — shot.js: 'sigShot', the meaningful image of a cut, in six framings.
 *   { mode: 'full' | 'crop' | 'char' | 'sil' | 'split' | 'word',
 *     img          background / picture (path);  imgs  for 'split' (2-4 panels)
 *     char         a cut-out (path) for 'char' / 'sil';  charX, charY, charH  (default centre-bottom, 92 % of the height)
 *     focus [u,v]  what 'crop' looks at (0..1 of the image: an eye, a mouth, a link of chain, a corner of the moon)
 *     zoom         'crop' magnification (3-6) / 'full' start zoom (1.06)
 *     ground       flat colour behind 'char' / 'sil' (default near-black; 'sil' default light grey: a high-contrast cut-out)
 *     line, word   'word': a lyric line index; word = 'emph' (its *emphasis*, default) | 'all' | [from, to) char range
 *     enter        'punch' (snaps in from 110 %) | 'shake' | 'none';  drift  px/s of the continuous slide (never still)
 *     vertical     'split': stack panels vertically;  invert  'word': light ground, dark type }
 * The heat grade colours everything: draw natural, neutral images and let Z.SIG.grade tint them.
 * mv-studio (MIT).
 */
(() => {
  'use strict';
  const Z = window.Z, D = Z.draw, E = Z.ease, W = 1920, H = 1080;
  const MINCHO = { jp: '"Shippori Mincho B1", "Noto Serif JP"', zh: '"Noto Serif SC"' };
  Z.SIG = Z.SIG || {};
  Z.SIG.serif = MINCHO.jp;
  Z.SIG.useChinese = () => { Z.SIG.serif = MINCHO.zh; };

  const enterXf = (ctx, S, a) => {
    const lt = S.lt;
    if (a.enter === 'punch') { const s = 1 + 0.1 * (1 - E.outExpo(Z.clamp(lt / 0.18))); ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2); }
    else if (a.enter === 'shake') { const k = Math.exp(-lt * 9), q = Math.floor(S.t * 30); ctx.translate(Z.rnds(q, 61) * 26 * k, Z.rnds(q, 62) * 18 * k); }
  };
  const driftView = (S, a, z0 = 1.06) => {
    const sd = a.seed ?? 1, dir = Z.rnds(sd, 63), drift = a.drift ?? 1;
    return { zoom: (a.zoom ?? z0) + 0.06 * S.lt * drift, x: Z.clamp(dir * 0.6 + 0.25 * S.lt * dir * drift, -1, 1), y: Z.rnds(sd, 64) * 0.4 };
  };
  Z.scene('sigShot', {
    preload: a => [a.img, a.char, ...(a.imgs || [])].filter(Boolean),
    init: async () => { await Promise.all(['800 200px "Shippori Mincho B1"', '900 200px "Noto Serif SC"'].map(f => document.fonts.load(f, '字'))); },
    draw(ctx, S) {
      const a = S.args, mode = a.mode || 'full', sd = a.seed ?? 1;
      ctx.fillStyle = a.ground || (mode === 'sil' ? '#b9bdbf' : '#060607'); ctx.fillRect(0, 0, W, H);
      ctx.save(); enterXf(ctx, S, a);
      if (mode === 'full' && a.img) D.cover(ctx, Z.imgSync(a.img), driftView(S, a));
      else if (mode === 'crop' && a.img) {
        const img = Z.imgSync(a.img), z = a.zoom ?? 3.5 + 2 * Z.rnd(sd, 65), [u, v] = a.focus || [0.5, 0.4];
        D.cover(ctx, img, { zoom: z * (1 + 0.04 * S.lt), x: Z.clamp(-(u - 0.5) * 2 + 0.03 * Math.sin(S.t * 1.3 + sd), -1, 1), y: Z.clamp(-(v - 0.5) * 2, -1, 1) });
      } else if (mode === 'char' || mode === 'sil') {
        if (a.img && mode === 'char') D.cover(ctx, Z.imgSync(a.img), driftView(S, a, 1.08));
        const img = Z.imgSync(a.char);
        if (img) {
          const x = (a.charX ?? 960) + Z.rnds(sd, 66) * 30 * S.lt, y = a.charY ?? H + 20, h = a.charH ?? H * 0.92;
          if (mode === 'sil') D.silhouette(ctx, img, x, y, h, a.ink || '#08080a', { sway: 0.004, t: S.t });
          else { D.contactShadow(ctx, x, Math.min(y, H - 4), h * 0.4, { a: 0.35 }); D.sprite(ctx, img, x, y, h, { sway: 0.006, breathe: 1, t: S.t }); }
        }
      } else if (mode === 'split') {
        const list = a.imgs || [a.img], n = Math.min(4, Math.max(2, a.n || list.length)), swap = Z.clamp(S.clock.phase(S.t));
        let x0 = 0;
        for (let i = 0; i < n; i++) {
          const w0 = (a.vertical ? H : W) / n, wi = w0 * (1 + 0.25 * Math.sin((S.clock.beat(S.t) + i) * 1.7 + swap)), wN = i === n - 1 ? (a.vertical ? H : W) - x0 : wi;
          ctx.save(); ctx.beginPath(); if (a.vertical) ctx.rect(0, x0, W, wN); else ctx.rect(x0, 0, wN, H); ctx.clip();
          const img = Z.imgSync(list[i % list.length]);
          if (img) D.cover(ctx, img, { zoom: 1.3 + 0.8 * Z.rnd(sd, i, 67) + 0.05 * S.lt, x: Z.rnds(sd, i, 68), y: Z.rnds(sd, i, 69) * 0.6 });
          ctx.restore();
          ctx.fillStyle = '#000'; if (a.vertical) ctx.fillRect(0, x0 + wN - 4, W, 8); else ctx.fillRect(x0 + wN - 4, 0, 8, H);
          x0 += wN;
        }
      } else if (mode === 'word') {
        const L = Z.line(a.line ?? Z.lineAt(S.t)); let str = L.text;
        if ((a.word ?? 'emph') === 'emph' && L.emph.length) str = [...L.text].slice(L.emph[0][0], L.emph[0][1]).join('');
        else if (Array.isArray(a.word)) str = [...L.text].slice(a.word[0], a.word[1]).join('');
        ctx.fillStyle = a.invert ? '#e9e6df' : '#050505'; ctx.fillRect(0, 0, W, H);
        const n = [...str].length || 1, size = Math.min(760, (W * 0.86) / n, H * 0.78);
        ctx.font = `800 ${size}px ${Z.SIG.serif}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const s = 1 + 0.03 * S.lt; ctx.translate(W / 2, H / 2); ctx.scale(s, s);
        ctx.fillStyle = a.invert ? '#0b0b0b' : '#efeae1'; ctx.fillText(str, 0, size * 0.04);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
      ctx.restore();
    },
  });
})();
