#!/usr/bin/env python3
"""Cut character reference sheets into paper-puppet pieces for the papercraft storybook (scene pcStory).

    python tools/cut_puppet.py                 # assets/cast/puppets.json -> assets/cast/<who>_{head,body,leg,front}.png,
                                               #   <who>_<extra>.png and assets/cast/rig.json
    python tools/cut_puppet.py --selftest

A sheet is one generated image of a character on a removed (transparent) background: a side view facing LEFT and a
front view, both full body (generate it, remove the background with the generator's tool or tools/alpha_matte.py,
look at it). puppets.json, per role:
    "hero": { "src": "assets/cast/hero_cut.png",
              "side": [0.56, 0.70],      the side view's x span, as fractions of the sheet width
              "neck": 110, "hem": 513,   sheet rows: the head is cut above the neck line, the legs below the hem line
              "front": [0.05, 0.25],     the front view's x span (drawn as one piece)
              "tall": 640,               height in rig px (the sheets differ in size; set the cast's relative heights)
              "mirror": false,           true when the side view faces right
              "extras": [ { "name": "tail", "src": "assets/ref/tail.png", "key": true, "base": "right",
                            "at": [325, 630], "len": 230, "angle": 0.3, "sway": 0.1 } ] }
Extras are separate pieces drawn behind the body and swinging at their base (a tail, a cape end, a long scarf): `src`
is their own image (`key`: remove a flat background by its corner colour), `base` the end that joins the body, `at`
the join in side-view crop coords, `len` the drawn length, `angle` the rest angle (rad, + = down and back), `sway`.
Pick the neck line where a collar, scarf or hair hides the cut, the hem line just below a coat or skirt.

rig.json gives each piece's top-left relative to the foot point (x = the leg's centre, y = the sole) and the pivots.
mv-studio (MIT).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OVER = 10    # px the head runs on under the body, and the leg runs up under the hem (hidden when they turn)


def bbox(a):
    ys, xs = np.where(a[:, :, 3] > 8)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def key_flat(im):
    """Alpha from the distance to the corner colour (a flat generated background)."""
    rgb = im[:, :, :3].astype(float)
    d = np.linalg.norm(rgb - rgb[:8, :8].reshape(-1, 3).mean(0), axis=2)
    a = (np.clip((d - 30) / 25, 0, 1) * 255).astype(np.uint8)
    a = np.array(Image.fromarray(a).filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.MinFilter(3)))
    return np.dstack([im[:, :, :3], a])


def cut(spec: dict, root: Path, out: Path) -> dict:
    rig, files = {}, {}
    for who, s in spec.items():
        im = np.array(Image.open(root / s["src"]).convert("RGBA"))
        im[:, :, 3] = np.array(Image.fromarray(im[:, :, 3]).filter(ImageFilter.MinFilter(3)))   # drop the matte's 1 px fringe
        W = im.shape[1]
        side = im[:, int(s["side"][0] * W):int(s["side"][1] * W)].copy()
        if s.get("mirror"):
            side = side[:, ::-1].copy()
        x0, y0, x1, y1 = bbox(side)
        side = side[:, x0:x1]
        leg = side[s["hem"]:y1].copy()
        lx0, _, lx1, _ = bbox(leg)
        leg = np.concatenate([np.repeat(leg[:1, lx0:lx1], OVER * 2, axis=0), leg[:, lx0:lx1]])   # runs on up under the coat
        foot = ((lx0 + lx1) / 2, y1)
        P = {}
        for name, arr, top in (("head", side[y0:s["neck"] + OVER], y0), ("body", side[s["neck"]:s["hem"] + 2], s["neck"])):
            bx0, by0, bx1, by1 = bbox(arr)
            files[f"{who}_{name}.png"] = arr[by0:by1, bx0:bx1]
            P[name] = dict(x=int(bx0 - foot[0]), y=int(top + by0 - foot[1]), w=int(bx1 - bx0), h=int(by1 - by0))
        files[f"{who}_leg.png"] = leg
        P["leg"] = dict(x=int(lx0 - foot[0]), y=int(s["hem"] - OVER * 2 - foot[1]), w=int(leg.shape[1]), h=int(leg.shape[0]))
        ncol = np.where(side[s["neck"], :, 3] > 8)[0]
        P["neck"] = [float(ncol.mean() - foot[0]), float(s["neck"] - foot[1])]
        P["hip"] = [0.0, float(s["hem"] - OVER - foot[1])]
        fr = im[:, int(s["front"][0] * W):int(s["front"][1] * W)]
        fx0, fy0, fx1, fy1 = bbox(fr)
        files[f"{who}_front.png"] = fr[fy0:fy1, fx0:fx1]
        P["front"] = dict(w=int(fx1 - fx0), h=int(fy1 - fy0))
        P["height"] = int(y1 - y0)
        P["scale"] = s.get("tall", P["height"]) / P["height"]
        P["extras"] = []
        for e in s.get("extras", []):
            ex = np.array(Image.open(root / e["src"]).convert("RGBA"))
            if e.get("key"):
                ex = key_flat(ex)
            ex = ex[bbox(ex)[1]:bbox(ex)[3], bbox(ex)[0]:bbox(ex)[2]]
            if e.get("base", "left") == "right":
                ex = ex[:, ::-1].copy()                                   # the base on the left, the free end pointing back
            files[f"{who}_{e['name']}.png"] = ex
            P["extras"].append(dict(name=e["name"], w=int(ex.shape[1]), h=int(ex.shape[0]),
                                    base=[0, float(np.where(ex[:, 3, 3] > 8)[0].mean())],
                                    at=[float(e["at"][0] - x0 - foot[0]), float(e["at"][1] - foot[1])],
                                    len=e.get("len", 200), angle=e.get("angle", 0.3), sway=e.get("sway", 0.1)))
        assert P["leg"]["h"] > 2 * OVER + 20 and P["head"]["h"] > 40 and P["body"]["h"] > 40, (who, P)
        rig[who] = P
    out.mkdir(parents=True, exist_ok=True)
    for name, arr in files.items():
        Image.fromarray(arr).save(out / name)
    (out / "rig.json").write_text(json.dumps(rig, indent=1), encoding="utf-8")
    return rig


def selftest():
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        sheet = np.zeros((400, 400, 4), np.uint8)
        sheet[20:100, 230:300] = (200, 150, 120, 255)    # side view: head
        sheet[100:300, 220:310] = (40, 60, 120, 255)     # coat
        sheet[300:380, 250:280] = (90, 50, 30, 255)      # legs
        sheet[20:380, 40:140] = (40, 60, 120, 255)       # front view
        Image.fromarray(sheet).save(d / "s.png")
        tail = np.full((60, 200, 4), (100, 120, 130, 255), np.uint8)
        tail[20:40, 30:190] = (110, 60, 40, 255)
        Image.fromarray(tail).save(d / "t.png")
        spec = {"hero": dict(src="s.png", side=[0.5, 1.0], neck=100, hem=300, front=[0, 0.5], tall=720,
                             extras=[dict(name="tail", src="t.png", key=True, base="right", at=[90, 250])])}
        R = cut(spec, d, d / "out")["hero"]
        assert R["leg"]["y"] + R["leg"]["h"] == 0 and R["hip"][1] < 0 < -R["neck"][1], R
        assert R["head"]["y"] == -358 and abs(R["scale"] - 720 / 358) < 1e-9 and R["front"]["h"] == 358, R   # 1 px eroded each edge
        x = R["extras"][0]
        assert x["w"] == 158 and x["h"] == 18 and abs(x["base"][1] - 8.5) < 1 and x["at"] == [25.0, -129.0], x
        assert (d / "out/hero_tail.png").exists() and (d / "out/rig.json").exists()
    print("cut_puppet selftest ok")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    else:
        spec = json.loads((ROOT / "assets/cast/puppets.json").read_text(encoding="utf-8"))
        print(json.dumps(cut(spec, ROOT, ROOT / "assets/cast")))
