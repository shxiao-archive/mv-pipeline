#!/usr/bin/env python3
"""Image generation through the NovelAI image API -- the same jobs file as tools/imagegen.py and tools/grokgen.py.

NovelAI's models are anime-trained (V5 by default). The key comes ONLY from the
environment variable NOVELAI_API_KEY (a persistent API token from NovelAI's account settings, set by the user in their
own shell); it is never read from, or written to, a file, and never printed. Without it this tool stops before any
request.

    python tools/novelaigen.py assets/char/jobs_core.jsonl --out-dir assets/char
    python tools/novelaigen.py assets/char/jobs_core.jsonl --out-dir assets/char --only run,jump --force
    python tools/novelaigen.py assets/char/jobs_core.jsonl --out-dir assets/char --dry-run    # request bodies, no network

Then LOOK at <out-dir>/_check_novelai.jpg (every image, with its id).

Job fields (tools/imagegen.py: id, prompt, out, transparent, key, images, trim; tools/grokgen.py: aspect) plus:
  "negative": "..."            extra negative prompt (added to the default one)
  "char": "solo, ..."           the character's tags as a V4 character caption (tools/gen_table.py fills it from the
                               CHAR / CHAR_BACK lock of char rows); the prompt keeps the scene and the pose
  "size": "1472x704"           width x height (or "width" + "height"; else "aspect"); snapped to 64 px, capped by max_pixels
  "seed": 1234                 fixed seed (default: derived from id + prompt, so a re-run gives the same image;
                               change the seed or the prompt for another take)
  "ref_mode": "character" | "img2img" | "inpaint" | "vibe"
                               how "images" are used: "character" = V4.5 character reference (identity of the FIRST
                               image; default on V4.5, not V5: its character reference failed), "img2img" = the first image is the starting picture
                               ("strength" 0..1, default 0.6), "inpaint" = repaint only the box "region" [u0, v0, u1, v1] (on the 8 px grid)
                               of the first image (the <model>-inpainting model; variants for tools/gen_table.py),
                               "vibe" = vibe transfer (V3 models only). A cut-out is flattened on the key colour first
  "ref_strength": 1.0          character / vibe reference strength;  "fidelity": 1.0 (character reference)
  "nai": {...}                 raw overrides of the request "parameters" (steps, scale, sampler, ...) -- rarely needed
Edit jobs (no generation; "images": [<the source>], no "prompt" needed) -- "op":
  "upscale"                    2x with NovelAI's upscaler (a V5 model: art.config.json -> novelai.upscale_model);
                               a cut-out keeps its own matte, scaled up
  "bg-removal"                 cut the subject out of a picture (a native-alpha cut-out, trimmed like any other)
  "lineart" | "sketch" | "declutter" | "colorize" | "emotion"
                               the other Director tools, with "prompt" and "defry" passed as they are
                               (emotion: "prompt": "happy;;", "defry": 0..5)
Project defaults (model, steps, scale, size cap, negative prompt) come from art.config.json -> "novelai".

Costs: on an Opus subscription a plain generation up to 1024x1024 px area and 28 steps is free; larger images, more
steps, img2img, character references, upscales and Director tools cost Anlas. NovelAI runs ONE generation per account at a time, so jobs run
one after another (HTTP 429 -> wait and retry).

mv-studio (MIT).
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import kit_env  # noqa: E402
from imagegen import job_key, key_suffix, load_jobs, postprocess_alpha  # noqa: E402

ROOT = kit_env.ROOT
API = (os.environ.get("NOVELAI_API_URL") or "https://image.novelai.net").rstrip("/")
KEY_ENV = "NOVELAI_API_KEY"

# width x height per aspect, multiples of 64 and <= 1024*1024 px (the free size on Opus)
SIZES = {"16:9": (1344, 768), "9:16": (768, 1344), "1:1": (1024, 1024), "2:3": (832, 1216), "3:2": (1216, 832),
         "4:3": (1152, 896), "3:4": (896, 1152)}
DEFAULTS = {
    "model": "nai-diffusion-5-full",
    "steps": 28, "scale": 5.0, "sampler": "k_euler_ancestral", "noise_schedule": "karras", "cfg_rescale": 0.0,
    "quality_tags": True, "uc_preset": 0, "skip_cfg_above_sigma": None,
    # NSFW, text and existing-character look-alikes are never wanted in an MV asset
    "negative": "nsfw, lowres, bad anatomy, bad hands, extra digits, fewer digits, text, logo, watermark, signature, "
                "username, artist name, speech bubble, jpeg artifacts, blurry",
    "max_pixels": 1024 * 1024,
    "upscale_model": "nai-diffusion-5-full",   # the standalone upscaler refuses V3 / V4 / V4.5 models
}
DIRECTOR_OPS = ("bg-removal", "lineart", "sketch", "declutter", "colorize", "emotion")
KEY_TAGS = {"#00FF00": "green background", "#FF00FF": "magenta background", "#0000FF": "blue background"}
# character-reference images must be padded to one of these canvases
CHAR_REF_CANVAS = [(1024, 1536), (1536, 1024), (1472, 1472)]


def config() -> dict:
    p = ROOT / "art.config.json"
    cfg = dict(DEFAULTS)
    if p.is_file():
        cfg.update({k: v for k, v in (json.loads(p.read_text(encoding="utf-8-sig")).get("novelai") or {}).items()
                    if not k.startswith("_")})
    return cfg


def size_for(job: dict, cfg: dict) -> tuple[int, int]:
    if job.get("width") and job.get("height"):
        w, h = int(job["width"]), int(job["height"])
    elif job.get("size"):                                             # "1472x704" (gen_table rows, imagegen jobs)
        w, h = (int(x) for x in str(job["size"]).lower().split("x"))
    else:
        aspect = job.get("aspect") or ("2:3" if job.get("transparent") else "16:9")
        if aspect not in SIZES:
            raise ValueError(f"job {job['id']}: aspect {aspect!r} is not one of {', '.join(SIZES)}")
        w, h = SIZES[aspect]
    scale = min(1.0, (cfg["max_pixels"] / (w * h)) ** 0.5)
    return max(64, int(w * scale) // 64 * 64), max(64, int(h * scale) // 64 * 64)


def job_seed(job: dict) -> int:
    if job.get("seed") is not None:
        return int(job["seed"])
    return int.from_bytes(hashlib.sha256((job["id"] + "\n" + job["prompt"]).encode()).digest()[:4], "big") % 4294967295


def ref_path(p: str) -> Path:
    q = Path(p)
    return q if q.is_absolute() else (ROOT / q).resolve()


def b64_png(img) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def char_ref_image(path: Path) -> str:
    """Fit the reference onto the closest allowed canvas (black padding), as NovelAI's character reference expects."""
    from PIL import Image
    im = Image.open(path).convert("RGBA")
    flat = Image.new("RGB", im.size, (0, 0, 0))
    flat.paste(im, mask=im.split()[3])
    a = im.width / im.height
    cw, ch = min(CHAR_REF_CANVAS, key=lambda s: abs(s[0] / s[1] - a))
    k = min(cw / im.width, ch / im.height)
    flat = flat.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    canvas = Image.new("RGB", (cw, ch), (0, 0, 0))
    canvas.paste(flat, ((cw - flat.width) // 2, (ch - flat.height) // 2))
    return b64_png(canvas)


def model_gen(model: str) -> float:
    """Model generation from its name: nai-diffusion-4-5-full -> 4.5, nai-diffusion-3 / -furry-3 -> 3; unknown -> 4."""
    m = re.search(r"diffusion-(?:furry-)?(\d+)(?:-(\d)(?!\d))?", model)
    return float(f"{m.group(1)}.{m.group(2) or 0}") if m else 4.0


def build_request(job: dict, cfg: dict, data: bool = True) -> dict:
    """The JSON body of POST /ai/generate-image. data=False leaves image payloads out (for --dry-run)."""
    w, h = size_for(job, cfg)
    model = job.get("model") or cfg["model"]
    gen = model_gen(model)
    v4 = gen >= 4                                                  # V4 caption format (v4_prompt)
    prompt = job["prompt"].strip()
    # an inpaint repaints a box inside the figure: background tags there paint the key colour into the face
    if job.get("transparent") and job.get("ref_mode") != "inpaint":
        key = job_key(job)
        tag = KEY_TAGS.get(key, f"plain {key} background")
        if v4:   # tags only: the Codex key sentence and "no shadow" flatten V4 poses and shading (Gemini old/new runs)
            prompt = ", ".join([prompt] + [t for t in ("solo", "simple background", tag) if t not in prompt.lower()])
        else:
            tags = [t for t in ("solo", "simple background", tag, "no shadow") if t not in prompt.lower()]
            prompt = ", ".join([prompt] + tags) + "." + key_suffix(key)
    negative = ", ".join(x for x in (cfg["negative"], job.get("negative", "")) if x)
    if job.get("transparent"):
        negative += ", scenery, detailed background, gradient background, cast shadow"
    p = {
        "params_version": 3, "width": w, "height": h, "scale": cfg["scale"], "sampler": cfg["sampler"],
        "steps": cfg["steps"], "n_samples": 1, "seed": job_seed(job), "ucPreset": cfg["uc_preset"],
        "qualityToggle": bool(cfg["quality_tags"]), "dynamic_thresholding": False, "controlnet_strength": 1,
        "legacy": False, "add_original_image": True, "cfg_rescale": cfg["cfg_rescale"],
        "noise_schedule": cfg["noise_schedule"], "legacy_v3_extend": False, "skip_cfg_above_sigma": cfg["skip_cfg_above_sigma"],
        "negative_prompt": negative, "deliberate_euler_ancestral_bug": False, "prefer_brownian": True,
    }
    chars = [{"char_caption": job["char"].strip(), "centers": [{"x": 0.5, "y": 0.5}]}] if v4 and job.get("char") else []
    if v4:
        p.update({
            "use_coords": False, "characterPrompts": [], "legacy_uc": False,
            "v4_prompt": {"caption": {"base_caption": prompt, "char_captions": chars}, "use_coords": False, "use_order": True},
            "v4_negative_prompt": {"caption": {"base_caption": negative, "char_captions": [dict(c, char_caption="") for c in chars]},
                                   "legacy_uc": False},
        })
    action = "generate"
    refs = [ref_path(r) for r in job.get("images") or []]
    for r in refs:
        if not r.is_file():
            raise FileNotFoundError(f"job {job['id']}: reference image {r} does not exist")
    if refs:
        mode = job.get("ref_mode") or ("character" if 4.5 <= gen < 5 else "vibe" if not v4 else "img2img")   # V5 character reference: HTTP 500 (04 §12)
        if mode == "character":
            if gen < 4.5:
                raise ValueError(f"job {job['id']}: ref_mode 'character' needs a V4.5 model (model is {model})")
            caption = {"caption": {"base_caption": "character&style", "char_captions": []}, "legacy_uc": False}
            p.update({
                "director_reference_images": [char_ref_image(refs[0]) if data else f"<{refs[0].name}>"],
                "director_reference_descriptions": [caption],
                "director_reference_information_extracted": [1],
                "director_reference_strength_values": [float(job.get("ref_strength", 1.0))],
                "director_reference_secondary_strength_values": [round(1.0 - float(job.get("fidelity", 1.0)), 3)],
            })
        elif mode in ("img2img", "inpaint"):
            from PIL import Image, ImageDraw
            src = Image.open(refs[0])
            if src.mode in ("RGBA", "LA", "P"):                      # a cut-out: flatten onto the key colour, so the result keys again
                rgba = src.convert("RGBA"); flat = Image.new("RGB", rgba.size, "#808080" if mode == "inpaint" else job_key(job) if job.get("transparent") else "#FFFFFF")
                flat.paste(rgba, mask=rgba.getchannel("A")); src = flat
            init = src.convert("RGB").resize((w, h), Image.LANCZOS)
            p.update({"image": b64_png(init) if data else f"<{refs[0].name} {w}x{h}>",
                      "strength": float(job.get("strength", 0.6 if mode == "img2img" else 1.0)), "noise": float(job.get("noise", 0.0)),
                      "extra_noise_seed": job_seed(job)})
            action = "img2img"
            if mode == "inpaint":                                     # repaint only job["region"] [u0, v0, u1, v1]; the rest stays
                u0, v0, u1, v1 = job.get("region") or (0, 0, 1, 1)
                mask = Image.new("RGB", (w, h), "black")
                box = [int(u0 * w) // 8 * 8, int(v0 * h) // 8 * 8, -(-int(u1 * w) // 8) * 8, -(-int(v1 * h) // 8) * 8]
                ImageDraw.Draw(mask).rectangle(box, fill="white")   # a box on the 8 px grid (an ellipse mask came back as garbage)
                action = "infill"
                model = job.get("inpaint_model") or (model if model.endswith("-inpainting") else model + "-inpainting")
                p.update({"mask": b64_png(mask) if data else f"<mask {job.get('region')}>"})
            if job.get("char_ref") and gen >= 4.5:                # also hold identity + style to the reference (V4.5)
                caption = {"caption": {"base_caption": "character&style", "char_captions": []}, "legacy_uc": False}
                p.update({"director_reference_images": [char_ref_image(refs[0]) if data else f"<{refs[0].name}>"],
                          "director_reference_descriptions": [caption], "director_reference_information_extracted": [1],
                          "director_reference_strength_values": [float(job.get("ref_strength", 1.0))],
                          "director_reference_secondary_strength_values": [round(1.0 - float(job.get("fidelity", 1.0)), 3)]})
        elif mode == "vibe":
            if v4:
                raise ValueError(f"job {job['id']}: ref_mode 'vibe' is for V3 models here; use 'character' on V4.5")
            from PIL import Image
            p.update({"reference_image_multiple": [b64_png(Image.open(r).convert("RGB")) if data else f"<{r.name}>"
                                                   for r in refs],
                      "reference_information_extracted_multiple": [1.0] * len(refs),
                      "reference_strength_multiple": [float(job.get("ref_strength", 0.6))] * len(refs)})
        else:
            raise ValueError(f"job {job['id']}: ref_mode {mode!r} is not character / img2img / inpaint / vibe")
    p.update(job.get("nai") or {})
    return {"input": prompt, "model": model, "action": action, "parameters": p}


def op_canvas(size: tuple[int, int]) -> tuple[int, int]:
    """The source padded to the 64 px grid: the API centre-crops other sizes (256x315 came back as 2x 256x304), so
    the edit pads at the bottom right and edited_image cuts the padding off again."""
    return -(-size[0] // 64) * 64, -(-size[1] // 64) * 64


def op_request(job: dict, cfg: dict, data: bool = True) -> tuple[str, dict]:
    """(path, JSON body) of an edit job: "op" upscale -> POST /ai/upscale, a Director tool -> POST /ai/augment-image."""
    from PIL import Image
    op = job["op"]
    if op != "upscale" and op not in DIRECTOR_OPS:
        raise ValueError(f"job {job['id']}: op {op!r} is not upscale / {' / '.join(DIRECTOR_OPS)}")
    refs = [ref_path(r) for r in job.get("images") or []]
    if not refs or not refs[0].is_file():
        raise FileNotFoundError(f"job {job['id']}: op {op!r} needs \"images\": [<an existing source image>]")
    src = Image.open(refs[0]).convert("RGBA")
    pw, ph = op_canvas(src.size)
    flat = Image.new("RGB", (pw, ph), "#808080" if op == "upscale" else "#FFFFFF")   # grey: the least spill on a matte edge
    flat.paste(src, (0, 0), mask=src.getchannel("A"))
    img = b64_png(flat) if data else f"<{refs[0].name} {src.width}x{src.height} padded to {pw}x{ph}>"
    if op == "upscale":
        return "/ai/upscale", {"image": img, "model": job.get("model") or cfg["upscale_model"], "declared_blur_sigma": 0}
    return "/ai/augment-image", {"req_type": op, "width": pw, "height": ph, "image": img,
                                 "prompt": job.get("prompt", ""), "defry": int(job.get("defry", 0))}


def all_images(body: bytes) -> list:
    """The response is a zip with image_0.png, ... (or, from some endpoints, the PNG itself)."""
    from PIL import Image
    if body[:4] == b"PK\x03\x04":
        with zipfile.ZipFile(io.BytesIO(body)) as z:
            names = sorted(n for n in z.namelist() if n.lower().endswith((".png", ".jpg", ".webp")))
            if not names:
                raise RuntimeError("the response zip has no image")
            return [Image.open(io.BytesIO(z.read(n))) for n in names]
    return [Image.open(io.BytesIO(body))]


def first_image(body: bytes):
    return all_images(body)[0]


def edited_image(job: dict, body: bytes):
    """The result of an edit job, with the grid padding cut off: bg-removal -> the returned image with the most
    transparency; an upscaled cut-out gets its source matte back, scaled to the new size."""
    from PIL import Image
    imgs = all_images(body)
    clear = lambda im: im.convert("RGBA").getchannel("A").histogram()[0]
    img = max(imgs, key=clear) if job["op"] == "bg-removal" else imgs[0]
    alpha = Image.open(ref_path(job["images"][0])).convert("RGBA").getchannel("A")
    k = img.width / op_canvas(alpha.size)[0]                         # 2 for an upscale, 1 for the Director tools
    img = img.crop((0, 0, round(alpha.width * k), round(alpha.height * k)))
    if job["op"] == "upscale":
        if alpha.getextrema()[0] < 255:
            img = img.convert("RGB"); img.putalpha(alpha.resize(img.size, Image.LANCZOS))
    return img


def request_for(job: dict, cfg: dict, data: bool = True) -> tuple[str, dict]:
    return op_request(job, cfg, data) if job.get("op") else ("/ai/generate-image", build_request(job, cfg, data))


HTTP_HINTS = {
    400: "the request was rejected (a field NovelAI does not accept: try another ref_mode, or check 'nai' overrides)",
    401: f"the key in {KEY_ENV} was refused: create a new persistent API token in NovelAI's account settings",
    402: "this needs an active subscription or more Anlas (size > 1 MP, > 28 steps, img2img, references, upscales and "
         "Director tools cost Anlas)",
    403: "forbidden (subscription tier or model access; an HTML page with 'error code: 1010' is Cloudflare blocking the client)",
}


def post(path: str, body: dict, key: str, timeout: float, attempts: int) -> bytes:
    data = json.dumps(body).encode("utf-8")
    wait = 8.0
    for attempt in range(1, attempts + 1):
        req = urllib.request.Request(API + path, data=data, method="POST", headers={
            "Authorization": "Bearer " + key, "Content-Type": "application/json", "Accept": "application/zip, image/png",
            "User-Agent": "mv-studio/1.0 (tools/novelaigen.py)"})   # Cloudflare blocks the default Python-urllib agent (error 1010)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            msg = e.read()[:400].decode("utf-8", "replace")
            if e.code in (429, 500, 502, 503, 504) and attempt < attempts:
                print(f"    HTTP {e.code} (busy or concurrent generation), retrying in {wait:.0f} s", flush=True)
                time.sleep(wait); wait = min(wait * 2, 120); continue
            raise RuntimeError(f"HTTP {e.code}: {HTTP_HINTS.get(e.code, e.reason)}" + (f" -- server: {msg.strip()[:200]}" if msg.strip() else "")) from None
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < attempts:
                print(f"    network error ({e}), retrying in {wait:.0f} s", flush=True)
                time.sleep(wait); wait = min(wait * 2, 120); continue
            raise RuntimeError(f"network error: {e}") from None
    raise RuntimeError("no response")


def main() -> int:
    from grokgen import check_sheet
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("jobs")
    ap.add_argument("--out-dir", default="assets")
    ap.add_argument("--only", help="comma-separated job ids")
    ap.add_argument("--force", action="store_true", help="regenerate even if the output exists")
    ap.add_argument("--dry-run", action="store_true", help="write _novelai/<id>.request.json (no images, no key), no network")
    ap.add_argument("--timeout", type=float, default=180, help="seconds per request (default 180)")
    ap.add_argument("--attempts", type=int, default=4, help="tries per job on 429 / 5xx / network errors (default 4)")
    ap.add_argument("--delay", type=float, default=1.0, help="pause between jobs, s (default 1)")
    a = ap.parse_args()
    key = os.environ.get(KEY_ENV, "").strip()
    if not key and not a.dry_run:
        print(f"[novelai] {KEY_ENV} is not set. The user sets it in their own shell (never in a file of the project),\n"
              f"  e.g. PowerShell:  setx {KEY_ENV} \"<token>\"   (then open a new terminal)   bash:  export {KEY_ENV}=<token>")
        return 2
    cfg = config()
    jobs = load_jobs(kit_env.resolve(a.jobs))
    if a.only:
        keep = set(a.only.split(","))
        jobs = [j for j in jobs if j["id"] in keep]
    out_dir = kit_env.resolve(a.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = lambda j: (Path(j["out"]) if Path(j["out"]).is_absolute() else out_dir / j["out"])
    todo = [j for j in jobs if a.force or not target(j).exists()]
    if a.dry_run:
        d = ROOT / "_novelai"; d.mkdir(exist_ok=True)
        for j in todo:
            path, body = request_for(j, cfg, data=False)
            (d / f"{j['id']}.request.json").write_text(json.dumps(dict(body, _path=path), ensure_ascii=False, indent=1),
                                                       encoding="utf-8")
        print(f"[novelai] dry run: {len(todo)} request(s) in _novelai/ (model {cfg['model']}); nothing was sent")
        return 0
    manifest_path = out_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    done = [(j["id"], target(j)) for j in jobs if j not in todo]
    failed = []
    print(f"[novelai] {len(todo)} of {len(jobs)} job(s) to run, one at a time (model {cfg['model']})", flush=True)
    for i, j in enumerate(todo):
        dst = target(j)
        t0 = time.time()
        try:
            resp = post(*request_for(j, cfg), key, a.timeout, a.attempts)
            img = edited_image(j, resp) if j.get("op") else first_image(resp)
        except Exception as e:  # noqa: BLE001
            failed.append(j["id"])
            print(f"[  failed] {j['id']}: {e}", flush=True)
            manifest[j["id"]] = {"status": "failed", "error": str(e)[:300], "generator": "novelai"}
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
            if str(e).startswith(("HTTP 401", "HTTP 402", "HTTP 403")):
                print("[novelai] stopping: the same error would repeat for every job")
                break
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        raw = dst.with_suffix(".raw.png")
        cut = j.get("transparent") or j.get("op") == "bg-removal" or (j.get("op") and img.mode in ("RGBA", "LA"))
        (img.convert("RGBA") if cut and j.get("op") else img.convert("RGB")).save(raw)   # re-encoded: NovelAI's PNG text chunks are not kept
        info: dict = {"alpha_method": "none"}
        if cut:
            info = postprocess_alpha(raw, dst, j.get("trim", True))
            if (info.get("transparent_pct") or 0) < 3:
                print(f"  WARN {j['id']}: the cut-out came back as a full rectangle (no key colour around the subject)")
        else:
            shutil.copyfile(raw, dst); raw.unlink()
        _, req = request_for(j, cfg, data=False)
        seed = None if j.get("op") else req["parameters"]["seed"]
        manifest[j["id"]] = dict(info, status="complete", out=kit_env.rel(dst), prompt=j.get("prompt", ""), generator="novelai",
                                 model=req.get("model"), seed=seed, action=j.get("op") or req["action"],
                                 source=(j.get("images") or [None])[0] if j.get("op") else None, raw_size=list(img.size),
                                 elapsed=round(time.time() - t0, 1))
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
        done.append((j["id"], dst))
        print(f"[complete] {j['id']} ({manifest[j['id']]['elapsed']} s, " + (j["op"] if j.get("op") else f"seed {seed}") + ")", flush=True)
        if i + 1 < len(todo):
            time.sleep(a.delay)
    sheet = out_dir / "_check_novelai.jpg"
    check_sheet([(n, p) for n, p in done if p.exists()], sheet)
    print(f"[novelai] {len(done)} image(s); check sheet -> {kit_env.rel(sheet)} (LOOK at it)"
          + (f"; failed: {', '.join(failed)}" if failed else ""))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
