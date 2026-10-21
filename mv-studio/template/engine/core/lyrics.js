/* mv-studio engine — lyric LINES for code-drawn typography (styles/interface, styles/signal, any custom `text` hook).
 *
 * JIZURA reads analysis/lyrics_mv.lrc on its own; this module parses the same file once at boot (main.js calls
 * Z.loadLyrics() before Z.setup) so scenes can draw lyric lines themselves WITHOUT the text ever appearing in code:
 * a scene gets line INDICES in its args and calls Z.line(i).text at draw time.
 *
 *   Z.LYR                     [{ i, t, end, text, parts, emph, kime }]   (gap rows like [間奏] are not lines; they only end the previous one)
 *       text   the display text, markup removed ('/' breaks become `parts`; Latin parts are joined with a space)
 *       parts  the '/'-separated halves (the layout may set them as separate rows / beats)
 *       emph   [[from, to), ...] character ranges of *word* emphasis in `text`
 *       kime   true for a trailing '!' (the strongest treatment of a chorus; 1-2 per chorus)
 *   Z.line(i)                 the line object (or a blank one past the end)
 *   Z.lineAt(t, lead = 0.2)   index of the line on screen at t (shown `lead` s before the voice), -1 in gaps
 *   Z.charsAt(i, t, o)        how many characters of line i are out at t: { lead 0.2, rate (chars/s) | over (s) }
 *                             default: the line types out over min(60 % of its duration, 0.09 s per char)
 *   Z.isEmph(i, k)            is character k of line i inside an *emphasis*?
 *   Z.wordsAt(i, t, o)        like charsAt, but whole words: a word is out once its first character is sung
 *   Z.wordIndex(i, word, last) index of a word in line i (letters only, any case); -1 if absent
 *   Z.charTimes(i)            per-character start times of line i from analysis/lyric_timing.json (or null)
 *
 * analysis/lyric_timing.json (text-free; tools/lrc.py) adds, per line, where its timing came from (`source`), how sure
 * it is (`conf`) and optional per-character / per-word times. A timing row is used only while its character count and
 * hash and its start time still match the LRC line (so an edited LRC never pairs with stale character times). With character times
 * present, Z.charsAt reveals each character at its own sung time unless the caller passes `rate` or `over`.
 * project.json timing.lyricOffset shifts every line (core/cues.js).
 *
 * Author of the base engine: NikusonP (vocaloid-style-mv-pipeline, MIT). This file: mv-studio, MIT.
 */
(() => {
  'use strict';
  const Z = (window.Z = window.Z || {});
  const GAP = /^\s*\[(間奏|interlude|inst|instrumental|間|gap|—|-)\]\s*$/i;
  const TIME = /\[(\d+):(\d+(?:\.\d+)?)\]/g;
  const latin = s => /^[\x00-\x7FÀ-ɏ]*$/.test(s);

  function parse(src, duration = 1e9) {
    const rows = [];
    for (const raw of src.replace(/^﻿/, '').split(/\r?\n/)) {
      const times = [...raw.matchAll(TIME)].map(m => +m[1] * 60 + +m[2]);
      if (!times.length) continue;                                   // header tags ([ar:], [by:], [offset:]) and blank rows
      const body = raw.replace(TIME, '').trim();
      for (const t of times) rows.push({ t, body });
    }
    rows.sort((a, b) => a.t - b.t);
    const out = [];
    rows.forEach((r, k) => {
      const next = rows[k + 1];
      if (!r.body || GAP.test(r.body)) return;
      let s = r.body, kime = false;
      if (/!\s*$/.test(s) && !/[!！]{2,}\s*$/.test(s)) { kime = true; s = s.replace(/!\s*$/, ''); }
      const partsRaw = s.split('/').map(p => p.trim()).filter(Boolean);
      const joiner = partsRaw.every(latin) ? ' ' : '';
      // emphasis ranges are measured on the joined, unmarked text
      let text = '', emph = [], open = -1;
      const parts = [];
      partsRaw.forEach((p, pi) => {
        if (pi) text += joiner;
        let clean = '';
        for (const ch of p) {
          if (ch === '*') { if (open < 0) open = text.length; else { emph.push([open, text.length]); open = -1; } continue; }
          text += ch; clean += ch;
        }
        parts.push(clean);
      });
      if (open >= 0) emph.push([open, text.length]);
      const end = Math.min(next ? next.t : r.t + 4, duration);
      out.push({ i: out.length, t: r.t, end, text, parts, emph, kime });
    });
    return out;
  }

  // FNV-1a over code points: the same as tools/lrc.py line_hash()
  const lineHash = text => { let h = 2166136261; for (const ch of text) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); };

  Z.parseLyrics = parse;
  Z.lineHash = lineHash;
  Z.LYR = [];
  Z.loadLyrics = async (path = 'analysis/lyrics_mv.lrc', timingPath = 'analysis/lyric_timing.json') => {
    try {
      const r = await fetch((Z.ROOT || '../') + path);
      if (r.ok) Z.LYR = parse(await r.text(), (Z.audio && Z.audio.duration) || 1e9);
    } catch (e) { /* no lyrics yet: Z.LYR stays empty */ }
    let timing = null;
    try { const r = await fetch((Z.ROOT || '../') + timingPath); if (r.ok) timing = JSON.parse((await r.text()).replace(/^﻿/, '')); } catch (e) { /* optional */ }
    const off = Z.LYRIC_OFFSET || 0;
    for (const L of Z.LYR) {
      const row = timing && timing.lines && timing.lines.find(x => x.i === L.i);
      if (row && row.n === [...L.text].length && row.h === lineHash(L.text) && Math.abs((row.start ?? L.t) - L.t) <= 0.02) {
        L.source = row.source; L.conf = row.conf;
        if (row.chars && row.chars.length === row.n) L.chars = row.chars.map(x => x + off);
        if (row.words) L.words = row.words.map(([a, b]) => [a + off, b + off]);
      } else if (row) console.warn(`lyric_timing.json line ${L.i} no longer matches the LRC (re-run the tool that wrote it)`);
      L.t += off; L.end += off;
    }
    return Z.LYR;
  };
  Z.charTimes = i => (Z.LYR[i] && Z.LYR[i].chars) || null;
  const BLANK = { i: -1, t: 0, end: 0, text: '', parts: [], emph: [], kime: false };
  Z.line = i => Z.LYR[i] || BLANK;
  Z.lineAt = (t, lead = 0.2) => { let k = -1; for (const L of Z.LYR) { if (L.t - lead <= t && t < L.end - lead * 0.5) k = L.i; } return k; };
  Z.charsAt = (i, t, o = {}) => {
    const L = Z.line(i), n = [...L.text].length; if (!n) return 0;
    const lead = o.lead ?? 0.2, t0 = L.t - lead;
    if (L.chars && o.over == null && o.rate == null) { let k = 0; for (const c of L.chars) if (c - lead <= t) k++; return k; }
    const over = o.over ?? (o.rate ? n / o.rate : Math.min(0.6 * (L.end - L.t), 0.09 * n));
    return over <= 0 ? n : Math.max(0, Math.min(n, Math.floor((t - t0) / over * n + 1e-6) + (t >= t0 ? 1 : 0)));
  };
  Z.isEmph = (i, k) => Z.line(i).emph.some(([a, b]) => k >= a && k < b);
  // word by word (world-execute-me v4): a word comes out whole when its first character is sung (Latin text; a line
  // without spaces falls back to characters). wordIndex(i, word, last): which word of line i a word is (by its letters)
  Z.wordsAt = (i, t, o = {}) => {
    const ch = [...Z.line(i).text], k = Z.charsAt(i, t, o);
    if (!k || !ch.includes(' ')) return k;
    let e = k; while (e < ch.length && ch[e] !== ' ') e++;
    return e;
  };
  Z.wordIndex = (i, word, last = false) => {
    const w = Z.line(i).text.split(' ').map(x => x.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()), q = String(word).toLowerCase();
    return last ? w.lastIndexOf(q) : w.indexOf(q);
  };
})();
