/* engine/timeline.js — STARTER for the VOCALOID style (read <skill>/styles/vocaloid/BRIEF.md, then STYLE.md).
 * The ボカロPV tradition, from two equal libraries a film takes shots from freely:
 *   TEGAKI (styles/vocaloid: illust typeCard kanjiSlam converge afterimage …) — an illustrated 手書き story: light,
 *          colour script, signature set pieces; lyrics by JIZURA plans
 *   SIGNAL (styles/signal, Z.SIG: sigShot sigTerm sigFrag sigAbs, SIG.cuts) — footage from a device failing in heat:
 *          speed is editing, heat grades the picture, the device HUD sets the lyrics
 * The signal grade, decay and HUD run only where signal shots are (SIG.spans), so the two lyric layers never meet.
 *
 * This starter builds a plain first cut from the song's lyric lines so a new project renders at once: the title,
 * then one shot (or one run of cuts) per line from POOL (both libraries, cycled in order), then the title's
 * afterimage. It is scaffolding, not the film: replace the pool, or pick a builder per line yourself, from YOUR shot
 * list (moment / line / cue per shot; node tools/storyboard.mjs). The hand-built demo film 「蛍火」 is demo/hotarubi.js.
 * Lyric text never appears here: shots take line indices (Z.LYR / Z.line(i)); tools/check_no_lyrics.mjs checks it.
 * Run tools/check_flash.py on every render (signal runs cut fast).
 *
 * Sky helpers and the JIZURA curation come from the demo 「蛍火」 — NikusonP, vocaloid-style-mv-pipeline, MIT licence.
 */
(() => {
  'use strict';
  const Z = window.Z, D = Z.draw, SIG = Z.SIG;
  const W = 1920, H = 1080;
  Z.TITLE = 'untitled';
  Z.TITLE_SUB = '';
  Z.ARTIST = '';
  Z.CREDIT = '';
  const IMGS = [];             // signal motifs, e.g. ['assets/bg/ruins.png', ...] (NEUTRAL colour: the heat grade tints them)

  // one palette for both libraries: firefly yellow-green on a navy night (the HUD accent is its glow)
  const FF = { glow: '#DDFF7A', sunset: '#9BD86A', hi: '#F2FFC8' };
  const NIGHT = [[0, '#02040b'], [0.5, '#081429'], [0.85, '#10284a'], [1, '#173458']];

  // ---- small custom fx (illust `fx: [{ type: 'custom', fn }]`); fn(ctx, S) must be a pure function of S.t
  // twinkling star field (12 fps twinkle = hand-drawn 2コマ timing; positions fixed per seed)
  const stars = (n = 170, seed = 5, top = 0.72, color = '#E8F0FF', alpha = 1) => ({ type: 'custom', fn: (ctx, S) => {
    const tq = Z.quant(S.t, 12);
    ctx.save(); ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const x = Z.rnd(i, seed) * W, y = Math.pow(Z.rnd(i, seed + 1), 1.35) * H * top;
      const tw = 0.3 + 0.7 * Math.abs(Math.sin(tq * (0.6 + 2.4 * Z.rnd(i, seed + 2)) + i));
      const r = 0.7 + 2.0 * Math.pow(Z.rnd(i, seed + 3), 3);
      ctx.globalAlpha = alpha * tw * (0.2 + 0.8 * Z.rnd(i, seed + 4));
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
    ctx.restore();
  } });
  // a hill silhouette from 1-D noise, drifting sideways (parallax depth without a background painting)
  const ridge = (y, amp, color, { drift = 8, seed = 1, scale = 420, rim = null } = {}) => ({ type: 'custom', fn: (ctx, S) => {
    const off = S.lt * drift, pts = [];
    for (let x = -16; x <= W + 16; x += 12) pts.push([x, y - amp * (0.5 + 0.55 * Z.fbm1((x + off) / scale, seed, 3))]);
    ctx.save(); ctx.beginPath(); ctx.moveTo(-16, H + 16);
    for (const [x, yy] of pts) ctx.lineTo(x, yy);
    ctx.lineTo(W + 16, H + 16); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    if (rim) { ctx.beginPath(); pts.forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy))); ctx.strokeStyle = rim; ctx.lineWidth = 1.6; ctx.stroke(); }
    ctx.restore();
  } });
  // star trails turning around a celestial pole (cx, cy): arcs that lengthen with the shot's time
  const starTrails = (cx, cy, { n = 340, seed = 13, speed = 0.16, reach = 2100 } = {}) => ({ type: 'custom', fn: (ctx, S) => {
    const turn = speed * S.t, len = speed * (0.8 + S.lt);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const r = 40 + Math.sqrt(Z.rnd(i, seed)) * reach, a1 = Z.rnd(i, seed + 1) * Z.TAU + turn, w = 0.9 + 2.0 * Math.pow(Z.rnd(i, seed + 2), 3);
      const col = Z.rnd(i, seed + 3) < 0.12 ? '#FFD9A0' : Z.rnd(i, seed + 3) < 0.3 ? '#BFD4FF' : '#EEF3FF', al = 0.35 + 0.65 * Z.rnd(i, seed + 4);
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = Z.rgba(col, al * (1 - k * 0.33)); ctx.lineWidth = w;
        ctx.beginPath(); ctx.arc(cx, cy, r, a1 - len * (k + 1) / 3, a1 - len * k / 3); ctx.stroke();
      }
    }
    ctx.restore();
  } });
  // `afterimage` cuts a character silhouette out of its sun disc: no character art yet, so an empty one
  // (with a character, pass assets/char/REF_master.png, the default)
  const NO_IMAGE = (() => Z.canvas(1, 1).toDataURL('image/png'))();

  Z.setup = async (audio) => {
    const nb = t => audio.beats.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), audio.beats[0] ?? t);   // nearest beat
    const secs = audio.sections || [];
    for (const s of secs) s.look = s.label;
    Z.sectionAt = t => { let s = secs[0] || null; for (const x of secs) if (x.start <= t + 1e-6) s = x; return s; };
    const all = Z.LYR.map(l => l.text).join('');
    if (/[一-鿿]/.test(all) && !/[぀-ヿ]/.test(all)) SIG.useChinese();
    // a night film (daylight: bloom 0.15, bloomThreshold 0.93, vignette 0.1 — a 0.72 threshold turns a sky milky)
    Z.LOOK_DEFAULT = { boil: 1.0, bloom: 0.32, bloomThreshold: 0.72, grain: 0.05, vignette: 0.35, lutMix: 0 };
    Z.LOOKS = { verse: { boil: 0.9, grain: 0.06 }, 'pre-chorus': { boil: 1.1, beatCA: 1.5 }, chorus: { boil: 1.2, bloom: 0.42, beatBloom: 0.15, beatCA: 2 } };
    await Promise.all(['400 32px "DotGothic16"', '600 64px "Shippori Mincho B1"', '800 64px "Shippori Mincho B1"', '600 64px "Noto Serif SC"', '800 64px "Noto Serif SC"',
      '400 24px "Zen Kaku Gothic New"'].map(f => document.fonts.load(f, Z.TITLE + Z.CREDIT + 'A0字')));
    const END = audio.music_cut || audio.duration, TAIL = 3;

    // ---- JIZURA lyric plans (tegaki shots) from analysis/lyrics_mv.lrc; without it tegaki shots draw no text
    let lrc = '';
    try { const r = await fetch(Z.ROOT + 'analysis/lyrics_mv.lrc'); if (r.ok) lrc = await r.text(); } catch (e) { /* no lyrics yet */ }
    if (!lrc.trim()) console.warn('analysis/lyrics_mv.lrc missing: rendering without the JIZURA lyric layer');
    lrc = lrc.replace(/^﻿/, '').replace(/^\[ti:.*\]\s*$/m, '');   // no [ti:]: JIZURA would add its own title card
    if (lrc.trim() && window.J) {
      JZ.setAudio({ duration: audio.duration, beats: audio.beats, energy: null, energyRate: 0 });
      // Curate JIZURA's ~860 parts for the film's tone (references/06 §5). Any change here (or to `seed`, MOODS)
      // re-rolls every cut of the plan: re-render the stills afterwards.
      const DENY = {
        layout: 'scatter ring wave labels pill knSeesaw knGearWords knTumble knPadGrid knPathRide zigzag arcTop ' +
                'gridCells bubble ticker searchBar chat notification ticket hanging wordCloud bounceLine elastic ' +
                'stickerBomb keycaps bubbles slotMachine flipBoard dotMatrix equalizer tape contents numbered poster ' +
                'ema ransom newspaper vinyl cassette bookSpine stampSheet calendar chochin routeMap stationSign noren ' +
                'tanzaku omikuji kakejiku shoji clapper warningLabel priceTag nameTag stickyNotes karuta cube ' +
                'flipCards accordion pile blocks balloons magnets tiles bulbs ledScroll billboard crowdBubbles ' +
                'crossword wordSearch puzzle dominoes burst fisheye origami zipper mosaicTiles stencil tyIndexTable ' +
                'tyStatCount typeSpecimen dictionary proofread magazine headlineDeck footnote ribbon flag pendulum ' +
                'knCollide knSlamStack halftoneBig tySquare tyRotBlock subtitleBar tile kaleido polaroid postcard ' +
                'letterPaper genkou panels splitScreen splitHalves wall cylinder cube',
        fx: 'panelWipe irisTrans doors blindsTrans splitSlide gridRepeat whiteFrame blackFrame strobe colorBars ' +
            'mirrorFlash starGlint focusLines speedLines halftone duotone kaleido bulge squash snapshot ' +
            'loopScroll crtOff tvStatic zoomStutter negativeRing edgeDetect hueShift posterize ditherBit ' +
            'rotateSnap invert bandInvert flash bloomFlash',
        decor: 'dots arrows shapes qrBlock triangleSpin checkerStrip confetti petals heartsStars kamon seigaiha ' +
               'asanoha hanabi chochin shimenawa sensu momiji namiGashira memphis zigzagRibbon polkaPatch ' +
               'stripeCircle starburst cursorClick windowChrome progressBar toggleSwitch notifBell likeCounter ' +
               'mediaControls volumeBars musicNotes bubbles dandelion vines cloudPuffs tapePieces highlightMark ' +
               'staple paperClip indexTabs punchHoles swatches spinner tally qrBlock bracketsJP loopArrows ' +
               'halfCircles decoCorners tyColophon dateStamp tyTypeScale tyTextRule',
        cam: 'knCardFlip jelly bounce knJumpCut knTiltKick knReadPan knShearKick knRushIn',
        treat: 'boxed marker knWordPlate circled sticker splitColor rainbow chrome',
        enter: 'bubbles stickerPeel crumple loadingBar tokoroten',
        exit: 'balloonOff crumpleOut peelOff',
        bg: 'argyle tartan chevron houndstooth herringbone polka checker retroGrid eqBars kaleidoscope fireworks ' +
            'sunburst bigStripes isoCubes seigaiha asanoha tvBars splitDiag spiralArms squareTunnel moire',
        trans: 'knCornerSwing knStripSlam checker cubeTurn spinOut doorsOpen pixelate',
      };
      DENY.decor += ' dataColumns timecodeBar rainStreaks';           // no data tables / timecodes (the signal HUD has them), no rain
      DENY.layout += ' shadowPlay glitchGrid';                        // opaque plates: a grey floor (9:16) / beige glyph tiles
      DENY.trans += ' knStutterCut zoomThrough inkBlob';              // black out / cover the picture under the lyric in front mode
      DENY.layout += ' curtain'; DENY.fx += ' filmAdvance';           // an opaque theatre curtain; black film frames (pops.mjs flags them)
      // measured by tools/jizura_cover.mjs (> 30 % of the frame covered in front mode; references/06 §5)
      DENY.trans += ' uncover whipPan flashCross';
      DENY.layout += ' marquee diag filmstrip contour knZoomDive knTypeSlam sliceStack';
      DENY.treat += ' ransom monoGrid';
      DENY.layout += ' huge gloss zoomRepeat';                         // the noir / mono plans: giant type over 40 % of the frame
      // editorial captions (No.06, LINE 06, 0:26.00, rulers, reticles) read as a debug layer over an illustrated film (references/09 §8)
      DENY.decor += ' atomOrbit barcode constellation counter crosshair dimension glitchRects glyphLock guides headingTape hexGrid indexNum knWordTicks leaders progressRing radar registration reticle rings ruledLines rulerEdge spectrumRing tyGlyphBody tyRunningHead verticalStrip';
      DENY.layout += ' corners crossBands ruler swissGrid type';
      // stacked repeats: the line drawn 4x more often than a plain layout draws it (a wall of copies, echoes, rings)
      DENY.layout += ' circleWords credits edgeFrame justified mirror orbit rain tunnel tyBandHide vcols'; DENY.hold = 'shadowSway';
      DENY.layout += ' circle';   // words set on a dark disc that hides them in the centre-free side bands
      DENY.layout += ' condensed'; DENY.exit = (DENY.exit || '') + ' tyToIndex';   // a short word repeated to fill the width; letters turned into index numbers
      DENY.layout += ' tyCropGiant sideways knQuarterTurn';   // words against the frame edge or thrown off it (check_shots safe area)
      DENY.layout += ' stack depthStack perspective tyCross knFlowSnap';   // the line again: stacked, receding, crossing itself, a cascade of copies
      DENY.decor += ' romajiLine watermarkKanji';   // codepoints under kanji lines; one of the line's glyphs huge behind it
      DENY.decor += ' tyBigPunct'; DENY.layout += ' kanjiFocus';   // faint giant brackets / a faint giant kanji (low contrast, at the frame edge)
      DENY.layout += ' lowerThird'; DENY.decor += ' circuit';       // a rule / circuit traces drawn from the frame edge
      DENY.hold += ' zoomSlow stretchPulse pulse heartbeat echoTrail';   // holds that scale a full-width line past the safe area
      DENY.layout += ' knRhythmCuts columnsBig'; DENY.decor += ' speedCorner';   // a word thrown off the edge; edge-to-edge columns; speed lines from the corners
      // Optional mood filter on JIZURA's part tags; null = off, e.g. a night ballad ['emotional', 'calm', 'editorial', 'glitch']
      const MOODS = null;
      // JIZURA's own transitions draw the old and the new line on top of each other: off (shot.trans is not affected)
      const TEXT_TRANS = false;
      const enabled = {};
      for (const g of J.GROUP_KEYS) {
        enabled[g] = {}; const deny = new Set((DENY[g] || '').split(/\s+/).filter(Boolean));
        for (const k of J.order(g)) {
          const d = J.registry(g)[k] || {}, tags = Array.isArray(d.tags) ? d.tags : null;
          let ok = !deny.has(k) && !/^hr[A-Z]/.test(k) && d.set !== 'horror';
          if (ok && MOODS && tags && !tags.some(m => MOODS.includes(m))) ok = false;
          if (g === 'trans' && !TEXT_TRANS) ok = false;
          if (k === 'none') ok = true;
          enabled[g][k] = ok;
        }
      }
      const common = {
        enabled, fullLine: false, lyrics: lrc, fps: 30, res: 1080, aspect: '16:9', seed: 128, unify: true, typeset: true, extra: true, wa: false, horror: false,
        colors: { accentOn: true, accent: FF.glow, ghostA: '#39C6E0', ghostB: FF.sunset }, schemes: 'dark',   // daylight film: schemes: 'light'
        fx: { motion: 0.7, glitch: 0.4, chroma: 0.55, decor: 0.4, density: 0.5, texture: 0.5, flash: false, koma: 12, hud: 'off', bgSwitch: 0.3,
              hideNo: true, hideTime: true } };
      // the plans keep the common chroma: a stronger colour split on a cut blurs the line under 3:1 (check_shots)
      // one plan per look; a shot picks one with `plan:` (default 'main'). 'cf' = centre-free (subject in the middle)
      await JZ.addPlan('main', Object.assign({}, common, { style: 'gold', mood: 'emotional' }));
      await JZ.addPlan('cf', Object.assign({}, common, { style: 'gold', mood: 'emotional', centerFree: true }));
      await JZ.addPlan('noir', Object.assign({}, common, { style: 'noir', mood: 'glitch', fx: Object.assign({}, common.fx, { glitch: 0.65 }) }));
      await JZ.addPlan('mono', Object.assign({}, common, { style: 'mono', mood: 'graphic', seed: 129, fx: Object.assign({}, common.fx, { motion: 0.85 }) }));
      // the 統一感 morph melts one part of a line into the next (both drawn, blurred): off with the text transitions
      if (!TEXT_TRANS) for (const name of ['main', 'cf', 'noir', 'mono']) for (const c of JZ.plans[name].plan.cuts) delete c.morph;
    }

    const S = [];
    const shot = (id, t0, t1, scene, args, extra = {}) => { if (t1 > t0 + 0.05) S.push(Object.assign({ id, t0, t1, scene, args }, extra)); };
    const L = Z.LYR, first = L.length ? nb(L[0].t - 0.4) : Math.min(4, END);
    // ---- the title in the quiet
    shot('s00', 0, first, 'typeCard', { lines: [Z.TITLE], size: 112, fam: 'minchoHeavy', weight: 700, ruleColor: FF.glow, sub: Z.TITLE_SUB, lead: 0.25 },
      { lyric: 'none', hud: false, post: { boil: 0, bloom: 0.4, grain: 0.04 }, moment: 'the title in near silence' });

    // ---- the shot builders: each takes a line and its span [a, b)
    let k = 0;
    const spans = [], hudLyrics = [], signalIds = [];
    // TEGAKI: an illustrated shot, the line set by a JIZURA plan over it (REPLACE the sky with the film's pictures).
    // Out of a signal run: a hard cut (a blending transition would draw the run's WORD frame under the JIZURA line)
    const tegaki = (moment, plan, args, extra = {}) => (l, a, b) => shot(`s${++k}`, a, b, 'illust', args, Object.assign(
      { line: l.i, plan, hud: false, moment: `line ${l.i}: ${moment} (REPLACE: what this line shows)` }, extra));
    // SIGNAL: a run of cuts at a tier (1 sprint · 2 one gear lower · 3 slow); the HUD sets the line (1 stamp · 2 centre ·
    // 3 vertical), a WORD frame slams it (or its emphasised word) in tiers 1-2
    const signal = tier => (l, a, b) => {
      const motifs = IMGS.map((img, i) => ({ scene: 'sigShot', args: { mode: ['full', 'crop', 'split'][i % 3], img, imgs: IMGS.slice(i, i + 3) } }));
      if (tier < 3) motifs.unshift({ scene: 'sigShot', args: { mode: 'word', line: l.i } });
      if (!motifs.length) motifs.push({ scene: 'sigAbs', args: { mode: 'scan' } }, { scene: 'sigTerm', args: { mode: 'coord' } });
      const run = SIG.cuts({ t0: a, t1: b, tier, motifs, seed: 11 + l.i, id: `s${++k}_`, moment: `line ${l.i}: tier ${tier} signal run (REPLACE: the motifs for this line)` });
      run.forEach(x => { x.line = l.i; signalIds.push(x.id); });
      S.push(...run);
      const last = spans[spans.length - 1];
      if (last && last[1] >= a - 1e-3) last[1] = b; else spans.push([a, b]);
      hudLyrics.push({ from: a, to: b, mode: ['stamp', 'center', 'vertical'][tier - 1] });
    };
    // REPLACE: the film's own order (or choose a builder per line). Any line may come from either library.
    const POOL = [
      tegaki('night sky, stars, hills, fireflies', 'main', { grad: NIGHT, vignette: 0.55,
        fxBack: [stars(), { type: 'glow', x: 1480, y: 230, r: 420, color: '#BFD4FF', a: 0.32 }, ridge(820, 150, '#0a1a2c', { drift: 10, seed: 3, scale: 520 }), ridge(930, 120, '#050c16', { drift: 22, seed: 9, scale: 380 })],
        fx: [{ type: 'fireflies', n: 16, area: [0, H * 0.62, W, H], alpha: 0.75, color: FF.glow }, { type: 'dust', n: 36, color: 'rgba(190,210,255,0.35)' }] },
        { post: { lutA: 'night', lutMix: 0.2 } }),
      signal(3),
      tegaki('star trails wheel around the pole', 'noir', { grad: [[0, '#01030a'], [0.6, '#06112a'], [1, '#0d2244']], vignette: 0.5,
        fxBack: [starTrails(1460, 140), { type: 'glow', x: 1460, y: 140, r: 260, color: '#BFD4FF', a: 0.18 }],
        fx: [ridge(930, 120, '#02050b', { drift: 4, seed: 15, rim: 'rgba(191,212,255,0.18)' })] },
        { post: { lutA: 'night', lutMix: 0.15, bloom: 0.4 } }),
      signal(2),
      tegaki('a field of rising fireflies', 'mono', { grad: [[0, '#02060c'], [0.55, '#0a2030'], [1, '#14423f']], vignette: 0.4,
        fxBack: [stars(120, 21, 0.55), { type: 'glow', x: 960, y: 1080, r: 900, color: FF.sunset, a: 0.35, beat: 0.5 }, { type: 'rays', x: 960, y: 1150, n: 22, len: 1800, color: FF.glow, a: 0.07 }],
        fx: [ridge(960, 90, '#020509', { drift: 30, seed: 12 }), { type: 'embers', n: 130, color: FF.glow, rise: 150, size: 3.2, area: [0, 300, W, H + 80], wind: 0.15 }, { type: 'fireflies', n: 40, alpha: 0.8, color: FF.glow }] },
        { post: { lutA: 'P4', lutMix: 0.12, bloom: 0.55 } }),
      signal(1),
      // the light of dawn stays low, behind the hills: the light lyric type needs 3:1 against the sky (check_shots)
      tegaki('dawn', 'cf', { grad: [[0, '#140f33'], [0.45, '#3a2860'], [0.75, '#7a4a6e'], [0.88, '#d9908f'], [0.95, '#ffd2a6'], [1, '#fff0d8']], vignette: 0.3,
        fxBack: [stars(60, 41, 0.35, '#FFF2E0', 0.4), { type: 'glow', x: 960, y: 1040, r: 620, color: '#FFD9B0', a: 0.24, beat: 0.25 }],
        fx: [ridge(900, 130, '#1a1030', { drift: 14, seed: 8 }), ridge(980, 90, '#0b0718', { drift: 30, seed: 2 }), { type: 'dust', n: 50, color: 'rgba(255,236,210,0.55)' }] },
        { post: { lutA: 'dawn', lutMix: 0.15, bloom: 0.38, bloomThreshold: 0.8 } }),
      signal(2),
    ];

    const lines = L.filter(l => l.t >= first - 0.3 && l.t < END - 0.3);
    let cur = first;
    lines.forEach((l, i) => {
      const next = lines[i + 1] ? nb(lines[i + 1].t - 0.3) : END;
      if (next > cur + 0.2) POOL[i % POOL.length](l, cur, next);
      cur = Math.max(cur, next);
    });
    // ---- the end: hard cut to the title's afterimage (its colour is the complement of FF.glow)
    shot('end', END, END + TAIL, 'afterimage', { text: Z.TITLE, sub: Z.TITLE_SUB.toLowerCase(), credit: Z.CREDIT, color: '#A88BFF', char: NO_IMAGE },
      { lyric: 'none', hud: false, post: St => Object.assign(Z.INTRO.post.afterimage(St), { boil: 0 }), moment: "the title's afterimage and the credit", cue: Z.CUES.end ? 'end' : null });

    // ---- signal: grade, decay and HUD only inside its spans; heat rises over the film (REPLACE: the film's heat curve)
    SIG.spans = spans;
    SIG.heatKeys = [[0, 0.1], [END, 0.95]];
    SIG.boost = { chorus: 0.14, 'pre-chorus': 0.06, 'post-chorus': 0.1 };
    SIG.install();
    if (IMGS.length) SIG.useImages(IMGS);
    Object.assign(SIG.hudCfg, { title: (Z.TITLE || 'UNIT') + ' / LOG', accent: FF.glow, lyrics: hudLyrics,
      log: spans.length ? [[spans[0][0] + 0.2, 'boot'], [spans[0][0] + 0.6, 'sensor check ... ok'], [spans[0][0] + 1.0, 'rec start']] : [] });
    Z.hud = (ctx, St) => { if (SIG.on(St.t)) SIG.hud(ctx, St); };
    Z.hudShowsLyrics = true;                               // the HUD sets the lyrics of signal shots (tools/storyboard.mjs counts it)

    Z.SHOTS = S;
    window.__zankoMeta.duration = END + TAIL;
    // 9:16 (engine/vertical.html): signal runs and type cards keep the whole 16:9 frame; tegaki plans map to vertical ones
    Z.VERTICAL_CFG = { full: ['s00', 'end', ...signalIds], planMap: { main: 'v_main', cf: 'v_main', noir: 'v_noir', mono: 'v_mono' },
      title: Z.TITLE, sub: Z.TITLE_SUB, artist: Z.ARTIST, credits: [first, END], schemes: 'dark', ambience: [10, 6, 18] };
  };
})();
