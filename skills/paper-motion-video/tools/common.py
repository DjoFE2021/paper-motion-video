"""Shared helpers: project layout, config, setup options, progress records, page generation, ffmpeg."""
import json
import os
import re
import sys
import time
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
SKILL = TOOLS.parent
RUNTIME = SKILL / "runtime"
TEMPLATES = SKILL / "templates"
EXAMPLES = SKILL / "examples"
PMV_HOME = Path(os.environ.get("PMV_HOME", Path.home() / ".cache" / "paper-motion-video"))

# Output formats. landscape = 16:9 (YouTube, talks, desktop); portrait = 4:5 (LinkedIn / Instagram / X feeds on phones);
# vertical = 9:16 (Reels, Shorts, TikTok, Stories); square = 1:1. Each non-landscape format needs its own scenes.<format>.js.
FORMATS = {"landscape": (1920, 1080), "portrait": (1080, 1350), "vertical": (1080, 1920), "square": (1080, 1080)}


def frame_size(fmt, preview=False):
    """Pixel size of a rendered video: previews are half size, rounded down to even numbers for H.264 (portrait: 540x674)."""
    w, h = FORMATS[fmt]
    return (w // 4 * 2, h // 4 * 2) if preview else (w, h)

DEFAULTS = {
    "voice": {"name": "af_heart", "speed": 1.1, "leadIn": 1.0, "tail": 5.0},
    "video": {"fps": 60, "phoneFps": 30, "targetSeconds": 120, "formats": ["landscape"]},
    "music": {"enabled": True, "preset": "hopeful", "key": "D", "bpm": 96, "bedLufs": -30, "sfx": True},
}


def die(msg):
    print(f"pmv: {msg}", file=sys.stderr)
    RUN.end(error=msg)
    sys.exit(1)


# ---- setup options: `pmv new <dir> --length 90 ...` writes them into the project's config.json, and `pmv defaults ...`
# saves them for every new project in DEFAULTS_FILE (a fragment of config.json; any of its fields may go there)
DEFAULTS_FILE = Path(os.environ.get("PMV_DEFAULTS", Path.home() / ".config" / "paper-motion-video" / "defaults.json"))
MUSIC = ("hopeful", "reflective", "driving")


def parse_length(text):
    """'90', '90s', '2m', '1.5min' or '1:30' -> seconds"""
    s = text.strip().lower()
    m = re.fullmatch(r"(\d+):([0-5]\d)", s) or re.fullmatch(r"(\d+(?:\.\d+)?)\s*(s|sec|m|min)?", s)
    if not m:
        die(f"length {text!r}: give seconds (90), minutes (2m) or m:ss (1:30)")
    sec = int(m[1]) * 60 + int(m[2]) if ":" in s else float(m[1]) * (60 if m[2] in ("m", "min") else 1)
    if not 20 <= sec <= 900:
        die(f"length {text!r}: choose between 20 seconds and 15 minutes")
    return round(sec)


def setup_options(a):
    """the config.json fields the --length, --formats, --voice and --music flags ask for"""
    cfg = {}
    if a.length:
        cfg.setdefault("video", {})["targetSeconds"] = parse_length(a.length)
    if a.formats:
        fs = [f.strip() for f in a.formats.split(",") if f.strip()]
        if not fs or any(f not in FORMATS for f in fs):
            die(f"formats {a.formats!r}: choose from {', '.join(FORMATS)}, or a comma list")
        cfg.setdefault("video", {})["formats"] = fs
    if a.voice:
        if not re.fullmatch(r"[a-z]{2}_[a-z]+", a.voice):
            die(f"voice {a.voice!r}: a Kokoro voice such as af_heart or bm_george (references/storytelling.md lists them)")
        cfg["voice"] = {"name": a.voice}
    if a.music:
        if a.music != "off" and a.music not in MUSIC:
            die(f"music {a.music!r}: choose from {', '.join(MUSIC)} or off")
        cfg["music"] = {"enabled": False} if a.music == "off" else {"enabled": True, "preset": a.music}
    return cfg


def merge(base, extra):
    """`extra` over `base`, nested objects merged"""
    out = dict(base)
    for k, v in extra.items():
        out[k] = merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def user_defaults():
    try:
        return json.loads(DEFAULTS_FILE.read_text(encoding="utf-8")) if DEFAULTS_FILE.exists() else {}
    except json.JSONDecodeError as e:
        die(f"{DEFAULTS_FILE} is not valid JSON: {e}")


def clock(seconds):
    s = round(seconds)
    return f"{s // 60}:{s % 60:02d}"


def budget(seconds):
    """what fits a target length: (words low, words high, scenes low, scenes high)"""
    talk = max(seconds - 6, 10)   # the lead-in and the end card's hold carry no words
    scenes = round(seconds / 13)
    return 5 * round(2.05 * talk / 5), 5 * round(2.2 * talk / 5), max(3, scenes - 1), max(3, scenes + 1)


def describe_setup(cfg):
    """one line: the length and what fits it, formats, voice, music"""
    v, music = cfg.get("video", {}), cfg.get("music", {})
    t = v.get("targetSeconds", 120)
    lo, hi, slo, shi = budget(t)
    return (f"length {clock(t)} (a script of about {lo}–{hi} words, {slo}–{shi} scenes), formats "
            f"{', '.join(v.get('formats', ['landscape']))}, voice {cfg.get('voice', {}).get('name', 'af_heart')}, "
            f"music {music.get('preset', 'hopeful') if music.get('enabled', True) else 'off'}")


# ---- progress: one JSON file per run in PMV_PROGRESS_DIR, which the Claude Code progress pane (hooks/register.tsx at
# the repository's root) sets for its session. Without the variable nothing is written, and a failed write never stops pmv.
class Run:
    KEEP = 100   # runs kept in the folder

    def __init__(self):
        d = os.environ.get("PMV_PROGRESS_DIR")
        self.dir = Path(d) if d else None
        self.rec, self.written = None, 0.0

    def start(self, command, args):
        if self.dir is not None:
            t = now_ms()
            self.path = self.dir / f"{t}-{os.getpid()}.json"
            self.rec = {"command": command, "args": args, "project": None, "state": "running", "startedAt": t,
                        "step": None, "steps": []}
            self._write(prune=True)

    def update(self, **fields):
        if self.rec is not None:
            self.rec.update(fields)
            self._write()

    def step(self, name, fmt=None, total=None, unit=None, preview=False):
        """a new step of this run: narrate, review, stills, music, render, package, check or preview"""
        if self.rec is not None:
            self._close(ok=True)
            self.rec["step"] = {"name": name, "format": fmt, "preview": preview, "done": 0, "total": total,
                                "unit": unit, "startedAt": now_ms()}
            self._write()

    def advance(self, done):
        """`done` of the step's total, written at most twice a second"""
        step = self.rec and self.rec["step"]
        if step:
            step["done"] = done
            if done == step["total"] or time.time() - self.written > .5:
                self._write()

    def end(self, error=None):
        if self.rec is not None and self.rec["state"] == "running":
            self._close(ok=error is None)
            self.rec.update(state="failed" if error else "done", error=error, endedAt=now_ms())
            self._write()

    def _close(self, ok):
        if self.rec["step"]:
            self.rec["steps"].append({**self.rec["step"], "ok": ok, "endedAt": now_ms()})
            self.rec["step"] = None

    def _write(self, prune=False):
        self.rec["updatedAt"] = now_ms()
        try:
            self.dir.mkdir(parents=True, exist_ok=True)
            if prune:
                for old in sorted(self.dir.glob("*.json"))[:-self.KEEP]:
                    old.unlink()
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(self.rec), encoding="utf-8")
            os.replace(tmp, self.path)
            self.written = time.time()
        except OSError:
            pass


def now_ms():
    return round(time.time() * 1000)


RUN = Run()


class Project:
    def __init__(self, path):
        self.dir = Path(path).expanduser().resolve()
        cfg = self.dir / "config.json"
        if not cfg.exists():
            die(f"{self.dir} is not a project (no config.json). Create one with: pmv new <dir>")
        try:
            self.config = json.loads(cfg.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            die(f"config.json is not valid JSON: {e}")
        RUN.update(project=str(self.dir))
        for k, v in DEFAULTS.items():
            self.config[k] = {**v, **self.config.get(k, {})}
        self.build = self.dir / "build"
        self.build.mkdir(exist_ok=True)
        self.out = self.dir / "out"

    @property
    def name(self):
        return self.config.get("output") or self.dir.name

    def timeline(self):
        p = self.build / "timeline.json"
        if not p.exists():
            die("no build/timeline.json yet. Run: pmv narrate <project>")
        return json.loads(p.read_text(encoding="utf-8"))

    # ---- formats
    def formats(self, arg=None):
        """--format value ('portrait', 'landscape,portrait', 'all') or config video.formats"""
        if arg and arg != "all":
            fs = [f.strip() for f in arg.split(",") if f.strip()]
        else:
            fs = self.config["video"].get("formats") or ["landscape"]
        for f in fs:
            if f not in FORMATS:
                die(f"unknown format {f!r}; choose from {', '.join(FORMATS)}")
        return fs

    def fbuild(self, fmt="landscape"):
        d = self.build if fmt == "landscape" else self.build / fmt
        d.mkdir(parents=True, exist_ok=True)
        return d

    def scenes(self, fmt="landscape"):
        f = self.dir / ("scenes.js" if fmt == "landscape" else f"scenes.{fmt}.js")
        if not f.exists():
            die(f"{f.name} not found. The {fmt} format needs its own layout file: copy scenes.js to {f.name} and lay every "
                f"scene out for {FORMATS[fmt][0]}x{FORMATS[fmt][1]} (see examples/pit-llm/scenes.portrait.js and references/design.md)")
        return f

    def out_name(self, fmt="landscape"):
        return self.name + ("" if fmt == "landscape" else f"_{fmt}")

    def fps(self, fmt="landscape"):
        v = self.config["video"]
        return int(v.get("fps", 60) if fmt == "landscape" else v.get("phoneFps", 30))

    def events(self, fmt="landscape"):
        p = self.fbuild(fmt) / "events.json"
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


CDN = {
    "fonts": "https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300..700;1,8..60,300..700"
             "&family=Inter:wght@300..700&family=IBM+Plex+Mono:wght@400;500&display=block",
    "katex_css": "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css",
    "katex_js": "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js",
    "qrcode_js": "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js",
}
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def _get(url):
    import urllib.request
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def local_assets():
    """Download web fonts, KaTeX and the QR library once into PMV_HOME/assets so that renders
    work offline and many parallel browsers don't hit the network. Falls back to the CDN on failure."""
    import hashlib
    import re
    d = PMV_HOME / "assets"
    marker = d / ".ok-v1"
    paths = {"fonts": d / "fonts.css", "katex_css": d / "katex" / "katex.min.css",
             "katex_js": d / "katex" / "katex.min.js", "qrcode_js": d / "qrcode.min.js"}
    if marker.exists():
        return {k: v.as_uri() for k, v in paths.items()}
    try:
        (d / "fonts").mkdir(parents=True, exist_ok=True)
        (d / "katex" / "fonts").mkdir(parents=True, exist_ok=True)
        css = _get(CDN["fonts"]).decode()
        for u in sorted(set(re.findall(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", css))):
            f = d / "fonts" / (hashlib.sha1(u.encode()).hexdigest()[:16] + Path(u).suffix)
            if not f.exists():
                f.write_bytes(_get(u))
            css = css.replace(u, f.as_uri())
        paths["fonts"].write_text(css, encoding="utf-8")
        kcss = _get(CDN["katex_css"]).decode()
        base = CDN["katex_css"].rsplit("/", 1)[0]
        for rel in sorted(set(re.findall(r"url\((fonts/[^)]+\.woff2)\)", kcss))):
            f = d / "katex" / rel
            if not f.exists():
                f.write_bytes(_get(f"{base}/{rel}"))
        kcss = re.sub(r",\s*url\(fonts/[^)]+\.(woff|ttf)\) format\(\"(woff|truetype)\"\)", "", kcss)
        paths["katex_css"].write_text(kcss, encoding="utf-8")
        paths["katex_js"].write_bytes(_get(CDN["katex_js"]))
        paths["qrcode_js"].write_bytes(_get(CDN["qrcode_js"]))
        marker.touch()
        return {k: v.as_uri() for k, v in paths.items()}
    except Exception as e:
        print(f"pmv: could not cache fonts/KaTeX locally ({e}); using the CDN", file=sys.stderr)
        return dict(CDN)


def write_index(project: Project, local=True, fmt="landscape") -> Path:
    """Fill runtime/index.html for this project and format.
    local=True  -> <build>/render.html, assets from the local cache (headless renders, needs --allow-file-access-from-files)
    local=False -> <build>/index.html, assets from the CDN (interactive preview in any browser)"""
    tl = project.timeline()
    html = (RUNTIME / "index.html").read_text(encoding="utf-8")
    fb = project.fbuild(fmt)
    audio = (fb / "mix.wav") if (fb / "mix.wav").exists() else (project.build / "voice.wav")
    audio = audio.relative_to(project.dir).as_posix()   # used as a URL: forward slashes on Windows too
    w, h = FORMATS[fmt]
    cfg = {k: v for k, v in project.config.items() if not k.startswith("_")}
    rep = {
        "{{TITLE}}": project.config.get("title", "paper-motion-video"),
        "{{PROJECT_URI}}": project.dir.as_uri(),
        "{{RUNTIME_URI}}": RUNTIME.as_uri(),
        "{{SCENES_URI}}": project.scenes(fmt).as_uri(),
        "{{FORMAT}}": json.dumps({"name": fmt, "w": w, "h": h}),
        "{{TIMELINE}}": json.dumps(tl),
        "{{CONFIG}}": json.dumps(cfg),
        "{{AUDIO}}": audio,
    }
    for k, v in (local_assets() if local else CDN).items():
        rep["{{%s}}" % k.upper()] = v
    for a, b in rep.items():
        html = html.replace(a, b)
    out = fb / ("render.html" if local else "index.html")
    out.write_text(html, encoding="utf-8")
    return out


def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()
