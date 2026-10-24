#!/usr/bin/env node
/* The library index: one JSON line per scene, transition, helper and lyric plan of the engine, per tool, and per
 * section of the skill's manuals, so a builder finds what exists with grep and reads only the lines it needs.
 *   node tools/build_index.mjs [--skill <skill dir>] [--out index/index.jsonl]     (--selftest)
 * Generated from the code (registrations, assignments, file headers, the comments above a definition), never edited by
 * hand, so it cannot drift. An optional `// @index tags: a b c | fits: vocaloid interface` line above a definition adds tags
 * or overrides the presets. Fields: references in <skill>/index/README.md (id kind fits does where use lines status).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';

const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const STOCK = new Set(['scenes.js', 'intro.js', 'typo.js', 'glass.js', 'dark.js', 'night.js', 'memory.js', 'meta.js']);
const PACK = { signal: 'vocaloid', interface: 'interface', treatise: 'interface', stage: 'stage', papercraft: 'papercraft' };

function fitsOf(path) {
  const m = path.match(/engine\/styles\/(\w+)\//);
  if (m) return [PACK[m[1]] || m[1]];
  if (/engine\/scenes\//.test(path)) return [STOCK.has(basename(path)) ? 'vocaloid' : 'film'];
  if (/engine\/timeline\.js$/.test(path)) return ['vocaloid'];
  return ['shared'];
}
const clean = s => s.replace(/^[\s/*]+/, '').replace(/-{3,}/g, '').replace(/\s+/g, ' ').trim();
const short = s => (s.length > 240 ? s.slice(0, 237).replace(/\s\S*$/, '') + ' …' : s);

// the header's entry for a name: a line of the first /* */ block that starts with the name, plus its continuation lines
function fromHeader(header, name) {
  const esc = name.replace(/[.$]/g, '\\$&'), ls = header.split('\n'), re = new RegExp(`^\\s*\\*?\\s*['"]?${esc}['"]?\\b`);
  const i = ls.findIndex(l => re.test(l));
  if (i < 0) return null;
  const ind = ls[i].search(/\S/), out = [ls[i]];
  for (let j = i + 1; j < ls.length && out.length < 4; j++) {
    const l = ls[j];
    if (!clean(l) || /^\s*\*?\s*['"]?[a-zA-Z][\w.]*['"]?(\(|\s{2,})/.test(l) && l.search(/\S/) <= ind) break;   // the next entry
    out.push(l);
  }
  return clean(out.map(clean).join(' ').replace(new RegExp(`^\\s*\\*?\\s*['"]?${esc}['"]?(\\([^)]*\\))?\\s*:?`), ''));
}
// the // comment lines right above line i (separators stripped), and an @index line among them
function above(ls, i) {
  const out = []; let meta = null;
  for (let j = i - 1; j >= 0 && /^\s*\/\//.test(ls[j]); j--) {
    const l = ls[j].replace(/^\s*\/\/\s?/, '');
    if (l.startsWith('@index')) meta = l.slice(6); else out.unshift(l);
  }
  return { text: clean(out.join(' ')), meta };
}
function parseMeta(meta) {
  const o = {};
  for (const part of (meta || '').split('|')) { const m = part.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/); if (m) o[m[1]] = m[2].split(/\s+/); }
  return o;
}

const DEFS = [
  [/Z\.scene\(\s*'(\w+)'/, (n, f) => [/typo\.js$/.test(f) ? 'type-scene' : 'scene', n, `shot(id, t0, t1, '${n}', { … })`]],
  [/(?:^|[^.\w])(?:T|Z\.transition)\(\s*'(\w+)'/, n => ['transition', n, `{ trans: { type: '${n}', dur } }`]],
  [/addPlan\(\s*'(\w+)'/, n => ['lyric-plan', n, `shot(…, { plan: '${n}' })`]],
  [/^ {0,4}((?:Z\.)?[A-Z][A-Za-z]*(?:\.[A-Za-z]\w*)*)\.(\w+)\s*=\s*(\([^)]*\)|\w+)\s*=>/, (n, f, m) => ['helper', `${m[1]}.${n}`, `${m[1]}.${n}${m[3].startsWith('(') ? m[3] : `(${m[3]})`}`], 2],
];

export function indexSource(text, path) {
  const ls = text.split(/\r?\n/), hm = text.match(/^\s*\/\*[\s\S]*?\*\//), header = hm ? hm[0] : '';
  const fileDoc = clean((header.split('\n')[0] || '').replace(/^\/\*\s*/, ''));
  const hits = [];
  ls.forEach((l, i) => {
    for (const [re, mk, g = 1] of DEFS) { const m = l.match(re); if (m) { hits.push({ i, m, mk, n: m[g] }); break; } }
  });
  return hits.map((h, k) => {
    const [kind, name, use] = h.mk(h.n, path, h.m), end = Math.min(ls.length, (hits[k + 1] ? hits[k + 1].i : ls.length), h.i + 150);
    const ab = above(ls, h.i), meta = parseMeta(ab.meta);
    const does = short((kind === 'helper' && fromHeader(header, name)) || fromHeader(header, h.n) || ab.text || `(in ${fileDoc || basename(path)})`);
    const e = { id: `${kind}:${name}`, kind, fits: meta.fits || fitsOf(path), does, where: `${path}:${h.i + 1}-${end}`, use, lines: end - h.i };
    if (meta.tags) e.tags = meta.tags;
    if (/\bshots? \d/.test(does)) e.status = 'demo-specific: written for the demo film; learn from it, or call it with care';
    return e;
  });
}

function walk(dir, ext, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (!/^(node_modules|vendor|fonts|tests)$/.test(n)) walk(p, ext, out); }
    else if (ext.test(n)) out.push(p);
  }
  return out;
}
const rel = p => relative(process.cwd(), p).replace(/\\/g, '/');

function toolDoc(text) {
  const m = text.match(/^(?:#![^\n]*\n)?\s*(?:\/\*|"""|''')\s*([\s\S]*?)(?:\*\/|"""|''')/) || text.match(/^(?:#![^\n]*\n)?((?:\s*(?:\/\/|#)[^\n]*\n)+)/);
  if (!m) return '';
  return short(clean(m[1].replace(/^\s*(\/\/|#)/gm, '').split(/\n\s*\n/)[0]));
}

function manuals(skill) {
  const out = [];
  for (const f of [...walk(join(skill, 'references'), /\.md$/), ...walk(join(skill, 'styles'), /\.md$/)]) {
    const ls = readFileSync(f, 'utf8').split(/\r?\n/), heads = [];
    ls.forEach((l, i) => { if (/^## /.test(l)) heads.push(i); });
    const name = relative(skill, f).replace(/\\/g, '/');
    heads.forEach((i, k) => {
      const end = heads[k + 1] ?? ls.length, h = ls[i].replace(/^##\s*/, '');
      out.push({ id: `manual:${name.replace(/\.md$/, '')}#${h.split(/[ .]/)[0] || k}`, kind: 'manual', does: short(h), where: `<skill>/${name}:${i + 1}-${end}`, lines: end - i });
    });
  }
  return out;
}

if (args.includes("--selftest")) {
  const src = `/* x.js: two scenes.\n *   alpha  a red square that slams\n *          on the beat\n *   beta   a blue line\n */\n  Z.scene('alpha', {\n  });\n  // the second\n  // @index tags: impact\n  Z.scene('beta', {});\n  // moves on an arc\n  D.travel = (t, t0, t1, p0) => {};\n  T('iris', () => {});\n`;
  const e = indexSource(src, 'engine/styles/stage/x.js');
  const ok = [e.length === 4, e[0].does === 'a red square that slams on the beat', e[0].fits[0] === 'stage', e[1].tags?.[0] === 'impact',
    e[1].does === 'a blue line', e[2].id === 'helper:D.travel' && e[2].does === 'moves on an arc' && e[2].use === 'D.travel(t, t0, t1, p0)',
    e[3].kind === 'transition', e[0].where === 'engine/styles/stage/x.js:6-9'];
  console.log(`[build_index] selftest ${ok.every(Boolean) ? 'ok' : 'FAIL ' + JSON.stringify(ok) + ' ' + JSON.stringify(e.map(x => [x.does, x.where]))}`); process.exit(ok.every(Boolean) ? 0 : 1);
}

const rows = [];
for (const f of walk('engine', /\.js$/)) rows.push(...indexSource(readFileSync(f, 'utf8'), rel(f)));
for (const f of walk('tools', /\.(mjs|py)$/).filter(f => dirname(f) === 'tools')) {
  const n = basename(f), kind = /^(check_|motion_check|pops|lint|storyboard|verify)/.test(n) ? 'check' : 'tool';
  rows.push({ id: `${kind}:${n.replace(/\.\w+$/, '')}`, kind, fits: ['shared'], does: toolDoc(readFileSync(f, 'utf8')) || n, where: rel(f), use: `${n.endsWith('.py') ? 'python' : 'node'} tools/${n}` });
}
const skill = opt('--skill') || (existsSync('../references') ? '..' : null);
const out = opt('--out') || 'index/index.jsonl';
if (skill) rows.push(...manuals(skill));
// in a project the skill is elsewhere: keep the manual rows the scaffold shipped
else if (existsSync(out)) rows.push(...readFileSync(out, 'utf8').split('\n').filter(l => l.includes('"kind":"manual"')).map(l => JSON.parse(l)));
const seen = new Set(), outRows = rows.filter(r => !seen.has(r.id) && seen.add(r.id));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, outRows.map(r => JSON.stringify(r)).join('\n') + '\n');
const by = {}; for (const r of outRows) by[r.kind] = (by[r.kind] || 0) + 1;
console.log(`[build_index] ${outRows.length} entries -> ${out}  ${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
