#!/usr/bin/env node
/* Self-test of the magazine press (engine/styles/magazine/press.js) in a headless browser, no project data needed:
 * a spot-A proof prints in spot A's hue and a spot-B proof in spot B's (the separation gives a dark colour some key, as
 * a real separation does), white prints bare paper, the key channel of the ink layer prints near the key ink, and a
 * hole in the proof shows the back canvas raw.
 *   node tools/press_selftest.mjs        exit 1 on a failed check
 * mv-studio (MIT).
 */
import { launchBrowser, gpuArgs } from './kit_env.mjs';
import { serveRoot } from './engine_page.mjs';

const { server, origin } = await serveRoot();
const browser = await launchBrowser({ headless: true, args: gpuArgs() });
const page = await browser.newPage();
await page.goto(`${origin}/engine/index.html?selftest-blank`).catch(() => {});      // any page on the origin
const res = await page.evaluate(async (o) => {
  document.body.innerHTML = '';
  window.Z = undefined;
  for (const f of ['core/util.js', 'core/assets.js', 'core/shade.js', 'styles/magazine/press.js']) {
    await new Promise((ok, no) => { const s = document.createElement('script'); s.src = `${o}/engine/${f}?${Math.random()}`; s.onload = ok; s.onerror = no; document.head.appendChild(s); });   // lint-ok: cache-buster
  }
  const Z = window.Z, MZ = Z.MZ, out = Z.canvas(1920, 1080).getContext('2d');
  const shot = (fill, inkFill, opts = {}) => {
    const { P, I, F } = MZ.begin();
    Object.assign(F, { grainAmt: 0, vig: 0, scrMix: 0, paperAmt: 0 }, opts.F || {});
    if (fill) { P.fillStyle = fill; P.fillRect(0, 0, 1920, 1080); }
    if (opts.hole) P.clearRect(800, 400, 320, 280);
    if (inkFill) { I.fillStyle = inkFill; I.fillRect(0, 0, 1920, 1080); }
    MZ.print(out, F, 0, opts.back || null);
    return [...out.getImageData(960, 540, 1, 1).data.slice(0, 3)];
  };
  const F0 = MZ.defaults(), hex = h => Z.hex(MZ.INKS[h] || h);
  const back = Z.canvas(1920, 1080); { const g = back.getContext('2d'); g.fillStyle = '#204060'; g.fillRect(0, 0, 1920, 1080); }
  const weak = Array.from({ length: 40 }, (_, i) => [i * 0.1, 0.5]), strong = Array.from({ length: 8 }, (_, i) => [10 + i * 0.35, 0.95]);
  Z.audio = { onsets: { kick: [...weak, ...strong], snare: [[20, 0.9]] } };
  const re = t => { const F = MZ.defaults(); MZ.react(F, t); return [F.xf[0], F.offA[0], F.offA[1]]; };
  const react = { weak: re(2.05)[0], kept: re(10.70)[0], dropped: re(10.36)[0], s1: re(20.01), s2: re(20.08), late: re(21)[1] };
  return {
    react: [react, null],
    paper: [shot('#ffffff', null), hex(F0.paper)],
    spotA: [shot(F0.inkA, null), hex(F0.inkA).map((v, i) => v * hex(F0.paper)[i] / 255)],
    spotB: [shot(F0.inkB, null), hex(F0.inkB).map((v, i) => v * hex(F0.paper)[i] / 255)],
    key: [shot('#ffffff', 'rgb(255,0,0)'), hex(F0.inkK).map((v, i) => v * hex(F0.paper)[i] / 255)],
    hole: [shot('#ffffff', null, { hole: true, back, F: { backMode: 1 } }), [0x20, 0x40, 0x60]],
  };
}, origin);
let bad = 0;
{ const r = res.react[0], ang = v => Math.atan2(v[2], v[1]), chk = (ok, what) => { if (!ok) { bad++; console.log(`FAIL react: ${what}`, JSON.stringify(r)); } };
  chk(r.weak === 1, 'weak kicks move the page');
  chk(r.kept > 1.012 && Math.abs(r.dropped - 1) < 0.001, 'strong kicks closer than the gap are not dropped / a kept one does not punch');
  chk(Math.abs(ang(r.s1) - ang(r.s2)) < 1e-6 && Math.hypot(r.s1[1], r.s1[2]) > Math.hypot(r.s2[1], r.s2[2]), 'a snare slip changes direction or does not spring back');
  chk(Math.abs(r.late) < 0.01, 'the slip never returns');
  delete res.react; }
const hue = (k, ok) => { if (!ok(res[k][0])) { bad++; console.log(`FAIL ${k}: got ${res[k][0]} (not in the ink's hue; want ~${res[k][1].map(Math.round)})`); } delete res[k]; };
hue('spotA', ([r, g, b]) => r > 150 && g < 110 && b < 110);
hue('spotB', ([r, g, b]) => r < 50 && g > 60 && b > 60 && Math.abs(g - b) < 25);
for (const [k, [got, want]] of Object.entries(res)) {
  const d = Math.max(...got.map((v, i) => Math.abs(v - want[i])));
  if (d > 18) { bad++; console.log(`FAIL ${k}: got ${got} want ~${want.map(Math.round)} (off by ${d.toFixed(0)})`); }
}
await browser.close(); server.close();
console.log(bad ? `[press_selftest] ${bad} FAILED` : '[press_selftest] ok');
process.exit(bad ? 1 : 0);
