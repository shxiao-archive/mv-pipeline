#!/usr/bin/env bash
# Run the Grok jobs planned by `python tools/grokgen.py plan ...`, N at a time (from a SHELL: Grok will not start when
# a Python process launches it):
#   bash tools/grok_run.sh 4              (the ids in _grok/pending.txt)
#   bash tools/grok_run.sh 4 bg_sky hero  (just these)
# Each job: cd _grok/<id>; grok -p "$(cat prompt.txt)" --always-approve --output-format plain > out.txt 2> err.txt
# ~20-40 s per image. Then: python tools/grokgen.py collect <jobs> --out-dir <dir>.   mv-studio (MIT)
cd "$(dirname "$0")/.." || exit 1
N=${1:-4}; shift || true
if [ $# -eq 0 ] && [ -f _grok/pending.txt ]; then set -- $(tr -d '\r' < _grok/pending.txt); fi
[ $# -eq 0 ] && { echo "nothing to run (plan first: python tools/grokgen.py plan <jobs> --out-dir <dir>)"; exit 0; }
GROK=$(command -v grok || echo "$HOME/.grok/bin/grok")
export GROK
run() { (cd "_grok/$1" && "$GROK" -p "$(cat prompt.txt)" --always-approve --output-format plain > out.txt 2> err.txt; echo "done $1 ($?)"); }
export -f run
printf '%s\n' "$@" | xargs -P "$N" -I{} bash -c 'run "$@"' _ {}
