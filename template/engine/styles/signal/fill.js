/* styles/signal — fill.js: frames that MEAN nothing and only carry the overload, plus 1-2 frame inserts.
 *
 * 'sigTerm' { mode: 'hex' | 'mem' | 'panic' | 'ps' | 'check' | 'coord' | 'nosignal' | 'bars' | 'progress', copy:[str] (film-specific
 *            system lines, never lyrics), seed, size (16 | 24 | 32 | 48: multiples of the pixel grid) }   terminal junk
 * 'sigFrag' { img | imgs, mode: 'invert' | 'threshold' | 'channel' | 'posterize' | 'mono', seed, dim }   a fragment of an
 *            existing picture: a random crop, pixelated, inverted / thresholded / one channel
 * 'sigAbs'  { mode: 'noise' | 'scan' | 'stripes' | 'checker' | 'blocks' | 'black', seed, dim }   abstract fields
 * Z.SIG.FILLERS  default filler pool (whole slots);  Z.SIG.INSERTS  default 1-2 frame inserts (DARK ones only:
 *                a bright full-frame insert is a flash — see STYLE.md safety)
 * Z.SIG.useImages(paths)  adds sigFrag fillers / inserts made from your motif images (call it in Z.setup)
 *
 * mv-studio (MIT).
 */
(() => {
  'use strict';
  const Z = window.Z, SIG = (Z.SIG = Z.SIG || {}), D = Z.draw, W = 1920, H = 1080;
  const PIX = '"DotGothic16", "IBM Plex Mono", monospace';
  const hex = (n, w) => (n >>> 0).toString(16).toUpperCase().padStart(w, '0').slice(-w);
  const R = (...a) => Z.rnd(...a);

  // ---------------------------------------------------------------- terminal junk
  const LIB = ['libc.so.6', 'ld-linux.so', 'libm.so.6', 'vdso', 'heap', 'stack', 'sensor.ko', 'rec_daemon', 'codec.bin', 'firmware'];
  const PROCS = ['init', 'kthreadd', 'rec_daemon', 'sensor_poll', 'codec', 'thermal', 'watchdog', 'storage', 'uplink', 'audio_in'];
  function termLines(mode, seed, q, copy, rows) {
    const L = [];
    if (mode === 'hex') {
      const base = Math.floor(R(seed, 1) * 0xfffff) * 16 + q * 64;
      for (let r = 0; r < rows; r++) {
        let bytes = '', asc = '';
        for (let b = 0; b < 16; b++) { const v = Math.floor(R(seed, q, r, b) * 256); bytes += hex(v, 2) + (b === 7 ? '  ' : ' '); asc += v > 32 && v < 127 ? String.fromCharCode(v) : '.'; }
        L.push(hex(base + r * 16, 8) + '  ' + bytes + ' |' + asc + '|');
      }
    } else if (mode === 'mem') {
      let a = 0x400000 + Math.floor(R(seed, 2) * 0x1000) * 0x1000;
      for (let r = 0; r < rows; r++) { const sz = (1 + Math.floor(R(seed, r, 3) * 64)) * 0x1000; L.push(`${hex(a, 12)}-${hex(a + sz, 12)} ${['r--p', 'r-xp', 'rw-p', '---p'][Math.floor(R(seed, r, 4) * 4)]} ${hex(Math.floor(R(seed, r, 5) * 0xffff), 8)} 08:0${r % 4} ${LIB[r % LIB.length]}`); a += sz + 0x1000; }
    } else if (mode === 'panic') {
      L.push('Kernel panic - not syncing: thermal limit exceeded', 'CPU: 0 PID: ' + (100 + Math.floor(R(seed, 6) * 900)) + ' Comm: rec_daemon Tainted: G   D W', 'Call Trace:');
      for (let r = 0; L.length < rows; r++) L.push(` [<${hex(0xffff0000 + Math.floor(R(seed, q, r, 7) * 0xffff) * 16, 16)}>] ${['dump_stack', 'panic', 'thermal_trip', 'sensor_read', 'do_irq', 'ret_from_intr', 'schedule', 'io_write'][r % 8]}+0x${hex(Math.floor(R(seed, r, 8) * 0xfff), 3)}`);
    } else if (mode === 'ps') {
      L.push('  PID USER      %CPU %MEM  TEMP  STAT COMMAND');
      for (let r = 0; L.length < rows; r++) L.push(`${String(1 + Math.floor(R(seed, r, 9) * 9999)).padStart(5)} root     ${(R(seed, q, r, 10) * 99).toFixed(1).padStart(5)} ${(R(seed, r, 11) * 40).toFixed(1).padStart(4)} ${(40 + R(seed, q, r, 12) * 140).toFixed(0).padStart(4)}C  ${['R', 'S', 'D', 'Z'][Math.floor(R(seed, r, 13) * 4)]}    ${PROCS[r % PROCS.length]}`);
    } else if (mode === 'check') {
      for (let r = 0; r < rows; r++) { const ok = R(seed, q, r, 14) > 0.35; L.push(`sector 0x${hex(Math.floor(R(seed, r, 15) * 0xffffff), 6)}  crc32 ${hex(Math.floor(R(seed, q, r, 16) * 0xffffffff), 8)}  ${ok ? 'OK' : 'FAIL'}`); }
    } else if (mode === 'coord') {
      for (let r = 0; r < rows; r++) L.push(`${(35 + R(seed, q, r, 17) * 2).toFixed(6)}N ${(139 + R(seed, q, r, 18) * 2).toFixed(6)}E  alt ${(R(seed, q, r, 19) * 900).toFixed(1)}m  t+${(q / 12).toFixed(2)}s`);
    }
    if (copy && copy.length) for (let k = 0; k < Math.min(copy.length, 3); k++) L.splice(2 + Math.floor(R(seed, k, 20) * Math.max(1, L.length - 3)), 0, copy[(k + q) % copy.length]);
    return L.slice(0, rows);
  }
  Z.scene('sigTerm', {
    init: async () => { await document.fonts.load('400 32px "DotGothic16"', 'A0'); },
    draw(ctx, S) {
      const a = S.args, seed = a.seed ?? 1, mode = a.mode || 'hex', size = a.size || (mode === 'nosignal' ? 96 : 24), q = Math.floor(S.t * 12);
      ctx.fillStyle = '#07080a'; ctx.fillRect(0, 0, W, H);
      ctx.font = `400 ${size}px ${PIX}`; ctx.textBaseline = 'top';
      if (mode === 'nosignal') {
        ctx.textAlign = 'center'; ctx.fillStyle = '#d9dde0'; ctx.fillText('NO SIGNAL', W / 2, H / 2 - size / 2);
        ctx.font = `400 24px ${PIX}`; ctx.fillStyle = '#7d858c'; if (q % 12 < 8) ctx.fillText((a.copy && a.copy[0]) || 'INPUT 1  —  CHECK CABLE', W / 2, H / 2 + size * 0.8); ctx.textAlign = 'left'; return;
      }
      if (mode === 'bars') {                                         // colour bars, dimmed: a full-frame bright card is a flash
        const cols = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
        ctx.globalAlpha = a.dim ?? 0.5; cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect((i * W) / 7, 0, W / 7 + 1, H * 0.7); });
        ctx.fillStyle = '#101010'; ctx.fillRect(0, H * 0.7, W, H * 0.3); ctx.globalAlpha = 1; return;
      }
      if (mode === 'progress') {
        const k = Z.fract(R(seed, 21) + S.lt * 0.7), x = 360, y = H / 2, w = W - 720;
        ctx.strokeStyle = '#c9ced2'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, 48); ctx.fillStyle = '#c9ced2'; ctx.fillRect(x + 8, y + 8, (w - 16) * k, 32);
        ctx.font = `400 32px ${PIX}`; ctx.fillText(((a.copy && a.copy[0]) || 'RECOVERING') + '  ' + Math.floor(k * 100) + '%', x, y - 56); return;
      }
      const lh = size * 1.5, rows = Math.ceil((H - 80) / lh), lines = termLines(mode, seed, q, a.copy, rows);
      lines.forEach((ln, r) => {
        const bad = /FAIL|panic|exceeded/i.test(ln);
        ctx.fillStyle = bad ? '#ff6a4a' : r % 7 === 0 ? '#e7ebee' : '#9aa3aa';
        ctx.fillText(ln, 64, 40 + r * lh);
      });
      if (q % 2 === 0) { ctx.fillStyle = '#e7ebee'; ctx.fillRect(64 + Math.min(1700, (lines[lines.length - 1] || '').length * size * 0.5), 40 + (lines.length - 1) * lh, size * 0.55, size); }
    },
  });

  // ---------------------------------------------------------------- fragments of existing pictures
  const fragCache = new Map();
  const frag = (img, path, mode, seed) => {
    const key = path + '|' + mode + '|' + seed; if (fragCache.has(key)) return fragCache.get(key);
    const c = Z.canvas(320, 180), x = c.getContext('2d'), z = 2 + R(seed, 31) * 4;          // a random crop, 2-6x
    const sw = img.width / z, sh = sw * 9 / 16, sx = R(seed, 32) * (img.width - sw), sy = R(seed, 33) * Math.max(0, img.height - sh);
    x.filter = { invert: 'invert(1) contrast(1.3)', threshold: 'grayscale(1) contrast(9)', mono: 'grayscale(1) contrast(1.6) brightness(0.8)', posterize: 'contrast(2.4) saturate(1.6)', channel: 'grayscale(1) sepia(1) hue-rotate(' + Math.floor(R(seed, 34) * 360) + 'deg) saturate(4)' }[mode] || 'none';
    x.drawImage(img, sx, sy, sw, sh, 0, 0, 320, 180);
    if (fragCache.size > 96) fragCache.delete(fragCache.keys().next().value);
    fragCache.set(key, c); return c;
  };
  Z.scene('sigFrag', {
    preload: a => [a.img, ...(a.imgs || [])].filter(Boolean),
    draw(ctx, S) {
      const a = S.args, seed = a.seed ?? 1, list = a.imgs || [a.img], path = list[Math.floor(R(seed, 35) * list.length)], img = Z.imgSync(path);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); if (!img) return;
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = a.dim ?? 1;
      const dx = Z.rnds(seed, 36) * 60 * S.lt;                                                   // never still: a fast drift
      ctx.drawImage(frag(img, path, a.mode || 'threshold', seed), dx - 40, -24, W + 80, H + 48); ctx.restore();
    },
  });

  // ---------------------------------------------------------------- abstract fields
  const noiseTiles = [];
  const noiseTile = i => {
    if (noiseTiles[i]) return noiseTiles[i];
    const c = Z.canvas(240, 135), x = c.getContext('2d'), im = x.createImageData(240, 135);
    for (let p = 0; p < 240 * 135; p++) { const v = Math.floor(R(i, p, 41) * 255); im.data[p * 4] = im.data[p * 4 + 1] = im.data[p * 4 + 2] = v; im.data[p * 4 + 3] = 255; }
    x.putImageData(im, 0, 0); return (noiseTiles[i] = c);
  };
  Z.scene('sigAbs', {
    draw(ctx, S) {
      const a = S.args, seed = a.seed ?? 1, mode = a.mode || 'noise', q = Math.floor(S.t * 24), dim = a.dim ?? 0.7;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = dim;
      if (mode === 'noise') { ctx.imageSmoothingEnabled = false; ctx.drawImage(noiseTile(q % 8), 0, 0, W, H); }
      else if (mode === 'scan') { ctx.fillStyle = '#9aa3aa'; for (let y = (q * 3) % 6; y < H; y += 6) ctx.fillRect(0, y, W, 2); }
      else if (mode === 'stripes') { ctx.fillStyle = '#8f969c'; const w = 40 + Math.floor(R(seed, 42) * 80); for (let x = -w * 2 + ((S.lt * 400) % (w * 2)); x < W; x += w * 2) ctx.fillRect(x, 0, w, H); }
      else if (mode === 'checker') { const s = 120; for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) if (((x + y) / s) % 2 === 0) { ctx.fillStyle = '#3a3f44'; ctx.fillRect(x, y, s, s); } }
      else if (mode === 'blocks') { for (let i = 0; i < 14; i++) { ctx.fillStyle = ['#2b3036', '#4a5157', '#7c858c', '#1a1d20'][Math.floor(R(seed, i, 43) * 4)]; ctx.fillRect(R(seed, i, 44) * W, R(seed, i, 45) * H, 120 + R(seed, i, 46) * 700, 40 + R(seed, i, 47) * 400); } }
      ctx.restore();
    },
  });

  SIG.FILLERS = [
    { scene: 'sigTerm', args: { mode: 'hex' } }, { scene: 'sigTerm', args: { mode: 'mem' } }, { scene: 'sigTerm', args: { mode: 'ps' } },
    { scene: 'sigTerm', args: { mode: 'check' } }, { scene: 'sigTerm', args: { mode: 'panic' } }, { scene: 'sigTerm', args: { mode: 'coord' } },
    { scene: 'sigTerm', args: { mode: 'bars', dim: 0.45 } }, { scene: 'sigTerm', args: { mode: 'progress' } },
    { scene: 'sigAbs', args: { mode: 'blocks' } }, { scene: 'sigAbs', args: { mode: 'scan', dim: 0.5 } },
  ];
  SIG.INSERTS = [
    { scene: 'sigAbs', args: { mode: 'black' } }, { scene: 'sigAbs', args: { mode: 'noise', dim: 0.35 } },
    { scene: 'sigAbs', args: { mode: 'blocks', dim: 0.6 } }, { scene: 'sigTerm', args: { mode: 'nosignal', size: 96 } },
  ];
  SIG.useImages = (paths, { fill = true, ins = true } = {}) => {
    if (fill) for (const m of ['threshold', 'mono', 'posterize', 'channel']) SIG.FILLERS.push({ scene: 'sigFrag', args: { imgs: paths, mode: m } });
    if (ins) SIG.INSERTS.push({ scene: 'sigFrag', args: { imgs: paths, mode: 'mono', dim: 0.55 } }, { scene: 'sigFrag', args: { imgs: paths, mode: 'invert', dim: 0.3 } });
  };
})();
