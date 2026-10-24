/* engine/timeline.js — the BLANK starter: a film that designs its own style (no preset). Read <skill>/design-a-style.md.
 *
 * It renders at once and shows the moving parts, nothing more: one shot per section, a scene of the film's own
 * ('own') drawn from three things you will replace — a palette system, a master shape on the beat, a lyric voice —
 * and the lyric set by the scene itself from Z.line(i).text (line indices only; no lyric text in code).
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
  // REPLACE: the film's own identity (design-a-style.md §2)
  const LOOK = { ground: '#14161C', ink: '#E9E4DA', accent: '#E8553A', font: '"Noto Sans JP", sans-serif' };

  Z.scene('own', {
    draw(ctx, S) {
      const a = S.args, beat = Z.clock ? Z.clock.pulse(S.t, 6) : 0;
      ctx.fillStyle = LOOK.ground; ctx.fillRect(0, 0, W, H);
      // the master shape: one ring that answers the beat (REPLACE with your shape grammar)
      ctx.save(); ctx.strokeStyle = LOOK.accent; ctx.lineWidth = 6 + 10 * beat; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(W * (a.side === 'right' ? 0.68 : 0.32), H * 0.46, 180 + 40 * beat + 30 * S.p, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      // the lyric voice: the current line, set by the scene (REPLACE with your type roles and moves)
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
    Z.LOOK_DEFAULT = { boil: 0, bloom: 0.15, bloomThreshold: 0.85, grain: 0.04, vignette: 0.3, lutMix: 0 };
    await document.fonts.load(`700 64px ${LOOK.font}`, 'Aa0あ');
    const S = [], cuts = secs.length ? secs.map(s => s.start).filter(t => t < END - 0.5) : [0];
    if (cuts[0] > 0.05) cuts.unshift(0);
    cuts.forEach((t0, j) => {
      const t1 = cuts[j + 1] ?? END, line = L.filter(l => l.t >= t0 - 0.05 && l.t < t1 - 0.05).map(l => l.i);
      S.push({ id: `s${String(j + 1).padStart(2, '0')}`, t0, t1, scene: 'own', args: { side: j % 2 ? 'right' : 'left' }, lyric: 'none', hud: false, line,
        moment: `${(Z.sectionAt(t0) || {}).label || 'section'}: REPLACE with this section's pictures (one idea per line)` });
    });
    Z.SHOTS = S;
    Z.VERTICAL_CFG = { full: [], planMap: {}, quiet: [], title: Z.TITLE, sub: Z.TITLE_SUB, artist: Z.ARTIST, credits: [0, END] };
    window.__zankoMeta.duration = END;
  };
})();
