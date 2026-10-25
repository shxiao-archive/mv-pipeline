#!/usr/bin/env python3
"""gen_table.py -- the film's assets as ONE generation table (references/10 §3; the netsu-ijou-pv method), plus
VARIANTS: small edits of an approved image (eyes closed, mouth open, a head turn, wind in the hair) that are aligned to
it so the engine can switch them (engine/scenes/scenes.js chars[].anim).

  python tools/gen_table.py jobs   assets/gen/table.json [--pass base|variants]   # -> assets/gen/jobs_<pass>.jsonl
  python tools/artgen.py run assets/gen/jobs_base.jsonl --out-dir assets/gen/raw  # (the user's chosen generator)
  python tools/gen_table.py jobs   assets/gen/table.json --pass variants          # after the bases exist
  python tools/artgen.py run assets/gen/jobs_variants.jsonl --out-dir assets/gen/raw
  python tools/gen_table.py post   assets/gen/table.json      # align variants, copy finals, review sheets per category
  python tools/gen_table.py status assets/gen/table.json      # done / missing / failed per row
  python tools/gen_table.py align  BASE.png VARIANT.png OUT.png [--mode patch|full] [--region u0,v0,u1,v1]
  python tools/gen_table.py selftest

Table (JSON). Every lock and row kind is optional: a film without a cast has no CHAR locks or char rows.
  { "locks": { "STYLE": "...", "CHAR": "...", "CHAR_BACK": "...", "WORLD": "...", "ISO": "...", "EMPTY": "..." },   # your words per film
    "refs":  { "style": "assets/ref/style_ref.png", "char": ["assets/ref/char_front.png", "assets/ref/char_approved.png"] },
    "out":   "assets/gen",                       # finals go to <out>/<id>.png, raw generations to <out>/raw/
    "refs_first": "style",                       # "char" for NovelAI (its character reference reads the first image)
    "rows": [
      { "id": "CH01", "kind": "char", "subject": "Full body, side view ...", "size": "1024x1536", "transparent": true },
      { "id": "BG01", "kind": "world", "subject": "A vast ruined city plain ...", "size": "1536x1024" },
      { "id": "OBJ10a", "kind": "world", "subject": "A swallow, wings spread", "transparent": true },
      { "id": "CH01_blink", "variant_of": "CH01", "edit": "her eyes closed", "mode": "patch", "region": [0.3, 0.05, 0.75, 0.3], "takes": 3 },
      { "id": "CH02", "kind": "char", "subject": "Full body seen from behind ...", "transparent": true,
        "view": "back" },   # the CHAR_BACK lock if the table has one, else CHAR without its face words; + a face negative
      { "id": "CH01_turn", "variant_of": "CH01", "edit": "her head turned a little toward the viewer", "mode": "full" },
      { "id": "CH03", "kind": "char", "subject": "head and shoulders, three-quarter view", "size": "1024x1024", "transparent": true,
        "sheet": { "cells": ["neutral", "blink", "open", "smile"] } } ] }
  A SHEET row is THE way to make a character's expressions: one generation draws all of them in the same style; `post`
  numbers the figures it finds (_<id>_figures.jpg: generators often add or reorder figures; then set
  "pick": {"neutral": 2, "blink": 4, ...}) and draws a grid on the neutral one (_<id>_grid.jpg: set "eyes" and
  "mouth" [u0, v0, u1, v1] there, a little larger than the features), takes them, aligns them to the first (neutral) one, cuts each other expression to the face (`face`
  area pasted from each copy) and writes <id>.png, <id>_<name>.png and <id>.anim.json
  (blink / open -> anim.blink / anim.mouth, the others -> anim.expr) for engine/scenes/scenes.js. Variant rows (below)
  are for a full-body picture that needs one more face; big changes by variant drift in style (tested): avoid them.
  Prompt = the row's locks (default: char -> STYLE + CHAR, world -> STYLE + WORLD, + ISO when transparent, + EMPTY for
  world rows that are not transparent) + "New image: " + subject. References: the style reference first, then the
  character references (char rows) and the row's own "refs". Prefix of the id before the first digit or '-' = the
  review-sheet category (BG, CH, OBJ ...). A variant is generated FROM its base (the base is the reference image and
  the prompt says to change only the edit); `post` aligns it to the base (scale + offset, refuses a misfit) and writes
    patch  only the pixels that changed (the blobs centred in `region`, if given), on the base's canvas: drawn over the base
  "takes": 3 generates three seeds of a variant and keeps the one that changed least outside its region (an inpaint
  face variant: the one that changed most inside it, which is not always the one with the eyes closed); `post` writes
  _review_<id>_takes.jpg (the box from the base and from every take) and "take": 2 keeps take 2 instead.
  "noise": 0.1 (NovelAI inpaint / img2img) adds noise to the start image: try 0.1-0.2 when a blink comes back unchanged.
    full   the whole aligned variant on the base's canvas: swapped for the base (pose / turn / big changes); with
           "ref_mode": "inpaint" and a region (a face variant): the repainted box blended into the base with a soft
           edge inside the figure, the base everywhere else (engine chars[].anim whole: true swaps it in)

mv-studio (MIT). Standard library + numpy, scipy, Pillow.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import kit_env  # noqa: E402

ROOT = kit_env.ROOT
DEFAULT_LOCKS = {"char": ["STYLE", "CHAR"], "world": ["STYLE", "WORLD"]}
VARIANT_PROMPT = ("Redraw the attached image exactly: the same character, pose, framing, size on the canvas, colours, line "
                  "art and background. Change ONLY this: {edit}. Everything else must stay pixel-identical.")


def rp(p: str | Path) -> Path:
    p = Path(p)
    return p if p.is_absolute() else ROOT / p


def load(table: Path) -> dict:
    t = json.loads(table.read_text(encoding="utf-8-sig"))
    ids = [r["id"] for r in t.get("rows", [])]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        sys.exit(f"duplicate ids: {', '.join(sorted(dup))}")
    for r in t["rows"]:
        if r.get("variant_of") and r["variant_of"] not in ids:
            sys.exit(f"{r['id']}: variant_of {r['variant_of']} is not a row")
        if not r.get("variant_of") and not r.get("subject"):
            sys.exit(f"{r['id']}: no subject")
    return t


def area(region) -> float:
    u0, v0, u1, v1 = region
    return max(0.0, (u1 - u0) * (v1 - v0))


def category(rid: str) -> str:
    m = re.match(r"[A-Za-z]+", rid)
    return m.group(0).upper() if m else "MISC"


def raw_path(t: dict, rid: str) -> Path:
    return rp(t.get("out", "assets/gen")) / "raw" / f"{rid}.png"


def final_path(t: dict, rid: str) -> Path:
    return rp(t.get("out", "assets/gen")) / f"{rid}.png"


# a back view must not name the face: with the eyes in the prompt the model draws eyes on the back of the head
FACE_WORDS = re.compile(r"\b(eyes?|eyelash\w*|bangs|fringe|face|facial|mouth|lips|smil\w*|expression|gaze|looking|pupils?|blush\w*|cheeks?|freckles?)\b", re.I)
BACK_NEGATIVE = "face, eyes, looking at viewer, front view"


def back_of(text: str) -> str:
    """A character lock with every comma-separated part that names the face left out."""
    return ", ".join(x for x in re.split(r",\s*", text) if not FACE_WORDS.search(x))


def lock_text(t: dict, r: dict, name: str) -> str:
    locks = t.get("locks", {})
    if r.get("view") == "back" and name == "CHAR":
        return locks["CHAR_BACK"] if "CHAR_BACK" in locks else back_of(locks["CHAR"])
    return locks[name]


def prompt_of(t: dict, r: dict) -> str:
    locks = t.get("locks", {})
    names = r.get("locks") or list(DEFAULT_LOCKS.get(r.get("kind", "world"), ["STYLE"]))
    if r.get("transparent") and r.get("kind", "world") == "world" and "ISO" not in names:
        names.append("ISO")
    if not r.get("transparent") and r.get("kind", "world") == "world" and "EMPTY" not in names and "EMPTY" in locks:
        names.append("EMPTY")
    missing = [n for n in names if n not in locks]
    if missing:
        sys.exit(f"{r['id']}: locks {missing} are not defined in the table")
    subject = r["subject"]
    if r.get("view") == "back" and "behind" not in subject.lower():
        subject = "seen from behind, back view, facing away from the viewer, " + subject
    if r.get("sheet"):                                                  # an expression sheet: one image, one style
        cells = r["sheet"]["cells"]; cols = r["sheet"].get("cols", 2 if len(cells) == 4 else len(cells))
        desc = {"neutral": "neutral, mouth closed, eyes open", "blink": "eyes closed, mouth closed", "closed": "eyes closed",
                "open": "mouth open as if singing, eyes open", "smile": "a warm smile, mouth closed", "sad": "sad", "surprised": "surprised, mouth open"}
        order = "; ".join(f"{i + 1}: {desc.get(c, c)}" for i, c in enumerate(cells))
        subject = (f"expression sheet of ONE character: {len(cells)} identical copies of the same picture of her in a grid of {cols} "
                   f"columns, evenly spaced, not touching, exactly the same pose, framing, size, hair and clothes in every copy; only the "
                   f"facial expression changes, in reading order: {order}. The picture: {subject}")
    return "\n".join(lock_text(t, r, n) for n in names) + "\n\nNew image: " + subject


def char_of(t: dict, r: dict) -> str | None:
    """The row's character lock (CHAR, CHAR_BACK, ...): NovelAI sends it as a character caption."""
    if r.get("kind") != "char":
        return None
    names = r.get("locks") or DEFAULT_LOCKS["char"]
    return next((lock_text(t, r, n) for n in names if n.startswith("CHAR") and n in t.get("locks", {})), None)


def cmd_jobs(table: Path, pass_: str, out: Path | None) -> int:
    t = load(table)
    refs = t.get("refs", {})
    style = [refs["style"]] if refs.get("style") else []
    jobs, waiting = [], []
    for r in t["rows"]:
        if pass_ == "base" and not r.get("variant_of"):
            char = list(refs.get("char", [])) if r.get("kind") == "char" else []
            # NovelAI's character reference reads the FIRST image: "refs_first": "char" puts the design first
            imgs = (char + style if t.get("refs_first") == "char" else style + char) + list(r.get("refs", []))
            job = {"id": r["id"], "prompt": prompt_of(t, r), "out": f"{r['id']}.png",   # relative to --out-dir <out>/raw (all generator wrappers)
                   "transparent": bool(r.get("transparent")), "trim": bool(r.get("trim", r.get("transparent")))}
        elif pass_ == "variants" and r.get("variant_of"):
            base = final_path(t, r["variant_of"])
            if not base.is_file():
                waiting.append(r["id"]); continue
            imgs = [str(base.relative_to(ROOT)).replace("\\", "/")] + style
            b = next(x for x in t["rows"] if x["id"] == r["variant_of"])
            # the base's full prompt (style + identity locks) travels with the edit: a repainted head must stay her
            job = {"id": r["id"], "prompt": VARIANT_PROMPT.format(edit=r["edit"]) + "\n\n" + prompt_of(t, b), "out": f"{r['id']}.png",   # relative to --out-dir <out>/raw (all generator wrappers)
                   "transparent": bool(b.get("transparent")), "trim": False,
                   # generators that can: start from the base (img2img) or repaint only the region (inpaint, NovelAI)
                   "ref_mode": r.get("ref_mode") or ("inpaint" if r.get("mode", "patch") == "patch" and r.get("region") else "img2img"),
                   # a small feature (eyes, mouth) is redrawn outright; a large region (a head) keeps the original's colours
                   "strength": r.get("strength", 0.5 if not r.get("region") else 1.0 if area(r["region"]) < 0.02 else 0.7)}
            if r.get("region"):
                job["region"] = r["region"]
        else:
            continue
        ch = char_of(t, r) or char_of(t, next((x for x in t["rows"] if x["id"] == r.get("variant_of")), {}))
        if ch:
            job["char"] = ch                                              # NovelAI: a V4 character caption
        for k in ("size", "aspect", "seed", "negative", "noise"):        # passed through to the generator wrapper
            if k in r:
                job[k] = r[k]
        if r.get("view") == "back":
            job["negative"] = ", ".join(x for x in (job.get("negative"), BACK_NEGATIVE) if x)
        base_row = next((x for x in t["rows"] if x["id"] == r.get("variant_of")), {})
        if r.get("key") or base_row.get("key"):
            job["key"] = r.get("key") or base_row["key"]                 # a variant keeps its base's screen colour
        if r.get("provider"):
            job["provider"] = r["provider"]
        missing = [i for i in imgs if not rp(i).is_file()]
        if missing:
            sys.exit(f"{r['id']}: reference image(s) missing: {', '.join(missing)}")
        if imgs:
            job["images"] = imgs
        takes = int(r.get("takes", 1)) if r.get("variant_of") else 1
        if takes > 1:                                                 # several seeds; `post` keeps the cleanest take
            for k in range(1, takes + 1):
                jobs.append(dict(job, id=f"{r['id']}__t{k}", out=f"{r['id']}__t{k}.png"))
        else:
            jobs.append(job)
    out = out or rp(t.get("out", "assets/gen")) / f"jobs_{pass_}.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("".join(json.dumps(j, ensure_ascii=False) + "\n" for j in jobs), encoding="utf-8")
    print(f"{len(jobs)} {pass_} job(s) -> {out.relative_to(ROOT)}")
    if waiting:
        print(f"  waiting for their base: {', '.join(waiting)} (run `post` after the base pass first)")
    print(f"  next: python tools/artgen.py run {out.relative_to(ROOT).as_posix()} --out-dir {(rp(t.get('out', 'assets/gen')) / 'raw').relative_to(ROOT).as_posix()}")
    return 0


# ------------------------------------------------------------------ alignment
def _rgba(p: Path) -> np.ndarray:
    return np.asarray(Image.open(p).convert("RGBA"), dtype=np.float32) / 255.0


def _gray(a: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "RGBA").resize(size, Image.BILINEAR)
    x = np.asarray(im, dtype=np.float32) / 255.0
    g = (0.3 * x[..., 0] + 0.59 * x[..., 1] + 0.11 * x[..., 2]) * x[..., 3] + 0.5 * x[..., 3]   # shape + shading
    return g - g.mean()


def _phase(a: np.ndarray, b: np.ndarray) -> tuple[float, float, float]:
    """shift (dy, dx) that moves b onto a, and the correlation peak"""
    F = np.fft.fft2(a) * np.conj(np.fft.fft2(b))
    r = np.fft.ifft2(F / (np.abs(F) + 1e-9)).real
    iy, ix = np.unravel_index(np.argmax(r), r.shape)
    h, w = r.shape
    dy, dx = (iy if iy <= h // 2 else iy - h), (ix if ix <= w // 2 else ix - w)
    return float(dy), float(dx), float(r.max())


def place(var: np.ndarray, H: int, W: int, s: float, dy: float, dx: float) -> np.ndarray:
    """the variant scaled by s about its centre and shifted, on a H x W canvas (the base's)"""
    h, w = var.shape[:2]
    nh, nw = max(1, round(h * s)), max(1, round(w * s))
    im = Image.fromarray((np.clip(var, 0, 1) * 255).astype(np.uint8), "RGBA").resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.paste(im, (round((W - nw) / 2 + dx), round((H - nh) / 2 + dy)))
    return np.asarray(canvas, dtype=np.float32) / 255.0


def align(base: np.ndarray, var: np.ndarray) -> tuple[np.ndarray, dict]:
    H, W = base.shape[:2]
    work = 256 / max(H, W)
    sz = (max(8, round(W * work)), max(8, round(H * work)))
    gb = _gray(base, sz)
    best = None
    fit = min(H / var.shape[0], W / var.shape[1])                      # generators often return another size
    for s in np.arange(fit * 0.92, fit * 1.081, fit * 0.01):
        v = place(var, H, W, s, 0, 0)
        dy, dx, peak = _phase(gb, _gray(v, sz))
        if best is None or peak > best[3]:
            best = (s, dy / work, dx / work, peak)
    s, dy, dx, _ = best
    for _ in range(2):                                                 # refine the offset at full resolution scale
        v = place(var, H, W, s, dy, dx)
        ddy, ddx, _ = _phase(_gray(base, sz), _gray(v, sz))
        dy, dx = dy + ddy / work, dx + ddx / work
        if abs(ddy) < 1 and abs(ddx) < 1:
            break
    v = place(var, H, W, s, dy, dx)
    both = (base[..., 3] > 0.5) & (v[..., 3] > 0.5)
    err = float(np.abs(base[..., :3] - v[..., :3]).mean(axis=2)[both].mean()) if both.any() else 1.0
    iou = float(both.sum() / max(1, ((base[..., 3] > 0.5) | (v[..., 3] > 0.5)).sum()))
    return v, {"scale": round(float(s), 4), "dx": round(dx, 1), "dy": round(dy, 1), "colour_err": round(err, 4), "shape_iou": round(iou, 4)}


def patch_of(base: np.ndarray, v: np.ndarray, region=None, thr=0.14, feather=3) -> tuple[np.ndarray, float]:
    from scipy import ndimage
    H, W = base.shape[:2]
    d = np.abs(base[..., :3] - v[..., :3]).max(axis=2) * np.maximum(base[..., 3], v[..., 3]) + np.abs(base[..., 3] - v[..., 3])
    m = d > thr                                                       # low-contrast drift (an inpaint re-shading skin) stays out
    if region:
        u0, v0, u1, v1 = region
        yy, xx = np.mgrid[0:H, 0:W]                                      # the ellipse inside the region (as the inpaint mask)
        cx, cy, rx, ry = (u0 + u1) / 2 * W, (v0 + v1) / 2 * H, max(1, (u1 - u0) / 2 * W), max(1, (v1 - v0) / 2 * H)
        m &= ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1
    m = ndimage.binary_opening(m, iterations=2)                       # drops thin resampling differences along outlines
    m = ndimage.binary_closing(m, iterations=3)
    if region:                                                        # keep the feature: blobs centred in the region's core
        lab, n = ndimage.label(m)
        if n:
            cyx = ndimage.center_of_mass(m, lab, range(1, n + 1))
            keep = [i + 1 for i, (y, x) in enumerate(cyx) if ((x - cx) / (rx * 0.8)) ** 2 + ((y - cy) / (ry * 0.8)) ** 2 <= 1]
            m = np.isin(lab, keep)
    m = ndimage.binary_dilation(m, iterations=feather)
    soft = ndimage.gaussian_filter(m.astype(np.float32), feather)
    soft = np.clip(soft * 2, 0, 1) * v[..., 3]
    out = v.copy(); out[..., 3] = soft
    return out, float(m.mean())


def drift(base: np.ndarray, v: np.ndarray, region) -> float:
    """how much a variant changed OUTSIDE its region (lower is better: the edit stayed where it was asked)"""
    H, W = base.shape[:2]
    out = base[..., 3] > 0.5
    if region:
        u0, v0, u1, v1 = region; yy, xx = np.mgrid[0:H, 0:W]
        out &= (((xx - (u0 + u1) / 2 * W) / ((u1 - u0) / 2 * W)) ** 2 + ((yy - (v0 + v1) / 2 * H) / ((v1 - v0) / 2 * H)) ** 2) > 1
    return float(np.abs(base[..., :3] - v[..., :3]).max(axis=2)[out].mean()) if out.any() else 1.0


def save(a: np.ndarray, p: Path) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "RGBA").save(p)


def do_align(base_p: Path, var_p: Path, out_p: Path, mode: str, region=None, max_err=0.12, min_iou=0.85, inpaint=False) -> dict:
    base, var = _rgba(base_p), _rgba(var_p)
    if inpaint and region:                                            # same canvas by construction: resize, no keying or search
        im = Image.fromarray((var * 255).astype(np.uint8), "RGBA").resize((base.shape[1], base.shape[0]), Image.LANCZOS)
        v = np.asarray(im, np.float32) / 255; v[..., 3] = 1.0
        info, ok = {"scale": round(base.shape[1] / var.shape[1], 4), "dx": 0.0, "dy": 0.0, "colour_err": "-", "inpaint": True}, True
    else:
        v, info = align(base, var)
        ok = info["colour_err"] <= max_err and info["shape_iou"] >= (min_iou if mode == "patch" else min_iou - 0.15)
    info["mode"] = mode
    if not ok:
        info["refused"] = f"the variant does not line up with its base (colour_err {info['colour_err']} > {max_err} or shape_iou {info['shape_iou']} too low): regenerate it"
        return info
    if mode == "patch":
        p, frac = patch_of(base, v, region)
        info["changed"] = round(frac, 4)
        if frac < 0.0005:
            info["refused"] = "nothing changed inside the region: the generator ignored the edit"
            return info
        save(p, out_p)
    elif region:
        # a repainted box (inpaint) comes back re-shaded, with the key colour where the box leaves the figure: blend it
        # into the base with a soft edge inside the figure, so everything outside the face is the base, pixel for pixel
        out, inside = feather_in(base, v, region)
        info["changed"] = round(inside, 4)
        if inside < 0.01:
            info["refused"] = "nothing changed inside the region: the generator ignored the edit"
            return info
        save(out, out_p)
    else:
        save(v, out_p)
    return info


def feather_in(base: np.ndarray, v: np.ndarray, region) -> tuple[np.ndarray, float]:
    """The variant inside region [u0, v0, u1, v1] and inside the base figure, blended with a soft edge; the base elsewhere."""
    from scipy import ndimage
    H, W = base.shape[:2]
    u0, v0, u1, v1 = region
    box = np.zeros((H, W), np.float32)
    box[int(v0 * H):int(np.ceil(v1 * H)), int(u0 * W):int(np.ceil(u1 * W))] = 1
    sig = max(1.5, 0.06 * min((u1 - u0) * W, (v1 - v0) * H))
    figure = ndimage.binary_erosion(base[..., 3] > 0.5, iterations=max(1, int(sig)))
    m = ndimage.gaussian_filter(ndimage.binary_erosion(box > 0, iterations=int(sig)).astype(np.float32), sig) * figure * (v[..., 3] > 0.5)
    out = base.copy()
    out[..., :3] = base[..., :3] * (1 - m[..., None]) + v[..., :3] * m[..., None]
    inside = float((np.abs(base[..., :3] - v[..., :3]).mean(axis=2) * m).sum() / max(1.0, m.sum()))
    return out, inside



# ------------------------------------------------------------------ expression sheets (one generation, one style)
def figures(sheet: np.ndarray, n: int | None = None) -> list[tuple[int, int, int, int]]:
    """the figures of a keyed sheet (the n largest, or every one at least 15 % of the largest), in reading order
    (top to bottom by their tops, then left to right)"""
    from scipy import ndimage
    m = ndimage.binary_dilation(sheet[..., 3] > 0.5, iterations=6)
    lab, k = ndimage.label(m)
    sizes = ndimage.sum(m, lab, range(1, k + 1))
    if n is None:
        n = int((sizes >= 0.15 * sizes.max()).sum()) if k else 0
    if k < n or not n:
        raise ValueError(f"found {k} figure(s) on the sheet, expected {n}")
    keep = np.argsort(sizes)[::-1][:n] + 1
    boxes = []
    for i in keep:
        ys, xs = np.nonzero(lab == i)
        boxes.append((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    boxes = _split_touching(sheet[..., 3] > 0.5, boxes)
    hmin = float(min(b[3] - b[1] for b in boxes))
    boxes.sort(key=lambda b: (round(b[1] / (hmin * 0.5)), b[0]))
    return boxes


def _split_touching(alpha: np.ndarray, boxes: list) -> list:
    """figures drawn touching come out as one box about twice as tall (wide) as its look-alikes: cut it at its
    thinnest row (column) in the middle third"""
    out = []
    for b in boxes:
        x0, y0, x1, y1 = b
        w, h = x1 - x0, y1 - y0
        peers = [o for o in boxes if o is not b and 0.6 < (o[2] - o[0]) / w < 1.6]
        cut = None
        if peers and h > 1.7 * float(np.median([o[3] - o[1] for o in peers])):
            prof = alpha[y0:y1, x0:x1].sum(axis=1); a, z = h // 3, 2 * h // 3
            cut = ("y", y0 + a + int(np.argmin(prof[a:z])))
        peers = [o for o in boxes if o is not b and 0.6 < (o[3] - o[1]) / h < 1.6]
        if cut is None and peers and w > 1.7 * float(np.median([o[2] - o[0] for o in peers])):
            prof = alpha[y0:y1, x0:x1].sum(axis=0); a, z = w // 3, 2 * w // 3
            cut = ("x", x0 + a + int(np.argmin(prof[a:z])))
        if cut is None:
            out.append(b); continue
        halves = [(x0, y0, x1, cut[1]), (x0, cut[1], x1, y1)] if cut[0] == "y" else [(x0, y0, cut[1], y1), (cut[1], y0, x1, y1)]
        areas = [float(alpha[hy0:hy1, hx0:hx1].sum()) for hx0, hy0, hx1, hy1 in halves]
        if min(areas) < 0.6 * max(areas):                              # two look-alikes split evenly; a tall figure does not
            out.append(b); continue
        for hx0, hy0, hx1, hy1 in halves:                                # shrink each half to its own content
            ys, xs = np.nonzero(alpha[hy0:hy1, hx0:hx1])
            if len(ys):
                out.append((hx0 + int(xs.min()), hy0 + int(ys.min()), hx0 + int(xs.max()) + 1, hy0 + int(ys.max()) + 1))
    return out


def cells_of(sheet: np.ndarray, n: int | None = None, margin: int = 24, boxes=None) -> list[np.ndarray]:
    boxes = boxes or figures(sheet, n)
    w = max(b[2] - b[0] for b in boxes) + 2 * margin
    h = max(b[3] - b[1] for b in boxes) + 2 * margin
    out = []
    for x0, y0, x1, y1 in boxes:                                     # one canvas size, each figure centred on it
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        cell = np.zeros((h, w, 4), np.float32)
        sx0, sy0 = max(0, cx - w // 2), max(0, cy - h // 2)
        sx1, sy1 = min(sheet.shape[1], cx - w // 2 + w), min(sheet.shape[0], cy - h // 2 + h)
        dx, dy = sx0 - (cx - w // 2), sy0 - (cy - h // 2)
        own = np.zeros(sheet.shape[:2], bool); own[y0:y1, x0:x1] = True   # only this figure, not a neighbour's edge
        part = sheet[sy0:sy1, sx0:sx1].copy(); part[~own[sy0:sy1, sx0:sx1]] = 0
        cell[dy:dy + (sy1 - sy0), dx:dx + (sx1 - sx0)] = part
        out.append(cell)
    return out


def face_region(base: np.ndarray, others: list[np.ndarray], pad: float = 0.25) -> list[float]:
    """where the expressions differ from the neutral one (the face), as u0, v0, u1, v1 of the cell, padded"""
    from scipy import ndimage
    H, W = base.shape[:2]
    acc = np.zeros((H, W), bool)
    for v in others:
        d = np.abs(base[..., :3] - v[..., :3]).max(axis=2) * np.minimum(base[..., 3], v[..., 3]) > 0.14
        d = ndimage.binary_opening(d, iterations=2)
        lab, k = ndimage.label(ndimage.binary_dilation(d, iterations=8))
        if k:                                                         # the biggest cluster of changes is the face
            sizes = ndimage.sum(d, lab, range(1, k + 1)); acc |= lab == (int(np.argmax(sizes)) + 1)
    if not acc.any():
        raise ValueError("the expressions do not differ from the neutral one")
    ys, xs = np.nonzero(acc)
    u0, u1, v0, v1 = xs.min() / W, xs.max() / W, ys.min() / H, ys.max() / H
    pu, pv = (u1 - u0) * pad, (v1 - v0) * pad
    return [round(max(0, u0 - pu), 3), round(max(0, v0 - pv), 3), round(min(1, u1 + pu), 3), round(min(1, v1 + pv), 3)]


def numbered(img: np.ndarray, boxes, dst: Path) -> None:
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), "RGBA")
    bg = Image.new("RGBA", im.size, (200, 200, 200, 255)); bg.alpha_composite(im)
    dr = ImageDraw.Draw(bg)
    try:
        font = ImageFont.truetype("arial.ttf", 40)
    except OSError:
        font = ImageFont.load_default()
    for i, (x0, y0, x1, y1) in enumerate(boxes):
        dr.rectangle([x0, y0, x1, y1], outline=(220, 30, 30), width=3)
        dr.rectangle([x0, y0, x0 + 46, y0 + 46], fill=(220, 30, 30)); dr.text((x0 + 10, y0 + 2), str(i + 1), fill="white", font=font)
    dst.parent.mkdir(parents=True, exist_ok=True); bg.convert("RGB").save(dst, quality=90)


def _shift(a: np.ndarray, dy: int, dx: int) -> np.ndarray:
    out = np.zeros_like(a)
    H, W = a.shape[:2]
    ys, yd = (slice(0, H - dy), slice(dy, H)) if dy >= 0 else (slice(-dy, H), slice(0, H + dy))
    xs, xd = (slice(0, W - dx), slice(dx, W)) if dx >= 0 else (slice(-dx, W), slice(0, W + dx))
    out[yd, xd] = a[ys, xs]
    return out


def paste_of(base: np.ndarray, v: np.ndarray, regions, search: int = 6) -> np.ndarray:
    """the copy's feature (eyes, mouth) on the base, clean: per region the copy is shifted to fit the base locally and
    its skin tone matched; it is taken fully wherever the two drawings differ inside the feature (that also erases
    the base's own feature), the base is kept elsewhere, and the edge is softened only over flat skin. Differences
    near the region's edge (an outline a few px off) keep the base."""
    from scipy import ndimage
    H, W = base.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    out = np.zeros_like(base)
    for u0, v0, u1, v1 in regions:
        cx, cy, rx, ry = (u0 + u1) / 2 * W, (v0 + v1) / 2 * H, max(1, (u1 - u0) / 2 * W), max(1, (v1 - v0) / 2 * H)
        r = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
        ring = (r > 0.7) & (r <= 1.15) & (base[..., 3] > 0.9)
        best = None                                                   # local fit: the shift that matches the ring best
        for dy in range(-search, search + 1, 2):
            for dx in range(-search, search + 1, 2):
                vs = _shift(v, dy, dx)
                e = float(np.abs(base[..., :3] - vs[..., :3]).max(axis=2)[ring].mean()) if ring.any() else 0
                if best is None or e < best[0]:
                    best = (e, dy, dx)
        vs = _shift(v, best[1], best[2])
        d = np.abs(base[..., :3] - vs[..., :3]).max(axis=2)
        flat = ring & (d < 0.08)                                      # matching skin: the tone offset of the copy
        if flat.sum() > 50:
            off = np.median((base[..., :3] - vs[..., :3])[flat], axis=0)
            vs = vs.copy(); vs[..., :3] = np.clip(vs[..., :3] + off, 0, 1)
            d = np.abs(base[..., :3] - vs[..., :3]).max(axis=2)
        m = (d > 0.12) & (r <= 1.0)
        m = ndimage.binary_opening(m, iterations=1)
        lab, n = ndimage.label(ndimage.binary_dilation(m, iterations=3))
        if n:                                                         # the feature: blobs centred inside the core
            cyx = ndimage.center_of_mass(m, lab, range(1, n + 1))
            keep = [i + 1 for i, (y, x) in enumerate(cyx) if not np.isnan(y) and ((x - cx) / (rx * 0.75)) ** 2 + ((y - cy) / (ry * 0.75)) ** 2 <= 1]
            m = np.isin(lab, keep) & (r <= 1.05)
        m = ndimage.binary_fill_holes(ndimage.binary_closing(m, iterations=4))
        soft = np.clip(ndimage.gaussian_filter(ndimage.binary_dilation(m, iterations=2).astype(np.float32), 1.5) * 1.6, 0, 1)
        a = soft * vs[..., 3]
        take = a > out[..., 3]
        out[take] = np.concatenate([vs[..., :3], a[..., None]], axis=2)[take]
    return out


def grid_image(a: np.ndarray, dst: Path, step: float = 0.05) -> None:
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "RGBA")
    k = max(1, round(900 / max(im.size)))
    bg = Image.new("RGBA", im.size, (225, 225, 225, 255)); bg.alpha_composite(im); bg = bg.resize((im.width * k, im.height * k))
    dr = ImageDraw.Draw(bg)
    n = round(1 / step)
    for i in range(n + 1):
        x, y = i * step * bg.width, i * step * bg.height
        col = (220, 30, 30) if i % 2 == 0 else (240, 160, 160)
        dr.line([(x, 0), (x, bg.height)], fill=col, width=1); dr.line([(0, y), (bg.width, y)], fill=(30, 30, 220) if i % 2 == 0 else (160, 160, 240), width=1)
        if i % 2 == 0:
            dr.text((x + 2, 2), f"{i * step:.2f}", fill=(200, 0, 0)); dr.text((2, y + 2), f"{i * step:.2f}", fill=(0, 0, 200))
    dst.parent.mkdir(parents=True, exist_ok=True); bg.convert("RGB").save(dst, quality=90)


ROLE = {"blink": "blink", "closed": "blink", "open": "mouth", "mouth": "mouth", "sing": "mouth"}


def grid_figures(sheet: np.ndarray, cols: int, rows: int) -> list[tuple[int, int, int, int]]:
    """one box per cell of a cols x rows grid: the content bounds inside each cell (empty cells are left out)"""
    H, W = sheet.shape[:2]
    out = []
    for j in range(rows):
        for i in range(cols):
            x0, x1, y0, y1 = W * i // cols, W * (i + 1) // cols, H * j // rows, H * (j + 1) // rows
            ys, xs = np.nonzero(sheet[y0:y1, x0:x1, 3] > 0.5)
            if len(ys) > 0.02 * (x1 - x0) * (y1 - y0):
                out.append((x0 + int(xs.min()), y0 + int(ys.min()), x0 + int(xs.max()) + 1, y0 + int(ys.max()) + 1))
    return out


def split_sheet(t: dict, r: dict, raw: Path) -> dict:
    sh = r["sheet"]; names = sh["cells"]; rid = r["id"]; out = rp(t.get("out", "assets/gen"))
    img = _rgba(raw)
    allb = figures(img)
    if len(allb) < len(names) and not sh.get("pick"):                # figures drawn touching merge: cut the sheet's own grid
        cols = sh.get("cols", 2 if len(names) == 4 else len(names))
        grid = grid_figures(img, cols, -(-len(names) // cols))
        if len(grid) == len(names):
            print(f"{rid}: {len(allb)} separate figure(s) found; using the {cols}-column grid of the sheet instead", flush=True)
            allb = grid
    numbered(img, allb, out / f"_{rid}_figures.jpg")                  # LOOK at it: which figure is which expression
    pick = sh.get("pick")                                             # {"neutral": 2, "blink": 4, ...} (1-based numbers)
    if pick:
        missing = [nm for nm in names if nm not in pick]
        if missing or any(not 1 <= pick[nm] <= len(allb) for nm in names):
            raise ValueError(f"pick must give a figure 1..{len(allb)} for each of {names}")
        boxes = [allb[pick[nm] - 1] for nm in names]
    else:
        if len(allb) != len(names):
            raise ValueError(f"{len(allb)} figures on the sheet for {len(names)} expressions: look at _{rid}_figures.jpg and set sheet.pick")
        boxes = allb
    cells = cells_of(img, boxes=boxes)
    base = cells[0]
    grid_image(base, out / f"_{rid}_grid.jpg")                       # measure the eyes / mouth on the neutral figure
    whole = sh.get("faces", "patch") == "whole"
    if not whole and not (sh.get("eyes") and sh.get("mouth")):
        raise ValueError(f"set sheet.eyes and sheet.mouth ([u0, v0, u1, v1] of the neutral figure; measure on _{rid}_grid.jpg)")
    aligned = [base] + [align(base, c)[0] for c in cells[1:]]
    region = [min(sh["eyes"][0], sh["mouth"][0]), sh["eyes"][1], max(sh["eyes"][2], sh["mouth"][2]), sh["mouth"][3]] if sh.get("eyes") and sh.get("mouth") else None
    save(base, out / f"{rid}.png")
    rel = lambda p: p.relative_to(ROOT).as_posix()
    anim: dict = {"whole": True} if whole else {}
    info = {"face": region, "cells": {}}
    for name, v in zip(names[1:], aligned[1:]):
        both = (base[..., 3] > 0.5) & (v[..., 3] > 0.5)
        err = float(np.abs(base[..., :3] - v[..., :3]).mean(axis=2)[both].mean()) if both.any() else 1.0
        role = ROLE.get(name)
        # whole: the aligned copy itself, swapped for the picture (no seams, but a copy is redrawn: only for copies that
        # match outside the face). patch (default): a blink takes the eye area, a mouth the mouth area
        p = v if whole else paste_of(base, v, [sh["eyes"]] if role == "blink" else [sh["mouth"]] if role == "mouth" else [sh["eyes"], sh["mouth"]])
        frac = float((p[..., 3] > 0.5).mean())
        dst = out / f"{rid}_{name}.png"; save(p, dst)
        info["cells"][name] = {"colour_err": round(err, 4), "changed": round(frac, 4), "outside_face": round(drift(base, v, region), 4) if region else None}
        if role == "blink":
            anim["blink"] = rel(dst)
        elif role == "mouth":
            anim.setdefault("mouth", []).append(rel(dst))
        else:
            anim.setdefault("expr", {})[name] = rel(dst)
    if len(anim.get("mouth", [])) == 1:
        anim["mouth"] = anim["mouth"][0]
    snippet = {"img": rel(out / f"{rid}.png"), "anim": anim}
    (out / f"{rid}.anim.json").write_text(json.dumps(snippet, indent=2), encoding="utf-8")
    info["snippet"] = rel(out / f"{rid}.anim.json")
    return info

# ------------------------------------------------------------------ post / status / sheets
def cmd_post(table: Path) -> int:
    t = load(table)
    report, bad = {}, 0
    for r in t["rows"]:
        raw, fin = raw_path(t, r["id"]), final_path(t, r["id"])
        takes = sorted(raw.parent.glob(f"{r['id']}__t*.png")) if r.get("variant_of") else []
        takes = [p for p in takes if not p.name.endswith(".raw.png")]
        if takes and final_path(t, r["variant_of"]).is_file():        # pick the take that changed least outside its region
            b = _rgba(final_path(t, r["variant_of"]))
            if r.get("ref_mode") == "inpaint" and r.get("region"):     # outside is the base anyway: keep the take that changed most inside (change, not closed eyes: see the takes sheet)
                def inside(p):
                    v = np.asarray(Image.open(p).convert("RGBA").resize((b.shape[1], b.shape[0]), Image.LANCZOS), np.float32) / 255
                    return -feather_in(b, np.dstack([v[..., :3], np.ones(v.shape[:2], np.float32)]), r["region"])[1]
                scored = sorted((inside(p), p) for p in takes)
            else:
                scored = sorted((drift(b, align(b, _rgba(p))[0], r.get("region")), p) for p in takes)
            raw = pick_take(scored, r.get("take"))
            print(f"  {r['id']}: takes " + ", ".join(f"{p.stem.split('__')[-1]} {d:.4f}" for d, p in scored) + f" -> {raw.stem.split('__')[-1]}"
                  + (" (row's take)" if r.get("take") else ""))
            if r.get("region"):
                takes_sheet(t, r, b, takes, raw)
        if not raw.is_file():
            continue
        if r.get("sheet"):                                            # one image, several expressions: split and align
            try:
                info = split_sheet(t, r, raw)
            except ValueError as e:
                info = {"refused": str(e)}
            report[r["id"]] = info
            if info.get("refused"):
                bad += 1; print(f"  REFUSED {r['id']}: {info['refused']}")
            else:
                print(f"  {r['id']}: sheet -> {', '.join(r['sheet']['cells'])}; face {info['face']}; " + ", ".join(f"{k} drift {v['outside_face']}" for k, v in info["cells"].items()) + f"; anim snippet {info['snippet']}")
            continue
        if not r.get("variant_of"):
            if not fin.is_file() or fin.stat().st_mtime < raw.stat().st_mtime:
                fin.parent.mkdir(parents=True, exist_ok=True); fin.write_bytes(raw.read_bytes())
            continue
        base = final_path(t, r["variant_of"])
        if not base.is_file():
            continue
        info = do_align(base, raw, fin, r.get("mode", "patch"), r.get("region"), inpaint=r.get("ref_mode") == "inpaint")
        report[r["id"]] = info
        if info.get("refused"):
            bad += 1
            print(f"  REFUSED {r['id']}: {info['refused']}")
        else:
            print(f"  {r['id']}: {info['mode']} scale {info['scale']} offset ({info['dx']}, {info['dy']}) err {info['colour_err']}" + (f" changed {info['changed']:.1%}" if 'changed' in info else ""))
    out = rp(t.get("out", "assets/gen"))
    (out / "variants.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    sheets(t)
    return 1 if bad else 0


def pick_take(scored, take=None):
    """scored [(score, path)] best first -> the path to keep: the row's "take": k when given, else the best score."""
    if take:
        hit = [q for _, q in scored if q.stem.endswith(f"__t{int(take)}")]
        if not hit:
            sys.exit(f"take {take} not found among {', '.join(q.name for _, q in scored)}")
        return hit[0]
    return scored[0][1]


def takes_sheet(t: dict, r: dict, base: np.ndarray, takes: list, chosen: Path) -> Path:
    """The region (with a margin) from the base and from every take side by side, for picking with the eyes."""
    H, W = base.shape[:2]
    u0, v0, u1, v1 = r["region"]
    mu, mv = (u1 - u0) * 0.5, (v1 - v0) * 0.5
    box = (int(max(0, u0 - mu) * W), int(max(0, v0 - mv) * H), int(min(1, u1 + mu) * W), int(min(1, v1 + mv) * H))
    grey = Image.new("RGBA", (W, H), (128, 128, 128, 255))
    tiles = [("base", Image.alpha_composite(grey, Image.fromarray((base * 255).astype(np.uint8), "RGBA")))]
    tiles += [(q.stem.split("__")[-1] + (" kept" if q == chosen else ""), Image.alpha_composite(grey, Image.open(q).convert("RGBA").resize((W, H), Image.LANCZOS)))
              for q in takes]
    th = 256
    tw = max(1, round(th * (box[2] - box[0]) / max(1, box[3] - box[1])))
    sheet = Image.new("RGB", (len(tiles) * (tw + 8) + 8, th + 40), (236, 232, 224))
    dr = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 18)
    except OSError:
        font = ImageFont.load_default()
    for i, (name, im) in enumerate(tiles):
        sheet.paste(im.crop(box).convert("RGB").resize((tw, th), Image.LANCZOS), (8 + i * (tw + 8), 8))
        dr.text((10 + i * (tw + 8), th + 14), name, fill=(40, 34, 51), font=font)
    out = rp(t.get("out", "assets/gen")) / f"_review_{r['id']}_takes.jpg"
    sheet.save(out, quality=90)
    print(f"  takes sheet: {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}")
    return out


def sheets(t: dict) -> None:
    out = rp(t.get("out", "assets/gen"))
    cats: dict[str, list[dict]] = {}
    for r in t["rows"]:
        if final_path(t, r["id"]).is_file():
            cats.setdefault(category(r["id"]), []).append(r)
    try:
        font = ImageFont.truetype("arial.ttf", 18)
    except OSError:
        font = ImageFont.load_default()
    for cat, rows in cats.items():
        cols, tw, th = 6, 300, 340
        n = len(rows); sheet = Image.new("RGB", (cols * tw, ((n + cols - 1) // cols) * th), (236, 232, 224))
        dr = ImageDraw.Draw(sheet)
        for i, r in enumerate(rows):
            im = Image.open(final_path(t, r["id"])).convert("RGBA")
            if r.get("variant_of") and r.get("mode", "patch") == "patch":     # show a patch over its base
                b = Image.open(final_path(t, r["variant_of"])).convert("RGBA")
                b.alpha_composite(im.resize(b.size)); im = b
            im.thumbnail((tw - 16, th - 40))
            x, y = (i % cols) * tw, (i // cols) * th
            checker = Image.new("RGBA", im.size, (200, 200, 200, 255))
            for cy in range(0, im.size[1], 16):
                for cx in range(0, im.size[0], 16):
                    if (cx // 16 + cy // 16) % 2:
                        checker.paste((235, 235, 235, 255), (cx, cy, cx + 16, cy + 16))
            checker.alpha_composite(im)
            sheet.paste(checker.convert("RGB"), (x + 8 + (tw - 16 - im.size[0]) // 2, y + 8))
            dr.text((x + 10, y + th - 28), r["id"] + (f"  <- {r['variant_of']}" if r.get("variant_of") else ""), fill=(40, 34, 51), font=font)
        p = out / f"_review_{cat}.jpg"
        sheet.save(p, quality=90)
        print(f"  review sheet: {p.relative_to(ROOT)} ({n})")


def cmd_status(table: Path) -> int:
    t = load(table)
    rep = json.loads((rp(t.get("out", "assets/gen")) / "variants.json").read_text(encoding="utf-8")) if (rp(t.get("out", "assets/gen")) / "variants.json").is_file() else {}
    todo = 0
    for r in t["rows"]:
        st = "final" if final_path(t, r["id"]).is_file() else "raw" if raw_path(t, r["id"]).is_file() else "missing"
        if rep.get(r["id"], {}).get("refused"):
            st = "REFUSED"
        todo += st != "final"
        print(f"  {r['id']:<14} {category(r['id']):<5} {st}")
    print(f"{len(t['rows']) - todo}/{len(t['rows'])} final")
    return 0


def selftest() -> int:
    from scipy import ndimage
    rng = np.random.default_rng(3)
    H, W = 300, 200
    base = np.zeros((H, W, 4), np.float32)
    yy, xx = np.mgrid[0:H, 0:W]
    body = ((xx - 100) / 60) ** 2 + ((yy - 170) / 110) ** 2 < 1
    head = ((xx - 100) / 45) ** 2 + ((yy - 70) / 45) ** 2 < 1
    base[body | head] = [0.9, 0.6, 0.5, 1]
    base[..., :3] += ndimage.gaussian_filter(rng.random((H, W)), 4)[..., None] * 0.3 * (body | head)[..., None]
    for ex in (85, 115):                                               # open eyes
        base[(((xx - ex) / 5) ** 2 + ((yy - 70) / 8) ** 2 < 1)] = [0.1, 0.1, 0.15, 1]
    var = base.copy()
    for ex in (85, 115):                                               # closed eyes: skin, then a line
        var[(((xx - ex) / 6) ** 2 + ((yy - 70) / 9) ** 2 < 1)] = base[70, 100]
        var[(abs(yy - 72) < 1.5) & (abs(xx - ex) < 6)] = [0.1, 0.1, 0.15, 1]
    gen = place(var, H, W, 1.04, 7, -5)                                # the generator moved and scaled it a little
    gen = np.asarray(Image.fromarray((gen * 255).astype(np.uint8), "RGBA").resize((220, 330)), dtype=np.float32) / 255
    v, info = align(base, gen)
    bad = 0
    if info["colour_err"] > 0.08 or info["shape_iou"] < 0.9:
        print("FAIL align:", info); bad += 1
    p, frac = patch_of(base, v, (0.3, 0.15, 0.7, 0.35))
    ys, xs = np.nonzero(p[..., 3] > 0.5)
    if not len(ys) or ys.min() < 50 or ys.max() > 95 or frac > 0.05:
        print("FAIL patch region:", (ys.min() if len(ys) else None, ys.max() if len(ys) else None, frac)); bad += 1
    # an expression sheet: 2 x 2 copies, each a few px off the grid; split, align, find the face (the eyes)
    sheet = np.zeros((2 * H + 40, 2 * W + 40, 4), np.float32)
    for k, (img, ox, oy) in enumerate([(base, 0, 0), (var, 3, -2), (var, -2, 4), (base, 1, 1)]):
        y0, x0 = (k // 2) * (H + 40) + 20 + oy, (k % 2) * (W + 40) + 20 + ox
        sheet[max(0, y0):y0 + H, max(0, x0):x0 + W] = img[max(0, -y0):, max(0, -x0):][:sheet.shape[0] - max(0, y0), :sheet.shape[1] - max(0, x0)]
    cells = cells_of(sheet, 4)
    if len(figures(sheet)) != 4:
        print("FAIL sheet: expected 4 figures"); bad += 1
    touch = sheet.copy()                                              # a bar through each row joins its two figures
    for yc in (20 + H // 2, H + 60 + H // 2):
        touch[yc - 4:yc + 4, :, 3] = 1.0
    if len(figures(touch)) >= 4 or len(grid_figures(touch, 2, 2)) != 4:
        print("FAIL sheet: touching figures are not recovered from the grid"); bad += 1
    al = [cells[0]] + [align(cells[0], c)[0] for c in cells[1:3]]
    reg = face_region(cells[0], al[1:])
    ch, cw = cells[0].shape[:2]
    eye_v, eye_u = (70 + (ch - H) / 2) / ch, (100 + (cw - W) / 2) / cw
    if not (reg[0] < eye_u < reg[2] and reg[1] < eye_v < reg[3]) or (reg[3] - reg[1]) > 0.4:
        print("FAIL sheet face region:", reg, (eye_u, eye_v)); bad += 1
    tb = {"locks": {"STYLE": "s", "CHAR": "front", "CHAR_BACK": "back", "WORLD": "w"}, "rows": [
        {"id": "CH01", "kind": "char"}, {"id": "CH02", "kind": "char", "locks": ["STYLE", "CHAR_BACK"]}, {"id": "BG01", "kind": "world"}]}
    if [char_of(tb, r) for r in tb["rows"]] != ["front", "back", None] or "front" in prompt_of(tb, dict(tb["rows"][1], subject="x")):
        print("FAIL character caption / CHAR_BACK lock"); bad += 1
    tv = {"locks": {"STYLE": "s", "CHAR": "1girl, white bob hair, blunt bangs, red eyes, black jacket"},
          "rows": [{"id": "CH05", "kind": "char", "view": "back", "subject": "full body"}]}
    pb = prompt_of(tv, tv["rows"][0])
    if "eyes" in pb or "bangs" in pb or "black jacket" not in pb or "seen from behind" not in pb \
            or char_of(tv, tv["rows"][0]) != "1girl, white bob hair, black jacket":
        print("FAIL automatic back view:", pb); bad += 1
    sc = [(-0.3, Path("CH01_blink__t2.png")), (-0.1, Path("CH01_blink__t1.png"))]
    if pick_take(sc).name != "CH01_blink__t2.png" or pick_take(sc, 1).name != "CH01_blink__t1.png":
        print("FAIL take pick / the row's take"); bad += 1
    print("align:", info, f"patch {frac:.2%} of the canvas; sheet face region {reg}")
    print("gen_table self-test: " + ("ok" if not bad else f"{bad} failed"))
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    j = sub.add_parser("jobs"); j.add_argument("table"); j.add_argument("--pass", dest="pass_", choices=["base", "variants"], default="base"); j.add_argument("--out")
    for name in ("post", "status"):
        sub.add_parser(name).add_argument("table")
    a = sub.add_parser("align"); a.add_argument("base"); a.add_argument("variant"); a.add_argument("out")
    a.add_argument("--mode", choices=["patch", "full"], default="patch"); a.add_argument("--region", help="u0,v0,u1,v1 (0..1 of the base)")
    sub.add_parser("selftest")
    a = ap.parse_args()
    if a.cmd == "jobs":
        return cmd_jobs(rp(a.table), a.pass_, rp(a.out) if a.out else None)
    if a.cmd == "post":
        return cmd_post(rp(a.table))
    if a.cmd == "status":
        return cmd_status(rp(a.table))
    if a.cmd == "align":
        info = do_align(rp(a.base), rp(a.variant), rp(a.out), a.mode, [float(x) for x in a.region.split(",")] if a.region else None)
        print(json.dumps(info))
        return 1 if info.get("refused") else 0
    return selftest()


if __name__ == "__main__":
    raise SystemExit(main())
