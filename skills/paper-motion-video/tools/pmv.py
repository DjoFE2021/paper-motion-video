"""paper-motion-video command line (run through the `pmv` wrapper, which sets up the environment).

  pmv new <dir> [setup flags]          create a project from the template (--example pit-llm: the worked example)
  pmv defaults [setup flags] [--reset] show, or save, the setup every new project starts from
  pmv text <paper.pdf> [-o paper.txt]  extract the PDF's text with page markers (to search and quote from)
  pmv narrate <dir>                    voice-over + timeline + subtitles from script.txt (shared by all formats)
  pmv review <dir> [--times 3,12.5]    review stills, contact sheets and a layout audit (<build>/review/)
  pmv preview <dir>                    write <build>/index.html: open it in a browser to scrub/play
  pmv music <dir>                      score + sound design + mix (<build>/mix.wav)
  pmv video <dir> [--preview]          render frames (--preview: half size @ 30 fps); re-mixes if sound cues changed
  pmv final <dir> [--preview]          mux into out/, share copy, subtitles
  pmv check <dir> [--interval 2]       final pass: file checks, dense layout audit, sheets of the finished video
  pmv all <dir>                        narrate -> music -> video -> final -> check
  pmv figures <pdf|dir>... -o <dir>    rasterize figure PDFs to PNG
  pmv doctor                           check the environment
  pmv setup                            (re)install the environment into ~/.cache/paper-motion-video

Setup flags (new, defaults): --length 90 | 2m | 1:30 (default 2:00), --formats landscape,portrait,
--voice af_heart, --music hopeful|reflective|driving|off. They set video.targetSeconds, video.formats,
voice.name and music in config.json; `pmv defaults` saves them to ~/.config/paper-motion-video/defaults.json
(or $PMV_DEFAULTS), a config.json fragment that may hold any other field too, for every new project.

Formats: every command after `narrate` takes --format landscape|portrait|vertical|square (or a comma list, or
`all`); without it, the formats listed in config.json "video.formats" are used. landscape uses scenes.js and
build/; the others use scenes.<format>.js and build/<format>/, and write out/<name>_<format>.mp4.
"""
import argparse
import json
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (DEFAULTS_FILE, EXAMPLES, PMV_HOME, RUN, TEMPLATES, Project, describe_setup, die, merge,  # noqa: E402
                    setup_options, user_defaults)

TRACKED = ("new", "text", "narrate", "review", "preview", "music", "video", "final", "check", "all")   # in progress records


def cmd_new(a):
    dst = Path(a.dir).expanduser().resolve()
    src = EXAMPLES / a.example if a.example else TEMPLATES / "project"
    if not src.exists():
        die(f"unknown example {a.example!r}; available: {', '.join(p.name for p in EXAMPLES.iterdir() if p.is_dir())}")
    if dst.exists() and any(dst.iterdir()) and not a.force:
        die(f"{dst} exists and is not empty (use --force to copy into it anyway)")
    saved = {} if a.example else user_defaults()   # an example keeps its own setup unless a flag changes it
    extra = merge(saved, setup_options(a))
    dst.mkdir(parents=True, exist_ok=True)
    for f in src.iterdir():
        if f.name in ("build", "out", "README.md"):
            continue
        (shutil.copytree if f.is_dir() else shutil.copy)(f, dst / f.name, **({"dirs_exist_ok": True} if f.is_dir() else {}))
    (dst / "assets").mkdir(exist_ok=True)
    cfg_file = dst / "config.json"
    cfg = json.loads(cfg_file.read_text(encoding="utf-8"))
    if extra:
        cfg = merge(cfg, extra)
        cfg_file.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    RUN.update(project=str(dst))
    print(f"created {dst}\n  {describe_setup(cfg)}" + (f"\n  defaults from {DEFAULTS_FILE}" if saved else "") +
          f"\n  edit config.json, script.txt, scenes.js, then: pmv narrate {dst}")


def cmd_defaults(a):
    saved = {} if a.reset else user_defaults()
    if a.reset:
        DEFAULTS_FILE.unlink(missing_ok=True)
    extra = setup_options(a)
    if extra:
        saved = merge(saved, extra)
        DEFAULTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        DEFAULTS_FILE.write_text(json.dumps(saved, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    template = json.loads((TEMPLATES / "project" / "config.json").read_text(encoding="utf-8"))
    print(f"{DEFAULTS_FILE}{'' if saved else ' (nothing saved)'}\n  new projects: {describe_setup(merge(template, saved))}")


def cmd_text(a):
    import pymupdf
    src = Path(a.pdf).expanduser()
    if not src.exists() or src.stat().st_size == 0:
        die(f"{src}: missing or empty (an online-only cloud file? make it available offline)")
    doc = pymupdf.open(src)
    out = Path(a.out).expanduser() if a.out else src.with_suffix(".txt")
    with open(out, "w", encoding="utf-8") as fh:
        for k, page in enumerate(doc, 1):
            txt = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", page.get_text())   # keep it greppable as text
            fh.write(f"\n=== page {k} ===\n{txt}")
    RUN.update(output=str(out), pages=len(doc))
    print(f"{out}  ({len(doc)} pages). Search it with grep -n; quote numbers from it into facts.md with their page.")


def cmd_narrate(a):
    import narrate
    narrate.run(Project(a.dir))


def cmd_review(a):
    import render
    p = Project(a.dir)
    times = [float(x) for x in a.times.split(",")] if a.times else None
    for fmt in p.formats(a.format):
        render.stills(p, times, sheet=not a.no_sheet, audit=not a.no_audit, fmt=fmt)


def cmd_preview(a):
    from common import write_index
    p = Project(a.dir)
    for fmt in p.formats(a.format):
        RUN.step("preview", fmt)
        print(f"[{fmt}] {write_index(p, local=False, fmt=fmt).as_uri()}")


def ensure_mix(p, fmt, force=False):
    """(re)build the mix when the scenes' sound cues or the timings changed since the last mix"""
    import render
    import score
    ev = render.events(p, fmt)
    if force or score.stale(p, fmt, ev):
        RUN.step("music", fmt)
        if not force:
            print(f"[{fmt}] sound cues or timings changed since the last mix: re-running the score")
        score.run(p, fmt)


def cmd_music(a):
    p = Project(a.dir)
    for fmt in p.formats(a.format):
        ensure_mix(p, fmt, force=True)


def cmd_video(a):
    import render
    p = Project(a.dir)
    for fmt in p.formats(a.format):
        ensure_mix(p, fmt)
        render.video(p, fps=a.fps, workers=a.workers, start=a.start, end=a.end, preview=a.preview, fmt=fmt)


def cmd_final(a):
    import finalize
    p = Project(a.dir)
    for fmt in p.formats(a.format):
        finalize.run(p, preview=a.preview, share=not a.no_share, fmt=fmt)


def cmd_check(a):
    import check
    p = Project(a.dir)
    for fmt in p.formats(a.format):
        check.run(p, interval=a.interval, step=a.step, preview=a.preview, fmt=fmt)


def cmd_all(a):
    import check
    import finalize
    import narrate
    import render
    p = Project(a.dir)
    if not a.skip_narrate:
        narrate.run(p)
        p = Project(a.dir)
    for fmt in p.formats(a.format):
        ensure_mix(p, fmt, force=True)
        render.video(p, workers=a.workers, preview=a.preview, fmt=fmt)
        finalize.run(p, preview=a.preview, fmt=fmt)
        check.run(p, preview=a.preview, fmt=fmt)


def cmd_figures(a):
    import figures
    figures.run(a.inputs, a.out, zoom=a.zoom, pages=[int(x) for x in a.pages.split(",")] if a.pages else None, trim=not a.no_trim)


def cmd_doctor(a):
    import platform
    ok = True
    print(f"python {platform.python_version()}  ({sys.executable})")
    print(f"PMV_HOME {PMV_HOME}")
    for mod in ["numpy", "scipy", "torch", "kokoro", "soundfile", "playwright", "imageio_ffmpeg", "pyloudnorm", "PIL", "pymupdf"]:
        try:
            m = __import__(mod)
            print(f"  ok  {mod} {getattr(m, '__version__', '')}")
        except Exception as e:
            ok = False
            print(f"  !!  {mod}: {e}")
    try:
        from common import ffmpeg
        print(f"  ok  ffmpeg {ffmpeg()}")
    except Exception as e:
        ok = False
        print(f"  !!  ffmpeg: {e}")
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            try:
                p.chromium.launch(channel="chrome", headless=True).close()
                print("  ok  browser: Google Chrome")
            except Exception:
                p.chromium.launch(headless=True).close()
                print("  ok  browser: Playwright Chromium")
    except Exception as e:
        ok = False
        print(f"  !!  browser: {e}")
    hf = PMV_HOME / "hf"
    print(f"  {'ok' if any(hf.rglob('*.pth')) else '!!'}  Kokoro weights in {hf}")
    try:
        import urllib.request
        urllib.request.urlopen("https://fonts.googleapis.com/css2?family=Inter", timeout=8)
        urllib.request.urlopen("https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js", timeout=8)
        print("  ok  network (Google Fonts, cdnjs)")
    except Exception as e:
        ok = False
        print(f"  !!  network: {e} (rendering needs fonts and KaTeX from the web)")
    print("all good" if ok else "problems found: re-run `pmv setup` or see references/troubleshooting.md")


def main():
    ap = argparse.ArgumentParser(prog="pmv", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    s = sp.add_parser("new"); s.add_argument("dir"); s.add_argument("--example"); s.add_argument("--force", action="store_true"); s.set_defaults(f=cmd_new)
    s = sp.add_parser("defaults"); s.add_argument("--reset", action="store_true", help="forget the saved defaults"); s.set_defaults(f=cmd_defaults)
    for name in ("new", "defaults"):
        s = sp.choices[name]
        s.add_argument("--length", help="target length: 90, 2m or 1:30 (default 2:00)")
        s.add_argument("--formats", help="landscape, portrait, vertical, square, or a comma list")
        s.add_argument("--voice", help="Kokoro voice: af_heart (default), bf_emma, bm_george, ...")
        s.add_argument("--music", help="hopeful (default), reflective, driving, or off")
    s = sp.add_parser("text"); s.add_argument("pdf"); s.add_argument("-o", "--out"); s.set_defaults(f=cmd_text)
    s = sp.add_parser("narrate"); s.add_argument("dir"); s.set_defaults(f=cmd_narrate)
    s = sp.add_parser("review"); s.add_argument("dir"); s.add_argument("--times"); s.add_argument("--no-sheet", action="store_true")
    s.add_argument("--no-audit", action="store_true"); s.set_defaults(f=cmd_review)
    s = sp.add_parser("preview"); s.add_argument("dir"); s.set_defaults(f=cmd_preview)
    s = sp.add_parser("music"); s.add_argument("dir"); s.set_defaults(f=cmd_music)
    s = sp.add_parser("video"); s.add_argument("dir"); s.add_argument("--preview", action="store_true"); s.add_argument("--fps", type=int)
    s.add_argument("--workers", type=int); s.add_argument("--start", type=float, default=0.0); s.add_argument("--end", type=float); s.set_defaults(f=cmd_video)
    s = sp.add_parser("final"); s.add_argument("dir"); s.add_argument("--preview", action="store_true"); s.add_argument("--no-share", action="store_true"); s.set_defaults(f=cmd_final)
    s = sp.add_parser("check"); s.add_argument("dir"); s.add_argument("--interval", type=float, default=2.0); s.add_argument("--step", type=float, default=.25)
    s.add_argument("--preview", action="store_true"); s.set_defaults(f=cmd_check)
    s = sp.add_parser("all"); s.add_argument("dir"); s.add_argument("--preview", action="store_true"); s.add_argument("--workers", type=int)
    s.add_argument("--skip-narrate", action="store_true"); s.set_defaults(f=cmd_all)
    s = sp.add_parser("figures"); s.add_argument("inputs", nargs="+"); s.add_argument("-o", "--out", required=True); s.add_argument("--zoom", type=float, default=3.0)
    s.add_argument("--pages"); s.add_argument("--no-trim", action="store_true"); s.set_defaults(f=cmd_figures)
    for name in ("review", "preview", "music", "video", "final", "check", "all"):
        sp.choices[name].add_argument("--format", help="landscape, portrait, vertical, square, a comma list, or all (default: config video.formats)")
    s = sp.add_parser("doctor"); s.set_defaults(f=cmd_doctor)
    s = sp.add_parser("help"); s.set_defaults(f=lambda a: print(__doc__))
    a = ap.parse_args()
    if a.cmd in TRACKED:
        RUN.start(a.cmd, sys.argv[1:])
    try:
        a.f(a)
    except KeyboardInterrupt:
        RUN.end(error="interrupted")
        raise
    except Exception as e:
        RUN.end(error=f"{type(e).__name__}: {e}")
        raise
    RUN.end()


if __name__ == "__main__":
    main()
