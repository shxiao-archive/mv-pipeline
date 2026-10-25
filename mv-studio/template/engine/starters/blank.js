/* engine/timeline.js — the BLANK starter: a film that designs its own style (no preset). Read <skill>/design-a-style.md.
 *
 * It renders at once and shows the moving parts, nothing more: one shot per section, a scene of the film's own
 * ('own') with neutral grey placeholders — a beat tick, the section's progress, the current lyric line read from
 * Z.line(i).text (line indices only; no lyric text in code). None of it is a suggestion for the look.
 * Replace all of it with the style written in docs/CONCEPT.md: your palette and type roles, your shape and motif
 * grammar, your motion feel, your scenes in engine/scenes/<film>.js. Borrow single techniques from the library
 * (grep index/index.jsonl), never a preset's look.
 */
(() => {
  'use strict';
  const Z = window.Z, W = 1920, H = 1080;
  Z.TITLE = 'untitled';
  Z.TITLE_SUB = '';
  Z.ARTIST = '';
  Z.CREDIT = '';
  // REPLACE: placeholders only, until docs/CONCEPT.md decides the film's own palette and type
  const LOOK = { ground: '#808080', ink: '#202020', mark: '#B0B0B0', font: 'sans-serif' };

  Z.scene('own', {
    draw(ctx, S) {
      const beat = Z.clock ? Z.clock.pulse(S.t, 6) : 0;
      ctx.fillStyle = LOOK.ground; ctx.fillRect(0, 0, W, H);
      // placeholder marks: a beat tick (Z.clock.pulse) and the shot's progress (S.p)
      ctx.fillStyle = LOOK.mark; ctx.fillRect(W / 2 - 4, H * 0.4 - 40 * beat, 8, 80 * beat); ctx.fillRect(0, H - 6, W * S.p, 6);
      // placeholder lyric: the current line (Z.lineAt / Z.line)
      const i = Z.lineAt(S.t, 0.1);
      if (i >= 0) {
        const L = Z.line(i), k = Z.ease.outCubic(Z.clamp((S.t - L.t + 0.1) / 0.25));
        ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = LOOK.ink; ctx.font = `700 64px ${LOOK.font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(L.text, W / 2, H * 0.8 + (1 - k) * 24); ctx.restore();
      }
    },
  });

  Z.setup = async (audio) => {
    const secs = audio.sections || [], END = audio.music_cut || audio.duration, L = Z.LYR;
    Z.sectionAt = t => { let s = secs[0] || null; for (const x of secs) if (x.start <= t + 1e-6) s = x; return s; };
    Z.LOOK_DEFAULT = { boil: 0, bloom: 0, grain: 0, vignette: 0, lutMix: 0 };   // neutral post: set the film's own
    await document.fonts.load(`700 64px ${LOOK.font}`, 'Aa0あ');
    const S = [], cuts = secs.length ? secs.map(s => s.start).filter(t => t < END - 0.5) : [0];
    if (cuts[0] > 0.05) cuts.unshift(0);
    cuts.forEach((t0, j) => {
      const t1 = cuts[j + 1] ?? END, line = L.filter(l => l.t >= t0 - 0.05 && l.t < t1 - 0.05).map(l => l.i);
      S.push({ id: `s${String(j + 1).padStart(2, '0')}`, t0, t1, scene: 'own', args: {}, lyric: 'none', hud: false, line,
        moment: `${(Z.sectionAt(t0) || {}).label || 'section'}: REPLACE with this section's pictures (one idea per line)` });
    });
    Z.SHOTS = S;
    Z.VERTICAL_CFG = { full: [], planMap: {}, quiet: [], title: Z.TITLE, sub: Z.TITLE_SUB, artist: Z.ARTIST, credits: [0, END] };
    window.__zankoMeta.duration = END;
  };
})();
