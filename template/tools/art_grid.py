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
    a = ap.parse_args()
    for src in a.images:
        p = Path(src) if Path(src).is_absolute() else ROOT / src
        im = Image.open(p).convert("RGB")
        s = a.width / im.width
        im = im.resize((a.width, round(im.height * s)))
        d = ImageDraw.Draw(im, "RGBA")
        n = round(1 / a.step)
        for k in range(1, n):
            f = k * a.step
            major = k % 2 == 0
            col = (255, 255, 0, 150) if major else (255, 255, 255, 70)
            x, y = round(f * im.width), round(f * im.height)
            d.line([(x, 0), (x, im.height)], fill=col, width=2 if major else 1)
            d.line([(0, y), (im.width, y)], fill=col, width=2 if major else 1)
            if major:
                for (tx, ty, txt) in [(x + 3, 3, f"u{f:.2f}"), (3, y + 2, f"v{f:.2f}")]:
                    d.rectangle([tx - 1, ty - 1, tx + 46, ty + 12], fill=(0, 0, 0, 160))
                    d.text((tx, ty), txt, fill=(255, 255, 0, 255))
        if a.out and len(a.images) == 1 and Path(a.out).suffix:
            dst = ROOT / a.out
        else:
            dst = (ROOT / (a.out or "render")) / f"grid_{p.stem}.png"
        dst.parent.mkdir(parents=True, exist_ok=True)
        im.save(dst)
        print(f"[grid] {src} -> {dst.relative_to(ROOT)}  (u = x / width, v = y / height of the ORIGINAL image)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
