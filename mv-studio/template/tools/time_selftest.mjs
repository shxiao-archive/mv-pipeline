#!/usr/bin/env node
/* Self-test of the time and word helpers (no browser): Z.withInserts, Z.replay / replayMap / passOf, Z.dropFrames,
 * Z.tear, Z.wordsAt / wordIndex (engine/core/util.js, engine/core/lyrics.js).
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

console.log(bad ? `[time_selftest] ${bad} FAILED` : '[time_selftest] ok');
process.exit(bad ? 1 : 0);
