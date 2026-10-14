"""Makes the celebration sound effects in assets/sounds/.

Every sound is built from scratch out of sine waves and random noise, so there are no
recordings and no licences to worry about. Python's standard library only.

    python scripts/make_sounds.py              writes assets/sounds/*.wav
    python scripts/make_sounds.py some/folder  writes them somewhere else

The random seed is fixed, so running it again gives byte-for-byte the same files.
Tweak a function below and re-run to change a sound.
"""
import math
import os
import random
import struct
import sys
import wave

RATE = 22050  # samples per second: plenty for short effects, keeps the files small


def env(i, n, attack, release):
    """Fade in over `attack` seconds and out over `release` seconds, to avoid clicks."""
    t = i / RATE
    end = (n - i) / RATE
    return min(1.0, t / attack if attack else 1.0, end / release if release else 1.0)


def noise():
    return random.uniform(-1.0, 1.0)


def whistle():
    """A referee's whistle: a high tone that trills quickly, with a little breath."""
    n = int(0.45 * RATE)
    out, phase = [], 0.0
    for i in range(n):
        t = i / RATE
        freq = 2800 + 120 * math.sin(2 * math.pi * 30 * t)  # the "pea" in the whistle rattling
        phase += 2 * math.pi * freq / RATE
        out.append((0.85 * math.sin(phase) + 0.15 * noise()) * env(i, n, 0.01, 0.06))
    return out


def swish():
    """A ball through a net: bright noise that rises and falls fast."""
    n = int(0.35 * RATE)
    out, prev_in, prev_out = [], 0.0, 0.0
    for i in range(n):
        x = noise()
        y = 0.92 * (prev_out + x - prev_in)  # one-pole high-pass: keeps the hiss, drops the rumble
        prev_in, prev_out = x, y
        t = i / n
        shape = math.sin(math.pi * min(1.0, t * 1.6)) ** 2  # quick swell, then gone
        out.append(y * shape)
    return out


def cheer():
    """Flag football: the kick's low thump, then a short crowd cheer."""
    n = int(0.9 * RATE)
    thump_n = int(0.06 * RATE)
    voices = [(random.uniform(200, 900), random.uniform(0, 2 * math.pi), random.uniform(3, 7)) for _ in range(24)]
    out, phase = [], 0.0
    for i in range(n):
        t = i / RATE
        s = 0.0
        if i < thump_n:  # the kick: a low tone sliding from 90 Hz to 50 Hz
            freq = 90 - 40 * (i / thump_n)
            phase += 2 * math.pi * freq / RATE
            s += 1.2 * math.sin(phase) * (1 - i / thump_n)
        if t > 0.08:  # the crowd: many voices slightly out of tune, plus noise
            crowd = sum(math.sin(2 * math.pi * f * t + p) * (0.6 + 0.4 * math.sin(2 * math.pi * w * t))
                        for f, p, w in voices) / len(voices)
            swell = math.sin(math.pi * min(1.0, (t - 0.08) / 0.82))
            s += (0.7 * crowd + 0.3 * noise()) * swell
        out.append(s * env(i, n, 0.002, 0.1))
    return out


def pistol():
    """A starting pistol: a sharp crack, then a quick echo dying away."""
    n = int(0.3 * RATE)
    crack_n = int(0.005 * RATE)
    out, low = [], 0.0
    for i in range(n):
        x = noise()
        if i < crack_n:
            out.append(x)
            continue
        low += 0.25 * (x - low)  # low-pass: the duller tail after the crack
        out.append(low * 2.5 * math.exp(-(i - crack_n) / (0.05 * RATE)))
    return out


def whoosh():
    """A disc flying past: noise whose brightness sweeps up and back down."""
    n = int(0.5 * RATE)
    out, low = [], 0.0
    for i in range(n):
        t = i / n
        cutoff = 0.05 + 0.5 * math.sin(math.pi * t)  # opens, then closes
        low += cutoff * (noise() - low)
        out.append(low * math.sin(math.pi * t))
    return out


def normalize(samples, peak=0.8):
    top = max(abs(s) for s in samples) or 1.0
    return [s * peak / top for s in samples]


def write_wav(path, samples):
    """16-bit mono WAV."""
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32767)) for s in samples))


SOUNDS = {"whistle": whistle, "swish": swish, "cheer": cheer, "pistol": pistol, "whoosh": whoosh}


def main(out_dir="assets/sounds"):
    random.seed(7)
    os.makedirs(out_dir, exist_ok=True)
    for name, make in SOUNDS.items():
        write_wav(os.path.join(out_dir, f"{name}.wav"), normalize(make()))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "assets/sounds")
