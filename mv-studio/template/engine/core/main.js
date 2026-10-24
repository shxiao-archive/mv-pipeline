/* vocaloid-style-mv engine — frame orchestration.
 *
 * Contract used by tools/render_frames.mjs:
 *   window.ready            Promise, resolves when assets/fonts/plans are loaded
 *   window.renderFrame(t)   async, draws the frame at song time t (seconds) into <canvas id="out">
 *   window.__zankoMeta      { duration, fps }
 *
 * Timeline (engine/timeline.js) defines Z.SHOTS = [{ id, t0, t1, scene, args, lyric, post, trans }]
 *   scene : name registered with Z.scene(name, { preload(args) -> [urls], init(args) async, draw(ctx, S) (may be async) })
 *   lyric : 'front' | 'full' | 'backfront' | 'none' | { plan, mode }       (JIZURA layer; default plan 'main')
 *   post  : object or (S) => object     (merged over the section look, see Z.post.DEFAULTS)
 *   trans : { type, dur }   transition INTO this shot, occupying [t0, t0+dur]; the previous shot keeps rendering
 *   text  : (ctx, S) => void           custom typography drawn on the text layer (after JIZURA)
 *   fps   : n                          the scene is drawn at n frames a second (dropped frames; lyrics stay smooth)
 *   tmap  : t => t'                    the time the scene draws at (Z.replayMap: a gesture played again)
 *   span  : [t0, t1]                   S.lt / S.p run over this span (set by Z.withInserts: a shot cut away from and back)
 */
(() => {
  'use strict';
  const Z = window.Z;
  const W = 1920, H = 1080;
  Z.W = W; Z.H = H;

  const out = document.getElementById('out');
  const sceneC = Z.canvas(W, H), sceneX = sceneC.getContext('2d');
  const textC = Z.canvas(W, H), textX = textC.getContext('2d');
  const fgC = Z.canvas(W, H), fgX = fgC.getContext('2d');       // foreground layer: drawn OVER the lyrics (text behind the character)
  const layerA = Z.canvas(W, H), layerAX = layerA.getContext('2d');
  const layerB = Z.canvas(W, H), layerBX = layerB.getContext('2d');
  Z.scratch = [Z.canvas(W, H), Z.canvas(W, H), Z.canvas(W, H)];

  // ---------------------------------------------------------------- data
  const loadJSON = async p => { const r = await fetch(Z.ROOT + p); if (!r.ok) throw new Error(p + ' ' + r.status); return JSON.parse((await r.text()).replace(/^﻿/, '')); };

  async function buildLutAtlas() {
    const pal = await loadJSON('assets/style/palettes.json');
    const c = Z.canvas(256, 32), x = c.getContext('2d');   // 32 rows: palettes x2 + built-in ramps + Z.RAMPS
    Z.LUT = {}; Z.PAL = {};
    let row = 0;
    for (const p of pal.palettes) {
      for (const [suffix, file] of [['', p.lut], ['_duo', p.lut_duotone]]) {
        const img = await Z.img(file);
        x.drawImage(img, 0, 0, img.width, img.height, 0, row, 256, 1);
        Z.LUT[p.id + suffix] = row; Z.LUT[p.id.split('_')[0] + suffix] = row; row++;
      }
      Z.PAL[p.id.split('_')[0]] = p;
    }
    // extra hand-built ramps
    const ramp = (name, stops) => {
      const g = x.createLinearGradient(0, 0, 256, 0);
      for (const [k, col] of stops) g.addColorStop(k, col);
      x.fillStyle = g; x.fillRect(0, row, 256, 1); Z.LUT[name] = row; row++;
    };
    ramp('night', [[0, '#04060d'], [0.3, '#0d1a33'], [0.55, '#23407a'], [0.75, '#7aa6d6'], [0.9, '#e8c38a'], [1, '#fff4dc']]);   // moonlit night with warm highlights
    ramp('ember', [[0, '#07040a'], [0.35, '#2a0c14'], [0.6, '#8e1f22'], [0.8, '#f06a2a'], [1, '#ffe2a8']]);                      // darkness + fire
    ramp('dawn', [[0, '#120d24'], [0.3, '#3a2d63'], [0.55, '#9a6aa0'], [0.75, '#f3a6a0'], [0.9, '#ffd9b0'], [1, '#fffaf0']]);     // first light
    ramp('mono', [[0, '#0b0a0d'], [1, '#f4efe6']]);
    ramp('day', [[0, '#0e2a47'], [0.5, '#2c8fc4'], [0.8, '#bfe8fa'], [1, '#ffffff']]);                                          // high-key daylight
    // ramps registered by style packs or the timeline file: Z.RAMPS = { name: [[k, '#hex'], ...] } (defined before main.js runs)
    for (const [name, stops] of Object.entries(Z.RAMPS || {})) ramp(name, stops);
    if (row > c.height) console.warn(`LUT atlas: ${row} rows > ${c.height}: too many palettes / Z.RAMPS: raise LUT_ROWS + the LUT texture height in gl.js and the atlas height here`);
    Z.post.setLutAtlas(c);
    Z.lutAtlas = c;
  }

  // ---------------------------------------------------------------- shots
  let SHOTS = [];
  function activeShots(t) {
    // returns [{shot, k}] : the current shot and (during its transition-in) the previous one
    let i = -1;
    for (let j = 0; j < SHOTS.length; j++) if (SHOTS[j].t0 <= t + 1e-6) i = j; else break;
    if (i < 0) return [];
    const cur = SHOTS[i];
    if (t >= cur.t1 && i === SHOTS.length - 1) return [{ shot: cur, k: 1 }];
    const tr = cur.trans;
    if (tr && tr.dur > 0 && i > 0 && t < cur.t0 + tr.dur) return [{ shot: SHOTS[i - 1], k: 0 }, { shot: cur, k: (t - cur.t0) / tr.dur }];
    return [{ shot: cur, k: 1 }];
  }

  // shot.span [t0, t1]: a part of a longer shot (Z.withInserts) keeps the whole shot's local time and progress
  function stateFor(shot, t) {
    const [a, b] = shot.span || [shot.t0, shot.t1], dur = b - a, lt = t - a;
    return {
      t, lt, dur, p: Z.clamp(lt / dur), shot, args: shot.args || {}, W, H,
      clock: Z.clock, env: Z.env, section: Z.sectionAt ? Z.sectionAt(t) : null,
      tq: Z.quant(t, 12), ltq: Z.quant(t, 12) - a,       // 2コマ打ち times
      rng: seed => Z.rng(Z.hash(Z.hash(shot.id.length, a * 1000), seed)),
    };
  }
  // shot.fps (a dropped-frame look: the scene is drawn at that rate) and shot.tmap(t) -> t (Z.replayMap, ...): the time the
  // scene draws at. The lyric layer and the post params keep song time, so the line stays readable and in sync.
  const sceneT = (shot, t) => { if (shot.tmap) t = shot.tmap(t); return shot.fps ? Z.dropFrames(t, shot.fps, shot.span ? shot.span[0] : shot.t0) : t; };

  async function drawShot(ctx, shot, t, fg = null) {
    const def = Z.SCENES[shot.scene];
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.clearRect(0, 0, W, H);
    if (!def) { ctx.fillStyle = '#300'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = '40px sans-serif'; ctx.fillText('missing scene ' + shot.scene, 60, 100); }
    else {
      const S = stateFor(shot, sceneT(shot, t)); S.fg = fg || ctx;              // scenes draw "in front of the lyrics" elements into S.fg
      if (fg) { fg.save(); }
      const r = def.draw(ctx, S); if (r && r.then) await r;
      if (fg) { fg.restore(); }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- lyric layer
  function drawLyrics(shot, t) {
    if (Z.NO_LYRICS) return;                                   // vertical build re-typesets the lyrics at 9:16
    let L = shot.lyric === undefined ? 'front' : shot.lyric;
    if (!L || L === 'none' || !window.JZ || !Object.keys(JZ.plans).length) return;
    if (typeof L === 'function') L = L(stateFor(shot, t));
    if (!L || L === 'none') return;
    const spec = typeof L === 'string' ? { plan: shot.plan || 'main', mode: L } : L;
    const plan = spec.plan || 'main';
    const tl = lyricT(t);
    if (spec.mode === 'backfront') { JZ.drawPlan(plan, textX, tl, 'back'); const c = Z.scratch[2], x = c.getContext('2d'); JZ.drawPlan(plan, x, tl, 'front'); textX.drawImage(c, 0, 0); }
    else JZ.drawPlan(plan, textX, tl, spec.mode === 'full' ? 'normal' : spec.mode);
    if (spec.safe) {   // lyric: { safe: 0.9 }: the lyric layer scaled into the title-safe box, for big layouts not meant to crop
      const k = typeof spec.safe === 'number' ? spec.safe : 0.9, c = Z.scratch[1], x = c.getContext('2d');
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'copy'; x.drawImage(textC, 0, 0);
      x.globalCompositeOperation = 'source-over';
      textX.clearRect(0, 0, W, H); textX.drawImage(c, W * (1 - k) / 2, H * (1 - k) / 2, W * k, H * k);
    }
  }
  // project.json timing.lyricOffset moves the JIZURA layer too (code-drawn type gets it in core/lyrics.js)
  const lyricT = t => t - (Z.LYRIC_OFFSET || 0);

  // ---------------------------------------------------------------- post params
  function postFor(shot, t) {
    const S = stateFor(shot, t);
    const sec = S.section;
    const base = Object.assign({}, Z.LOOK_DEFAULT || {}, sec && Z.LOOKS && Z.LOOKS[sec.look] ? Z.LOOKS[sec.look] : {});
    const sp = typeof shot.post === 'function' ? shot.post(S) : shot.post || {};
    const P = Object.assign({}, base, sp);
    for (const k of ['lutA', 'lutB']) if (typeof P[k] === 'string') P[k] = Z.LUT[P[k]] ?? 0;
    if (P.lutB == null) P.lutB = P.lutA;
    P.boilSeed = Math.floor(t * (P.boilFps || 12) + 1e-6) % 997;
    P.grainSeed = Math.floor(t * 24 + 1e-6) % 1009;
    if (P.glitchSeed == null) P.glitchSeed = Math.floor(t * 24 + 1e-6) % 101;
    // automatic beat reactions (scaled per section/shot with beatCA / beatBloom)
    const pulse = Z.clock ? Z.clock.pulse(t, 9) : 0;
    P.ca = (P.ca || 0) + (P.beatCA || 0) * pulse;
    P.bloom = (P.bloom ?? 0.35) + (P.beatBloom || 0) * pulse;
    if (Z.globalFX) Z.globalFX(P, t);
    return P;
  }

  // ---------------------------------------------------------------- frame
  async function renderFrame(t, sub) {
    const act = activeShots(t);
    sceneX.setTransform(1, 0, 0, 1, 0, 0); sceneX.globalAlpha = 1; sceneX.globalCompositeOperation = 'source-over'; sceneX.filter = 'none';
    sceneX.fillStyle = '#000'; sceneX.fillRect(0, 0, W, H);
    textX.setTransform(1, 0, 0, 1, 0, 0); textX.globalAlpha = 1; textX.globalCompositeOperation = 'source-over'; textX.clearRect(0, 0, W, H);
    fgX.setTransform(1, 0, 0, 1, 0, 0); fgX.globalAlpha = 1; fgX.globalCompositeOperation = 'source-over'; fgX.filter = 'none'; fgX.clearRect(0, 0, W, H);
    let P = Z.post.DEFAULTS;
    if (act.length === 1) {
      await drawShot(layerAX, act[0].shot, t, fgX);
      sceneX.drawImage(layerA, 0, 0);
      drawLyrics(act[0].shot, t);
      if (act[0].shot.text) { textX.save(); act[0].shot.text(textX, stateFor(act[0].shot, t)); textX.restore(); }
      if (Z.onText) Z.onText(textC, act[0].shot, fgC, sceneC);   // the lyrics before the HUD (tools/check_shots.mjs)
      if (Z.hud && !Z.VERTICAL && act[0].shot.hud !== false) { textX.save(); Z.hud(textX, stateFor(act[0].shot, t)); textX.restore(); }
      P = postFor(act[0].shot, t);
    } else if (act.length === 2) {
      const [a, b] = act; const tr = b.shot.trans;
      await drawShot(layerAX, a.shot, t);
      await drawShot(layerBX, b.shot, t);
      const fn = Z.TRANS[tr.type] || Z.TRANS.xfade;
      fn(sceneX, layerA, layerB, Z.clamp(b.k), Object.assign({ t, W, H }, tr));
      // lyric layer follows the incoming shot (JIZURA already handles its own cut changes)
      drawLyrics(b.shot, t);
      if (b.shot.text) { textX.save(); b.shot.text(textX, stateFor(b.shot, t)); textX.restore(); }
      if (Z.onText) Z.onText(textC, b.shot, fgC, sceneC);
      if (Z.hud && !Z.VERTICAL && b.shot.hud !== false) { textX.save(); Z.hud(textX, stateFor(b.shot, t)); textX.restore(); }
      const Pa = postFor(a.shot, t), Pb = postFor(b.shot, t), k = Z.ease.inOutSine(Z.clamp(b.k));
      P = Object.assign({}, Pb);
      for (const key of Object.keys(Pb)) if (typeof Pb[key] === 'number' && typeof Pa[key] === 'number' && !/Seed|lutA|lutB/.test(key)) P[key] = Z.lerp(Pa[key], Pb[key], k);
      if (Pa.lutA !== Pb.lutA) { P.lutA = Pa.lutA; P.lutB = Pb.lutA; P.lutBlend = k; }
      if (tr.post) Object.assign(P, tr.post(b.k, P));
    }
    // style hook: Z.layerFX({ scene, text, fg, P, shot }, t) may draw over or displace the finished Canvas2D layers
    // (styles/signal: tear bands, hot pixels, rolling band) and may edit the post params P. Pure function of t.
    if (Z.layerFX) Z.layerFX({ scene: sceneX, text: textX, fg: fgX, P, shot: act.length ? act[act.length - 1].shot : null }, t);
    Z.post.render(sceneC, textC, P, fgC, sub);
  }

  // ---------------------------------------------------------------- boot
  window.__zankoMeta = { duration: 224.32, fps: 30 };
  window.ready = (async () => {
    const rendererName = Z.post.init(out);
    const audio = await loadJSON('analysis/audio.json');
    Z.audio = audio;
    Z.clock = Z.makeClock(audio.beats, audio.bpm, (audio.downbeat_info && audio.downbeat_info.winning_phase) || 0, audio.bars);
    Object.assign(Z, Z.makeHits(audio.onsets));                 // Z.hit / Z.lastHit / Z.hitCount ('kick' | 'snare' | 'hat' | 'vocal')
    try { Z.env = Z.makeEnv(await loadJSON('analysis/envelope_30fps.json')); } catch (e) { console.warn('no envelope', e); Z.env = Z.makeEnv(null); }
    await buildLutAtlas();
    try { Z.setProject(await loadJSON('project.json')); } catch (e) { Z.setProject({}); }   // core/cues.js: timing offsets
    if (Z.loadLyrics) await Z.loadLyrics();                     // core/lyrics.js: Z.LYR (lines with times), for code-drawn type
    try { Z.setCues(await loadJSON('analysis/cues.json')); } catch (e) { Z.setCues(null); }  // Z.cue('L07'): tools/make_cues.py
    if (Z.setup) await Z.setup(audio);                           // timeline.js: sections, looks, JIZURA plans, shots
    SHOTS = (Z.SHOTS || []).slice().sort((a, b) => a.t0 - b.t0);
    const urls = [];
    for (const s of SHOTS) { const d = Z.SCENES[s.scene]; if (d && d.preload) urls.push(...d.preload(s.args || {})); }
    await Z.preload(urls);
    for (const name of new Set(SHOTS.map(s => s.scene))) { const d = Z.SCENES[name]; if (d && d.init) await d.init(); }
    await document.fonts.ready;
    window.__zankoMeta.renderer = rendererName; window.__zankoMeta.shots = SHOTS.length; window.__zankoMeta.assets = urls.length;
    return window.__zankoMeta;
  })();
  // song time -> film time: project.json timing.offset > 0 shows every picture later
  // shutter (project.json render.shutter, core/cues.js): n sub-frames over the open shutter, which starts AT the frame
  // time, so a cut on a frame boundary never mixes two shots (a cut between frames blends one frame)
  window.renderFrame = async t => {
    await window.ready;
    const ft = t - (Z.OFFSET || 0), { n, angle } = Z.SHUTTER;
    if (n <= 1) return renderFrame(ft);
    const open = angle / 360 / ((window.__ZANKO_RENDER__ || {}).fps || window.__zankoMeta.fps || 30);
    for (let i = 0; i < n; i++) await renderFrame(ft + (i + 0.5) / n * open, { i, n });
  };
  Z.shotList = () => SHOTS;                                     // tools/storyboard.mjs, check_shots.mjs, pops.mjs
  Z.activeShots = activeShots;
  // helpers for meta scenes (ref / burst / montage)
  Z.shotById = id => SHOTS.find(s => s.id === id) || null;
  Z.renderShot = async (id, t, ctx) => { const s = Z.shotById(id); if (!s) throw new Error('no shot ' + id); await drawShot(ctx, s, t); };
  // draw scene `name` with `args` as if it were a shot spanning [t0,t1] (clears ctx first)
  Z.drawSceneAs = async (name, ctx, t, args, t0, t1, id = 'as_' + name) => drawShot(ctx, { id, t0, t1, scene: name, args }, t);
  Z.stateFor = stateFor;
})();
