#!/usr/bin/env python3
"""Download full (non-subset) Japanese/Chinese (+ Latin UI / mono) font files from github.com/google/fonts
into <ROOT>/engine/fonts/ and write engine/fonts/fonts.css (@font-face rules) + manifest.json.

Usage:  python tools/fetch_fonts.py [--css-only] [--out-dir engine/fonts]

Deterministic offline rendering: the engine only ever references ./fonts/*.ttf via fonts.css,
never Google Fonts CDN. Re-running skips files already downloaded with the right size.
Set GITHUB_TOKEN to raise the GitHub API rate limit (60 requests/hour without it).
All families are SIL Open Font License; the OFL texts are saved next to the fonts (OFL_<dir>.txt).
Author: NikusonP -- vocaloid-style-mv-pipeline, MIT licence.
"""
import argparse, json, os, re, sys, urllib.request, urllib.parse, concurrent.futures as cf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit_env  # noqa: E402

FONT_DIR = str(kit_env.ROOT / "engine" / "fonts")
# (css family name, google/fonts ofl dir)
FAMILIES = [
    ("Noto Sans JP", "notosansjp"),
    ("Noto Serif JP", "notoserifjp"),
    ("Zen Old Mincho", "zenoldmincho"),
    ("Shippori Mincho B1", "shipporiminchob1"),
    ("Dela Gothic One", "delagothicone"),
    ("Klee One", "kleeone"),
    ("Yuji Syuku", "yujisyuku"),
    ("Zen Kaku Gothic New", "zenkakugothicnew"),
    ("DotGothic16", "dotgothic16"),
    ("Kaisei Tokumin", "kaiseitokumin"),
    ("M PLUS Rounded 1c", "mplusrounded1c"),
    ("Reggae One", "reggaeone"),
    ("Rampart One", "rampartone"),
    ("Noto Sans SC", "notosanssc"),
    ("Noto Serif SC", "notoserifsc"),
    # Latin faces for the interface / signal style packs (UI sans, code mono)
    ("Inter", "inter"),
    ("IBM Plex Mono", "ibmplexmono"),
    # treatise style pack: a grotesk with a width axis (the lyric voice) and an italic serif (the prophetic register)
    ("Archivo", "archivo"),
    ("Cormorant Garamond", "cormorantgaramond"),
    # papercraft style pack: round display, playful hand, storybook serif (CJK) + a round Latin for numbers / UI
    ("ZCOOL QingKe HuangYou", "zcoolqingkehuangyou"),
    ("ZCOOL KuaiLe", "zcoolkuaile"),
    ("ZCOOL XiaoWei", "zcoolxiaowei"),
    ("Fredoka", "fredoka"),
]
ITALIC = {"Cormorant Garamond"}          # families whose italic files are fetched too (font-style italic in fonts.css)
WEIGHTS = {"Thin": 100, "ExtraLight": 200, "Light": 300, "Regular": 400, "Medium": 500,
           "SemiBold": 600, "Bold": 700, "ExtraBold": 800, "Black": 900}
UA = {"User-Agent": "vocaloid-style-mv-pipeline-font-fetch"}


def api_list(d):
    url = f"https://api.github.com/repos/google/fonts/contents/ofl/{d}"
    tok = os.environ.get("GITHUB_TOKEN")
    hdr = dict(UA)
    if tok:
        hdr["Authorization"] = "Bearer " + tok
    with urllib.request.urlopen(urllib.request.Request(url, headers=hdr), timeout=60) as r:
        return json.load(r)


def retry(fn, *a, tries=5):
    import time
    for k in range(tries):
        try:
            return fn(*a)
        except Exception as e:  # DNS hiccups / resets on large files
            if k == tries - 1:
                raise
            print("retry", k + 1, a[0] if a else "", e, flush=True)
            time.sleep(2 + 3 * k)


def download(url, dst, size):
    if os.path.exists(dst) and (size is None or os.path.getsize(dst) == size):
        return dst, "skip"
    tmp = dst + ".part"
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r, open(tmp, "wb") as f:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)
    if size is not None and os.path.getsize(tmp) != size:
        raise RuntimeError(f"size mismatch {dst}: {os.path.getsize(tmp)} != {size}")
    os.replace(tmp, dst)
    return dst, "ok"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--css-only", action="store_true",
                    help="no downloads: rebuild fonts.css from the existing manifest.json")
    ap.add_argument("--refresh", action="store_true",
                    help="list every family through the GitHub API again (new files upstream); default: the manifest's files")
    ap.add_argument("--out-dir", default=FONT_DIR, help=f"font directory (default {FONT_DIR})")
    args = ap.parse_args()
    root = str(kit_env.resolve(args.out_dir))

    os.makedirs(root, exist_ok=True)
    manifest_path = os.path.join(root, "manifest.json")
    manifest = []
    if args.css_only and os.path.exists(manifest_path):
        manifest = json.load(open(manifest_path, encoding="utf-8"))
    else:
        jobs = []
        # files the shipped manifest already names come straight from raw.githubusercontent.com: the contents API
        # (60 requests an hour without GITHUB_TOKEN) is asked only for families the manifest does not list, or --refresh
        known = {}
        if not args.refresh and os.path.exists(manifest_path):
            for m in json.load(open(manifest_path, encoding="utf-8")):
                known.setdefault(m["dir"], []).append(m)
        RAW = "https://raw.githubusercontent.com/google/fonts/main/ofl/"
        for fam, d in FAMILIES:
            if d in known:
                for m in known[d]:
                    jobs.append((fam, d, m["src"], RAW + d + "/" + urllib.parse.quote(m["src"]), os.path.join(root, m["file"]), m["size"]))
                jobs.append((fam, d, "OFL.txt", RAW + d + "/OFL.txt", os.path.join(root, f"OFL_{d}.txt"), None))
                continue
            items = retry(api_list, d)
            for it in items:
                n = it["name"]
                if "Italic" in n and fam not in ITALIC:
                    continue                      # upright faces only, except the ITALIC families
                if n.endswith(".ttf") or n == "OFL.txt":
                    local = n if n.endswith(".ttf") else f"OFL_{d}.txt"
                    local = local.replace("[", "_").replace("]", "_")  # avoid [] in URLs
                    jobs.append((fam, d, n, it["download_url"], os.path.join(root, local), it["size"]))
        with cf.ThreadPoolExecutor(6) as ex:
            futs = {ex.submit(retry, download, j[3], j[4], j[5]): j for j in jobs}
            for fu in cf.as_completed(futs):
                j = futs[fu]
                try:
                    print(fu.result()[1], os.path.basename(j[4]), j[5], flush=True)
                except Exception as e:
                    if j[2] != "OFL.txt":
                        raise
                    print("warn: no", j[3], f"({e}); keeping the shipped licence file if there is one", flush=True)
        for fam, d, n, url, local, size in jobs:
            if n.endswith(".ttf"):
                manifest.append({"family": fam, "dir": d, "src": n, "file": os.path.basename(local), "size": size})
        json.dump(manifest, open(manifest_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    css = ["/* Generated by tools/fetch_fonts.py - full google/fonts TTFs (OFL), local only. */"]
    for m in manifest:
        f = m["file"]
        if "wght" in m["src"]:
            weight = "100 900"
        else:
            mm = re.search(r"-(\w+)\.ttf$", m["src"])
            weight = str(WEIGHTS.get(mm.group(1), 400)) if mm else "400"
        stretch = "font-stretch:62% 125%;" if "wdth" in m["src"] else ""      # variable width (Archivo)
        style = "italic" if "Italic" in m["src"] else "normal"
        css.append(
            "@font-face{font-family:'%s';src:url('./%s') format('truetype');font-weight:%s;%s"
            "font-style:%s;font-display:block;}" % (m["family"], f, weight, stretch, style))
    open(os.path.join(root, "fonts.css"), "w", encoding="utf-8").write("\n".join(css) + "\n")
    # JS list of families/weights so pages can pre-load exactly what they use
    fams = {}
    for m in manifest:
        fams.setdefault(m["family"], [])
    print("families:", len(fams), "files:", len(manifest))


if __name__ == "__main__":
    main()
