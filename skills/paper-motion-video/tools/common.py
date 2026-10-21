"""Shared helpers: project layout, config, page generation, ffmpeg."""
import json
import os
import sys
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

DEFAULTS = {
    "voice": {"name": "af_heart", "speed": 1.1, "leadIn": 1.0, "tail": 5.0},
    "video": {"fps": 60, "phoneFps": 30, "targetSeconds": 120, "formats": ["landscape"]},
    "music": {"enabled": True, "preset": "hopeful", "key": "D", "bpm": 96, "bedLufs": -30, "sfx": True},
}


def die(msg):
    print(f"pmv: {msg}", file=sys.stderr)
    sys.exit(1)


class Project:
    def __init__(self, path):
        self.dir = Path(path).expanduser().resolve()
        cfg = self.dir / "config.json"
        if not cfg.exists():
            die(f"{self.dir} is not a project (no config.json). Create one with: pmv new <dir>")
        try:
            self.config = json.loads(cfg.read_text())
        except json.JSONDecodeError as e:
            die(f"config.json is not valid JSON: {e}")
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
        return json.loads(p.read_text())

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
        return json.loads(p.read_text()) if p.exists() else None


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
        paths["fonts"].write_text(css)
        kcss = _get(CDN["katex_css"]).decode()
        base = CDN["katex_css"].rsplit("/", 1)[0]
        for rel in sorted(set(re.findall(r"url\((fonts/[^)]+\.woff2)\)", kcss))):
            f = d / "katex" / rel
            if not f.exists():
                f.write_bytes(_get(f"{base}/{rel}"))
        kcss = re.sub(r",\s*url\(fonts/[^)]+\.(woff|ttf)\) format\(\"(woff|truetype)\"\)", "", kcss)
        paths["katex_css"].write_text(kcss)
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
    html = (RUNTIME / "index.html").read_text()
    fb = project.fbuild(fmt)
    audio = (fb / "mix.wav") if (fb / "mix.wav").exists() else (project.build / "voice.wav")
    audio = str(audio.relative_to(project.dir))
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
    out.write_text(html)
    return out


def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()
