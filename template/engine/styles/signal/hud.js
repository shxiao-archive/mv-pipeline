/* styles/signal — hud.js: the recording device's own layer (crisp: the text layer, not graded, torn only by the bands)
 * and the lyrics of a signal film. Set Z.hud = Z.SIG.hud in the timeline and configure Z.SIG.hudCfg:
 *   { title,                      small header line (film / unit name — copy, not lyrics)
 *     rec: true,                  REC dot + timecode
 *     temp: { from: 36.5, to: 180, unit: 'C', label: 'CORE TEMP' },   read-out driven by heat (ERR.OVER above heat 0.98)
 *     log: [[t, 'text'], ...],    a pixel LOG column, newest at the bottom (system copy you write for the film)
 *     hide: [[t0, t1], ...],      spans without HUD (a black stop, the end card)
 *     lyrics: [{ from, to, mode, ...opts }]  how lyric lines are set in each span (none = no lyrics there):
 *        'vertical'  mincho 縦書き in a right-hand column, character by character with the voice (slow sections)
 *        'stamp'     the line big, re-laid on every beat (position / size / tilt from the beat), emphasis in accent (sprints)
 *        'center'    one large centred line, typed with the voice, on a dark plate (long lines, T2)
 *        'none' }
 * Pixel type sits on a 16 px grid: sizes 16 / 32 / 48 / 64 only, integer positions — that is what keeps it crisp.
 * mv-studio (MIT).
 */
(() => {
  'use strict';
  const Z = window.Z, SIG = (Z.SIG = Z.SIG || {}), W = 1920, H = 1080;
  const PIX = '"DotGothic16", "IBM Plex Mono", monospace';
  SIG.hudCfg = { title: '', rec: true, temp: { from: 36.5, to: 180, unit: 'C', label: 'CORE TEMP' }, log: [], hide: [], lyrics: [], accent: '#ff6a3d', ink: '#f2efe9' };

  const tc = t => { const f = Math.floor(t * 30); return [Math.floor(t / 3600), Math.floor(t / 60) % 60, Math.floor(t) % 60, f % 30].map(n => String(n).padStart(2, '0')).join(':'); };
  const pix = (ctx, s, x, y, size = 32, col = '#e8e6e1', align = 'left') => { ctx.font = `400 ${size}px ${PIX}`; ctx.textAlign = align; ctx.fillStyle = col; ctx.fillText(s, Math.round(x), Math.round(y)); };

  function lyricVertical(ctx, t, o, c) {
    const i = Z.lineAt(t, 0.25); if (i < 0) return;
    const draw = (k, alpha) => {
      const L = Z.line(k), chars = [...L.text], n = k === i ? Z.charsAt(k, t, { lead: 0.2 }) : chars.length, size = o.size || 64, x = (o.x || W - 150) - (i - k) * size * 1.5;
      ctx.font = `600 ${size}px ${SIG.serif}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let j = 0; j < n; j++) {
        const ch = chars[j], y = (o.y || 140) + j * size * 1.12, fresh = k === i && j === n - 1 ? Z.clamp((t - (L.t - 0.2)) * 8) : 1;
        ctx.globalAlpha = alpha * fresh; ctx.fillStyle = Z.isEmph(k, j) ? c.accent : c.ink;
        if ('ー〜…—「」、。'.includes(ch)) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 2); ctx.fillText(ch, 0, 0); ctx.restore(); } else ctx.fillText(ch, x, y);
      }
      ctx.globalAlpha = 1;
    };
    if (i > 0 && t - Z.line(i).t < 1.2) draw(i - 1, 0.35 * (1 - (t - Z.line(i).t) / 1.2));
    draw(i, 1);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }
  function lyricStamp(ctx, t, o, c, clock) {
    const i = Z.lineAt(t, 0.15); if (i < 0) return;
    const L = Z.line(i), chars = [...L.text], b = clock.beat(t), sd = (o.seed || 5) + b * 13 + i * 101;
    const size = (o.size || 150) * (0.8 + 0.5 * Z.rnd(sd, 1)), n = chars.length;
    const fit = Math.min(size, (W * 0.84) / Math.max(1, n));
    ctx.font = `800 ${fit}px ${SIG.serif}`; const half = ctx.measureText(L.text).width / 2, room = Math.max(0, W / 2 - 80 - half);   // stays inside the frame
    const x = W / 2 + Z.rnds(sd, 2) * Math.min(260, room), y = H / 2 + Z.rnds(sd, 3) * 220, rot = Z.rnds(sd, 4) * 0.06, k = Math.exp(-clock.since(t) * 10);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1 + 0.06 * k, 1 + 0.06 * k);
    ctx.font = `800 ${fit}px ${SIG.serif}`; ctx.textBaseline = 'middle';
    let wsum = 0; const ws = chars.map(ch => { const w = ctx.measureText(ch).width; wsum += w; return w; });
    let cx = -wsum / 2;
    chars.forEach((ch, j) => {
      const em = Z.isEmph(i, j), jit = em ? Z.rnds(sd, j, 5) * 10 * (0.3 + k) : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(ch, cx + 6, 6 + jit);
      ctx.fillStyle = em ? c.accent : c.ink; ctx.fillText(ch, cx, jit); cx += ws[j];
    });
    ctx.restore(); ctx.textBaseline = 'alphabetic';
  }
  function lyricCenter(ctx, t, o, c) {
    const i = Z.lineAt(t, 0.2); if (i < 0) return;
    const L = Z.line(i), chars = [...L.text], n = Z.charsAt(i, t), size = Math.min(o.size || 96, (W * 0.8) / Math.max(1, chars.length));
    ctx.font = `600 ${size}px ${SIG.serif}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const full = ctx.measureText(L.text).width, x0 = W / 2 - full / 2, y = o.y || H * 0.78;
    ctx.fillStyle = 'rgba(4,4,6,0.72)'; ctx.fillRect(x0 - 32, y - size * 0.78, full + 64, size * 1.56);
    let x = x0;
    chars.slice(0, n).forEach((ch, j) => { ctx.fillStyle = Z.isEmph(i, j) ? c.accent : c.ink; ctx.fillText(ch, x, y); x += ctx.measureText(ch).width; });
    ctx.textBaseline = 'alphabetic';
  }

  SIG.hud = (ctx, St) => {
    const c = SIG.hudCfg, t = St.t;
    if ((c.hide || []).some(([a, b]) => t >= a && t < b)) return;
    // lyrics first (under the HUD chrome)
    const span = (c.lyrics || []).find(s => t >= s.from && t < s.to);
    const own = St.shot && St.shot.args && St.shot.args.mode === 'word';          // the shot IS the lyric: do not set it twice
    if (span && span.mode !== 'none' && !own) ctx.save(), (span.mode === 'vertical' ? lyricVertical : span.mode === 'stamp' ? lyricStamp : lyricCenter)(ctx, t, span, c, St.clock), ctx.restore();
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
    if (c.rec) {
      if (Math.floor(t * 2) % 2 === 0) { ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(64, 64, 12, 0, Z.TAU); ctx.fill(); }
      pix(ctx, 'REC', 88, 76, 32, c.ink); pix(ctx, tc(t), W - 64, 76, 32, c.ink, 'right');
      if (c.title) pix(ctx, c.title, 64, 112, 16, '#a9aeb2');
    }
    if (c.temp) {
      const h = SIG.heat(t), v = Z.lerp(c.temp.from, c.temp.to, h), over = h > 0.98;
      pix(ctx, c.temp.label, W - 64, H - 112, 16, '#a9aeb2', 'right');
      pix(ctx, over ? 'ERR.OVER' : v.toFixed(1) + ' ' + c.temp.unit, W - 64, H - 64, 48, over || h > 0.66 ? c.accent : c.ink, 'right');
    }
    const live = (c.log || []).filter(([lt]) => t >= lt).slice(-8);
    live.forEach(([lt, s], k) => { const a = k === live.length - 1 ? Z.clamp((t - lt) * 8) : 1; ctx.globalAlpha = a * (0.45 + 0.55 * (k + 1) / live.length); pix(ctx, s, 64, H - 64 - (live.length - 1 - k) * 24, 16, c.ink); });
    ctx.restore(); ctx.textAlign = 'left';
  };
})();
