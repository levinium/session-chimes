"""Builds session-chimes' built-in sounds. No lead-in: the player adds it."""
import math, random, struct, sys, wave
from pathlib import Path

RATE = 44100


def note(freq, dur, vol=0.35, decay=6.0, partials=((1, 1.0), (2, 0.25)), attack=0.008):
    out = []
    norm = sum(a for _, a in partials)
    for i in range(int(RATE * dur)):
        t = i / RATE
        env = min(1.0, t / attack) * math.exp(-t * decay)
        s = sum(a * math.sin(2 * math.pi * freq * m * t) for m, a in partials)
        out.append(s / norm * env * vol)
    return out


def rest(dur):
    return [0.0] * int(RATE * dur)


def seq(*parts):
    return [s for p in parts for s in p]


def mix(*parts):
    n = max(len(p) for p in parts)
    return [sum(p[i] for p in parts if i < len(p)) for i in range(n)]


def pop():
    random.seed(7)
    out = []
    for i in range(int(RATE * 0.09)):
        t = i / RATE
        f = 1400 * math.exp(-t * 30) + 300
        out.append((math.sin(2 * math.pi * f * t) * 0.8 + random.uniform(-1, 1) * 0.2 * math.exp(-t * 200)) * math.exp(-t * 45) * 0.5)
    return out


def pad():
    out = []
    dur = 1.1
    for i in range(int(RATE * dur)):
        t = i / RATE
        env = math.sin(math.pi * t / dur) ** 2
        s = sum(math.sin(2 * math.pi * f * t) for f in (523.25, 659.25, 783.99)) / 3
        out.append(s * env * 0.3)
    return out


BELL = ((1, 1.0), (2.76, 0.45), (5.4, 0.25), (8.93, 0.12))
MARIMBA = ((1, 1.0), (4, 0.35), (10, 0.08))

SOUNDS = {
    "chime": seq(note(784, 0.22), note(1047, 0.45)),
    "triple": seq(note(1319, 0.11, 0.4), rest(0.04), note(1319, 0.11, 0.4), rest(0.04), note(1760, 0.35, 0.4)),
    "bell": note(880, 1.3, 0.35, decay=3.2, partials=BELL, attack=0.003),
    "marimba": seq(note(523, 0.12, 0.4, 14, MARIMBA, 0.002), note(659, 0.12, 0.4, 14, MARIMBA, 0.002), note(784, 0.4, 0.4, 9, MARIMBA, 0.002)),
    "ping": seq(note(880, 0.14, 0.35, 10), note(1319, 0.35, 0.35, 8)),
    "pop": pop(),
    "descend": seq(note(1047, 0.16, 0.35, 8), note(784, 0.16, 0.35, 8), note(659, 0.45, 0.35, 6)),
    "pad": pad(),
}

out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
for old in out.glob("*.wav"):
    old.unlink()
for name, samples in SOUNDS.items():
    with wave.open(str(out / f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 32767)) for s in samples))
print(", ".join(SOUNDS))
