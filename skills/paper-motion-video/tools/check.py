"""Final pass over a finished video (run after `pmv final`, before handing it over).

1. File: resolution, fps, duration vs. the narration, audio stream, loudness, subtitles.
2. Dense layout audit: the same checks as `pmv review` (overlapping text, text outside its card,
   subtitle band, safe frame), but every `step` seconds across the whole timeline, transitions included.
3. Frames decoded from the final MP4 every `interval` seconds: blank-frame detection, and contact
   sheets (<format build>/check/final_sheet_NN.png, labelled frames) for a visual pass through the whole video.
Blank detection looks only at the content area (between the running head and the subtitles).
"""
import asyncio
import json
import re
import subprocess

from common import FORMATS, RUN, Project, die, ffmpeg, frame_size
import finalize
import render


async def _dense(project, times, fmt="landscape"):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b, pg, errors = await render.open_page(p, project, fmt=fmt)
        res = await pg.evaluate(f"""(times) => {{ const audit = {render.AUDIT_JS};
            return times.map(t => {{ render(t, Math.round(t * 30)); return [t, audit().issues]; }}); }}""", times)
        await b.close()
    return res, errors


def _cue_at(tl, t):
    return render.cue_at(tl, t)


def run(project: Project, interval=2.0, step=0.25, preview=False, fmt="landscape"):
    from PIL import Image, ImageDraw, ImageFont, ImageStat
    RUN.step("check", fmt, preview=preview)
    tl = project.timeline()
    fb = project.fbuild(fmt)
    name = project.out_name(fmt) + ("_preview" if preview else "")
    main = project.out / f"{name}.mp4"
    if not main.exists():
        die(f"{main} not found. Run: pmv final <project> --format {fmt}{' --preview' if preview else ''}")
    problems, notes = [], []

    # 1. file
    info = finalize.probe(main)
    lufs, peak = finalize.loudness(main)
    dur = info["duration"] or 0
    W, H = FORMATS[fmt]
    want = "{}x{}".format(*frame_size(fmt, preview))
    if info["size"] != want:
        problems.append(f"resolution is {info['size']}, expected {want}")
    if abs(dur - tl["duration"]) > 0.25:
        problems.append(f"duration {dur:.2f} s differs from the narration timeline ({tl['duration']:.2f} s): re-run pmv video / pmv final")
    if not info["audio"]:
        problems.append("no audio stream")
    if lufs is None or abs(lufs + 16) > 1.0:
        problems.append(f"loudness {lufs} LUFS (target -16): re-run pmv music, pmv final")
    if peak is not None and peak > -0.9:
        problems.append(f"true peak {peak} dBFS (target <= -1 dBFS): re-run pmv music, pmv final")
    srt = project.out / f"{project.name}.srt"
    if not srt.exists():
        problems.append("subtitle file missing in out/")
    else:
        ends = re.findall(r"--> (\d+):(\d+):(\d+),(\d+)", srt.read_text(encoding="utf-8"))
        if ends:
            h, m, s, ms = map(int, ends[-1])
            if h * 3600 + m * 60 + s + ms / 1000 > dur + 0.1:
                problems.append("the last subtitle ends after the video")
    notes.append(f"file: {info['size']} @ {info['fps']} fps, {dur:.2f} s, audio {'yes' if info['audio'] else 'no'}, {lufs} LUFS, peak {peak} dBFS")

    # 2. dense layout audit
    times = [round(i * step, 3) for i in range(int(tl["duration"] / step) + 1)]
    res, errors = asyncio.run(_dense(project, times, fmt))
    spans = {}
    for t, issues in res:
        for msg in issues:
            s = spans.setdefault(msg, [t, t, 0])
            s[1], s[2] = t, s[2] + 1
    for msg, (a, z, n) in sorted(spans.items(), key=lambda kv: kv[1][0]):
        if msg.startswith("ghost:") and n < 3:
            continue  # ordinary crossfades overlap for a moment; only lingering ghosts are a problem
        problems.append(f"t={a:6.2f}–{z:6.2f} [{_cue_at(tl, a)}]  {msg}")
    for e in dict.fromkeys(errors):
        problems.append(f"JavaScript: {e}")
    notes.append(f"layout audit: {len(times)} moments checked every {step} s")

    # 3. frames from the final file
    cols, rows, tw, th = render.sheet_layout(fmt, 9 if W > H else 8)
    if W > H:
        cols, rows, tw, th = 3, 3, 640, 360
    fdir = fb / "check" / "frames"
    fdir.mkdir(parents=True, exist_ok=True)
    for f in fdir.glob("*.png"):
        f.unlink()
    every = max(1, round(interval * (info["fps"] or 30)))  # exact frames at t = 0, interval, 2*interval, ...
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-i", str(main), "-vf", f"select='not(mod(n\\,{every}))',scale={tw}:{th}",
                    "-fps_mode", "vfr", str(fdir / "f_%04d.png")], check=True)
    frames = sorted(fdir.glob("f_*.png"))
    blank = []
    for k, f in enumerate(frames):
        t = k * interval
        im = Image.open(f).convert("L")
        content = im.crop((0, int(.12 * im.height), im.width, int(.80 * im.height)))   # skip running head and subtitles
        if 1.5 < t < dur - 1.5 and ImageStat.Stat(content).stddev[0] < 2.5:
            blank.append(t)
    if blank:
        problems.append(f"empty frames (nothing but background) at t = {', '.join(f'{t:.0f}' for t in blank)} s: "
                        f"a gap between scenes, or content arriving too late")
    try:
        font = ImageFont.load_default(size=22)
    except TypeError:
        font = ImageFont.load_default()
    sheets = []
    n = cols * rows
    for i in range(0, len(frames), n):
        sheet = Image.new("RGB", (cols * (tw + 2) + 2, rows * (th + 2) + 2), (40, 42, 48))
        for j, f in enumerate(frames[i:i + n]):
            t = (i + j) * interval
            x, y = (j % cols) * (tw + 2) + 2, (j // cols) * (th + 2) + 2
            sheet.paste(Image.open(f).convert("RGB"), (x, y))
            lab = f"{t:5.1f}s [{_cue_at(tl, t)}]"
            d = ImageDraw.Draw(sheet)
            d.rectangle([x, y, x + 14 + 11 * len(lab), y + 30], fill=(0, 0, 0))
            d.text((x + 7, y + 4), lab, fill=(255, 220, 90), font=font)
        out = fb / "check" / f"final_sheet_{i // n + 1:02d}.png"
        sheet.save(out)
        sheets.append(out)
    notes.append(f"{len(frames)} frames decoded from {main.name}, every {interval:g} s")

    (fb / "check" / "report.json").write_text(json.dumps({"problems": problems, "notes": notes, "sheets": [str(s) for s in sheets]}, indent=1), encoding="utf-8")
    print(f"[{fmt}] final pass")
    for nt in notes:
        print(nt)
    print("\ncontact sheets of the final video (look at every one):")
    for s in sheets:
        print(f"  {s}")
    if problems:
        print(f"\n{len(problems)} problem(s):")
        for pr in problems:
            print("  " + pr)
    else:
        print("\nautomatic checks: all passed")
