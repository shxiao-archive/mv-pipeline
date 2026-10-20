"""Grade one run: python grade.py <run_dir> <eval_name>   (run_dir = .../with_skill or .../without_skill)
Writes <run_dir>/grading.json and <run_dir>/outputs/contact.png (frames every 2 s, for the viewer).
Fixtures: python fixtures/make_test_song.py fixtures   (test_song.wav + the three lyric files of evals.json)."""
import json, re, shutil, subprocess, sys
from pathlib import Path
import numpy as np

FF = shutil.which("ffmpeg"); FP = shutil.which("ffprobe")
FIX = Path(__file__).resolve().parent / "fixtures"
SR8 = 8000
T0, PER = 0.25, 0.5                      # fixture beat grid (120 BPM)
SPEC = {
    "interface-en-chat": dict(size=(1920, 1080), span=(0.5, 33.5), lyr="lyrics_en.lrc", pops=True),
    "signal-zh-glitch": dict(size=(1920, 1080), span=(0.5, 33.5), lyr="lyrics_zh.lrc", pops=False),   # 1-2 frame inserts are the style
    "tegaki-vertical-plain": dict(size=(1080, 1920), span=(0.5, 33.5), fps=30, lyr="lyrics_en_plain.txt", estimated=True, pops=True),
    "stage-en-show": dict(size=(1920, 1080), span=(0.5, 33.5), lyr="lyrics_en.lrc", pops=True, stage=True),
}
STARTER = Path(__file__).resolve().parents[1] / "template" / "engine" / "starters" / "stage.js"
PAINT = re.compile(r"\bST\.(paint|ink|puppet|dancer)\(")


def stage_checks(proj, add):
    """Stage style: the style is used, the starter was replaced (not shipped), and the film paints its own gags."""
    sj = proj / "plan" / "shots.json"
    shots = json.loads(sj.read_text(encoding="utf-8"))["shots"] if sj.is_file() else []
    st = [s for s in shots if re.match(r"^st[A-Z]", s.get("scene", ""))]
    declared = {i for s in shots for i in (s.get("line") if isinstance(s.get("line"), list) else [s.get("line")]) if isinstance(i, int)}
    add("uses the stage style: >= 80% of the shots are st* scenes and every lyric line 0-7 is declared by a shot",
        shots and len(st) >= 0.8 * len(shots) and set(range(len(TRUTH))) <= declared,
        f"{len(st)}/{len(shots)} st* shots; lines declared {sorted(declared)}" if shots else "no plan/shots.json (run tools/storyboard.mjs)")
    moments = [s.get("moment") or "" for s in shots]
    left = sum("REPLACE" in m for m in moments)
    add("the starter was replaced: no placeholder moments left and >= 80% of the moments are distinct",
        shots and not left and len(set(moments)) >= 0.8 * len(shots), f"{left} placeholder(s); {len(set(moments))} distinct of {len(shots)}")
    base = len(PAINT.findall(STARTER.read_text(encoding="utf-8")))
    mine = 0
    for f in [proj / "engine" / "timeline.js", *(proj / "engine" / "scenes").glob("*.js"), *(proj / "engine" / "tests").glob("*.js")]:
        if f.is_file() and not (f.parent.name == "scenes" and (STARTER.parents[1] / "scenes" / f.name).is_file()):
            mine += len(PAINT.findall(f.read_text(encoding="utf-8", errors="ignore")))
    for f in (proj / "engine" / "styles").rglob("*.js") if (proj / "engine" / "styles").is_dir() else []:
        if not (STARTER.parents[1] / "styles" / f.relative_to(proj / "engine" / "styles")).is_file():
            mine += len(PAINT.findall(f.read_text(encoding="utf-8", errors="ignore")))
    add("the film paints its own gags: >= 15 ST.paint / ST.ink / ST.puppet calls beyond the starter's",
        mine - base >= 15, f"{mine} calls in the project's own engine files, starter has {base}")
TRUTH = [4.25, 8.25, 12.25, 16.25, 20.25, 22.25, 26.25, 28.25]   # sung line onsets of the fixture song (all three lyric files)
LRC_TIME = re.compile(r"\[(\d+):(\d+(?:\.\d+)?)\]")
TOOLS = Path(__file__).resolve().parents[1] / "template" / "tools"
PY = sys.executable


def run(cmd):
    return subprocess.run(cmd, capture_output=True)


def pcm(path, start=None):
    r = run([FF, "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR8), "-f", "f32le", "-"])
    return np.frombuffer(r.stdout, dtype=np.float32)


def offset_in_song(mp4):
    """Song time of the video's first frame, from audio cross-correlation (None if no audio)."""
    # Normalised cross-correlation of the WHOLE video audio against the song (the test song repeats every few bars,
    # so short windows are ambiguous). Lags from -10 s (a silent lead-in before the song) to the end of the song.
    a, s = pcm(mp4), pcm(FIX / "test_song.wav")
    if len(a) < SR8:
        return None
    lead = 10 * SR8
    sp = np.concatenate([np.zeros(lead), s, np.zeros(len(a))])
    n = len(sp) + len(a)
    xc = np.fft.irfft(np.fft.rfft(sp, n) * np.conj(np.fft.rfft(a, n)), n)[: len(sp) - len(a) + 1]
    c = np.concatenate([[0], np.cumsum(sp ** 2)])
    energy = np.sqrt(np.maximum(c[len(a):] - c[: -len(a)], 1e-9))[: len(xc)]
    score = xc / (energy * np.sqrt((a ** 2).sum()) + 1e-9)
    k = int(np.argmax(score))
    return (k - lead) / SR8   # song time of the video's first sample (negative: lead-in before the song)


def frags(lyr):
    text = (FIX / lyr).read_text(encoding="utf-8")
    out = set()
    for row in text.splitlines():
        row = re.sub(r"\[[^\]]*\]", "", row).strip().lstrip("*").lower()
        w = re.findall(r"[a-z0-9']+", row)
        out |= {"w:" + " ".join(w[i:i + 4]) for i in range(len(w) - 3)}
        h = "".join(re.findall(r"[一-鿿]", row))
        out |= {"c:" + h[i:i + 6] for i in range(len(h) - 5)}
    return out


def lyric_hits(project, fr):
    hits = []
    if not project.exists():
        return hits
    for p in project.rglob("*"):
        parts = set(p.parts)
        if not p.is_file() or parts & {"node_modules", "media", "out", ".git", "__pycache__", "data", "analysis", "audio", "vendor", "render", "fonts", "_grok"} or p.name == "jizura_engine.js":
            continue
        if p.suffix.lower() not in {".js", ".mjs", ".html", ".json", ".py", ".ts", ".css", ".md"} or p.name.lower() == "summary.md":
            continue
        try:
            t = p.read_text(encoding="utf-8", errors="ignore").lower()
        except Exception:
            continue
        for row in t.splitlines():
            w = re.findall(r"[a-z0-9']+", row); h = "".join(re.findall(r"[一-鿿]", row))
            if any("w:" + " ".join(w[i:i + 4]) in fr for i in range(len(w) - 3)) or any("c:" + h[i:i + 6] in fr for i in range(len(h) - 5)):
                hits.append(str(p.relative_to(project))); break
    return hits


def main():
    rd, name = Path(sys.argv[1]), sys.argv[2]
    sp, out, ex = SPEC[name], rd / "outputs", []
    add = lambda text, ok, ev: ex.append({"text": text, "passed": bool(ok), "evidence": ev})
    mp4 = out / "final.mp4"
    if not mp4.exists():
        cands = sorted(out.rglob("*.mp4"), key=lambda p: p.stat().st_size, reverse=True)
        mp4 = cands[0] if cands else mp4
    info = {}
    if mp4.exists():
        pr = json.loads(run([FP, "-v", "error", "-show_streams", "-show_format", "-of", "json", str(mp4)]).stdout or b"{}")
        v = next((s for s in pr.get("streams", []) if s["codec_type"] == "video"), None)
        a = next((s for s in pr.get("streams", []) if s["codec_type"] == "audio"), None)
        info = dict(v=v, a=a, dur=float(pr.get("format", {}).get("duration", 0)))
    v, a = info.get("v"), info.get("a")
    add("final video exists with an h264 video stream and an AAC audio stream", v and a and v["codec_name"] == "h264" and a["codec_name"] == "aac",
        f"{mp4.name}: video={v and v['codec_name']} audio={a and a['codec_name']}" if v else "no mp4 found")
    W, H = sp["size"]
    add(f"resolution is {W}x{H}", v and (v["width"], v["height"]) == (W, H), f"{v and v['width']}x{v and v['height']}")
    if "fps" in sp:
        fps = eval(v["r_frame_rate"]) if v else 0
        add(f"frame rate is {sp['fps']} fps", abs(fps - sp["fps"]) < 0.1, f"{fps:.2f} fps")
    off = offset_in_song(mp4) if v and a else None
    if v and off is not None:
        s0, s1 = off, off + info["dur"]
        ok = s0 <= sp["span"][0] and s1 >= sp["span"][1] and info["dur"] <= sp.get("maxdur", 1e9)
        add(f"covers song time {sp['span'][0]:.0f}-{sp['span'][1]:.0f} s" + (f" and is at most {sp['maxdur']} s long" if "maxdur" in sp else ""),
            ok, f"video spans song time {s0:.2f}-{s1:.2f} s ({info['dur']:.2f} s)")
    else:
        add("covers the requested song span", False, "no audio to align")
    # cuts on the beat grid
    if v and off is not None:
        fps = eval(v["r_frame_rate"])
        raw = run([FF, "-v", "error", "-i", str(mp4), "-vf", "scale=64:36,format=gray", "-f", "rawvideo", "-"]).stdout
        g = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 64 * 36).astype(np.float32) / 255
        d = np.abs(np.diff(g, axis=0)).mean(axis=1)
        idx = [i + 1 for i in range(len(d)) if d[i] > 0.06 and d[i] >= d[max(0, i - 1)] and d[i] >= d[min(len(d) - 1, i + 1)]]
        # one event per burst: fast motion inside a shot gives several peaks close together; keep the strongest
        ev = []
        for i in idx:
            if ev and (i - ev[-1]) / fps < 0.35:
                if d[i - 1] > d[ev[-1] - 1]:
                    ev[-1] = i
            else:
                ev.append(i)
        # a transition (wipe, zoom) peaks part-way through: date each event from its ONSET, i.e. walk back from the
        # peak while the frame change stays above 30 % of the peak (at most 0.5 s)
        # A lead-in transition (align 'end') ENDS on the beat; one that starts on the cut (align 'start') BEGINS on it.
        # So an event is on the grid if its onset OR its end (walk forward while > 30 % of the peak) is.
        on, en = [], []
        for i in ev:
            j, pk = i, d[i - 1]
            while j - 1 > 0 and d[j - 2] > 0.3 * pk and (i - (j - 1)) / fps <= 0.5:
                j -= 1
            e = i
            while e < len(d) and d[e] > 0.3 * pk and (e + 1 - i) / fps <= 0.5:
                e += 1
            on.append(j); en.append(e)
        # a planned transition (wipe, iris: plan/shots.json `trans`) is dated from its start, which is on the grid; its
        # visible change peaks part-way through, so events inside a transition window are skipped (as check_sync does)
        sj = out / "project" / "plan" / "shots.json"
        tw = [(s["t0"] - 0.05, s["t0"] + s["trans"]["dur"] + 0.1) for s in json.loads(sj.read_text(encoding="utf-8"))["shots"]
              if s.get("trans") and s["trans"].get("dur")] if sj.is_file() else []
        inside = lambda t: any(a <= t <= b for a, b in tw)
        keep = [k for k in range(len(on)) if on[k] / fps + off > 0.3 and not inside(on[k] / fps + off)]
        times = np.array([on[k] / fps + off for k in keep])
        ends = np.array([en[k] / fps + off for k in keep])
        gd = lambda x: np.abs(((x - T0) / (PER / 2) + 0.5) % 1 - 0.5) * (PER / 2)
        dist = np.minimum(gd(times), gd(ends)) if len(times) else np.array([])
        frac = float((dist <= 0.05).mean()) if len(times) else 0.0
        add("at least 3 hard cuts, and >= 75% of them land within 50 ms of a beat / half-beat", len(times) >= 3 and frac >= 0.75,
            f"{len(times)} hard cuts; {frac:.0%} on grid; at song times {np.round(times, 2).tolist()[:20]}" + (f"; {len(tw)} planned transitions skipped" if tw else ""))
        # systematic lateness: the signed distance of each cut onset to the nearest beat / half-beat (one frame = 33 ms)
        sd = lambda x: (((x - T0) / (PER / 2) + 0.5) % 1 - 0.5) * (PER / 2)
        near = [sd(t) for t, dd in zip(times, dist) if dd <= 0.12]
        med = float(np.median(near)) if near else 1.0
        add("cuts are not systematically late or early: median offset of the cuts from the beat grid within one frame",
            len(near) >= 3 and abs(med) <= 1 / fps + 1e-3, f"median {med * 1000:+.0f} ms over {len(near)} cuts near the grid")
        # short unplanned flashes: 1-3 frames that change and then come back (not a cut: a cut does not come back)
        if sp.get("pops"):
            pops = []
            for i in range(1, len(g) - 1):
                if d[i - 1] > 0.06:
                    for k in (1, 2, 3):
                        if i + k < len(g) and np.abs(g[i - 1] - g[i + k]).mean() < 0.015 and d[i - 1] > 4 * np.abs(g[i - 1] - g[i + k]).mean():
                            pops.append(round(i / fps + off, 2)); break
            add("no short unplanned flashes (1-3 frames that change and return)", len(pops) == 0,
                f"{len(pops)} at song times {pops[:12]}" if pops else "none")
        # contact sheet for the viewer
        run([FF, "-v", "error", "-y", "-i", str(mp4), "-vf", f"fps=0.5,scale={'320:-2' if W >= H else '-2:320'},tile=6x3:padding=4", "-frames:v", "1", str(out / "contact.png")])
    # flash check
    if v:
        r = subprocess.run([PY, str(TOOLS / "check_flash.py"), str(mp4)], capture_output=True, text=True)
        worst = [float(x) for x in re.findall(r"worst 1 s window = ([0-9.]+)", r.stdout)]
        add("passes the photosensitivity check (<= 3 flashes in any second, general and red)", worst and max(worst) <= 3, f"worst windows {worst}")
    hits = lyric_hits(out / "project", frags(sp["lyr"]))
    add("no lyric text hard-coded in the project's source / config files", not hits and (out / "project").exists(),
        "clean" if not hits and (out / "project").exists() else (f"lyric text in: {hits[:6]}" if hits else "no project folder"))
    # lyric timing accuracy: the project's LRC line starts against the sung onsets of the fixture
    lrcs = [q for q in (out / "project").rglob("*.lrc") if not set(q.parts) & {"node_modules", "vendor", "demo", "backup"}] if (out / "project").exists() else []
    lrc = next((q for q in lrcs if q.name == "lyrics_mv.lrc"), lrcs[0] if lrcs else None)
    if lrc:
        ts = []
        for row in lrc.read_text(encoding="utf-8", errors="ignore").splitlines():
            body = LRC_TIME.sub("", row).strip()
            if body and not re.match(r"^\[?(間奏|interlude|inst)", body, re.I):
                ts += [int(m.group(1)) * 60 + float(m.group(2)) for m in LRC_TIME.finditer(row)]
        ts = sorted(ts)[:len(TRUTH)]
        errs = [abs(a - b) for a, b in zip(ts, TRUTH)]
        good = sum(e <= 0.12 for e in errs)
        add("lyric timing: >= 90% of the line starts within 120 ms of where the lines are sung", len(ts) == len(TRUTH) and good / len(TRUTH) >= 0.9,
            f"{good}/{len(TRUTH)} within 120 ms ({lrc.relative_to(out / 'project').as_posix()}); errors {[round(e, 2) for e in errs]}")
    else:
        add("lyric timing: >= 90% of the line starts within 120 ms of where the lines are sung", False, "no .lrc in the project")
    if sp.get("stage"):
        stage_checks(out / "project", add)
    if sp.get("estimated"):
        sm = (out / "summary.md").read_text(encoding="utf-8", errors="ignore") if (out / "summary.md").exists() else ""
        add("summary tells the user the lyric timing is estimated / approximate", re.search(r"estimat|approximat|rough", sm, re.I), "found" if re.search(r"estimat|approximat|rough", sm, re.I) else "not mentioned")
    # motion: the template's motion check (calibrated on the iteration-1 human review: <= ~25 % static felt alive)
    if v:
        r = subprocess.run([PY, str(TOOLS / "motion_check.py"), str(mp4), "--quiet"], capture_output=True, text=True)
        m = re.search(r"totalling ([0-9.]+) s \(([0-9]+) %\)", r.stdout)
        pct = int(m.group(2)) if m else 100
        add("the picture keeps moving: static stretches (>= 1.5 s with almost no motion) are at most 15 % of the video",
            m and pct <= 15, f"{pct} % static ({m.group(1) if m else '?'} s)")
    passed = sum(e["passed"] for e in ex)
    res = {"expectations": ex, "summary": {"passed": passed, "failed": len(ex) - passed, "total": len(ex), "pass_rate": round(passed / len(ex), 3)}}
    (rd / "grading.json").write_text(json.dumps(res, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{name}/{rd.name}: {passed}/{len(ex)}")
    for e in ex:
        print(f"  {'PASS' if e['passed'] else 'FAIL'}  {e['text']}  -- {e['evidence']}")


if __name__ == "__main__":
    main()
