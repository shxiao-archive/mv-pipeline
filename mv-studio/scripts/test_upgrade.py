#!/usr/bin/env python3
"""Check new_project.py --upgrade on a scratch scaffold: python scripts/test_upgrade.py (needs no network)."""
import json, subprocess, sys, tempfile
from pathlib import Path
NP = str(Path(__file__).resolve().parent / "new_project.py")
sys.path.insert(0, str(Path(NP).parent)); import new_project as N  # noqa: E401,E402
P = Path(tempfile.mkdtemp(prefix="mv-upgrade-")) / "p"
run = lambda *a: subprocess.run([sys.executable, NP, *a], capture_output=True, text=True, encoding="utf-8")
r = run(str(P), "--no-git"); assert r.returncode == 0, r.stderr
rec = json.loads((P / ".mv-studio.json").read_text(encoding="utf-8"))
assert "engine/core/main.js" in rec["files"] and "engine/timeline.js" not in rec["files"] and "README.md" in rec["files"]
assert "tools/check_env.py" in rec["files"] and not any(k.startswith(("node_modules", "analysis/a")) for k in rec["files"])
r = run(str(P), "--upgrade"); assert "up to date" in r.stdout, r.stdout
# old-but-untouched (update), edited (keep), deleted+unrecorded (add), dropped upstream, the film's file untouched
(P / "tools/stale.mjs").write_text("// old\n", encoding="utf-8"); rec["files"]["tools/stale.mjs"] = N.sig(P / "tools/stale.mjs")
(P / "tools/lint.mjs").write_text("// mine\n", encoding="utf-8")
(P / "engine/core/cues.js").unlink(); del rec["files"]["engine/core/cues.js"]
rec["files"]["tools/gone.mjs"] = "0" * 16
(P / "engine/timeline.js").write_text("// my film\n", encoding="utf-8")
(P / ".mv-studio.json").write_text(json.dumps(rec), encoding="utf-8")
r = run(str(P), "--upgrade"); out = r.stdout
assert "update: 1\n    tools/stale.mjs" in out and "add: 1\n    engine/core/cues.js" in out, out
assert "keep (changed in the project): 1\n    tools/lint.mjs" in out and "tools/gone.mjs" in out, out
assert (P / "tools/stale.mjs").read_text() == "// old\n", "dry run changed a file"
r = run(str(P), "--upgrade", "--apply"); assert r.returncode == 0, r.stdout + r.stderr
assert N.sig(P / "tools/stale.mjs") == N.sig(N.TEMPLATE / "tools/stale.mjs") and (P / "engine/core/cues.js").is_file()
assert (P / "tools/lint.mjs").read_text() == "// mine\n" and (P / "engine/timeline.js").read_text() == "// my film\n"
rec2 = json.loads((P / ".mv-studio.json").read_text(encoding="utf-8"))["files"]
assert "tools/gone.mjs" not in rec2 and rec2["tools/lint.mjs"] == rec["files"]["tools/lint.mjs"]
r = run(str(P), "--upgrade"); assert "keep (changed in the project): 1" in r.stdout and "update" not in r.stdout.split("project  :")[1], r.stdout
# a project without a record: nothing replaced
(P / ".mv-studio.json").unlink()
r = run(str(P), "--upgrade", "--apply"); assert "differs (no record" in r.stdout and (P / "tools/lint.mjs").read_text() == "// mine\n", r.stdout
print("upgrade selftest ok")
import shutil; shutil.rmtree(P.parent, ignore_errors=True)  # noqa: E401,E402
