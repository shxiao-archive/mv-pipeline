#!/usr/bin/env python3
"""Upload version with a photosensitivity PREROLL: a silent warning card naming where the flashes and fast cuts are,
then the film. Reads the warning ranges tools/check_flash.py wrote; writes the share encode and the description text.

    python tools/check_flash.py render/mv.mp4          # writes render/mv_flash.json
    python tools/preroll.py render/mv.mp4 [--lang en|ja|zh] [--seconds 5] [--out render/mv_share.mp4] [--force]

Outputs: render/<name>_share.mp4 (card + film; libx264 slow CRF 19, AAC 256k, BT.709, as references/08 section 4)
and render/<name>_warning.txt (the same warning for the upload description; times are times IN the share file, so
they include the card). Without warning ranges it does nothing unless --force (then the card has no times).
The master (render/<name>.mp4) is never changed. ja / zh need the Noto fonts (npm run fonts).
Idea after world-execute-me-lyric-mv's preroll page; written for mv-studio (MIT).
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import kit_env  # noqa: E402

FONTS = {"en": "Inter_opsz,wght_.ttf", "ja": "NotoSansJP_wght_.ttf", "zh": "NotoSansSC_wght_.ttf"}
TEXT = {
    "en": ("PHOTOSENSITIVITY WARNING",
           ["This video contains flashing lights and rapid cuts{at}.",
            "Watch in a well-lit room, at a distance from the screen.",
            "Stop watching if you feel unwell."], " at {r}"),
    "ja": ("光過敏性発作に関するご注意",
           ["この映像には点滅する光や速いカット切り替えが含まれます{at}。",
            "部屋を明るくし、画面から離れてご覧ください。",
            "気分が悪くなった場合は視聴を中止してください。"], "（{r}）"),
    "zh": ("光敏性癫痫警告",
           ["本视频含有闪烁画面与快速剪辑{at}。",
            "请在明亮的环境中、与屏幕保持距离观看。",
            "如感到不适，请立即停止观看。"], "（{r}）"),
}


def fmt(t: float) -> str:
    return f"{int(t // 60)}:{int(t % 60):02d}"


def probe(path: Path) -> dict:
    out = subprocess.run([kit_env.FFPROBE, "-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate",
                          "-of", "json", str(path)], capture_output=True, text=True, check=True).stdout
    st = json.loads(out)["streams"]
    v = next(s for s in st if s["codec_type"] == "video")
    a, b = (v["r_frame_rate"].split("/") + ["1"])[:2]
    return {"w": v["width"], "h": v["height"], "fps": float(a) / float(b), "audio": any(s["codec_type"] == "audio" for s in st)}


def card(w: int, h: int, lang: str, ranges: str) -> Image.Image:
    font = TOOLS.parent / "engine" / "fonts" / FONTS[lang]
    if not font.is_file():
        sys.exit(f"[preroll] font {font.name} missing: run npm run fonts (or use --lang en)")
    title, body, at = TEXT[lang]
    im = Image.new("RGB", (w, h), (0, 0, 0))
    d = ImageDraw.Draw(im)
    ft, fb = ImageFont.truetype(str(font), round(h * 0.052)), ImageFont.truetype(str(font), round(h * 0.033))
    for f, wt in ((ft, b"Bold"), (fb, b"Medium")):           # variable fonts default to their thinnest weight
        try:
            f.set_variation_by_name(wt)
        except (OSError, ValueError):
            pass
    lines = [(title, ft, (255, 214, 64))] + [(s.format(at=at.format(r=ranges) if ranges else ""), fb, (235, 235, 235)) for s in body]
    hs = [d.textbbox((0, 0), s, font=f)[3] for s, f, _ in lines]
    y = (h - sum(hs) - h * 0.03 * len(lines)) / 2
    for (s, f, c), lh in zip(lines, hs):
        d.text((w / 2, y), s, font=f, fill=c, anchor="ma")
        y += lh + h * (0.06 if f is ft else 0.03)
    return im


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--lang", choices=sorted(TEXT), default="en")
    ap.add_argument("--seconds", type=float, default=5.0)
    ap.add_argument("--out")
    ap.add_argument("--force", action="store_true", help="make the card even without warning ranges")
    a = ap.parse_args()
    mp4 = kit_env.resolve(a.video)
    fj = mp4.with_name(mp4.stem + "_flash.json")
    if not fj.is_file():
        sys.exit(f"[preroll] no {fj.name}: run python tools/check_flash.py {a.video} first")
    fl = json.loads(fj.read_text(encoding="utf-8"))
    if fl.get("result") == "FAIL":
        sys.exit("[preroll] check_flash FAILED: fix the flashes first, a warning card does not make them safe")
    rg = fl.get("warning_ranges") or []
    if not rg and not a.force:
        print("[preroll] no warning ranges: no preroll needed (encode the share version as in references/08 section 4)")
        return 0
    # times in the share file: the film starts after the card; check_flash ranges are song time from the file's start
    shift = a.seconds - float(fl.get("start", 0))
    ranges = ", ".join(f"{fmt(x + shift)}-{fmt(y + shift)}" for x, y in rg)
    p = probe(mp4)
    if not p["audio"]:
        sys.exit("[preroll] the film has no audio stream (render it with the song: render_final.mjs)")
    out = kit_env.resolve(a.out) if a.out else mp4.with_name(mp4.stem + "_share.mp4")
    png = out.with_name(out.stem + "_card.png")
    card(p["w"], p["h"], a.lang, ranges).save(png)
    fps = f"{p['fps']:.6g}"
    fc = (f"[0:v]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setsar=1,fps={fps}[c];"
          f"[2:v]format=yuv420p,setsar=1[m];[1:a]aformat=sample_rates=48000:channel_layouts=stereo[ca];"
          f"[2:a]aresample=48000,aformat=channel_layouts=stereo[ma];[c][ca][m][ma]concat=n=2:v=1:a=1[v][a]")
    subprocess.run([kit_env.FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
                    "-loop", "1", "-framerate", fps, "-t", str(a.seconds), "-i", str(png),
                    "-f", "lavfi", "-t", str(a.seconds), "-i", "anullsrc=r=48000:cl=stereo", "-i", str(mp4),
                    "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p",
                    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
                    "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", str(out)], check=True)
    png.unlink()
    title, body, at = TEXT[a.lang]
    txt = out.with_name(mp4.stem + "_warning.txt")
    txt.write_text(title + "\n" + "\n".join(s.format(at=at.format(r=ranges) if ranges else "") for s in body) + "\n", encoding="utf-8")
    print(f"[preroll] {a.seconds:g} s card ({a.lang}{', ' + ranges if ranges else ''}) -> {kit_env.rel(out)}; "
          f"description text -> {kit_env.rel(txt)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
