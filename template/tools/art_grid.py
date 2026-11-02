#!/usr/bin/env python3
"""Overlay a labelled grid on an image so you can READ where things are: the track, the waterline, the floor, the
horizon, a window, a lamp. Use the numbers (fractions u, v of the image) to pin cut-outs to the painted surface with
Z.draw.coverPt(img, view, u, v) instead of placing them by eye (a cut-out placed by eye floats).

Usage:  python tools/art_grid.py assets/bg/bg_bridge.png [--step 0.05] [--out render/grid_bg_bridge.png]
Then open the output image and note e.g. "rail top v = 0.712 from u = 0.10 to 0.95". Several images: pass them all.
mv-studio (MIT).
"""
import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("images", nargs="+")
    ap.add_argument("--step", type=float, default=0.05)
    ap.add_argument("--out", help="output file (one image) or folder")
    ap.add_argument("--width", type=int, default=1600, help="output width (px)")
    ap.add_argument("--crop", help="u0,v0,u1,v1: grid only this part, enlarged (a face region: --crop ... --step 0.01)")
    a = ap.parse_args()
    u0, v0, u1, v1 = [float(x) for x in a.crop.split(",")] if a.crop else (0, 0, 1, 1)
    assert 0 <= u0 < u1 <= 1 and 0 <= v0 < v1 <= 1, "--crop wants u0,v0,u1,v1 inside 0..1"
    for src in a.images:
        p = Path(src) if Path(src).is_absolute() else ROOT / src
        im = Image.open(p).convert("RGB")
        im = im.crop((round(u0 * im.width), round(v0 * im.height), round(u1 * im.width), round(v1 * im.height)))
        s = a.width / im.width
        im = im.resize((a.width, round(im.height * s)))
        d = ImageDraw.Draw(im, "RGBA")
        n = round(1 / a.step)
        for k in range(1, n):
            f = k * a.step
            major = k % 2 == 0
            col = (255, 255, 0, 150) if major else (255, 255, 255, 70)
            # labels stay in the ORIGINAL image's u, v when cropped
            x, y = round((f - u0) / (u1 - u0) * im.width), round((f - v0) / (v1 - v0) * im.height)
            if u0 < f < u1: d.line([(x, 0), (x, im.height)], fill=col, width=2 if major else 1)
            if v0 < f < v1: d.line([(0, y), (im.width, y)], fill=col, width=2 if major else 1)
            if major:
                for (tx, ty, txt, on) in [(x + 3, 3, f"u{f:.2f}", u0 < f < u1), (3, y + 2, f"v{f:.2f}", v0 < f < v1)]:
                    if not on: continue
                    d.rectangle([tx - 1, ty - 1, tx + 46, ty + 12], fill=(0, 0, 0, 160))
                    d.text((tx, ty), txt, fill=(255, 255, 0, 255))
        if a.out and len(a.images) == 1 and Path(a.out).suffix:
            dst = ROOT / a.out
        else:
            dst = (ROOT / (a.out or "render")) / f"grid_{p.stem}.png"
        dst.parent.mkdir(parents=True, exist_ok=True)
        im.save(dst)
        shown = dst.relative_to(ROOT) if dst.is_relative_to(ROOT) else dst  # --out may be outside the project
        print(f"[grid] {src} -> {shown}  (u = x / width, v = y / height of the ORIGINAL image)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
