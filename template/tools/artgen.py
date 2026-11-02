#!/usr/bin/env python3
"""One entry point for image generation: the same jobs file goes to whichever generator the USER chose.

    python tools/artgen.py providers                                   # what is installed / signed in / chosen
    python tools/artgen.py use novelai                                 # record the user's choice in art.config.json
    python tools/artgen.py run     assets/char/jobs_core.jsonl --out-dir assets/char [--provider grok] [--only a,b] [--force]
    python tools/artgen.py collect assets/char/jobs_core.jsonl --out-dir assets/char  # Grok only, after grok_run.sh
    python tools/artgen.py run ... --dry-run                           # print who makes what (NovelAI: request bodies)

Built-in providers (each also works on its own, see its docstring):
  codex    tools/imagegen.py   Codex CLI, the user's own sign-in; parallel; reference images via -i
  grok     tools/grokgen.py    Grok Build CLI, the user's own sign-in; plan -> `bash tools/grok_run.sh` -> collect
  novelai  tools/novelaigen.py NovelAI image API (anime models); key from the env var NOVELAI_API_KEY only
Any other tool that takes `<jobs> --out-dir <dir>` can be added in art.config.json -> "custom" (no code change):
  "custom": {"mygen": {"cmd": ["python", "tools/mygen.py", "{jobs}", "--out-dir", "{out_dir}"],
                       "needs_env": "MYGEN_KEY", "needs_cmd": "mygen"}}

Which provider makes a job, first match wins:
  1. the job's own "provider" field (e.g. characters on NovelAI, plates on Codex, in one jobs file)
  2. --provider
  3. env MV_ART_PROVIDER
  4. art.config.json "provider" (set by `artgen.py use <name>` or by hand)
  5. the only available provider, if exactly one is available
Otherwise it stops and lists what is available: ask the user which one they want. Nothing is preferred by the kit.
Keys and passwords never go into art.config.json, jobs files or prompts.

mv-studio (MIT).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import kit_env  # noqa: E402
from imagegen import load_jobs  # noqa: E402

ROOT = kit_env.ROOT
CONFIG = ROOT / "art.config.json"
PY = kit_env.PYTHON


def load_config() -> dict:
    return json.loads(CONFIG.read_text(encoding="utf-8-sig")) if CONFIG.is_file() else {}


def grok_exe() -> str | None:
    exe = shutil.which("grok")
    if exe:
        return exe
    p = Path.home() / ".grok" / "bin" / ("grok.exe" if kit_env.IS_WIN else "grok")
    return str(p) if p.is_file() else None


def builtin() -> dict:
    def codex():
        try:
            exe = kit_env.find_codex(required=False)
        except FileNotFoundError:
            exe = None
        return bool(exe), exe or "Codex CLI not found (install it, sign in once, or set CODEX_BIN)"

    def grok():
        exe = grok_exe()
        return bool(exe), exe or "Grok Build CLI not found (install it and sign in once)"

    def novelai():
        ok = bool(os.environ.get("NOVELAI_API_KEY", "").strip())
        return ok, ("NOVELAI_API_KEY is set" if ok else
                    "NOVELAI_API_KEY is not set (the user sets it in their own shell; never in a file)")

    return {
        "codex": {"check": codex, "cmd": [PY, str(TOOLS / "imagegen.py"), "{jobs}", "--out-dir", "{out_dir}"],
                  "note": "parallel; reference images attached with -i"},
        "grok": {"check": grok, "cmd": [PY, str(TOOLS / "grokgen.py"), "plan", "{jobs}", "--out-dir", "{out_dir}"],
                 "collect": [PY, str(TOOLS / "grokgen.py"), "collect", "{jobs}", "--out-dir", "{out_dir}"],
                 "note": "two steps around `bash tools/grok_run.sh` (Grok will not start from Python)"},
        "novelai": {"check": novelai, "cmd": [PY, str(TOOLS / "novelaigen.py"), "{jobs}", "--out-dir", "{out_dir}"],
                    "dry": ["--dry-run"], "note": "anime models (V5); one image at a time; free <= 1 MP / 28 steps on Opus"},
    }


def providers(cfg: dict) -> dict:
    out = builtin()
    for name, c in (cfg.get("custom") or {}).items():
        def check(c=c):
            if c.get("needs_env") and not os.environ.get(c["needs_env"], "").strip():
                return False, f"{c['needs_env']} is not set"
            if c.get("needs_cmd") and not shutil.which(c["needs_cmd"]):
                return False, f"{c['needs_cmd']} not found"
            return True, "custom: " + " ".join(c["cmd"][:3])
        out[name] = {"check": check, "cmd": list(c["cmd"]), "collect": c.get("collect"), "note": c.get("note", "custom")}
    return out


def available(provs: dict) -> dict:
    return {n: p["check"]() for n, p in provs.items()}


def choose(job: dict, cli: str | None, cfg: dict, avail: dict) -> str:
    for src, name in (("job", job.get("provider")), ("--provider", cli), ("MV_ART_PROVIDER", os.environ.get("MV_ART_PROVIDER")),
                      ("art.config.json", cfg.get("provider"))):
        if name:
            if name not in avail:
                raise SystemExit(f"[art] {src} names provider {name!r}: not one of {', '.join(avail)}")
            return name
    ok = [n for n, (a, _) in avail.items() if a]
    if len(ok) == 1:
        return ok[0]
    lines = "\n".join(f"  {n:9s} {'available' if a else 'not available'}: {d}" for n, (a, d) in avail.items())
    raise SystemExit("[art] no image generator chosen. Ask the user which one they want, then\n"
                     "  python tools/artgen.py use <name>     (or --provider <name>, or \"provider\" in a job)\n" + lines)


def fill(cmd: list[str], jobs: Path, out_dir: Path) -> list[str]:
    return [c.replace("{jobs}", str(jobs)).replace("{out_dir}", str(out_dir)) for c in cmd]


def split(a, cfg: dict, provs: dict) -> tuple[dict, list[dict]]:
    jobs = load_jobs(kit_env.resolve(a.jobs))
    if a.only:
        keep = set(a.only.split(","))
        # a variant job is <id>__t1, <id>__t2: its base id selects all its takes
        jobs = [j for j in jobs if j["id"] in keep or j["id"].split("__")[0] in keep]
        missing = keep - {x for j in jobs for x in (j["id"], j["id"].split("__")[0])}
        if missing:
            sys.exit(f"[artgen] --only: no job {', '.join(sorted(missing))} in {a.jobs}")
    avail = available(provs)
    groups: dict[str, list[dict]] = {}
    for j in jobs:
        groups.setdefault(choose(j, a.provider, cfg, avail), []).append(j)
    return groups, jobs


def group_file(out_dir: Path, jobs_path: str, name: str, items: list[dict]) -> Path:
    d = out_dir / "_jobs"
    d.mkdir(parents=True, exist_ok=True)
    p = d / f"{Path(jobs_path).stem}.{name}.jsonl"
    p.write_text("".join(json.dumps(j, ensure_ascii=False) + "\n" for j in items), encoding="utf-8")
    return p


def cmd_providers(cfg: dict, provs: dict) -> int:
    chosen = os.environ.get("MV_ART_PROVIDER") or cfg.get("provider")
    print(f"chosen: {chosen or '(none: ask the user, then python tools/artgen.py use <name>)'}")
    for n, (ok, detail) in available(provs).items():
        print(f"  {'*' if n == chosen else ' '} {n:9s} {'available    ' if ok else 'not available'}  {detail}")
        print(f"    {'':9s} {provs[n].get('note', '')}")
    return 0


def cmd_use(name: str, cfg: dict, provs: dict) -> int:
    if name not in provs:
        print(f"[art] {name!r} is not one of {', '.join(provs)}")
        return 2
    cfg["provider"] = name
    CONFIG.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    ok, detail = provs[name]["check"]()
    print(f"[art] provider = {name} (art.config.json){'' if ok else '  -- not available yet: ' + detail}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("step", choices=["providers", "use", "run", "collect"])
    ap.add_argument("jobs", nargs="?", help="jobs file (run / collect) or provider name (use)")
    ap.add_argument("--out-dir", default="assets")
    ap.add_argument("--provider", help="provider for jobs that do not name one")
    ap.add_argument("--only", help="comma-separated job ids; a base id selects its variant takes (<id>__t1, ...)")
    ap.add_argument("--force", action="store_true", help="regenerate even if the output exists")
    ap.add_argument("--dry-run", action="store_true", help="show which provider makes which job; send nothing")
    a, extra = ap.parse_known_args()
    extra = [x for x in extra if x != "--"]
    cfg = load_config()
    provs = providers(cfg)
    if a.step == "providers":
        return cmd_providers(cfg, provs)
    if not a.jobs:
        ap.error(f"{a.step} needs {'a provider name' if a.step == 'use' else 'a jobs file'}")
    if a.step == "use":
        return cmd_use(a.jobs, cfg, provs)
    out_dir = kit_env.resolve(a.out_dir)
    groups, jobs = split(a, cfg, provs)
    for name, items in groups.items():
        print(f"[art] {name}: {', '.join(j['id'] for j in items)}")
    rc = 0
    for name, items in groups.items():
        p = provs[name]
        if a.step == "collect" and not p.get("collect"):
            continue
        if a.step == "run" and not a.dry_run:
            ok, detail = p["check"]()
            if not ok:
                print(f"[art] {name} is not available: {detail}")
                rc = rc or 2
                continue
        if a.dry_run and not p.get("dry"):
            continue
        gf = group_file(out_dir, a.jobs, name, items)
        cmd = fill(p["collect"] if a.step == "collect" else p["cmd"], gf, out_dir)
        cmd += list((cfg.get(name) or {}).get("args") or []) if a.step == "run" else []
        cmd += (["--force"] if a.force else []) + (p.get("dry", []) if a.dry_run else []) + extra
        print(f"[art] {name} -> {' '.join(Path(c).name if i < 2 else c for i, c in enumerate(cmd))}", flush=True)
        r = subprocess.run(cmd, cwd=ROOT).returncode
        rc = rc or r
        if name == "grok" and a.step == "run" and r == 0 and not a.dry_run:
            print("[art] grok: now, from a SHELL (not from Python):\n  bash tools/grok_run.sh 4\n"
                  f"  python tools/artgen.py collect {a.jobs} --out-dir {a.out_dir}")
    return rc


if __name__ == "__main__":
    sys.exit(main())
