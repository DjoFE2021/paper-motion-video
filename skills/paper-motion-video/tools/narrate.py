"""Synthesize script.txt with Kokoro and write the timeline that drives the animation.

script.txt, one cue per line (continuation lines without [..] are appended to the previous cue):
    [id]        text              first cue
    [id +0.8]   text              0.8 s of silence before this cue (default 0.35)
Markup inside text:
    {Shown|spoken}   subtitle shows "Shown", the voice says "spoken"
    " / "            subtitle break (one subtitle card per segment)
    # ...            comment line

Outputs in build/: voice.wav (24 kHz), timeline.json (cue/word/subtitle timings), subtitles.srt
"""
import hashlib
import json
import re

import numpy as np
import soundfile as sf

from common import Project, die

SR = 24000
UNIT = re.compile(r"\{([^|}]*)\|([^}]*)\}|(?<!\S)(/)(?!\S)|(\S+)")
CUE = re.compile(r"^\[\s*([A-Za-z][\w-]*)\s*(?:\+\s*([\d.]+))?\s*\]\s*(.*)$")


def parse_script(text):
    cues = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = CUE.match(line)
        if m:
            cid, gap, body = m.group(1), m.group(2), m.group(3)
            if any(c["id"] == cid for c in cues):
                die(f"duplicate cue id [{cid}]")
            cues.append({"id": cid, "gap": float(gap) if gap else (0.0 if not cues else 0.35), "text": body})
        elif cues:
            cues[-1]["text"] += " " + line
        else:
            die(f"script.txt: text before the first [cue] line: {line[:60]}")
    if not cues:
        die("script.txt has no cues")
    return cues


def parse_units(text):
    """-> [{d: display, s: spoken, br: subtitle break before}]"""
    units, br = [], False
    for m in UNIT.finditer(text):
        if m.group(3):
            br = True
            continue
        d, s = (m.group(1), m.group(2)) if m.group(1) is not None else (m.group(4), m.group(4))
        units.append({"d": d, "s": s, "br": br})
        br = False
    return units


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def align(units, tokens):
    """Give each unit (t0, t1) from Kokoro token timestamps, matching on a letters-only stream."""
    spans, pos = [], 0
    for u in units:
        n = len(norm(u["s"]))
        spans.append((pos, pos + n))
        pos += n
    times = [[None, None] for _ in units]
    pos = 0
    for text, t0, t1 in tokens:
        n = len(norm(text))
        if n == 0:
            continue
        a, b = pos, pos + n
        pos = b
        if t0 is None or t1 is None:
            continue
        for k, (ua, ub) in enumerate(spans):
            if ua < b and a < ub:
                times[k][0] = t0 if times[k][0] is None else min(times[k][0], t0)
                times[k][1] = t1 if times[k][1] is None else max(times[k][1], t1)
    for k in range(len(times)):  # words without timestamps: interpolate
        if times[k][0] is None:
            prev = next((times[j][1] for j in range(k - 1, -1, -1) if times[j][1] is not None), 0.0)
            nxt = next((times[j][0] for j in range(k + 1, len(times)) if times[j][0] is not None), prev + 0.3)
            times[k] = [prev, nxt]
    return times


def run(project: Project):
    v = project.config["voice"]
    voice, speed = v["name"], float(v["speed"])
    lang = v.get("lang") or ("b" if voice.startswith("b") else "a")
    script = project.dir / "script.txt"
    if not script.exists():
        die("no script.txt in the project")
    cues_in = parse_script(script.read_text())
    cache = project.build / "tts_cache"
    cache.mkdir(exist_ok=True)
    pipe = None

    pieces, t = [np.zeros(int(v["leadIn"] * SR), np.float32)], float(v["leadIn"])
    cues, subs = {}, []
    for c in cues_in:
        if c["gap"]:
            pieces.append(np.zeros(int(c["gap"] * SR), np.float32))
            t += c["gap"]
        units = parse_units(c["text"])
        if not units:
            die(f"cue [{c['id']}] is empty")
        spoken = " ".join(u["s"] for u in units)
        key = hashlib.sha1(f"{voice}|{speed}|{lang}|{spoken}".encode()).hexdigest()[:16]
        f = cache / f"{key}.npz"
        if f.exists():
            z = np.load(f, allow_pickle=True)
            audio, tokens = z["audio"], [tuple(x) for x in z["tokens"]]
        else:
            if pipe is None:
                from kokoro import KPipeline
                pipe = KPipeline(lang_code=lang, repo_id="hexgrad/Kokoro-82M")
            chunks, tokens, off = [], [], 0.0
            for r in pipe(spoken, voice=voice, speed=speed, split_pattern=None):
                a = r.audio.numpy()
                chunks.append(a)
                tokens += [(tk.text, None if tk.start_ts is None else tk.start_ts + off,
                            None if tk.end_ts is None else tk.end_ts + off) for tk in r.tokens]
                off += len(a) / SR
            audio = np.concatenate(chunks).astype(np.float32)
            np.savez(f, audio=audio, tokens=np.array(tokens, dtype=object))
        times = align(units, tokens)
        a0 = max(0.0, times[0][0] - 0.06)
        a1 = min(len(audio) / SR, times[-1][1] + 0.28)
        clip = audio[int(a0 * SR):int(a1 * SR)].copy()
        fade = int(0.012 * SR)
        clip[:fade] *= np.linspace(0, 1, fade)
        clip[-fade:] *= np.linspace(1, 0, fade)
        pieces.append(clip)
        words = [{"d": u["d"], "s": u["s"], "t0": round(t + w0 - a0, 3), "t1": round(t + w1 - a0, 3)}
                 for u, (w0, w1) in zip(units, times)]
        cues[c["id"]] = {"start": words[0]["t0"], "end": words[-1]["t1"], "text": " ".join(u["d"] for u in units), "words": words}
        seg = []
        for u, w in zip(units, words):
            if u["br"] and seg:
                subs.append(seg)
                seg = []
            seg.append((c["id"], w))
        subs.append(seg)
        t += len(clip) / SR

    pieces.append(np.zeros(int(v["tail"] * SR), np.float32))
    voice_wav = np.concatenate(pieces)
    duration = len(voice_wav) / SR

    subs = [{"cue": s[0][0], "text": " ".join(w["d"] for _, w in s), "t0": s[0][1]["t0"] - 0.08, "t1": s[-1][1]["t1"],
             "words": [{"d": w["d"], "t0": w["t0"]} for _, w in s]} for s in subs]
    for i, s in enumerate(subs):  # hold a little after speech, bridge short pauses
        nxt = subs[i + 1]["t0"] if i + 1 < len(subs) else duration
        s["t1"] = round(nxt - 0.04 if nxt - s["t1"] < 0.7 else s["t1"] + 0.35, 3)
        s["t0"] = round(s["t0"], 3)

    sf.write(project.build / "voice.wav", voice_wav, SR)
    (project.build / "timeline.json").write_text(json.dumps(
        {"duration": round(duration, 3), "voice": voice, "speed": speed, "cues": cues, "subs": subs}, indent=1))

    def ts(x):
        hh, r = divmod(x, 3600)
        mm, ss = divmod(r, 60)
        return f"{int(hh):02d}:{int(mm):02d}:{int(ss):02d},{int(round((ss % 1) * 1000)) % 1000:03d}"
    with open(project.build / "subtitles.srt", "w") as fh:
        for i, s in enumerate(subs, 1):
            fh.write(f"{i}\n{ts(s['t0'])} --> {ts(s['t1'])}\n{s['text']}\n\n")

    nwords = sum(len(c["words"]) for c in cues.values())
    speech = sum(c["end"] - c["start"] for c in cues.values())
    print(f"{'cue':>6}  {'start':>7}  {'end':>7}  text")
    for cid, c in cues.items():
        print(f"{cid:>6}  {c['start']:7.2f}  {c['end']:7.2f}  {c['text'][:90]}")
    target = project.config["video"].get("targetSeconds")
    print(f"\nduration {duration:.1f} s  ({nwords} words, {nwords / max(speech, 1e-6):.2f} words/s while speaking, {len(subs)} subtitle cards)")
    if target:
        diff = duration - target
        pace = nwords / max(duration - v["leadIn"] - v["tail"], 1)   # words per second, pauses included
        if abs(diff) > 4:
            print(f"target is {target} s: {'cut' if diff > 0 else 'add'} about {abs(diff) * pace:.0f} words "
                  f"(measured pace {pace:.2f} words/s including pauses), or shorten the pauses")
