#!/usr/bin/env node
/* One labelled frame just after every cue: the quickest way to check "is this the picture for this line?".
 * Each tile is stamped with the cue id, its time and its picture hint (analysis/cues.json) -- never lyric text.
 *
 *   node tools/cues_sheet.mjs [--kinds line,section,impact] [--after 0.12] [--url engine/index.html]
 *                             [--out render/cues] [--cols 4] [--from 0 --to 999]
 * Writes <out>/cues_<n>.jpg (24 tiles per sheet) and <out>/cues.json. LOOK at every sheet.
 *
 * mv-studio (MIT).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, cliArg as arg, handleHelp, pythonCmd } from './kit_env.mjs';
import { openEngine } from './engine_page.mjs';

handleHelp(`cues_sheet.mjs -- a labelled frame after every cue (line cues by default)
  node tools/cues_sheet.mjs [--kinds line,section,impact,stop,custom] [--after 0.12] [--out render/cues] [--cols 4]`);

const kinds = new Set(arg('kinds', 'line').split(','));
const after = +arg('after', 0.12), from = +arg('from', 0), to = +arg('to', 1e9);
const outDir = path.resolve(ROOT, arg('out', 'render/cues'));
fs.mkdirSync(outDir, { recursive: true });
const E = await openEngine({ url: arg('url', 'engine/index.html'), quiet: true });
const P = await E.plan();
const cues = P.cues.filter(c => (kinds.has(c.kind) || kinds.has('all')) && c.t >= from && c.t <= to);
if (!cues.length) { console.log('[cues_sheet] no cues of kinds ' + [...kinds].join(',') + ' (python tools/make_cues.py)'); await E.close(); process.exit(1); }
const shotAt = t => { let s = null; for (const x of P.shots) if (x.t0 <= t + 1e-6) s = x; return s; };
const tiles = [];
for (const c of cues) {
  const t = c.t + after;
  await E.frame(t);
  const f = path.join(outDir, `${c.id.replace(/[^\w.-]/g, '_')}.png`);
  fs.writeFileSync(f, await E.png());
  const s = shotAt(t);
  tiles.push({ file: f, label: `${c.id}  ${t.toFixed(2)} s  ${s ? s.id : '-'}`, hint: c.hint || '(no hint)' });
}
await E.close();
fs.writeFileSync(path.join(outDir, 'cues.json'), JSON.stringify(tiles.map(x => ({ label: x.label, hint: x.hint, file: path.relative(ROOT, x.file) })), null, 1));
const py = `
from PIL import Image, ImageDraw
import json, sys, math
tiles = json.loads(open(sys.argv[1], encoding='utf-8').read()); out = sys.argv[2]; cols = int(sys.argv[3])
per = cols * 6
for n in range(0, len(tiles), per):
    chunk = tiles[n:n + per]
    im0 = Image.open(chunk[0]['file']); ar = im0.size[0] / im0.size[1]
    w, h = (400, round(400 / ar)) if ar >= 1 else (round(380 * ar), 380)
    rows = math.ceil(len(chunk) / cols)
    S = Image.new('RGB', (cols * w, rows * (h + 40)), (16, 16, 16)); d = ImageDraw.Draw(S)
    for i, t in enumerate(chunk):
        x, y = (i % cols) * w, (i // cols) * (h + 40)
        S.paste(Image.open(t['file']).convert('RGB').resize((w, h)), (x, y))
        d.text((x + 6, y + h + 3), t['label'], fill=(240, 240, 240)); d.text((x + 6, y + h + 20), t['hint'][:64], fill=(170, 200, 255))
    S.save(f"{out}/cues_{n // per + 1}.jpg", quality=86)
print(math.ceil(len(tiles) / per))`;
const tmp = path.join(outDir, '_tiles.json');
fs.writeFileSync(tmp, JSON.stringify(tiles));
const [cmd, ...pre] = pythonCmd();
const sheets = execFileSync(cmd, [...pre, '-c', py, tmp, outDir, String(+arg('cols', 4))], { encoding: 'utf8' }).trim();
fs.unlinkSync(tmp);
console.log(`[cues_sheet] ${tiles.length} cues -> ${path.relative(ROOT, outDir)}/cues_1..${sheets}.jpg (LOOK at them: is each the picture for its line?)`);
