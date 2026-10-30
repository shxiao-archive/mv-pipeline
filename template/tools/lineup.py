#!/usr/bin/env python3
"""Line-up sheet: every character cut-out side by side at ONE scale, plus a trial placement on key backgrounds, so
inconsistent heads, line weights, palettes or proportions show before the cut-outs reach a scene.

Usage:  python tools/lineup.py [IMG ...] [--height NAME=170 ...] [--bg assets/bg/a.png --bg assets/bg/b.png]
                               [--floor 0.92] [--fill 0.6] [--out render/lineup.jpg]
  IMG          transparent cut-outs (default: assets/char/*.png, without REF_* masters)
  --height     relative height of one character (file stem, any unit; default: all the same). A bust or close-up
               shot is not a body height: line up full-body poses, or give each image the height it SHOWS.
  --bg         a background to stand them on (repeat for two key locations); --floor is the floor line (v, 0-1) and
               --fill the height of the tallest character as a fraction of the frame. Read real floor lines with
               tools/art_grid.py first.
Rows: the line-up on a grey checker (one scale, a ruler every 10 %), then one row per background.
Idea after dalabengba-mv's character line-up; written for mv-studio (MIT).
"""
import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H, PAD = 1920, 1080, 24
FONT = ImageFont.load_default(size=26)


def checker(w, h, s=24):
    im = Image.new("RGB", (w, h), (150, 150, 150))
    d = ImageDraw.Draw(im)
    for y in range(0, h, s):
        for x in range((y // s) % 2 * s, w, 2 * s):
            d.rectangle([x, y, x + s - 1, y + s - 1], fill=(120, 120, 120))
    return im


def place(canvas, figs, heights, names, floor_y, top_h, label=True):
    """Stand the figures on floor_y, the tallest top_h px high, spread evenly across the canvas."""
    hmax = max(heights)
    scaled = [f.resize((max(1, round(f.width * top_h * h / hmax / f.height)), max(1, round(top_h * h / hmax))), Image.LANCZOS)
              for f, h in zip(figs, heights)]
    gap = (canvas.width - sum(s.width for s in scaled)) / (len(scaled) + 1)
    x, d = gap, ImageDraw.Draw(canvas)
    for s, name in zip(scaled, names):
        canvas.paste(s, (round(x), round(floor_y - s.height)), s)
        if label:
            d.text((round(x), round(floor_y) + 4), name, fill=(255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0), font=FONT)
        x += s.width + gap


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("images", nargs="*")
    ap.add_argument("--height", action="append", default=[], metavar="NAME=H")
    ap.add_argument("--bg", action="append", default=[])
    ap.add_argument("--floor", type=float, default=0.92)
    ap.add_argument("--fill", type=float, default=0.6)
    ap.add_argument("--out", default="render/lineup.jpg")
    a = ap.parse_args()
    files = [Path(f) if Path(f).is_absolute() else ROOT / f for f in a.images] or \
        sorted(p for p in (ROOT / "assets" / "char").glob("*.png") if not p.stem.startswith("REF") and not p.name.endswith(".raw.png"))
    if not files:
        sys.exit("no cut-outs: pass images or put them in assets/char/")
    hmap = dict(kv.split("=", 1) for kv in a.height)
    figs, heights, figs_names = [], [], []
    for f in files:
        im = Image.open(f).convert("RGBA")
        box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
        if not box:
            print(f"[lineup] {f.name}: fully transparent, skipped")
            continue
        figs.append(im.crop(box))
        heights.append(float(hmap.get(f.stem, 1)))
        figs_names.append(f.stem)
    rows = [checker(W, H // 2)]
    d = ImageDraw.Draw(rows[0])
    floor_y, top_h = H // 2 - PAD - 14, H // 2 - 2 * PAD - 14
    for k in range(11):                                         # ruler: 10 % of the tallest height
        y = floor_y - top_h * k / 10
        d.line([0, y, W, y], fill=(90, 90, 90) if k % 5 else (60, 60, 60), width=1)
    place(rows[0], figs, heights, figs_names, floor_y, top_h)
    trials = []
    for b in a.bg:
        bp = Path(b) if Path(b).is_absolute() else ROOT / b
        bg = Image.open(bp).convert("RGB")
        s = max(W / bg.width, H / bg.height)                    # cover, like the engine
        bg = bg.resize((round(bg.width * s), round(bg.height * s)), Image.LANCZOS)
        bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))
        place(bg, figs, heights, figs_names, H * a.floor, H * a.fill, label=False)
        ImageDraw.Draw(bg).text((PAD, PAD), bp.name, fill=(255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0), font=FONT)
        trials.append(bg.resize((W // 2, H // 2), Image.LANCZOS))
    rows += [trials[k:k + 2] for k in range(0, len(trials), 2)]            # two trial placements per row
    sheet = Image.new("RGB", (W, H // 2 * len(rows)), (20, 20, 20))
    for k, r in enumerate(rows):
        for j, im in enumerate(r if isinstance(r, list) else [r]):
            sheet.paste(im, (j * W // 2, k * H // 2))
    out = ROOT / a.out
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=90)
    print(f"[lineup] {len(figs)} characters, {len(a.bg)} background(s) -> {out.relative_to(ROOT).as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
