#!/usr/bin/env python3
"""Compare two snapshots of the film made by tools/regress.mjs and list the frames that changed.

    python tools/compare_sheets.py before after [--level 6] [--pixels 12] [--cols 3]

A frame counts as changed when more than PIXELS of its pixels differ by more than LEVEL (of 255) in any channel
(two renders of the same code differ by a level or two on the GPU). Prints every changed frame with its time and
shot, groups them into runs, and writes render/regress/<a>_vs_<b>.jpg: before | after | difference, for each run's
strongest frame. A change you meant shows up only in the shots you meant to change; anything else is a regression.

mv-studio (MIT).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
REG = ROOT / "render" / "regress"


def load(name: str) -> dict:
    p = REG / name / "index.json"
    if not p.is_file():
        sys.exit(f"no snapshot '{name}' (node tools/regress.mjs snap {name})")
    return json.loads(p.read_text(encoding="utf-8"))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("a"); ap.add_argument("b")
    ap.add_argument("--level", type=int, default=6)
    ap.add_argument("--pixels", type=int, default=12)
    ap.add_argument("--cols", type=int, default=3)
    a = ap.parse_args()
    A, B = load(a.a), load(a.b)
    bt = {round(f["t"], 3): f for f in B["frames"]}
    changed, missing = [], []
    for fa in A["frames"]:
        fb = bt.get(round(fa["t"], 3))
        if not fb:
            missing.append(fa["t"]); continue
        ia = np.asarray(Image.open(REG / a.a / fa["file"]).convert("RGB"), dtype=np.int16)
        ib = np.asarray(Image.open(REG / a.b / fb["file"]).convert("RGB"), dtype=np.int16)
        if ia.shape != ib.shape:
            changed.append((fa, fb, 1.0, None)); continue
        dd = np.abs(ia - ib).max(axis=2)
        n = int((dd > a.level).sum())
        if n > a.pixels:
            changed.append((fa, fb, n / dd.size, dd))
    # runs of consecutive changed frames (by shot / time)
    runs: list[list] = []
    for c in changed:
        if runs and runs[-1][-1][0]["shot"] == c[0]["shot"]:
            runs[-1].append(c)
        else:
            runs.append([c])
    for r in runs:
        t0, t1 = r[0][0]["t"], r[-1][0]["t"]
        worst = max(x[2] for x in r)
        print(f"CHANGED  shot {r[0][0]['shot']}: {t0:7.2f}-{t1:7.2f} s  {len(r)} frame(s), up to {worst * 100:.1f} % of pixels")
    if missing:
        print(f"note: {len(missing)} frame(s) of '{a.a}' have no counterpart in '{a.b}' (different --every / shots)")
    if runs:
        picks = [max(r, key=lambda x: x[2]) for r in runs]
        w, h = Image.open(REG / a.a / picks[0][0]["file"]).size
        cols = a.cols
        S = Image.new("RGB", (cols * w, len(picks) * (h + 18)), (16, 16, 16))
        d = ImageDraw.Draw(S)
        for k, (fa, fb, frac, dd) in enumerate(picks):
            y = k * (h + 18)
            S.paste(Image.open(REG / a.a / fa["file"]).convert("RGB"), (0, y))
            S.paste(Image.open(REG / a.b / fb["file"]).convert("RGB"), (w, y))
            if dd is not None and cols > 2:
                S.paste(Image.fromarray(np.clip(dd * 4, 0, 255).astype(np.uint8)).convert("RGB"), (2 * w, y))
            d.text((6, y + h + 3), f"{fa['t']:.2f} s  shot {fa['shot']}  {frac * 100:.1f} %   {a.a} | {a.b} | diff x4", fill=(235, 235, 235))
        out = REG / f"{a.a}_vs_{a.b}.jpg"
        S.save(out, quality=86)
        print(f"sheet -> {out.relative_to(ROOT).as_posix()} (LOOK at it)")
    print(f"[compare] {len(A['frames'])} frames: {len(changed)} changed in {len(runs)} run(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
