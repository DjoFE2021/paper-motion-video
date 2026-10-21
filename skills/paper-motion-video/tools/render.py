"""Headless-Chrome rendering: review stills (+ contact sheets + layout audit), sound-event export, video.
Every function takes a format (landscape, portrait, vertical, square); see common.FORMATS."""
import asyncio
import json
import math
import os
import subprocess
import time

from common import FORMATS, RUN, Project, die, ffmpeg, frame_size, write_index

AUDIT_JS = r"""
() => {
  const vis = el => { let o = 1; for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= parseFloat(cs.opacity); } return o; };
  const groups = new Map(), issues = [], seen = new Set(), small = new Set();
  // the box a text belongs to: a .card / .chip / .box ancestor, or the element named by data-within
  const boxOf = el => el.closest('.card, .chip, .box') || (el.closest('[data-within]') ? document.getElementById(el.closest('[data-within]').dataset.within) : null);
  const inner = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el), f = k => parseFloat(cs[k]) || 0;
    return { l: r.left + f('borderLeftWidth') + f('paddingLeft'), r: r.right - f('borderRightWidth') - f('paddingRight'),
             t: r.top + f('borderTopWidth') + f('paddingTop'), b: r.bottom - f('borderBottomWidth') - f('paddingBottom') }; };
  for (const root of [document.getElementById('world'), document.getElementById('subs')]) {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.textContent.trim()) continue;
      const p = n.parentElement; if (!p) continue;
      const g = p.closest('.sub') || p.closest('.katex')?.closest('.abs') || p.closest('.abs') || p;
      const op = vis(p);
      if (op < .12) continue;   // words that have not faded in yet / are gone
      const r = document.createRange(); r.selectNodeContents(n);
      const key = n.textContent.trim().slice(0, 40);
      // minimum size (for math, the formula's base size: sub/superscripts are smaller by design)
      // math and sub/superscripts are measured at their base size (indices are meant to be smaller)
      const kx = p.closest('.katex') || (/^(SUB|SUP)$/.test(p.tagName) ? p.parentElement : null), fs = parseFloat(getComputedStyle(kx || p).fontSize) || 16;
      // effective size on screen: CSS transforms (UI.move, scaled layers) shrink text without changing font-size
      const host = (kx || p).closest('.abs') || p, lh = host.offsetHeight;
      const eff = fs * (lh ? host.getBoundingClientRect().height / lh : 1) / (window.STAGE_SCALE || 1);
      if (op > .6 && root.id === 'world' && eff < TYPE.min - .5 && !small.has(key)) {
        small.add(key); issues.push(`text too small for phones (${Math.round(eff)}px on screen < ${TYPE.min}px): "${key}"`);
      }
      const box = boxOf(p);
      if (box && op > .95 && vis(box) > .95) {   // text must stay inside its card / chip / box
        const c = inner(box), tv = Math.max(2, .22 * fs);
        for (const q of r.getClientRects()) {
          if (q.width < 1) continue;
          const over = Math.max(q.right - c.r, c.l - q.left), overV = Math.max(q.bottom - c.b, c.t - q.top);
          if ((over > 2 || overV > tv) && !seen.has(key)) {
            seen.add(key);
            issues.push(`text runs outside its card by ${Math.round(Math.max(over, overV - tv))}px: "${key}"`);
          }
        }
      }
      for (const b of r.getClientRects()) {
        if (b.width < 1 || b.height < 1) continue;
        const cur = groups.get(g) || { l: 1e9, t: 1e9, r: -1e9, b: -1e9, text: '', op: 0 };
        cur.op = Math.max(cur.op, op);
        cur.l = Math.min(cur.l, b.left); cur.t = Math.min(cur.t, b.top); cur.r = Math.max(cur.r, b.right); cur.b = Math.max(cur.b, b.bottom);
        if (cur.text.length < 60) cur.text += n.textContent.trim() + ' ';
        groups.set(g, cur);
      }
    }
  }
  const items = [], ghosts = [];
  for (const [el, r] of groups) {
    const o = Math.min(vis(el), r.op), it = { el, ...r, o, sub: !!el.closest('.sub'), text: r.text.trim().slice(0, 48) };
    if (o > .45) items.push(it); else if (o > .12 && !it.sub) ghosts.push(it);
  }
  // faded text (leaving or arriving) lying under solid text: a hand-off where the old content is still there
  for (const g of ghosts) for (const a of items) {
    if (a.sub || a.o < .7 || a.el.contains(g.el) || g.el.contains(a.el)) continue;
    const w = Math.min(a.r, g.r) - Math.max(a.l, g.l), h = Math.min(a.b, g.b) - Math.max(a.t, g.t);
    if (w > 4 && h > 4) issues.push(`ghost: faded "${g.text}" lies under "${a.text}" during a transition`);
  }
  // text lying on a card, chip, cell or bar it does not belong to
  const solids = [...document.querySelectorAll('#world .card, #world .chip, #world .box, #world .solid')]
    .filter(e => vis(e) > .5).map(e => ({ e, r: e.getBoundingClientRect() }));
  for (const a of items) {
    if (a.sub) continue;
    const ta = (a.r - a.l) * (a.b - a.t);
    for (const { e, r } of solids) {
      if (e.contains(a.el) || a.el.contains(e)) continue;
      const w = Math.min(a.r, r.right) - Math.max(a.l, r.left), h = Math.min(a.b, r.bottom) - Math.max(a.t, r.top);
      if (w > 4 && h > 4 && w * h > .15 * ta) {
        const what = e.classList.contains('solid') ? 'a bar' : 'a card';
        issues.push(`text sits on ${what} it does not belong to: "${a.text}"`); break;
      }
    }
  }
  const W = LAY.W, H = LAY.H;
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (!a.sub && a.b > LAY.subTop - 4 && a.t < H - LAY.subBottom + 8) issues.push(`enters the subtitle band (y>${LAY.subTop}): "${a.text}"`);
    if (a.l < 30 || a.r > W - 30 || a.t < 24 || a.b > H - 24) issues.push(`outside the safe frame: "${a.text}" [${a.l|0},${a.t|0},${a.r|0},${a.b|0}]`);
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if (w <= 2 || h <= 2) continue;
      const area = w * h, sm = Math.min((a.r - a.l) * (a.b - a.t), (b.r - b.l) * (b.b - b.t));
      if (area / sm > .25) { issues.push(`text overlap: "${a.text}"  x  "${b.text}"`); continue; }
    }
    // texts on the same line that touch or nearly touch ("64.3%+28 pts"), or a label grazing another
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (a.sub || b.sub || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const hv = Math.min(a.b, b.b) - Math.max(a.t, b.t), minH = Math.min(a.b - a.t, b.b - b.t);
      const gap = Math.max(a.l, b.l) - Math.min(a.r, b.r);   // horizontal gap (negative = overlap)
      if (hv > .45 * minH && gap < 8)
        issues.push(`texts touch (less than 8px apart): "${a.text}"  x  "${b.text}"`);
    }
  }
  return { issues, errors: (window.__errors || []).slice(0, 5) };
}
"""


def launch_args():
    return {"headless": True, "args": ["--force-color-profile=srgb", "--hide-scrollbars", "--allow-file-access-from-files"]}


async def open_page(p, project, scale=1.0, fmt="landscape"):
    try:
        b = await p.chromium.launch(channel="chrome", **launch_args())
    except Exception:
        b = await p.chromium.launch(**launch_args())
    w, h = FORMATS[fmt]
    pg = await b.new_page(viewport={"width": w, "height": h}, device_scale_factor=scale)
    errors = []
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    await pg.add_init_script("window.RENDER_MODE = true;")
    url = write_index(project, fmt=fmt).as_uri()
    for attempt in range(3):
        try:
            await pg.goto(url)
            await pg.wait_for_function("window.READY === true", timeout=40000)
            break
        except Exception:
            if attempt == 2:
                await b.close()
                die("page did not become ready. JavaScript errors:\n  " + "\n  ".join(errors[:8] or ["(none: fonts or scripts failed to load)"]))
    if errors:
        print("JavaScript errors / warnings from the scenes file:\n  " + "\n  ".join(dict.fromkeys(errors).keys()))
    return b, pg, errors


def auto_times(tl, scenes=()):
    """A frame near the end of every cue (its visuals are complete), the middle of every scene
    crossfade (where hand-off collisions hide), and the end-card hold."""
    ts = [round(max(c["start"] + .3, c["end"] - .25), 2) for c in tl["cues"].values()]
    ts += [round(s["a"] + .3, 2) for s in scenes if .5 < s["a"] < tl["duration"] - 1]
    ts.append(round(tl["duration"] - 1.5, 2))
    return sorted(set(ts))


def cue_at(tl, t):
    best = None
    for cid, c in tl["cues"].items():
        if c["start"] - .5 <= t:
            best = cid
    return best or ""


def sheet_layout(fmt, per_sheet=4):
    """(cols, rows, tile_w, tile_h) for contact sheets about 1920 px wide"""
    w, h = FORMATS[fmt]
    cols = 2 if w > h else 4
    rows = max(1, per_sheet // cols)
    tw = (1920 - (cols - 1) * 8) // cols
    return cols, rows, tw, round(tw * h / w)


def make_sheets(paths, labels, outdir, fmt="landscape", prefix="sheet"):
    from PIL import Image, ImageDraw, ImageFont
    try:
        font = ImageFont.load_default(size=26)
    except TypeError:
        font = ImageFont.load_default()
    cols, rows, tw, th = sheet_layout(fmt)
    n = cols * rows
    sheets = []
    for k in range(0, len(paths), n):
        sheet = Image.new("RGB", (cols * tw + (cols - 1) * 8, rows * th + (rows - 1) * 8), (20, 22, 28))
        for j, (pth, lab) in enumerate(zip(paths[k:k + n], labels[k:k + n])):
            im = Image.open(pth).convert("RGB").resize((tw, th), Image.LANCZOS)
            x, y = (j % cols) * (tw + 8), (j // cols) * (th + 8)
            sheet.paste(im, (x, y))
            d = ImageDraw.Draw(sheet)
            d.rectangle([x, y, x + 12 + 15 * len(lab), y + 38], fill=(0, 0, 0))
            d.text((x + 8, y + 5), lab, fill=(255, 220, 90), font=font)
        out = outdir / f"{prefix}_{k // n + 1:02d}.png"
        sheet.save(out)
        sheets.append(out)
    return sheets


async def _stills(project, times, sheet, audit, fmt):
    from playwright.async_api import async_playwright
    tl = project.timeline()
    auto = times is None
    # the full review goes to review/; ad-hoc --times go to review/times/ so they don't replace the full set
    outdir = project.fbuild(fmt) / "review" / ("" if auto else "times")
    outdir.mkdir(parents=True, exist_ok=True)
    for f in outdir.glob("*.png"):
        f.unlink()
    paths, labels, report = [], [], []
    async with async_playwright() as p:
        b, pg, errors = await open_page(p, project, fmt=fmt)
        if auto:
            ev = await pg.evaluate("() => ({...window.EVENTS, scenes: window.SCENES_INFO()})")
            times = auto_times(tl, ev["scenes"]) + [round(ev[k] + d, 2) for k, d in (("title", 2.2), ("endcard", 2.6)) if ev.get(k) is not None]
            times = sorted(set(times))
        RUN.step("review" if auto else "stills", fmt, total=len(times), unit="stills")
        for k, t in enumerate(times):
            await pg.evaluate("([t, f]) => render(t, f)", [t, round(t * 30)])
            path = outdir / f"t{t:07.2f}.png"
            await pg.screenshot(path=str(path))
            paths.append(path)
            labels.append(f"t={t:.2f}s  [{cue_at(tl, t)}]")
            if audit:
                res = await pg.evaluate(AUDIT_JS)
                for msg in res["issues"]:
                    if not msg.startswith("ghost:"):
                        report.append(f"t={t:6.2f} [{cue_at(tl, t)}]  {msg}")
            RUN.advance(k + 1)
        await b.close()
    print(f"[{fmt}] {len(paths)} stills in {outdir}")
    if sheet:
        for s in make_sheets(paths, labels, outdir, fmt):
            print(f"sheet: {s}")
    if audit:
        report = list(dict.fromkeys(report))
        txt = "\n".join(report) if report else "no layout issues found"
        (outdir / "audit.txt").write_text(txt + "\n", encoding="utf-8")
        print(f"\n[{fmt}] layout audit:\n" + ("\n".join("  " + r for r in report[:60]) if report else "  no issues found"))
        if len(report) > 60:
            print(f"  ... {len(report) - 60} more in {outdir / 'audit.txt'}")


def stills(project, times=None, sheet=True, audit=True, fmt="landscape"):
    asyncio.run(_stills(project, times, sheet, audit, fmt))


async def _events(project, fmt):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b, pg, _ = await open_page(p, project, fmt=fmt)
        ev = await pg.evaluate("() => ({...window.EVENTS, scenes: window.SCENES_INFO()})")
        await b.close()
    (project.fbuild(fmt) / "events.json").write_text(json.dumps(ev, indent=1), encoding="utf-8")
    return ev


def events(project, fmt="landscape"):
    return asyncio.run(_events(project, fmt))


async def _worker(p, project, f0, f1, fps, path, tag, scale, preview, fmt, tick, delay=0.0):
    await asyncio.sleep(delay)  # stagger browser start-up
    b, pg, _ = await open_page(p, project, scale, fmt)
    enc = (["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"] if preview else
           ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-maxrate", "25M", "-bufsize", "50M", "-x264-params", "aq-mode=3"])
    cmd = [ffmpeg(), "-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", str(fps), "-i", "-",
           "-vf", "crop=trunc(iw/2)*2:trunc(ih/2)*2,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p", *enc,  # even size, see frame_size
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-r", str(fps), str(path)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    try:
        for f in range(f0, f1):
            await pg.evaluate("([t, f]) => render(t, f)", [f / fps, f])
            proc.stdin.write(await pg.screenshot(type="jpeg", quality=95 if not preview else 88))
            tick()
            if (f - f0) % 600 == 0 and f > f0:
                done = (f - f0) / (f1 - f0)
                print(f"[{tag}] {100 * done:4.0f}%  eta {(time.time() - t0) / done * (1 - done) / 60:.1f} min", flush=True)
    except (BrokenPipeError, asyncio.CancelledError):
        proc.kill()
        raise
    proc.stdin.close()
    proc.wait()
    await b.close()


async def _video(project, fps, workers, start, end, preview, fmt):
    from playwright.async_api import async_playwright
    tl = project.timeline()
    fb = project.fbuild(fmt)
    end = tl["duration"] if end is None else min(end, tl["duration"])
    n0, n1 = int(round(start * fps)), int(math.ceil(end * fps))
    step = math.ceil((n1 - n0) / workers)
    segs, jobs, done = [], [], [0]
    RUN.step("render", fmt, total=n1 - n0, unit="frames", preview=preview)

    def tick():   # one frame written, by any worker
        done[0] += 1
        RUN.advance(done[0])

    async with async_playwright() as p:
        for k in range(workers):
            a, z = n0 + k * step, min(n1, n0 + (k + 1) * step)
            if a >= z:
                break
            path = fb / f"seg{k:02d}.mp4"
            segs.append(path)
            jobs.append(_worker(p, project, a, z, fps, path, f"{fmt}:w{k}", .5 if preview else 1.0, preview, fmt, tick, delay=.6 * k))
        await asyncio.gather(*jobs)
    lst = fb / "segs.txt"
    lst.write_text("".join(f"file '{s}'\n" for s in segs), encoding="utf-8")
    out = fb / ("preview.mp4" if preview else "video.mp4")
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)], check=True)
    for s in segs:
        s.unlink()
    lst.unlink()
    return out


def video(project, fps=None, workers=None, start=0.0, end=None, preview=False, fmt="landscape"):
    from common import local_assets
    local_assets()  # make sure fonts are cached before the workers start
    fps = fps or (30 if preview else project.fps(fmt))
    workers = workers or max(2, min(8, (os.cpu_count() or 4) // 2))
    t = time.time()
    tl = project.timeline()
    frames = int(((end or tl["duration"]) - start) * fps)
    size = "{}x{}".format(*frame_size(fmt, preview))
    print(f"[{fmt}] rendering {frames} frames at {fps} fps, {size}{' (preview)' if preview else ''}, {workers} workers ...", flush=True)
    try:
        out = asyncio.run(_video(project, fps, workers, start, end, preview, fmt))
    except KeyboardInterrupt:
        die("render interrupted")
    print(f"{out}  ({time.time() - t:.0f} s)")
    return out
