#!/usr/bin/env node
/* Self-test of the time and word helpers (no browser): Z.withInserts, Z.replay / replayMap / passOf, Z.dropFrames,
 * Z.tear, Z.wordsAt / wordIndex, the metre clock (Z.makeClock with a bar map) and Z.makeHits (engine/core/util.js,
 * engine/core/lyrics.js), Z.stroke reporting a character its font has no glyph for (engine/core/stroke.js), and
 * Z.draw.warpQuad landing a picture's corners on the glass (engine/core/draw.js).
 *   node tools/time_selftest.mjs        exit 1 on a failed check
 * mv-studio (MIT).
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './kit_env.mjs';

const win = {};
const ctx = vm.createContext({ window: win, Math, console });
for (const f of ['engine/core/util.js', 'engine/core/lyrics.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const Z = win.Z;
let bad = 0;
const check = (ok, msg) => { if (!ok) { bad++; console.log('FAIL ' + msg); } };

// inserts: the shot is split round the insert, every part keeps the whole span, the way back is a cut by default
const parts = Z.withInserts({ id: 's1', t0: 0, t1: 8, scene: 'ifChat', trans: { type: 'xfade', dur: 0.3 }, line: [2] },
  [{ t0: 5, t1: 6, shot: { scene: 'ifPlate' } }, { t0: 2, t1: 3, shot: { scene: 'ifPlate' }, back: { type: 'xfade', dur: 0.2 } }]);
check(parts.map(p => p.id).join(' ') === 's1 s1-ins1 s1-b s1-ins3 s1-c', 'insert ids: ' + parts.map(p => p.id).join(' '));
check(parts.map(p => `${p.t0}-${p.t1}`).join(' ') === '0-2 2-3 3-5 5-6 6-8', 'insert times');
check(parts.filter(p => p.scene === 'ifChat').every(p => p.span[0] === 0 && p.span[1] === 8), 'parts keep the span');
check(parts[0].trans.type === 'xfade' && parts[2].trans.type === 'xfade' && parts[4].trans === null, 'transitions back');
check(parts[1].line[0] === 2, 'an insert answers for the shot\'s line unless it says otherwise');

let threw = false;
try { Z.withInserts({ id: 's2', t0: 0, t1: 8 }, [{ t0: 7, t1: 9, shot: {} }]); } catch (e) { threw = true; }
check(threw, 'an insert that runs past its shot is refused');

// replay / dropped frames / tear
check(Z.replay(0.5, [1, 2]) === -1 && Z.replay(1.25, [1, 2]) === 0.25 && Z.replay(2.1, [1, 2], 0.05) === 0.05, 'replay');
check(Z.passOf(1.5, [1, 2]) === 1, 'passOf');
check(Math.abs(Z.replayMap(10, [1, 2])(2.5) - 10.5) < 1e-9 && Z.replayMap(10, [1, 2])(0.5) === 0.5, 'replayMap');
check(Math.abs(Z.dropFrames(1.37, 8, 1) - 1.25) < 1e-9, 'dropFrames counts from the shot start');
check(Z.dropFrames(2.0, 12) === 2.0 && Math.abs(Z.dropFrames(2.07, 12) - 2.0) < 1e-9, 'dropFrames holds a frame');
const a = Z.tear(5.02, 5), b = Z.tear(5.09, 5);
check(a.glitch === 0.5 && a.glitchSeed === b.glitchSeed && !('glitch' in Z.tear(5.2, 5)), 'tear holds one pattern for 0.1 s');

// word by word: a word is out whole once its first character is due
Z.LYR = [{ i: 0, t: 10, end: 14, text: 'the night train hums', parts: [], emph: [], kime: false }, { i: 1, t: 20, end: 22, text: '夜の電車', parts: [], emph: [], kime: false }];
const n = Z.charsAt(0, 10.15, { lead: 0 });
check(n > 0 && n < 4 && Z.wordsAt(0, 10.15, { lead: 0 }) === 3, `wordsAt finishes the word (chars ${n})`);
check(Z.wordsAt(0, 9, { lead: 0 }) === 0 && Z.wordsAt(0, 13.9, { lead: 0 }) === 20, 'wordsAt before / after');
check(Z.wordsAt(1, 20.1, { lead: 0 }) === Z.charsAt(1, 20.1, { lead: 0 }), 'a line without spaces types per character');
check(Z.wordIndex(0, 'Train') === 2 && Z.wordIndex(0, 'bus') === -1, 'wordIndex');

// the metre clock: 4/4 from beats; a bar map (analysis/meter.json -> audio.bars) of 4/4, 3/8, 5/8 at a 0.1 s tatum
const beats = Array.from({ length: 64 }, (_, i) => 1 + i * 0.4);
const C4 = Z.makeClock(beats, 150, 0);
const m4 = C4.meter(1 + 4 * 0.4 + 0.4 * 2.5);
check(m4.bar === 1 && m4.group === 2 && Math.abs(m4.gPhase - 0.5) < 1e-9 && m4.meter === '4/4', 'meter() in 4/4 ' + JSON.stringify(m4));
const map = [{ start: 1, end: 2.6, meter: '4/4', groups: [4, 4, 4, 4], tatum: 0.1 }, { start: 2.6, end: 3.2, meter: '3/8', groups: [6], tatum: 0.1 },
  { start: 3.2, end: 4.2, meter: '5/8', groups: [6, 4], tatum: 0.1 }, { start: 4.2, end: 5.2, meter: '5/8', groups: [6, 4], tatum: 0.1 }];
const CM = Z.makeClock(beats, 150, 0, [{ start: 0.6, end: 1, pickup: true }, ...map]);
const m5 = CM.meter(3.2 + 0.75);
check(m5.bar === 2 && m5.meter === '5/8' && m5.group === 1 && Math.abs(m5.gq - 1.5) < 1e-9, 'meter() in 5/8 ' + JSON.stringify(m5));
check(CM.bar(2.7) === 1 && CM.inBar(4.85) === 1 && Math.abs(CM.barPhase(2.9) - 0.5) < 1e-9, 'bar / inBar / barPhase follow the map');
check(Math.abs(CM.downPulse(3.2) - 1) < 1e-9 && CM.downPulse(3.85) < 0.1 && Math.abs(CM.groupPulse(3.8) - 1) < 1e-9, 'downPulse / groupPulse');
check(CM.meter(0.5).bar === -1 && CM.downPulse(0.5) === 0, 'before the first bar');

// drum hits: the strongest recent onset, decaying
const H = Z.makeHits({ kick: [[1, 1], [2, 0.4], [2.05, 0.9]], snare: [] });
check(Math.abs(H.hit('kick', 1) - 1) < 1e-9 && Math.abs(H.hit('kick', 1.12) - Math.exp(-1)) < 1e-9, 'hit decays exp(-dt / tau)');
check(H.hit('kick', 0.5) === 0 && H.hit('snare', 3) === 0 && H.hit('hat', 3) === 0, 'no onset, no hit');
check(Math.abs(H.hit('kick', 2.06) - 0.9 * Math.exp(-0.01 / 0.12)) < 1e-9, 'the strongest recent onset wins');
check(H.lastHit('kick', 2.03, 0.5) === 1 && H.hitCount('kick', 0, 3, 0.5) === 2, 'lastHit / hitCount');

// the pen fonts are Latin only: a character with no glyph is a page error, once per font and text; a space is not
const logged = [], glyph = u => ({ getAttribute: k => (k === 'unicode' ? u : k === 'd' ? 'M0 0L0 700' : null) });
const stubs = { window: win, Math, console: { error: m => logged.push(m) }, fetch: async () => ({ ok: true, text: async () => '' }),
  DOMParser: class { parseFromString() { return { querySelector: () => ({ getAttribute: () => null }), querySelectorAll: () => [glyph('H'), glyph(' ')] }; } } };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'engine/core/stroke.js'), 'utf8'), stubs, { filename: 'engine/core/stroke.js' });
await Z.stroke.load(['sans']);
check(Z.stroke.layout('H H', 'sans').len > 0 && logged.length === 0, 'a line the font has: no report');
Z.stroke.layout('H\u661f\u661f', 'sans');
check(logged.length === 1 && logged[0].includes('2 character') && logged[0].includes('\u661f'), 'missing glyphs are reported: ' + logged[0]);
Z.stroke.layout('H\u661f\u661f', 'sans');
check(logged.length === 1, 'the same line is reported once');

// warpQuad: every source corner lands on its corner of the glass, and the middle of the picture where its diagonals cross
vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine/core/draw.js'), 'utf8'), ctx, { filename: 'engine/core/draw.js' });
const glass = [[100, 50], [500, 80], [520, 400], [90, 380]], srcQ = [[0, 0], [200, 0], [200, 100], [0, 100]], maps = [];
let cur = null;
Z.draw.warpQuad({ save() { cur = null; }, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {},
  transform(a, b, c, d, e, f) { cur = [a, b, c, d, e, f]; }, drawImage() { maps.push(cur); } }, {}, srcQ, glass, 2);
const hits = p => maps.map(([a, b, c, d, e, f]) => [a * p[0] + c * p[1] + e, b * p[0] + d * p[1] + f]);
const lands = (p, want) => hits(p).some(h => Math.hypot(h[0] - want[0], h[1] - want[1]) < 1e-6);
check(maps.length === 8, 'warpQuad: two triangles a cell');
srcQ.forEach((p, i) => check(lands(p, glass[i]), 'warpQuad: corner ' + i + ' lands on the glass'));
// perspective: the picture's middle lands where the glass's diagonals cross (bilinear would put it at the corners' mean)
const [[ax, ay], [bx, by], [cx, cy], [dx, dy]] = glass, tD = ((bx - ax) * (dy - by) - (by - ay) * (dx - bx)) / ((cx - ax) * (dy - by) - (cy - ay) * (dx - bx));
check(lands([100, 50], [ax + (cx - ax) * tD, ay + (cy - ay) * tD]), 'warpQuad: the middle lands where the diagonals cross');
check(!lands([100, 50], [(ax + bx + cx + dx) / 4, (ay + by + cy + dy) / 4]), 'warpQuad: perspective, not bilinear');

console.log(bad ? `[time_selftest] ${bad} FAILED` : '[time_selftest] ok');
process.exit(bad ? 1 : 0);
