"""Mux picture + mix into out/, make a lighter share copy, copy subtitles, verify the result."""
import re
import shutil
import subprocess

from common import RUN, Project, die, ffmpeg

BT709 = "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1"


def probe(path):
    r = subprocess.run([ffmpeg(), "-hide_banner", "-i", str(path)], capture_output=True, encoding="utf-8", errors="replace")
    dur = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    vid = re.search(r"Video: .*?, (\d+)x(\d+).*?, ([\d.]+) fps", r.stderr)
    return {"duration": int(dur[1]) * 3600 + int(dur[2]) * 60 + float(dur[3]) if dur else None,
            "size": f"{vid[1]}x{vid[2]}" if vid else None, "fps": float(vid[3]) if vid else None, "audio": "Audio:" in r.stderr}


def loudness(path):
    r = subprocess.run([ffmpeg(), "-hide_banner", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, encoding="utf-8", errors="replace")
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    pk = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r.stderr)
    return (float(i[-1]) if i else None), (float(pk[-1]) if pk else None)


def run(project: Project, preview=False, share=True, fmt="landscape"):
    RUN.step("package", fmt, preview=preview)
    b = project.fbuild(fmt)
    src = b / ("preview.mp4" if preview else "video.mp4")
    if not src.exists():
        die(f"{src.name} not found for {fmt}. Run: pmv video <project> --format {fmt}{' --preview' if preview else ''}")
    audio = b / "mix.wav"
    if not audio.exists():
        die(f"mix.wav not found for {fmt}. Run: pmv music <project> --format {fmt}")
    project.out.mkdir(exist_ok=True)
    name = project.out_name(fmt) + ("_preview" if preview else "")
    main = project.out / f"{name}.mp4"
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-i", str(src), "-i", str(audio), "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-bsf:v", BT709, "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", "-shortest", str(main)], check=True)
    outs = [main]
    if share and not preview and fmt == "landscape":   # phone formats are already small
        sh = project.out / f"{name}_share.mp4"
        enc = ["-c:v", "libx264", "-preset", "fast", "-crf", "23", "-maxrate", "8M", "-bufsize", "16M", "-profile:v", "high"]
        subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-i", str(src), "-i", str(audio), "-map", "0:v", "-map", "1:a",
                        "-vf", "fps=30", *enc, "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", str(sh)], check=True)
        outs.append(sh)
    if (project.build / "subtitles.srt").exists():
        shutil.copy(project.build / "subtitles.srt", project.out / f"{project.name}.srt")
        outs.append(project.out / f"{project.name}.srt")
    # verification
    chk = b / "check"
    chk.mkdir(exist_ok=True)
    info = probe(main)
    lufs, peak = loudness(main)
    dur = info["duration"] or 0
    for k, t in enumerate([dur * .15, dur * .5, dur * .85]):
        subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", str(main), "-frames:v", "1", str(chk / f"final_{k}.png")])
    for o in outs:
        print(f"{o}  ({o.stat().st_size / 1e6:.1f} MB)")
    print(f"check: {info['size']} @ {info['fps']} fps, {dur:.2f} s, audio {'yes' if info['audio'] else 'MISSING'}, "
          f"loudness {lufs} LUFS (target -16), true peak {peak} dBFS; frames for a visual check in {chk}")
