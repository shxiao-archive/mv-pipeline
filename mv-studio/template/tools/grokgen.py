#!/usr/bin/env python3
"""Image generation through the Grok Build CLI (`grok`, signed in by the user) — the same jobs file as tools/imagegen.py.

Grok's headless mode has two image tools: image_gen (prompt + aspect_ratio 1:1 / 16:9 / 9:16 / 2:3 / 3:2) and
image_edit (reference images as absolute paths: a consistent ORIGINAL character, or a new aspect ratio of an existing
image with two references). Each call saves one JPG under ~/.grok/sessions/... and the reply names its path.

Grok does not start when a Python process launches it, so this runs in three steps:
    python tools/grokgen.py plan    assets/char/jobs_core.jsonl --out-dir assets/char   # writes _grok/<id>/prompt.txt + _grok/pending.txt
    bash   tools/grok_run.sh 4                                                           # from the SHELL: grok -p ... --always-approve, 4 at a time
    python tools/grokgen.py collect assets/char/jobs_core.jsonl --out-dir assets/char   # copies + keys + trims, writes a check sheet
Then LOOK at <out-dir>/_check_grok.jpg (every image, with its id): wrong subject, extra figures, a framed scene instead
of a cut-out, cropped subjects -> fix the prompt and plan/run/collect again with --only id1,id2 --force.

Job fields (tools/imagegen.py) plus: "aspect": "16:9" | "9:16" | "1:1" | "2:3" | "3:2"
  (default: 16:9 for backgrounds, 2:3 for transparent cut-outs). "images": [...] refs -> image_edit.
Transparent jobs get a flat chroma-key background in the prompt and are keyed with tools/alpha_matte.py.
Never put API keys or account details in prompts or files; the CLI uses the user's own sign-in.

mv-studio (MIT). The headless recipe (image_gen / image_edit, --always-approve, shell launch, green-screen cut-outs)
follows the method the kit's user documented for their own projects.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import urllib.parse
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import kit_env  # noqa: E402
from imagegen import job_key, key_suffix, load_jobs, postprocess_alpha  # noqa: E402

ROOT = kit_env.ROOT
WORK = ROOT / "_grok"
PATH_RE = re.compile(r"((?:[A-Za-z]:[\\/]|/)[^\r\n\"'<>|*?]+?\.(?:jpg|jpeg|png|webp))", re.I)
CUTOUT = (" ONLY the subject described above and nothing else: no extra people, figures, animals or objects unless the "
          "description asks for them, no frame, no border, no scenery behind it. The subject alone, entirely inside the "
          "frame with generous margin.")


def grok_prompt(job: dict) -> str:
    prompt = job["prompt"].strip()
    if job.get("transparent"):
        prompt += CUTOUT + key_suffix(job_key(job))
    aspect = job.get("aspect") or ("2:3" if job.get("transparent") else "16:9")
    refs = [str((ROOT / p).resolve()) if not Path(p).is_absolute() else p for p in job.get("images", [])]
    if refs:
        tool = (f"Use the image_edit tool exactly once, with image = {json.dumps(refs)} (absolute file paths) as the "
                "reference(s): keep the same character design, face, hair, outfit, colours and drawing style exactly, "
                "unless the prompt says otherwise.")
        if len(refs) > 1:
            tool += f' Use aspect_ratio "{aspect}".'
    else:
        tool = f'Use the image_gen tool exactly once with aspect_ratio "{aspect}".'
    return (f"{tool} Use the prompt below verbatim as the tool's prompt. Do not run any other tool, do not ask questions. "
            "When the image is saved, reply with ONLY its absolute file path on one line.\n\nPROMPT:\n" + prompt)


def check_sheet(items: list[tuple[str, Path]], out: Path, h: int = 300) -> None:
    from PIL import Image, ImageDraw
    if not items:
        return
    thumbs = []
    for name, p in items:
        im = Image.open(p).convert("RGBA")
        w = max(1, round(im.width * h / im.height))
        bg = Image.new("RGBA", (w, h + 26), (60, 60, 64, 255))
        for y in range(0, h, 20):                                   # checkerboard behind cut-outs
            for x in range(0, w, 20):
                if (x // 20 + y // 20) % 2:
                    ImageDraw.Draw(bg).rectangle([x, y, x + 19, y + 19], fill=(90, 90, 96, 255))
        bg.alpha_composite(im.resize((w, h)), (0, 0))
        ImageDraw.Draw(bg).text((6, h + 6), name, fill=(240, 240, 240, 255))
        thumbs.append(bg)
    cols = min(4, len(thumbs)); rows = -(-len(thumbs) // cols)
    cw = max(t.width for t in thumbs)
    sheet = Image.new("RGB", (cols * (cw + 8), rows * (h + 34)), (24, 24, 26))
    for i, t in enumerate(thumbs):
        sheet.paste(t, ((i % cols) * (cw + 8), (i // cols) * (h + 34)), t)
    sheet.save(out, quality=88)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("step", choices=["plan", "collect"])
    ap.add_argument("jobs")
    ap.add_argument("--out-dir", default="assets")
    ap.add_argument("--only", help="comma-separated job ids")
    ap.add_argument("--force", action="store_true", help="re-plan / re-collect even if the output exists")
    a = ap.parse_args()
    jobs = load_jobs(kit_env.resolve(a.jobs))
    if a.only:
        keep = set(a.only.split(","))
        jobs = [j for j in jobs if j["id"] in keep]
    out_dir = kit_env.resolve(a.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = lambda j: (Path(j["out"]) if Path(j["out"]).is_absolute() else out_dir / j["out"])
    WORK.mkdir(exist_ok=True)
    if a.step == "plan":
        todo = [j for j in jobs if a.force or not target(j).exists()]
        for j in todo:
            w = WORK / j["id"]
            if w.exists():
                shutil.rmtree(w)
            w.mkdir(parents=True)
            (w / "prompt.txt").write_text(grok_prompt(j), encoding="utf-8")
        (WORK / "pending.txt").write_bytes(("\n".join(j["id"] for j in todo) + "\n").encode())   # LF only: the shell reads it
        print(f"[grok] {len(todo)} job(s) planned in _grok/. Now, from a shell (not from Python):\n"
              f"  bash tools/grok_run.sh 4\n  python tools/grokgen.py collect {a.jobs} --out-dir {a.out_dir}")
        return 0
    done, missing = [], []
    manifest_path = out_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    for j in jobs:
        w, dst = WORK / j["id"], target(j)
        if dst.exists() and not a.force and not (w / "out.txt").exists():
            done.append((j["id"], dst)); continue
        text = (w / "out.txt").read_text(encoding="utf-8", errors="replace") if (w / "out.txt").exists() else ""
        hits = [Path(m) for m in PATH_RE.findall(text) if Path(m).is_file()]
        if not hits and text:
            # Grok names its session folder after the working directory with the separators URL-encoded (%5C) but
            # sometimes prints the path with them decoded: look in that job's session folder for the newest image
            since = (w / "prompt.txt").stat().st_mtime - 5
            sess = Path.home() / ".grok" / "sessions"
            exact = sess / urllib.parse.quote(str(w.resolve()), safe="")
            dirs = [exact] if exact.is_dir() else list(sess.glob(f"*%5C{j['id']}"))
            cands = [f for d in dirs for f in d.rglob("*") if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp") and f.stat().st_mtime >= since]
            uid = re.findall(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", text)   # or by the session id it printed
            if not cands and uid:
                cands = [f for f in sess.rglob("*") if uid[-1] in str(f) and f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")]
            hits = sorted(cands, key=lambda f: f.stat().st_mtime)[-1:]
        if not hits:
            err = (w / "err.txt").read_text(encoding="utf-8", errors="replace") if (w / "err.txt").exists() else ""
            missing.append(f"{j['id']}: grok returned no image ({(text or err).strip()[-200:]!r})"); continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        raw = dst.with_suffix(".raw.png")
        from PIL import Image
        src = max(hits, key=lambda h: h.stat().st_mtime)   # the reply may name several paths (refs, earlier images): take the newest
        Image.open(src).convert("RGB").save(raw)
        if j.get("transparent"):
            info = postprocess_alpha(raw, dst, j.get("trim", True))
            if (info.get("transparent_pct") or 0) < 3:
                missing.append(f"{j['id']}: the cut-out came back as a full rectangle (no key colour around the subject): re-prompt")
        else:
            shutil.copyfile(raw, dst); raw.unlink()
            info = {"alpha_method": "none"}
        manifest[j["id"]] = dict(info, out=str(dst.relative_to(ROOT)).replace("\\", "/"), prompt=j["prompt"], generator="grok")
        (w / "out.txt").rename(w / "collected.txt")
        done.append((j["id"], dst))
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    sheet = out_dir / "_check_grok.jpg"
    check_sheet(done, sheet)
    print(f"[grok] collected {len(done)}; check sheet -> {sheet.relative_to(ROOT)} (LOOK at it)")
    for m in missing:
        print("  MISSING " + m)
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
