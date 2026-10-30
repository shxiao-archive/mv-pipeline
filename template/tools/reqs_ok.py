"""reqs_ok.py -- exit 0 when every package in requirements.txt is already installed (at a high enough version).

setup.ps1 / setup.sh run it before pip: an interpreter whose packages are managed elsewhere (uv, a distro: PEP 668
"externally-managed-environment") then needs no pip at all.
  python tools/reqs_ok.py [requirements.txt]      prints what is missing; exit 1 if anything is
"""
import re
import sys
from importlib import metadata
from pathlib import Path


def vtuple(v):
    return tuple(int(x) for x in re.findall(r"\d+", v)[:3])


def main():
    req = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "requirements.txt")
    missing = []
    for row in req.read_text(encoding="utf-8").splitlines():
        row = row.split("#")[0].strip()
        m = re.match(r"^([A-Za-z0-9_.\-]+)\s*(?:>=\s*([0-9.]+))?", row)
        if not m:
            continue
        name, want = m.group(1), m.group(2)
        try:
            have = metadata.version(name)
        except metadata.PackageNotFoundError:
            missing.append(name)
            continue
        if want and vtuple(have) < vtuple(want):
            missing.append(f"{name} (have {have}, need >= {want})")
    if missing:
        print("missing: " + ", ".join(missing))
        return 1
    print("all requirements installed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
