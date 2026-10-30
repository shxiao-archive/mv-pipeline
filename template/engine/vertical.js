/* vertical 9:16 layout (1080x1920), configured from the timeline via Z.VERTICAL_CFG.
 * The 16:9 engine renders each frame (lyrics off) into #out; this compositor lays it out vertically:
 *   blurred full-bleed ambience  →  picture band (6:5 centre crop)  →  JIZURA lyrics re-planned natively at 9:16
 *   (中央を空ける: top / bottom bands around the picture)  →  header / footer / credit.
 * Shots whose typography is part of the picture (lyric:'none': title, kanji slams, type cards, tunnel, end card) get no lyric layer. */
(() => {
  'use strict';
  const Z = window.Z, D = Z.draw, E = Z.ease;
  const VW = 1080, VH = 1920;
  const out = document.getElementById('out');
  const vout = document.getElementById('vout'), vx = vout.getContext('2d');
  const lyr = Z.canvas(VW, VH), lx = lyr.getContext('2d');
  const amb = Z.canvas(120, 214), ax = amb.getContext('2d');
  // picture band: 6:5 centre crop of the 1920x1080 frame, full width
  const CROP_STD = { sx: 312, sy: 0, sw: 1296, sh: 1080 }, PIC_STD = { x: 0, y: 510, w: VW, h: 900 };
  // purely graphic shots (ember intro, title, outro lockup, end card) keep the whole 16:9 composition
  const CROP_FULL = { sx: 0, sy: 0, sw: 1920, sh: 1080 }, PIC_FULL = { x: 0, y: 656, w: VW, h: 608 };
  // Per-film settings: set Z.VERTICAL_CFG in engine/timeline.js (inside Z.setup). The defaults are neutral.
  //   full     shot ids that keep the whole 16:9 composition (title, type cards, end card ...)
  //   planMap  16:9 JIZURA plan -> vertical plan name; each vertical plan is re-planned from its source plan at 9:16
  //   title / sub / artist   header text;  credits: [t0, t1] when the header + credit footer are shown
  //            (the footer line is Z.CREDIT; nothing is drawn there when it is empty)
  //   schemes  lyric schemes of the vertical plans (overrides the source plan's): 'dark' (light text) | 'light'
  //            (dark text, daylight films) | [scheme indices] -- see jizura_adapter.js addPlan
  //   quiet    shot ids whose typography lives in the picture (title, hook slams, end card): the blurred surround gets
  //            a deeper tint so the big letters do not echo as a ghost in the bands (mv-studio)
  //   schemesOf { v_plan: schemes } per vertical plan override of `schemes` (mv-studio)
  //   ambience [r, g, b] tint laid over the blurred 9:16 surround (black by default; a light tint also turns the
  //            built-in header / footer / rules dark ink)
  //   chrome   (vx, t, { PIC, VW, VH, credits }) draws the film's own header / footer / rules instead of the built-in
  //            ones; false draws none
  const CFG_DEFAULT = { full: [], planMap: {}, title: '', sub: '', artist: '', credits: [0, 0], schemes: 'dark', ambience: [0, 0, 0] };
  let CFG = CFG_DEFAULT, FULL = new Set(CFG.full);

  const baseReady = window.ready;
  window.ready = (async () => {
    const meta = await baseReady;
    CFG = Object.assign({}, CFG_DEFAULT, { title: Z.TITLE || '', sub: Z.TITLE_SUB || '', artist: Z.ARTIST || '', credits: [0, meta.duration] }, Z.VERTICAL_CFG || {});
    FULL = new Set(CFG.full);
    // header / footer faces must be loaded before frame 0 (a face first requested mid-render makes workers differ)
    const txt = CFG.title + CFG.sub + CFG.artist + (Z.CREDIT || '') + '0123456789:';
    await Promise.all(['900 40px "Zen Old Mincho"', '400 17px "DotGothic16"', '500 20px "Zen Kaku Gothic New"', '400 21px "Zen Kaku Gothic New"']
      .map(f => document.fonts.load(f, txt)));
    const mk = (name, src) => {
      const p = Object.assign({}, JZ.plans[src].project, { aspect: '9:16', res: 1080, centerFree: true, centerDir: 'tb', schemes: (CFG.schemesOf && CFG.schemesOf[name]) || CFG.schemes || 'dark' });
      return JZ.addPlan(name, p);
    };
    // one vertical twin per target plan, built from the first source plan that exists (main -> v_main, noir -> v_noir ...)
    const made = new Set();
    for (const [src, dst] of Object.entries(CFG.planMap)) {
      if (made.has(dst) || !JZ.plans[src]) continue;
      await mk(dst, src); made.add(dst);
    }
    Object.assign(meta, { width: VW, height: VH, vertical: true });
    return meta;
  })();

  function lyricPlan(shot, t) {                              // the 9:16 twin of the plan main.js would draw
    const spec = Z.lyricSpec(shot, t);
    const name = spec && (CFG.planMap[spec.plan] || CFG.planMap.main || 'v_main');
    return name && JZ.plans[name] ? name : null;
  }

  function compose(t) {
    const act = Z.activeShots(t), shot = act.length ? act[act.length - 1].shot : null;
    const full = shot && FULL.has(shot.id), CROP = full ? CROP_FULL : CROP_STD, PIC = full ? PIC_FULL : PIC_STD;
    vx.setTransform(1, 0, 0, 1, 0, 0); vx.globalAlpha = 1; vx.globalCompositeOperation = 'source-over'; vx.filter = 'none';
    // ---- ambience: the frame's centre, heavily blurred and tinted (CFG.ambience)
    ax.drawImage(out, (1920 - 607.5) / 2, 0, 607.5, 1080, 0, 0, amb.width, amb.height);
    vx.imageSmoothingQuality = 'high';
    vx.filter = 'blur(10px) saturate(1.25)'; vx.drawImage(amb, -60, -60, VW + 120, VH + 120); vx.filter = 'none';
    const [ar, ag, ab] = CFG.ambience || [0, 0, 0], tint = a => `rgba(${ar},${ag},${ab},${a})`;
    const lightAmb = 0.2126 * ar + 0.7152 * ag + 0.0722 * ab > 140;   // a light surround: header / footer / rules in dark ink
    const INK = lightAmb ? '#0B1524' : '#F4EFE6', RULE = lightAmb ? 'rgba(11,21,36,0.32)' : 'rgba(244,239,230,0.32)';
    const g = vx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, tint(0.78)); g.addColorStop(0.25, tint(0.5)); g.addColorStop(0.5, tint(0.35)); g.addColorStop(0.75, tint(0.5)); g.addColorStop(1, tint(0.8));
    vx.fillStyle = g; vx.fillRect(0, 0, VW, VH);
    if (!full && shot && (CFG.quiet || []).includes(shot.id)) {
      vx.fillStyle = `rgba(${Math.round(ar * 0.7)},${Math.round(ag * 0.7)},${Math.round(ab * 0.7)},0.86)`; vx.fillRect(0, 0, VW, VH);
    }
    if (full) {                                   // graphic shots: keep the ambience from echoing the typography (a deeper tint)
      vx.fillStyle = `rgba(${Math.round(ar * 0.8)},${Math.round(ag * 0.8)},${Math.round(ab * 0.8)},0.5)`; vx.fillRect(0, 0, VW, VH);
    }
    // ---- picture band + soft shadow
    vx.save(); vx.shadowColor = 'rgba(0,0,0,0.6)'; vx.shadowBlur = 40; vx.fillStyle = '#000'; vx.fillRect(PIC.x, PIC.y, PIC.w, PIC.h); vx.restore();
    vx.drawImage(out, CROP.sx, CROP.sy, CROP.sw, CROP.sh, PIC.x, PIC.y, PIC.w, PIC.h);
    const [c0, c1] = CFG.credits, credits = t > c0 && t < c1;
    const own = CFG.chrome !== undefined;
    // frame rules + ticks
    if (!own) {
      vx.save(); vx.strokeStyle = RULE; vx.lineWidth = 1.5;
      vx.beginPath(); vx.moveTo(0, PIC.y - 0.5); vx.lineTo(VW, PIC.y - 0.5); vx.moveTo(0, PIC.y + PIC.h + 0.5); vx.lineTo(VW, PIC.y + PIC.h + 0.5); vx.stroke();
      for (const x of [48, VW - 48]) { vx.beginPath(); vx.moveTo(x, PIC.y - 14); vx.lineTo(x, PIC.y - 2); vx.moveTo(x, PIC.y + PIC.h + 2); vx.lineTo(x, PIC.y + PIC.h + 14); vx.stroke(); }
    vx.restore();
    }
    // ---- lyrics, typeset by JIZURA at 9:16 in the bands around the picture
    const plan = shot ? lyricPlan(shot, t) : null;
    lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalAlpha = 1; lx.globalCompositeOperation = 'source-over'; lx.filter = 'none'; lx.clearRect(0, 0, VW, VH);
    if (plan) JZ.drawPlan(plan, lx, Z.lyricT(t), 'front');
    // tools/check_shots.mjs judges these 9:16 lyrics on the picture under them (main.js skips its hook here)
    // shortcut: a shot's own code-drawn type (shot.text) is baked into the picture band and not judged as lyrics
    if (Z.onText) Z.onText(lyr, shot, null, vout, { plan, t: Z.lyricT(t) });
    if (plan) vx.drawImage(lyr, 0, 0);
    // ---- header / footer (quiet, out of the way of the title card and the end card)
    if (own) { if (CFG.chrome) { vx.save(); CFG.chrome(vx, t, { PIC, VW, VH, credits }); vx.restore(); } }
    else if (credits) {
      const fade = Z.clamp((t - c0) / 0.8) * Z.clamp((c1 - t) / 0.3);
      vx.save(); vx.globalAlpha = 0.72 * fade; vx.fillStyle = INK; vx.textBaseline = 'alphabetic';
      D.font(vx, 40, 'minchoHeavy', 900); vx.textAlign = 'left'; vx.fillText(CFG.title, 56, 96);
      D.font(vx, 17, 'dot', 400); vx.fillText(CFG.sub, 58, 126);
      vx.textAlign = 'right'; D.font(vx, 20, 'gothic', 500); vx.fillText(CFG.artist, VW - 56, 92);
      const f = Math.floor(t * 30), tc = [Math.floor(t / 60) % 60, Math.floor(t) % 60, f % 30].map(n => String(n).padStart(2, '0')).join(':');
      D.font(vx, 17, 'dot', 400); vx.fillText(tc, VW - 56, 124);
      vx.globalAlpha = 0.6 * fade; vx.textAlign = 'center'; D.font(vx, 21, 'gothic', 400); vx.letterSpacing = '3px';
      vx.fillText(Z.CREDIT || '', VW / 2, VH - 64);
      vx.letterSpacing = '0px';
      // song progress hairline
      vx.globalAlpha = 0.35 * fade; vx.fillRect(56, VH - 40, (VW - 112) * Z.clamp(t / c1), 1.5);
      vx.restore();
    }
  }

  const baseRender = window.renderFrame;
  window.renderFrame = async t => { await window.ready; await baseRender(t); compose(Z.filmT(t)); };   // film time, as main.js
})();
