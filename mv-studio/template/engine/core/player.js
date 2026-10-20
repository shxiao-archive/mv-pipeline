/* mv-studio engine — PREVIEW PLAYER (engine/index.html?play or vertical.html?play): plays audio/song.wav and draws
 * the frame the export would show at the audio's time (snapped to 30 fps). Off in renders (render_frames.mjs sets
 * window.__ZANKO_RENDER__) and without ?play; it never draws into the canvas (the HUD is a DOM overlay).
 *
 *   npm run preview            (tools/jizura_serve.mjs 5179), then open the printed ?play URL
 *   space  play / pause                 left / right  one frame (shift: one second)
 *   [ / ]  previous / next shot          L  loop the current shot (again: off)
 *   Home   the start                      H  hide / show the HUD
 *   ?t=12.5 starts there; while paused the URL keeps the current time, so it is a deep link to the frame.
 * Slow frames are dropped while playing (the HUD shows the draw time); paused frames are always exact.
 * Idea after pdoom-video's preview app; written for mv-studio (MIT).
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search);
  if (!q.has('play') || window.__ZANKO_RENDER__) return;
  const Z = window.Z, FPS = 30, snap = s => Math.max(0, Math.round(s * FPS)) / FPS;
  const audio = new Audio(Z.ROOT + 'audio/song.wav');
  audio.preload = 'auto';
  let t = snap(+q.get('t') || 0), loop = null, busy = false, want = null, ms = 0, hudOn = true;
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9;padding:4px 8px;white-space:pre;pointer-events:none;' +
    'font:12px/1.5 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.65)';
  document.body.appendChild(hud);

  const fmt = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
  const shots = () => (Z.shotList ? Z.shotList() : []);
  const film = () => t - (Z.OFFSET || 0);                       // shots are in film time (project.json timing.offset)
  const current = () => { let k = -1; shots().forEach((s, i) => { if (s.t0 <= film() + 1e-6) k = i; }); return k; };
  const span = k => { const s = shots(), a = s[k]; return [a.t0 + (Z.OFFSET || 0), (s[k + 1] ? s[k + 1].t0 : a.t1) + (Z.OFFSET || 0)]; };
  function info() {
    if (!hudOn) { hud.style.display = 'none'; return; }
    const k = current(), s = shots()[k];
    hud.style.display = '';
    hud.textContent = `${fmt(t)}  f${Math.round(t * FPS)}  ${audio.paused ? 'paused' : 'playing'}${loop ? '  LOOP' : ''}  draw ${ms.toFixed(0)} ms\n` +
      (s ? `shot ${k + 1}/${shots().length}  ${s.id || ''}  ${s.scene}${s.moment ? '  - ' + s.moment : ''}\n` : '\n') +
      'space play  ←→ frame (shift 1 s)  [ ] shot  L loop  Home start  H hud';
  }
  async function show(nt) {
    t = snap(nt);
    if (busy) { want = t; return; }
    busy = true;
    const a = performance.now();          // lint-ok: HUD draw time, never in a render
    await window.renderFrame(t);
    ms = performance.now() - a;           // lint-ok
    busy = false;
    info();
    if (want != null) { const w = want; want = null; await show(w); }
  }
  const keepUrl = () => { q.set('t', t.toFixed(3)); history.replaceState(null, '', '?' + q.toString().replace(/play=(&|$)/, 'play$1')); };
  const pause = () => { if (!audio.paused) { audio.pause(); t = snap(audio.currentTime); } };
  const seek = nt => { pause(); show(nt).then(keepUrl); audio.currentTime = snap(nt); };

  function tick() {
    if (!audio.paused) {
      if (loop && audio.currentTime >= loop[1]) audio.currentTime = loop[0];
      if (!busy) show(audio.currentTime);
    }
    requestAnimationFrame(tick);
  }
  addEventListener('keydown', e => {
    const k = e.key;
    if (k === ' ') {
      e.preventDefault();
      if (audio.paused) { audio.currentTime = t; audio.play(); info(); } else { pause(); show(t).then(keepUrl); }
    } else if (k === 'ArrowRight' || k === 'ArrowLeft') {
      e.preventDefault();
      pause();
      seek(t + (k === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : 1 / FPS));
    } else if (k === '[' || k === ']') {
      const i = current(), n = shots().length;
      if (!n) return;
      if (k === ']') seek(span(Math.min(n - 1, i + 1))[0]);
      else seek(span(Math.max(0, t - span(Math.max(0, i))[0] > 0.1 ? i : i - 1))[0]);
    } else if (k === 'l' || k === 'L') {
      loop = loop ? null : span(Math.max(0, current()));
      info();
    } else if (k === 'Home') seek(0);
    else if (k === 'h' || k === 'H') { hudOn = !hudOn; info(); }
  });
  window.ready.then(() => { audio.currentTime = t; show(t); requestAnimationFrame(tick); });
})();
