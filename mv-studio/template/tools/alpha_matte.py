#!/usr/bin/env python3
"""Alpha-matte utilities for generated illustration assets (characters / props on a flat key colour).

Used by tools/imagegen.py, but also usable standalone:

  python tools/alpha_matte.py check  IMG [IMG ...]          # alpha / halo report (JSON)
  python tools/alpha_matte.py key    IN OUT [--key auto|#00ff00|#ffffff] [--band 3] [--feather 0.6] [--seal 2]
  python tools/alpha_matte.py redraw ORIG REDRAW OUT        # cut ORIG out with the mask of a green REDRAW of it
  python tools/alpha_matte.py trim   IN OUT [--margin 24] [--pad-square]
  python tools/alpha_matte.py preview IN OUT                 # composite over checker/black/white/orange
  python tools/alpha_matte.py tile   IN OUT [--blend 0.25]   # make a texture seamlessly tileable
  python tools/alpha_matte.py <command> --help               # options of one command

Keying method (flat-colour anime art on a solid key colour):
  1. key colour = median of the image border (or given).
  2. hard background = pixels within `tol_bg` of the key.  For non-chroma keys (white/grey)
     only regions connected to the image border (plus big enclosed holes) count as background,
     so eye whites / cream clothes are not punched out.
  3. an edge band (`band` px) around the background is solved per-pixel with the
     two-colour model  C = a*F + (1-a)*K  where F is the colour of the nearest solid
     foreground pixel (distance transform).  a = <C-K, F-K> / |F-K|^2.
  4. colours in the band are un-mixed (F' = K + (C-K)/a), key spill is clamped near the edge only
     (G <= max(R,B) for green keys; magenta: R,B lowered by min(R,B) - G), so teal / mint
     clothes and skin tones keep their colour inside the subject; alpha is optionally contracted/feathered.
  Chroma key choice: green unless the design has teal / aqua / mint / green (G > max(R,B)) -- those
  are partly keyed by a green screen: use magenta (#FF00FF; tools/imagegen.py job field "key").
  Light-on-light (white clothes on a white sheet): `--seal R` grows the background from the border only through
  openings at least 2R+1 px wide, so it cannot leak through small gaps in the line art into the clothes, and
  enclosed light areas are kept (pass --holes-min-area for real holes, e.g. between an arm and the body).
  Redraw mask (the better route when the subject is light-on-light or the art has a painted background): ask the
  generator to redraw the SAME picture on flat green, key the redraw, and use only its alpha on the ORIGINAL pixels
  (faces and line art stay exact). `redraw` checks the two images line up and refuses a mask that does not fit.
  5. transparent pixels get the nearest foreground colour (colour bleed) so GPU/canvas
     bilinear filtering never pulls key colour or black into the edges.

Author: NikusonP -- vocaloid-style-mv-pipeline, MIT licence.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

# ----------------------------------------------------------------------------------------
# analysis
# ----------------------------------------------------------------------------------------


def border_pixels(rgb: np.ndarray, band: int = 6) -> np.ndarray:
    h, w = rgb.shape[:2]
    b = max(1, min(band, h // 4, w // 4))
    parts = [rgb[:b].reshape(-1, 3), rgb[-b:].reshape(-1, 3), rgb[:, :b].reshape(-1, 3), rgb[:, -b:].reshape(-1, 3)]
    return np.concatenate(parts, axis=0)


def estimate_key(rgb: np.ndarray) -> tuple[np.ndarray, float]:
    """Median border colour and the fraction of border pixels within 40 of it (uniformity)."""
    px = border_pixels(rgb).astype(np.float32)
    key = np.median(px, axis=0)
    dist = np.abs(px - key).max(axis=1)
    return key, float((dist < 40).mean())


def detect_checkerboard(rgb: np.ndarray) -> bool:
    """Heuristic: border made of two light near-grey colours alternating in blocks (fake transparency)."""
    px = border_pixels(rgb, 4).astype(np.float32)
    lum = px.mean(axis=1)
    sat = px.max(axis=1) - px.min(axis=1)
    if (sat < 12).mean() < 0.85 or lum.mean() < 150:
        return False
    hi = lum > np.median(lum) + 6
    lo = lum < np.median(lum) - 6
    # two clusters each covering a decent share and separated by 10..80 levels
    if hi.mean() < 0.15 and lo.mean() < 0.15:
        return False
    top = rgb[:4].mean(axis=(0, 2))
    changes = np.abs(np.diff(top)) > 8
    return int(changes.sum()) >= 6


def is_chroma(key: np.ndarray) -> bool:
    """Key colour is saturated enough for colour-difference keying (green/blue/magenta screens)."""
    return float(key.max() - key.min()) > 90


def alpha_report(img: Image.Image) -> dict:
    """Quality metrics for an RGBA asset."""
    info: dict = {"size": list(img.size), "mode": img.mode}
    if img.mode not in ("RGBA", "LA", "PA") and not (img.mode == "P" and "transparency" in img.info):
        rgb = np.asarray(img.convert("RGB"))
        key, uni = estimate_key(rgb)
        info.update(
            has_alpha=False,
            border_key=[int(v) for v in key],
            border_uniformity=round(uni, 3),
            checkerboard=detect_checkerboard(rgb),
        )
        return info
    rgba = np.asarray(img.convert("RGBA")).astype(np.float32)
    a = rgba[..., 3]
    n = a.size
    transparent = float((a == 0).mean())
    opaque = float((a == 255).mean())
    partial_mask = (a > 0) & (a < 255)
    info.update(
        has_alpha=True,
        transparent_pct=round(100 * transparent, 2),
        opaque_pct=round(100 * opaque, 2),
        partial_pct=round(100 * float(partial_mask.mean()), 2),
    )
    vis = a > 8
    if vis.any():
        ys, xs = np.nonzero(vis)
        info["bbox"] = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
        h, w = a.shape
        info["touches_edge"] = bool(xs.min() == 0 or ys.min() == 0 or xs.max() == w - 1 or ys.max() == h - 1)
    # halo metrics: edge pixels (partial alpha, or opaque pixels touching transparent ones)
    edge = partial_mask | (ndi.binary_dilation(a == 0, iterations=1) & (a > 0))
    if edge.any():
        rgb = rgba[..., :3]
        e = rgb[edge]
        g_excess = e[:, 1] - np.maximum(e[:, 0], e[:, 2])
        lum = e.mean(axis=1)
        # interior reference: opaque pixels 3..6 px inside the edge
        inner = ndi.binary_erosion(a == 255, iterations=3) & ~ndi.binary_erosion(a == 255, iterations=6)
        inner_lum = float(rgb[inner].mean()) if inner.any() else float(lum.mean())
        info["edge_px"] = int(edge.sum())
        info["edge_green_spill_pct"] = round(100 * float((g_excess > 25).mean()), 2)
        info["edge_mean_lum"] = round(float(lum.mean()), 1)
        info["inner_ring_mean_lum"] = round(inner_lum, 1)
        # bright fringe = edge pixels much brighter than line-art interior -> white halo
        info["edge_bright_halo_pct"] = round(100 * float((lum > 200).mean()), 2)
    # isolated specks: small visible components far from the main subject
    lab, count = ndi.label(vis)
    if count:
        sizes = ndi.sum(vis, lab, index=np.arange(1, count + 1))
        info["components"] = int(count)
        info["largest_component_pct"] = round(100 * float(sizes.max() / max(1, vis.sum())), 2)
        info["tiny_specks"] = int((sizes < 20).sum())
    return info


# ----------------------------------------------------------------------------------------
# keying
# ----------------------------------------------------------------------------------------


def _nearest_fill(values: np.ndarray, known: np.ndarray) -> np.ndarray:
    """For every pixel, the value of the nearest pixel where `known` is True."""
    if not known.any():
        return values.copy()
    _, (iy, ix) = ndi.distance_transform_edt(~known, return_indices=True)
    return values[iy, ix]


def key_out(
    img: Image.Image,
    key: str | tuple | None = "auto",
    *,
    tol_bg: float | None = None,
    tol_fg: float | None = None,
    band: int = 3,
    contract: int = 0,
    feather: float = 0.6,
    despill: bool = True,
    holes_min_area: int | None = None,
    min_speck_area: int = 24,
    bleed: bool = True,
    seal: int = 0,
) -> tuple[Image.Image, dict]:
    """Turn a solid-colour-background image into a clean RGBA cut-out.

    key: "auto" (border median) | "#rrggbb" | (r,g,b)
    tol_bg: max channel distance counted as hard background (default 60 chroma / 22 neutral)
    tol_fg: distance beyond which a pixel is certainly foreground (default 150 chroma / 90 neutral)
    band: width in px of the soft edge band solved with the two-colour model
    holes_min_area: enclosed (not border connected) key-coloured regions larger than this
                    are also removed. Default: 16 for chroma keys, 1500 for neutral keys (none with seal).
    seal: neutral keys only: the background cannot pass openings narrower than 2*seal+1 px (light-on-light subjects).
    """
    rgb8 = np.asarray(img.convert("RGB"))
    src_alpha = np.asarray(img.convert("RGBA"))[..., 3].astype(np.float32) / 255.0 if img.mode == "RGBA" else None
    C = rgb8.astype(np.float32)
    h, w = C.shape[:2]
    if key in (None, "auto"):
        K, uniformity = estimate_key(rgb8)
    else:
        if isinstance(key, str):
            s = key.lstrip("#")
            K = np.array([int(s[i : i + 2], 16) for i in (0, 2, 4)], np.float32)
        else:
            K = np.array(key, np.float32)
        uniformity = None
    chroma = is_chroma(K)
    if tol_bg is None:
        tol_bg = 60.0 if chroma else 22.0
    if tol_fg is None:
        tol_fg = 150.0 if chroma else 90.0
    if holes_min_area is None:
        holes_min_area = 16 if chroma else 10 ** 9 if seal else 1500

    diff = C - K
    dist = np.abs(diff).max(axis=2)
    if chroma:
        return _key_chroma(rgb8, C, K, src_alpha, tol_bg=tol_bg, despill=despill, contract=contract,
                           feather=feather, min_speck_area=min_speck_area, bleed=bleed, uniformity=uniformity)
    if chroma:
        # colour-difference measure: how "key-like" the hue is, robust to shading of the screen
        kc = int(np.argmax(K))
        others = [i for i in range(3) if i != kc]
        excess = C[..., kc] - C[..., others].max(axis=2)
        k_excess = float(K[kc] - K[others].max())
        keyness = np.clip(excess / max(k_excess, 1.0), 0, 1)
        bg_cand = (dist < tol_bg) | (keyness > 0.80)
    else:
        bg_cand = dist < tol_bg
    reach = bg_cand
    if seal and not chroma:
        # the border region grows only through the OPENED candidate (gaps narrower than 2*seal+1 px are cut); the edge
        # pixels the opening took are given back next to that region only, so nothing leaks through a gap
        st8 = ndi.generate_binary_structure(2, 2)
        lab0, _ = ndi.label(ndi.binary_opening(bg_cand, structure=st8, iterations=seal))
        b0 = np.unique(np.concatenate([lab0[0], lab0[-1], lab0[:, 0], lab0[:, -1]]))
        reach = ndi.binary_dilation(np.isin(lab0, b0[b0 > 0]), structure=st8, iterations=seal) & bg_cand
    # connectivity: keep border-connected background + big enclosed holes
    lab, n = ndi.label(bg_cand)
    if n:
        border_labels = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
        border_labels = border_labels[border_labels > 0]
    if n and reach is not bg_cand:
        # the reached part of each border-connected label is background; the rest of that label is subject
        lab = np.where(reach | ~np.isin(lab, border_labels), lab, 0)
        lab, n = ndi.label(lab > 0)
        border_labels = np.unique(lab[reach])
        border_labels = border_labels[border_labels > 0]
        bg_cand = lab > 0
        sizes = ndi.sum(bg_cand, lab, index=np.arange(1, n + 1))
        keep = np.zeros(n + 1, bool)
        keep[border_labels] = True
        keep[1:][sizes >= holes_min_area] = True
        bg = keep[lab]
    else:
        bg = bg_cand
    # remove foreground specks (isolated noise islands inside background)
    fg_all = ~bg
    lab2, n2 = ndi.label(fg_all)
    if n2 > 1 and min_speck_area > 0:
        sizes2 = ndi.sum(fg_all, lab2, index=np.arange(1, n2 + 1))
        small = np.zeros(n2 + 1, bool)
        small[1:] = sizes2 < min_speck_area
        bg |= small[lab2]

    near_bg = ndi.binary_dilation(bg, iterations=max(1, band)) & ~bg
    fg_core = ~bg & ~near_bg
    # a band pixel that is clearly far from the key is solid foreground
    solid = near_bg & (dist >= tol_fg)
    if chroma:
        solid &= keyness < 0.05
    fg_core |= solid
    band_px = near_bg & ~solid

    alpha = np.ones((h, w), np.float32)
    alpha[bg] = 0.0
    F = _nearest_fill(C, fg_core)  # nearest solid foreground colour
    if band_px.any():
        c = C[band_px]
        f = F[band_px]
        fk = f - K
        denom = (fk * fk).sum(axis=1)
        a_proj = ((c - K) * fk).sum(axis=1) / np.maximum(denom, 1.0)
        a_proj = np.where(denom < 30.0 ** 2, 1.0, a_proj)  # fg too close to key -> keep opaque
        if chroma:
            # colour-difference alpha is more reliable for chroma screens; take the stricter
            a_cd = 1.0 - keyness[band_px]
            a_proj = np.minimum(a_proj, np.maximum(a_cd, 0.0) * 1.0 + 0.0)
        a_proj = np.clip(a_proj, 0.0, 1.0)
        a_proj[a_proj < 0.04] = 0.0
        a_proj[a_proj > 0.96] = 1.0
        alpha[band_px] = a_proj
        # un-mix colour: C = a F' + (1-a) K  ->  F' = K + (C-K)/a ; fall back to nearest F when a small
        a_safe = np.maximum(a_proj, 1e-3)[:, None]
        unmixed = K + (c - K) / a_safe
        wgt = np.clip((a_proj - 0.15) / 0.5, 0, 1)[:, None]
        newc = wgt * unmixed + (1 - wgt) * f
        C = C.copy()
        C[band_px] = np.clip(newc, 0, 255)

    if chroma and despill:
        kc = int(np.argmax(K))
        others = [i for i in range(3) if i != kc]
        cap = C[..., others].max(axis=2)
        spill_zone = ndi.binary_dilation(bg, iterations=band + 2)
        over = spill_zone & (C[..., kc] > cap)
        C[..., kc] = np.where(over, cap, C[..., kc])

    if contract > 0:
        alpha = ndi.grey_erosion(alpha, size=(2 * contract + 1, 2 * contract + 1))
    if feather > 0:
        zone = ndi.binary_dilation(bg, iterations=band + 2) & ndi.binary_dilation(~bg, iterations=band + 2)
        blurred = ndi.gaussian_filter(alpha, feather)
        alpha = np.where(zone, np.minimum(alpha, blurred) if contract == 0 else blurred, alpha)
        alpha = np.where(bg & ~ndi.binary_dilation(~bg, iterations=2), 0.0, alpha)
    if src_alpha is not None:
        alpha = alpha * src_alpha

    alpha8 = np.clip(np.round(alpha * 255), 0, 255).astype(np.uint8)
    alpha8[alpha8 <= 3] = 0
    if bleed:
        C = np.where((alpha8 == 0)[..., None], _nearest_fill(C, alpha8 > 200), C)
    out = np.dstack([np.clip(np.round(C), 0, 255).astype(np.uint8), alpha8])
    stats = {
        "key": [int(round(v)) for v in K],
        "key_uniformity": None if uniformity is None else round(uniformity, 3),
        "chroma": bool(chroma),
        "bg_pct": round(100 * float(bg.mean()), 2),
        "band_px": int(band_px.sum()),
    }
    return Image.fromarray(out, "RGBA"), stats


def _key_chroma(rgb8, C, K, src_alpha, *, tol_bg, despill, contract, feather, min_speck_area, bleed,
                uniformity, k_lo: float = 0.12, k_hi: float = 0.88):
    """Global colour-difference key for saturated screens (green / blue / magenta).

    keyness = (C[key] - max(C[others])) / (K[key] - max(K[others]))   -> 0 for neutral / non-key hues
    alpha   = 1 - smoothramp(keyness, k_lo, k_hi)
    colour  = (C - (1-a) K) / a   (un-premultiply the screen out), then despill the key channel(s) in the edge band.
    Handles green pockets between hair strands that are not connected to the border.
    """
    h, w = C.shape[:2]
    order = np.argsort(K)[::-1]
    kc = int(order[0])
    # magenta-like keys have two strong channels; treat the pair as the key "channel"
    two = K[order[1]] > 0.6 * K[order[0]]
    if two:
        kcs = [int(order[0]), int(order[1])]
        oth = [int(order[2])]
        strength = C[..., kcs].min(axis=2)
        k_strength = float(K[kcs].min())
    else:
        kcs = [kc]
        oth = [i for i in range(3) if i != kc]
        strength = C[..., kc]
        k_strength = float(K[kc])
    excess = strength - C[..., oth].max(axis=2)
    k_excess = max(1.0, k_strength - float(K[oth].max()))
    keyness = np.clip(excess / k_excess, 0, 1)
    t = np.clip((keyness - k_lo) / (k_hi - k_lo), 0, 1)
    alpha = 1.0 - t
    dist = np.abs(C - K).max(axis=2)
    alpha[dist < tol_bg] = 0.0
    # remove isolated specks (noise islands in the screen)
    vis = alpha > 0.5
    lab, n = ndi.label(vis)
    if n > 1 and min_speck_area > 0:
        sizes = ndi.sum(vis, lab, index=np.arange(1, n + 1))
        small = np.zeros(n + 1, bool)
        small[1:] = sizes < min_speck_area
        alpha[small[lab]] = 0.0
    # un-premultiply the key colour out of semi-transparent pixels
    a3 = alpha[..., None]
    F = np.where(a3 > 0.02, (C - (1.0 - a3) * K) / np.maximum(a3, 0.02), C)
    F = np.clip(F, 0, 255)
    if despill:
        # clamp only where the screen can spill: the soft edge band plus a few pixels inside it.
        # A global clamp turns teal / mint (green key) and every skin tone (magenta key: R clamped to G) grey.
        cap = F[..., oth].max(axis=2)
        zone = ndi.binary_dilation(alpha < 0.98, iterations=4)
        if len(kcs) == 2:   # magenta-like screen: spill = what the pair has in common above the third channel
            spill = np.clip(F[..., kcs].min(axis=2) - cap, 0, None) * zone
            for ch in kcs:
                F[..., ch] = F[..., ch] - spill
        else:
            F[..., kcs[0]] = np.where(zone, np.minimum(F[..., kcs[0]], cap), F[..., kcs[0]])
    if contract > 0:
        alpha = ndi.grey_erosion(alpha, size=(2 * contract + 1, 2 * contract + 1))
    if feather > 0:
        edge = ndi.binary_dilation((alpha > 0) & (alpha < 1), iterations=1) | (
            ndi.binary_dilation(alpha == 0, iterations=1) & (alpha > 0))
        blurred = ndi.gaussian_filter(alpha, feather)
        alpha = np.where(edge, np.minimum(alpha, blurred), alpha)
    if src_alpha is not None:
        alpha = alpha * src_alpha
    alpha8 = np.clip(np.round(alpha * 255), 0, 255).astype(np.uint8)
    alpha8[alpha8 <= 3] = 0
    if bleed:
        F = np.where((alpha8 == 0)[..., None], _nearest_fill(F, alpha8 > 200), F)
    out = np.dstack([np.clip(np.round(F), 0, 255).astype(np.uint8), alpha8])
    stats = {
        "key": [int(round(v)) for v in K],
        "key_uniformity": None if uniformity is None else round(uniformity, 3),
        "chroma": True,
        "method": "colour-difference",
        "bg_pct": round(100 * float((alpha8 == 0).mean()), 2),
    }
    return Image.fromarray(out, "RGBA"), stats


def normalize_alpha(img: Image.Image, floor: int = 3) -> tuple[Image.Image, dict]:
    """Fix native model alpha: the opaque body often tops out at 252-254 (1% see-through).

    Rescales alpha so the 99.5th percentile of the solid body becomes 255, zeroes alpha<=floor,
    and bleeds foreground colour into fully transparent pixels.
    """
    rgba = np.asarray(img.convert("RGBA")).astype(np.float32)
    a = rgba[..., 3]
    body = a[a > 128]
    info = {"alpha_max_before": int(a.max()) if a.size else 0}
    if body.size:
        p = float(np.percentile(body, 99.5))
        if 200 <= p < 255:
            a = np.clip(a * (255.0 / p), 0, 255)
            info["alpha_scale"] = round(255.0 / p, 4)
    a[a <= floor] = 0
    rgb = rgba[..., :3]
    rgb = np.where((a == 0)[..., None], _nearest_fill(rgb, a > 200), rgb)
    out = np.dstack([np.clip(np.round(rgb), 0, 255), np.round(a)]).astype(np.uint8)
    return Image.fromarray(out, "RGBA"), info


# ----------------------------------------------------------------------------------------
# geometry
# ----------------------------------------------------------------------------------------


def trim_to_content(img: Image.Image, margin: int = 24, threshold: int = 8, pad_square: bool = False,
                    pad_to: tuple[int, int] | None = None) -> tuple[Image.Image, list[int]]:
    """Crop an RGBA image to its visible bbox + margin (transparent padding added if needed)."""
    rgba = img.convert("RGBA")
    a = np.asarray(rgba)[..., 3]
    ys, xs = np.nonzero(a > threshold)
    if not len(xs):
        return rgba, [0, 0, rgba.width, rgba.height]
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    x0 -= margin; y0 -= margin; x1 += margin; y1 += margin
    if pad_square:
        side = max(x1 - x0, y1 - y0)
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        x0, x1 = cx - side // 2, cx - side // 2 + side
        y0, y1 = cy - side // 2, cy - side // 2 + side
    out = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
    out.paste(rgba.crop((max(0, x0), max(0, y0), min(rgba.width, x1), min(rgba.height, y1))),
              (max(0, -x0), max(0, -y0)))
    if pad_to:
        tw, th = pad_to
        scale = min(tw / out.width, th / out.height, 1.0)
        if scale < 1.0:
            out = out.resize((max(1, round(out.width * scale)), max(1, round(out.height * scale))), Image.LANCZOS)
        canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
        canvas.paste(out, ((tw - out.width) // 2, (th - out.height) // 2))
        out = canvas
    return out, [x0, y0, x1, y1]


def fit_size(img: Image.Image, size: tuple[int, int], mode: str = "cover") -> Image.Image:
    """Resize to an exact size. cover = fill + centre crop, contain = letterbox (transparent), stretch."""
    tw, th = size
    if mode == "stretch":
        return img.resize((tw, th), Image.LANCZOS)
    sw, sh = img.size
    scale = max(tw / sw, th / sh) if mode == "cover" else min(tw / sw, th / sh)
    nw, nh = max(1, round(sw * scale)), max(1, round(sh * scale))
    r = img.resize((nw, nh), Image.LANCZOS)
    if mode == "cover":
        l, t = (nw - tw) // 2, (nh - th) // 2
        return r.crop((l, t, l + tw, t + th))
    canvas = Image.new("RGBA" if img.mode == "RGBA" else "RGB", (tw, th), (0, 0, 0, 0) if img.mode == "RGBA" else (0, 0, 0))
    canvas.paste(r, ((tw - nw) // 2, (th - nh) // 2))
    return canvas


def make_tileable(img: Image.Image, blend: float = 0.25) -> Image.Image:
    """Cross-fade opposite edges (offset-and-blend) so a near-seamless texture tiles perfectly."""
    arr = np.asarray(img.convert("RGBA" if img.mode == "RGBA" else "RGB")).astype(np.float32)
    h, w = arr.shape[:2]
    shifted = np.roll(arr, (h // 2, w // 2), axis=(0, 1))
    # weight: 1 at centre of the original, 0 at its borders
    yy = np.minimum(np.arange(h), h - 1 - np.arange(h)) / (h * blend)
    xx = np.minimum(np.arange(w), w - 1 - np.arange(w)) / (w * blend)
    wgt = np.clip(np.minimum(yy[:, None], xx[None, :]), 0, 1)[..., None]
    out = arr * wgt + shifted * (1 - wgt)
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), img.mode if img.mode in ("RGB", "RGBA") else "RGB")


def seam_score(img: Image.Image) -> dict:
    """Mean abs difference across the wrap-around seams vs. typical neighbour difference (1.0 = seamless)."""
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    inner_h = np.abs(np.diff(a, axis=1)).mean()
    inner_v = np.abs(np.diff(a, axis=0)).mean()
    seam_h = np.abs(a[:, 0] - a[:, -1]).mean()
    seam_v = np.abs(a[0] - a[-1]).mean()
    return {"lr_seam_ratio": round(float(seam_h / max(inner_h, 1e-3)), 2),
            "tb_seam_ratio": round(float(seam_v / max(inner_v, 1e-3)), 2)}


def preview_sheet(img: Image.Image, out: Path, tile: int = 16) -> None:
    """Composite an RGBA image over checker / black / white / dusk-orange for eyeballing halos."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    scale = min(1.0, 700 / h)
    rgba = rgba.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    w, h = rgba.size
    backs = []
    yy, xx = np.mgrid[0:h, 0:w]
    chk = (((yy // tile) + (xx // tile)) % 2).astype(np.uint8)
    backs.append(Image.fromarray(np.dstack([200 + 55 * chk] * 3).astype(np.uint8), "RGB"))
    for col in [(0, 0, 0), (255, 255, 255), (232, 120, 60)]:
        backs.append(Image.new("RGB", (w, h), col))
    sheet = Image.new("RGB", (w * len(backs), h))
    for i, b in enumerate(backs):
        b = b.copy()
        b.paste(rgba, (0, 0), rgba)
        sheet.paste(b, (i * w, 0))
    sheet.save(out)


# ----------------------------------------------------------------------------------------
# CLI
def redraw_mask(orig: Image.Image, redraw: Image.Image, *, key: str = "auto", contract: int = 1, feather: float = 0.6,
                max_misfit: float = 0.12) -> tuple[Image.Image, dict]:
    """Cut ORIG out with the alpha of REDRAW (the generator's redraw of the same picture on a flat key colour).
    Only the mask comes from the redraw: every visible pixel is ORIG's. The redraw is resized to ORIG; `misfit` is the
    mean colour difference inside the mask's solid core (0-1): above max_misfit the redraw moved or changed the
    subject and the mask is refused (ValueError) -- redraw again, or key ORIG directly."""
    o = orig.convert("RGB")
    cut, st = key_out(redraw.convert("RGB").resize(o.size, Image.LANCZOS), key, contract=contract, feather=feather, bleed=False)
    a = np.asarray(cut)[..., 3]
    core = ndi.binary_erosion(a > 250, iterations=4)
    if core.sum() < 100:
        raise ValueError("the redraw has no solid subject after keying (is it on a flat key colour?)")
    O = np.asarray(o).astype(np.float32)
    misfit = float(np.abs(O[core] - np.asarray(cut)[..., :3][core].astype(np.float32)).mean() / 255)
    st.update({"misfit": round(misfit, 3), "size": list(o.size)})
    if misfit > max_misfit:
        raise ValueError(f"the redraw does not line up with the original (misfit {misfit:.3f} > {max_misfit}): "
                         "ask for the SAME picture, same framing, only the background replaced; or raise --max-misfit")
    rgb = np.where((a == 0)[..., None], _nearest_fill(O, a > 200), O)          # colour bleed, as key_out does
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), a]), "RGBA"), st


def selftest() -> None:
    """Light-on-light: a near-white disc with a gapped outline on white; and a redraw mask."""
    h = w = 120
    yy, xx = np.mgrid[:h, :w]
    r = np.hypot(yy - 60, xx - 60)
    img = np.full((h, w, 3), 255, np.uint8)
    img[r < 40] = 246                                       # white clothes
    img[(r >= 37) & (r < 40)] = 30                          # outline ...
    img[(r >= 37) & (r < 40) & (np.abs(yy - 60) <= 1) & (xx > 60)] = 255   # ... with a 3 px gap
    plain, _ = key_out(Image.fromarray(img), "#ffffff")
    sealed, _ = key_out(Image.fromarray(img), "#ffffff", seal=2)
    inside = r < 30
    assert np.asarray(plain)[..., 3][inside].mean() < 128, "the test gap should make the plain key leak"
    assert (np.asarray(sealed)[..., 3][inside] == 255).all(), "seal must keep the white clothes"
    assert (np.asarray(sealed)[..., 3][r > 44] == 0).all(), "seal must still clear the background"
    scene = np.dstack([(xx * 2).astype(np.uint8), (yy * 2).astype(np.uint8), np.full((h, w), 90, np.uint8)])
    scene[r < 40] = img[r < 40]                             # the subject on a painted background
    green = np.where((r < 40)[..., None], img, np.array([0, 255, 0], np.uint8)).astype(np.uint8)
    cut, st = redraw_mask(Image.fromarray(scene), Image.fromarray(green))
    c = np.asarray(cut)
    assert (c[..., 3][r > 44] == 0).all() and (c[..., 3][r < 36] == 255).all(), st
    assert (c[..., :3][r < 36] == scene[r < 36]).all(), "redraw must keep the original pixels"
    try:
        redraw_mask(Image.fromarray(scene), Image.fromarray(np.roll(green, 30, axis=1)))
        raise AssertionError("a shifted redraw must be refused")
    except ValueError:
        pass
    print("alpha_matte selftest: ok")

# ----------------------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check"); c.add_argument("images", nargs="+")
    k = sub.add_parser("key"); k.add_argument("inp"); k.add_argument("out")
    k.add_argument("--key", default="auto"); k.add_argument("--band", type=int, default=3)
    k.add_argument("--tol-bg", type=float); k.add_argument("--tol-fg", type=float)
    k.add_argument("--contract", type=int, default=0); k.add_argument("--feather", type=float, default=0.6)
    k.add_argument("--no-despill", action="store_true"); k.add_argument("--holes-min-area", type=int)
    k.add_argument("--seal", type=int, default=0, help="light-on-light: no leaks through gaps narrower than 2*SEAL+1 px")
    r = sub.add_parser("redraw", help="cut ORIG out with the mask of a flat-key REDRAW of it (original pixels kept)")
    r.add_argument("orig"); r.add_argument("redraw"); r.add_argument("out")
    r.add_argument("--key", default="auto"); r.add_argument("--contract", type=int, default=1)
    r.add_argument("--feather", type=float, default=0.6); r.add_argument("--max-misfit", type=float, default=0.12)
    sub.add_parser("selftest")
    t = sub.add_parser("trim"); t.add_argument("inp"); t.add_argument("out")
    t.add_argument("--margin", type=int, default=24); t.add_argument("--pad-square", action="store_true")
    v = sub.add_parser("preview"); v.add_argument("inp"); v.add_argument("out")
    s = sub.add_parser("tile"); s.add_argument("inp"); s.add_argument("out"); s.add_argument("--blend", type=float, default=0.25)
    args = p.parse_args(argv)
    if args.cmd == "check":
        for f in args.images:
            print(json.dumps({"file": f, **alpha_report(Image.open(f))}, ensure_ascii=False))
    elif args.cmd == "key":
        out, stats = key_out(Image.open(args.inp), args.key, tol_bg=args.tol_bg, tol_fg=args.tol_fg, band=args.band,
                             contract=args.contract, feather=args.feather, despill=not args.no_despill,
                             holes_min_area=args.holes_min_area, seal=args.seal)
        out.save(args.out)
        print(json.dumps({"out": args.out, **stats, **alpha_report(out)}))
    elif args.cmd == "redraw":
        try:
            out, stats = redraw_mask(Image.open(args.orig), Image.open(args.redraw), key=args.key, contract=args.contract,
                                     feather=args.feather, max_misfit=args.max_misfit)
        except ValueError as e:
            print(f"[redraw] {e}", file=sys.stderr)
            return 1
        out.save(args.out)
        print(json.dumps({"out": args.out, **stats, **alpha_report(out)}))
    elif args.cmd == "selftest":
        selftest()
    elif args.cmd == "trim":
        out, box = trim_to_content(Image.open(args.inp), args.margin, pad_square=args.pad_square)
        out.save(args.out)
        print(json.dumps({"out": args.out, "box": box, "size": out.size}))
    elif args.cmd == "preview":
        preview_sheet(Image.open(args.inp), Path(args.out))
    elif args.cmd == "tile":
        im = make_tileable(Image.open(args.inp), args.blend)
        im.save(args.out)
        print(json.dumps({"out": args.out, "before": seam_score(Image.open(args.inp)), "after": seam_score(im)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
