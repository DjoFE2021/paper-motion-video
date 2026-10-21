"""Synthesized score + sound design + final mix (no samples, no network).

Inputs: build/voice.wav, build/timeline.json, <format build>/events.json (scenes, sfx cues from components).
Outputs: <format build>/music.wav (bed), mix.wav (voice + bed, -16 LUFS integrated, true peak below -1 dBFS after AAC),
mix.json (hash of the cues it was built from; `pmv video` re-mixes when the scenes changed).

config.json "music": {enabled, preset: hopeful|reflective|driving, key: C..B, bpm, bedLufs (-30 default), sfx}
"""
import hashlib
import json
import math

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy import signal

from common import Project

SR = 48000
KEYS = {"C": -2, "C#": -1, "Db": -1, "D": 0, "D#": 1, "Eb": 1, "E": 2, "F": 3, "F#": 4, "Gb": 4, "G": 5, "G#": -6, "Ab": -6, "A": -5, "A#": -4, "Bb": -4, "B": -3}
PRESETS = {  # chord voicings in D (MIDI), two bars each; FINAL rings under the end card
    "hopeful": {"chords": [[47, 54, 61, 62, 66], [43, 50, 57, 59, 66], [50, 57, 64, 66, 71], [45, 52, 59, 61, 64]], "final": [38, 50, 57, 61, 64, 66]},
    "reflective": {"chords": [[50, 57, 60, 65, 69], [46, 53, 57, 62, 65], [41, 48, 57, 60, 64], [48, 55, 59, 62, 67]], "final": [38, 50, 57, 62, 64, 69]},
    "driving": {"chords": [[50, 57, 62, 64, 69], [47, 54, 59, 62, 66], [43, 50, 55, 59, 66], [45, 52, 57, 61, 64]], "final": [38, 50, 57, 61, 66, 69]},
}
RAW_MUSIC_LUFS = -24.0  # typical loudness of the unscaled synth bed; sets the sfx level when music is off
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)


def lp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "low")
    return signal.lfilter(b, a, x, axis=0)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "high")
    return signal.lfilter(b, a, x, axis=0)


def bp(x, f0, f1, order=2):
    b, a = signal.butter(order, [f0 / (SR / 2), f1 / (SR / 2)], "band")
    return signal.lfilter(b, a, x, axis=0)


class Score:
    def __init__(self, project: Project, fmt="landscape"):
        self.p = project
        self.fb = project.fbuild(fmt)
        self.tl = project.timeline()
        self.ev = project.events(fmt) or {"sfx": [], "scenes": [], "title": None, "endcard": None}
        self.m = project.config["music"]
        self.DUR = self.tl["duration"]
        self.N = int(self.DUR * SR) + SR
        self.rng = np.random.default_rng(3)
        pre = PRESETS.get(self.m.get("preset", "hopeful"), PRESETS["hopeful"])
        tr = KEYS.get(str(self.m.get("key", "D")), 0)
        self.chords = [[n + tr for n in c] for c in pre["chords"]]
        self.final = [n + tr for n in pre["final"]]
        self.BEAT = 60 / float(self.m.get("bpm", 96))
        self.CH = 8 * self.BEAT
        self.T_END = self.ev.get("endcard") or (self.DUR - 6)
        self.T_TITLE = self.ev.get("title")
        self.IR = self._ir()

    # ------------------------------------------------------------ helpers
    def place(self, bus, x, t0, pan=0.0):
        i = int(t0 * SR)
        if i >= len(bus):
            return
        if x.ndim == 1:
            g = np.array([math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)])
            x = x[:, None] * g[None, :]
        if i < 0:
            x, i = x[-i:], 0
        j = min(len(bus), i + len(x))
        bus[i:j] += x[: j - i]

    def curve(self, keys):
        keys = sorted(keys)
        ts, vs = zip(*keys)
        return np.interp(np.arange(self.N) / SR, ts, vs).astype(np.float32)

    def _ir(self, rt=3.2, pre=0.025):
        n = int(rt * SR)
        t = np.arange(n) / SR
        ir = self.rng.standard_normal((n, 2)) * np.exp(-6.9 * t / rt)[:, None]
        ir = lp(ir, 5200)
        ir[: int(pre * SR)] = 0
        return (ir / np.sqrt((ir ** 2).sum(axis=0))).astype(np.float32)

    def verb(self, x, wet):
        y = np.stack([signal.fftconvolve(x[:, c], self.IR[:, c])[: len(x)] for c in range(2)], axis=1)
        return x * (1 - wet) + y * wet * 1.4

    def chord_at(self, t):
        return self.final if t >= self.T_END else self.chords[int(t // self.CH) % len(self.chords)]

    # ------------------------------------------------------------ music
    def pad(self):
        bus = np.zeros((self.N, 2), np.float32)
        segs, t = [], 0.0
        while t < self.T_END:
            segs.append((t, min(t + self.CH, self.T_END), self.chord_at(t)))
            t += self.CH
        segs.append((self.T_END, self.DUR + 1, self.final))
        for a, b, notes in segs:
            att, rel = 1.6, 2.8
            n = int((b - a + rel) * SR)
            tt = np.arange(n) / SR
            e = (np.minimum(1, tt / att) * np.clip((b - a + rel - tt) / rel, 0, 1)) ** 1.5
            for k, m in enumerate(notes):
                f = hz(m)
                for d, pan in ((-7, -.6), (0, 0), (7, .6)):
                    ph = self.rng.uniform(0, 2 * np.pi)
                    x = signal.sawtooth(2 * np.pi * f * 2 ** (d / 1200) * tt + ph) * .5 + np.sin(2 * np.pi * f * tt + ph) * .5
                    self.place(bus, (x * e * (0.11 if k else 0.15)).astype(np.float32), a, pan)
            self.place(bus, (np.sin(2 * np.pi * hz(notes[0] - 12) * tt) * e * .18).astype(np.float32), a)
        bus = lp(bus, 1500, 2)
        bright = hp(bus, 900) * (0.35 + 0.35 * np.sin(2 * np.pi * np.arange(self.N) / SR / 17))[:, None]
        return (bus + bright).astype(np.float32)

    def arp(self):
        bus = np.zeros((self.N, 2), np.float32)
        step, t, k = self.BEAT / 2, 0.0, 0
        pattern = [0, 2, 1, 3, 2, 4, 3, 1]
        n = int(0.9 * SR)
        tt = np.arange(n) / SR
        env = np.minimum(1, tt / .004) * np.exp(-tt / .17)
        while t < self.DUR:
            notes = self.chord_at(t)
            m = notes[1:][pattern[k % 8] % (len(notes) - 1)] + 12 + (12 if k % 16 in (5, 13) else 0)
            f = hz(m)
            x = (np.sin(2 * np.pi * f * tt) + .25 * np.sin(4 * np.pi * f * tt) + .08 * np.sin(6 * np.pi * f * tt)) * env
            self.place(bus, (x * .05 * (1.0 if k % 4 == 0 else .72)).astype(np.float32), t, pan=.35 * math.sin(k * .9))
            t += step
            k += 1
        bus = lp(bus, 4200)
        d = int(self.BEAT * .75 * SR)
        outb, fb = bus.copy(), bus.copy()
        for r in range(4):  # ping-pong dotted-eighth delay
            fb = np.roll(fb, d, axis=0)[:, ::-1] * .42
            fb[:d] = 0
            outb += lp(fb, 3000 - 500 * r)
        return outb.astype(np.float32)

    def pulse(self):
        t = np.arange(self.N) / SR
        grid = np.arange(0, self.DUR + 1, self.CH / 8)
        f = np.repeat([hz(self.chord_at(x)[0] - 12) for x in grid], int(self.CH / 8 * SR))
        f = np.pad(f, (0, max(0, self.N - len(f))), mode="edge")[: self.N]
        ph = 2 * np.pi * np.cumsum(f) / SR
        duck = 1 - .85 * np.exp(-((t % self.BEAT) / self.BEAT) * 7)
        x = lp((np.sin(ph) + .2 * np.sin(2 * ph)) * duck * .16, 220)
        return np.stack([x, x], axis=1).astype(np.float32)

    def air(self):
        x = bp(self.rng.standard_normal((self.N, 2)).astype(np.float32), 2500, 9000) * .006
        return x * (0.6 + 0.4 * np.sin(2 * np.pi * np.arange(self.N) / SR / 11))[:, None]

    def energy_keys(self, fn, default=.6):
        """automation following each scene's `energy` (scene option), with 1.5 s ramps"""
        keys = [(0, 0.0)]
        scenes = sorted(self.ev.get("scenes") or [], key=lambda s: s["a"])
        for s in scenes:
            v = fn(s.get("energy", default))
            keys += [(max(0.01, s["a"] + .3), v), (max(0.02, s["b"] - .3), v)]
        keys += [(self.DUR - 2, keys[-1][1] if len(keys) > 1 else fn(default)), (self.DUR, 0), (self.DUR + 1, 0)]
        dedup = {}
        for t, v in keys:
            dedup[round(t, 3)] = v
        return sorted(dedup.items())

    # ------------------------------------------------------------ sfx
    def whoosh(self, dur=1.0, peak=.7, gain=.12):
        n = int(dur * SR)
        tt = np.arange(n) / SR
        x = self.rng.standard_normal(n)
        bands = [lp(x, fc) for fc in (300, 900, 2400, 6500)]
        idx = np.clip(tt / (dur * peak), 0, 1) * 3
        y = sum(bands[i] * np.clip(1 - np.abs(idx - i), 0, 1) for i in range(4))
        e = np.where(tt < dur * peak, (tt / (dur * peak)) ** 2.2, np.exp(-(tt - dur * peak) / (dur * .12)))
        y = y * e * gain
        pan = np.linspace(-.7, .7, n)
        return np.stack([y * np.cos((pan + 1) * np.pi / 4), y * np.sin((pan + 1) * np.pi / 4)], axis=1).astype(np.float32)

    def impact(self, gain=.5, f0=95, f1=36):
        n = int(2.6 * SR)
        tt = np.arange(n) / SR
        f = f1 + (f0 - f1) * np.exp(-tt / .12)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / .7)
        click = lp(self.rng.standard_normal(n), 1800) * np.exp(-tt / .015) * .5
        return ((x + click) * gain).astype(np.float32)

    def tick(self, f=2400, gain=.04, dec=.04):
        tt = np.arange(int(.25 * SR)) / SR
        x = (np.sin(2 * np.pi * f * tt) + .3 * np.sin(2 * np.pi * f * 2.01 * tt)) * np.exp(-tt / dec) * np.minimum(1, tt / .001)
        return (x * gain).astype(np.float32)

    def blip(self, f0, f1, dur=.28, gain=.045):
        n = int(dur * SR)
        tt = np.arange(n) / SR
        f = np.geomspace(f0, f1, n)
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 1.5 * gain).astype(np.float32)

    def glitch(self, dur=.55, gain=.09):
        n = int(dur * SR)
        tt = np.arange(n) / SR
        x = np.round(self.rng.standard_normal(n) * 3) / 3
        x = np.repeat(x[::24], 24)[:n]
        x = bp(x, 700, 5000) * (np.sin(2 * np.pi * 31 * tt) > -.2) * np.exp(-tt / .18)
        return (x * gain).astype(np.float32)

    def sfx(self):
        bus = np.zeros((self.N, 2), np.float32)
        if self.T_TITLE is not None:
            self.place(bus, self.whoosh(1.6, .8, .16), self.T_TITLE - 1.28)
        for e in self.ev.get("sfx", []):
            t, g, typ = e["t"], e.get("gain", 1.0), e["type"]
            pan = e.get("pan", 0.0)
            if typ == "whoosh":
                if self.T_TITLE is not None and abs(t - self.T_TITLE) < .8:
                    continue  # the title gets its own long whoosh
                self.place(bus, self.whoosh(1.0, .7, .10 * g), t - .7)
            elif typ == "impact":
                self.place(bus, self.impact(.5 * g, e.get("f0", 95), e.get("f1", 36)), t)
            elif typ == "thud":
                self.place(bus, self.impact(.22 * g, 140, 60), t)
            elif typ == "tick":
                self.place(bus, self.tick(hz(e.get("note", 81)), .04 * g, e.get("dec", .04)), t, pan)
            elif typ == "blip":
                self.place(bus, self.blip(e.get("f0", 420), e.get("f1", 840), e.get("dur", .28), .045 * g), t, pan)
            elif typ == "glitch":
                self.place(bus, self.glitch(.55, .09 * g), t)
        return bus

    # ------------------------------------------------------------ mix
    def run(self):
        voice, vsr = sf.read(self.p.build / "voice.wav", dtype="float32")
        voice = hp(signal.resample_poly(voice, SR, vsr), 75).astype(np.float32)
        v = np.zeros(self.N, np.float32)
        v[: min(self.N, len(voice))] = voice[: self.N]
        L = int(self.DUR * SR)
        meter = pyln.Meter(SR)
        vv = np.stack([v, v], axis=1)[:L]
        vv *= 10 ** ((-17.0 - meter.integrated_loudness(vv)) / 20)
        bed = np.zeros((L, 2), np.float32)
        if self.m.get("enabled", True):
            padk = self.energy_keys(lambda e: .55 + .35 * e)
            if self.T_TITLE is not None:
                padk += [(self.T_TITLE - .3, .7), (self.T_TITLE + .4, 1.0), (self.T_TITLE + 3.5, .65)]
            padk += [(self.T_END, 1.0), (self.DUR - 2.4, .9)]
            mus = self.pad() * self.curve(padk)[:, None]
            # scene energy 0..1: the arpeggio enters above ~0.4, the low pulse above ~0.6
            mus += self.arp() * self.curve(self.energy_keys(lambda e: float(np.clip((e - .4) / .5, 0, 1)) * .9))[:, None]
            mus += self.pulse() * self.curve(self.energy_keys(lambda e: float(np.clip((e - .6) / .25, 0, 1)) * .85))[:, None]
            mus += self.air()
            mus = self.verb(mus, .35)
            a = np.abs(v) / (np.abs(v).max() + 1e-9)  # duck under the voice
            at, rl = np.exp(-1 / (.03 * SR)), np.exp(-1 / (.40 * SR))
            env = signal.lfilter([1 - rl], [1, -rl], signal.lfilter([1 - at], [1, -at], a))
            mus = mus * (1 - .5 * np.clip(env / .04, 0, 1))[:, None]
            mus = mus[:L]
            raw = meter.integrated_loudness(mus)
            g = 10 ** ((float(self.m.get("bedLufs", -30)) - raw) / 20)
            bed += mus * g
        else:
            g = 10 ** ((float(self.m.get("bedLufs", -30)) - RAW_MUSIC_LUFS) / 20)
        if self.m.get("sfx", True):
            bed += self.verb(self.sfx(), .25)[:L] * g  # sfx sit at the same gain as the music bed
        sf.write(self.fb / "music.wav", bed, SR)
        mix = vv + bed
        mix *= 10 ** ((-16.0 - meter.integrated_loudness(mix)) / 20)
        ceil = 10 ** (-1.6 / 20)  # soft limiter: sample peaks <= -1.6 dBFS so the AAC true peak stays below -1 dBFS
        k = np.abs(mix) > ceil * .8
        mix[k] = np.sign(mix[k]) * (ceil * .8 + (ceil * .2) * np.tanh((np.abs(mix[k]) - ceil * .8) / (ceil * .2)))
        nf = int(2.0 * SR)
        mix[-nf:] *= (np.linspace(1, 0, nf) ** 2)[:, None]
        sf.write(self.fb / "mix.wav", mix.astype(np.float32), SR, subtype="PCM_24")
        (self.fb / "mix.json").write_text(json.dumps({"cues": cue_hash(self.p, self.ev)}), encoding="utf-8")
        print(f"mix: {meter.integrated_loudness(mix):.1f} LUFS, peak {20 * np.log10(np.abs(mix).max()):.1f} dBFS, "
              f"{len(self.ev.get('sfx', []))} sound cues, music {'on' if self.m.get('enabled', True) else 'off'}")


def cue_hash(project, ev):
    tl = (project.build / "timeline.json").read_bytes()
    return hashlib.sha1(json.dumps(ev, sort_keys=True).encode() + tl + json.dumps(project.config["music"], sort_keys=True).encode()).hexdigest()


def stale(project, fmt, ev):
    """True when the mix was built from other sound cues / timings than the current scenes."""
    f = project.fbuild(fmt) / "mix.json"
    if not (project.fbuild(fmt) / "mix.wav").exists() or not f.exists():
        return True
    return json.loads(f.read_text(encoding="utf-8")).get("cues") != cue_hash(project, ev)


def run(project: Project, fmt="landscape"):
    Score(project, fmt).run()
