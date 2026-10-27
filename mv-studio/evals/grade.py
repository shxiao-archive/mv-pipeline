"""Grade one run: python grade.py <run_dir> <eval_name>   (run_dir = .../with_skill or .../without_skill)
Writes <run_dir>/grading.json and <run_dir>/outputs/contact.png (frames every 2 s, for the viewer).
A juror's review (references/09 §8: a session that did not make the film, its JSON block saved as <run_dir>/jury.json)
is copied into grading.json as "jury" (scores, mean, critical count): an opinion for comparing runs, not a pass / fail.
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
    "stage-en-show": dict(size=(1920, 1080), span=(0.5, 33.5), lyr="lyrics_en.lrc", pops=True, stage=True, style="stage"),
    "treatise-en-plates": dict(size=(1920, 1080), span=(0.5, 33.5), lyr="lyrics_en.lrc", pops=True, style="interface", look="treatise"),
    "papercraft-en-quest": dict(size=(1920, 1080), span=(0.5, 33.5), lyr="lyrics_en.lrc", pops=True, style="papercraft"),
    "vocaloid-en-singer": dict(size=(1920, 1080), span=(0.5, 33.5), lyr="lyrics_en.lrc", pops=True, style="vocaloid"),
    "own-en-film": dict(size=(1920, 1080), span=(0.5, 33.5), lyr="lyrics_en.lrc", pops=True, style="own"),   # no preset asked for
    "magazine-en-press": dict(size=(1920, 1080), span=(0.5, 33.5), lyr="lyrics_en.lrc", pops=False, style="magazine"),   # one-tatum MZ.flash inserts are the style
}
SPEC["interface-en-chat"].update(style="interface", look="screen")   # look: which of the style's two kits the prompt asks for
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
        if f.is_file():
            mine += len(PAINT.findall(f.read_text(encoding="utf-8", errors="ignore")))
    for f in (proj / "engine" / "styles").rglob("*.js") if (proj / "engine" / "styles").is_dir() else []:
        if not (STARTER.parents[1] / "styles" / f.relative_to(proj / "engine" / "styles")).is_file():
            mine += len(PAINT.findall(f.read_text(encoding="utf-8", errors="ignore")))
    add("the film paints its own gags: >= 15 ST.paint / ST.ink / ST.puppet calls beyond the starter's",
        mine - base >= 15, f"{mine} calls in the project's own engine files, starter has {base}")
ENGINE = Path(__file__).resolve().parents[1] / "template" / "engine"
# per style: its scenes (None = the scene library), its starter timeline, and what its depth work looks like in code
STYLE = {
    # use: a film's own scene file that builds on the style (its scenes or its kit) counts as the style's scenes
    "interface": dict(scene=r"^(if|tr)[A-Z]", starter="starters/interface.js", use=r"\b(IF|TR)\.|['\"](if|tr)[A-Z]"),
    "papercraft": dict(scene=r"^pc[A-Z]", starter="starters/papercraft.js", use=r"\bPC\."),
    "stage": dict(scene=r"^st[A-Z]", starter="starters/stage.js", use=r"\bST\."),
    "magazine": dict(scene=r"^mz[A-Z]", starter="starters/magazine.js", use=r"\bMZ\.|['\"]mz[A-Z]"),
    "vocaloid": dict(scene=None, starter="starters/vocaloid.js"),
    "own": dict(scene=None, starter="starters/blank.js"),               # the film designs its own style (design-a-style.md)
}
V4 = {"withInserts": r"withInserts\(", "words": r"words\s*:\s*true", "inks": r"kind\s*:\s*['\"]inks", "limp": r"kind\s*:\s*['\"]limp",
      "fps": r"\bfps\s*:\s*\d", "replay": r"replay(Map)?\(", "tear": r"Z\.tear\(", "rays": r"\brays\s*:"}


def own_files(proj):
    """The project's engine files the agent wrote: (path, own lines). timeline.js (compared with the style's starter by
    the caller, so a shipped starter scores ~0) and files the template does not have; a template file the project
    carries (core/, styles/) is the template's."""
    eng, out = proj / "engine", []
    if not eng.is_dir():
        return out
    for f in eng.rglob("*.js"):
        rel = f.relative_to(eng)
        if rel.parts[0] in {"vendor", "fonts", "starters"}:            # starters/: the presets' starters, not the film's
            continue
        # shortcut: edits to a template file are not counted: a copy from an older skill differs line by line (drift, not
        # the agent's work); count them against the run's own skill snapshot once runs keep one
        if rel.as_posix() != "timeline.js" and (ENGINE / rel).is_file():
            continue
        lines = [l for l in f.read_text(encoding="utf-8", errors="ignore").splitlines() if l.strip() and not l.strip().startswith(("//", "*", "/*"))]
        if lines:
            out.append((rel.as_posix(), lines))
    return out


def style_checks(proj, add, style, look=None):
    """Every style: its scenes are used, every line is answered, the starter was replaced, and the project carries code
    of its own (references/10 §7: 80-150 lines per shot in the reference films, 5-15 in a first pass)."""
    cfg = STYLE[style]
    sj = proj / "plan" / "shots.json"
    shots = json.loads(sj.read_text(encoding="utf-8"))["shots"] if sj.is_file() else []
    declared = {i for s in shots for i in (s.get("line") if isinstance(s.get("line"), list) else [s.get("line")]) if isinstance(i, int)}
    if cfg["scene"]:
        own = set()                                                  # scenes the film registers in its own files on the style
        for name, ls in own_files(proj):
            if name.startswith("scenes/") and re.search(cfg["use"], "\n".join(ls)):
                own |= set(re.findall(r"Z\.scene\(\s*['\"](\w+)", "\n".join(ls)))
        mine = [s for s in shots if re.match(cfg["scene"], s.get("scene", "")) or s.get("scene") in own]
        add(f"uses the {style} style: >= 80% of the shots are its scenes and every lyric line 0-7 is declared by a shot",
            shots and len(mine) >= 0.8 * len(shots) and set(range(len(TRUTH))) <= declared,
            f"{len(mine)}/{len(shots)} style shots; lines declared {sorted(declared)}" if shots else "no plan/shots.json (run tools/storyboard.mjs)")
    else:
        add("every lyric line 0-7 is declared by a shot", shots and set(range(len(TRUTH))) <= declared,
            f"lines declared {sorted(declared)}" if shots else "no plan/shots.json (run tools/storyboard.mjs)")
    if style == "own":
        cp = proj / "docs" / "CONCEPT.md"
        concept = cp.read_text(encoding="utf-8", errors="ignore") if cp.is_file() else ""
        head = "## The film's style"
        block = concept.split(head, 1)[1].split("\n## ", 1)[0] if head in concept else ""
        field = lambda k: ((re.search(r"\*\*" + k + r"\*\*[^:\n]*:(.*)", block) or [None, ""])[1] or "").strip()
        tail = block.split("**Traits**", 1)[-1].split("\n- **", 1)[0].splitlines()[1:] if "**Traits**" in block else []
        traits = [l for l in tail if re.match(r"\s*([-*]|\d+[.)])\s+\S", l)] or [t for t in re.split(r"[;,]", field("Traits")) if t.strip()]
        add("docs/CONCEPT.md defines the film's own style: a Reads-as line and >= 6 traits", bool(field("Reads as")) and len(traits) >= 6,
            f"reads as: {field('Reads as')[:60]!r}; {len(traits)} traits" if block else "no 'The film's style' block")
    moments = [s.get("moment") or "" for s in shots]
    left = sum("REPLACE" in m for m in moments)
    add("the starter was replaced: no placeholder moments left and >= 80% of the moments are distinct",
        shots and not left and len(set(moments)) >= 0.8 * len(shots), f"{left} placeholder(s); {len(set(moments))} distinct of {len(shots)}")
    starter = set(l.strip() for l in (ENGINE / cfg["starter"]).read_text(encoding="utf-8").splitlines())
    files = [(n, [l for l in ls if l.strip() not in starter] if n == "timeline.js" else ls) for n, ls in own_files(proj)]
    n = sum(len(ls) for _, ls in files)
    per = n / max(1, len(shots))
    add("depth: >= 30 lines of the project's own code per shot (reference films 80-150, a first pass 5-15)", per >= 30,
        f"{n} own lines / {len(shots)} shots = {per:.0f} per shot; files: {', '.join(f'{k} {len(v)}' for k, v in files[:8])}")
    text = "\n".join(l for _, ls in files for l in ls)
    shot_names = {s.get("scene") for s in shots}
    if look == "screen":
        used = [k for k, rx in V4.items() if re.search(rx, text)]
        add("uses >= 2 of the v4 screen tools (inserts, words, ink plates, limp type, fps, replay, tear, rays)", len(used) >= 2, f"used: {used}")
    if look == "treatise":
        plates = sorted(x for x in shot_names if x and x.startswith("tr"))
        # in the project's OWN code: the starter's plate cycle already names trEngrave / trField
        gpu = bool(re.search(r"trEngrave|trField|Z\.(shade|lineBatch|glScene)\(", text))
        add(">= 4 distinct treatise plates", len(plates) >= 4, f"{plates}")
        add("at least one GPU plate in its own code (trEngrave / trField, or Z.shade / Z.lineBatch)", gpu, "yes" if gpu else "none")
        pen = bool(re.search(r"TR\.write\(|Z\.stroke\.|trEngrave|trField", text))
        add("a line written by the pen (TR.write / Z.stroke)", pen, "yes" if pen else "none")
    if style == "papercraft":
        # any quoted rig pose name (poses also come as keyed lists [[t, 'jump'], ...]); names from core/rig.js
        r = subprocess.run(["node", "-e", "const vm=require('vm'),fs=require('fs'),w={},c=vm.createContext({window:w,Math,console});"
                            "for(const f of ['core/util.js','core/rig.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);"
                            "console.log(w.Z.rig.biped.NAMES.join(' '))"], capture_output=True, text=True, cwd=ENGINE)
        names = set(r.stdout.split())
        poses = sorted({q for q in re.findall(r"['\"]([A-Za-z]+)['\"]", text) if q in names})
        add(">= 8 distinct rig poses named in the project's own code", len(poses) >= 8, f"{len(poses)}: {poses[:20]}")
        sheets = list((proj / "render" / "sheets").rglob("*.png")) + list((proj / "render" / "sheets").rglob("*.jpg")) if (proj / "render" / "sheets").is_dir() else []
        add("model sheets were rendered (render/sheets)", bool(sheets), f"{len(sheets)} images")


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
        if p.parent.name == "review" and p.parent.parent.name == "docs":    # the jury's reviews quote lines (09 §8)
            continue
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
    if sp.get("style"):
        style_checks(out / "project", add, sp["style"], sp.get("look"))
    if sp.get("estimated"):
        sm = (out / "summary.md").read_text(encoding="utf-8", errors="ignore") if (out / "summary.md").exists() else ""
        add("summary tells the user the lyric timing is estimated / approximate", re.search(r"estimat|approximat|rough", sm, re.I), "found" if re.search(r"estimat|approximat|rough", sm, re.I) else "not mentioned")
    # motion: the project's own motion check, which reads its plan and audio (the song's stops, declared holds, living
    # faces); the template's copy would see none of them (calibrated on the iteration-1 human review: <= ~25 % felt alive)
    if v:
        mc = out / "project" / "tools" / "motion_check.py"
        r = subprocess.run([PY, str(mc if mc.is_file() else TOOLS / "motion_check.py"), str(mp4), "--quiet"], capture_output=True, text=True)
        m = re.search(r"counted ([0-9.]+) s \(([0-9]+) %\)", r.stdout)   # motion_check: "totalling X s; counted Y s (Z %)"
        pct = int(m.group(2)) if m else 100
        add("the picture keeps moving: static stretches (>= 1.5 s with almost no motion) are at most 15 % of the video",
            m and pct <= 15, f"{pct} % static ({m.group(1) if m else '?'} s)")
    passed = sum(e["passed"] for e in ex)
    res = {"expectations": ex, "summary": {"passed": passed, "failed": len(ex) - passed, "total": len(ex), "pass_rate": round(passed / len(ex), 3)}}
    jury = jury_of(rd / "jury.json")
    if jury:
        res["jury"] = jury
    (rd / "grading.json").write_text(json.dumps(res, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{name}/{rd.name}: {passed}/{len(ex)}" + (f"  jury mean {jury['mean']} ({jury['critical']} critical)" if jury else ""))
    for e in ex:
        print(f"  {'PASS' if e['passed'] else 'FAIL'}  {e['text']}  -- {e['evidence']}")


JURY_DIMS = ("style_fidelity", "concept_story", "motion_craft", "composition_type", "finish", "sync", "technical")


def jury_of(p):
    """The juror's scores from jury.json (references/09 §8), checked: all seven dimensions, each 1-10; else None."""
    if not p.exists():
        return None
    j = json.loads(p.read_text(encoding="utf-8"))
    sc = {k: j.get("scores", {}).get(k) for k in JURY_DIMS}
    if not all(isinstance(v, (int, float)) and 1 <= v <= 10 for v in sc.values()):
        print(f"  jury.json ignored: scores must give {', '.join(JURY_DIMS)} as 1-10")
        return None
    return {"round": j.get("round"), "scores": sc, "mean": round(sum(sc.values()) / len(sc), 2), "critical": len(j.get("critical") or [])}


if __name__ == "__main__":
    main()
