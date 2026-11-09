"""Robot-voice sound sketches for session-chimes. Each sound is a list of segments
whose pitch glides; timbre comes from a soft square wave, optional FM wobble and
ring modulation, then a gentle low-pass so it stays pleasant in a headset.

The defaults came from round 4: finished-C is sounds/robot-statement.wav,
needs-input-A robot-question.wav, error-A robot-grumble.wav.
Run: python tools/robot_sketches.py <out folder>"""
import math, struct, sys, wave
from pathlib import Path

RATE = 44100
# Scales every segment's length; round 3 shortens them all.
SCALE = 0.65


def soft_square(phase, hardness):
    # tanh-shaped sine: 1 is near-sine, 6 is near-square
    return math.tanh(hardness * math.sin(phase)) / math.tanh(hardness)


def voice(segments, hardness=3.0, wobble=(0, 0), ring=0.0, vol=0.32, glide_curve=1.0):
    """segments: (start_hz, end_hz, seconds) or ('rest', seconds)."""
    out = []
    phase = 0.0
    t_all = 0.0
    for seg in segments:
        if seg[0] == 'rest':
            out += [0.0] * int(RATE * seg[1] * SCALE)
            continue
        f0, f1, dur = seg
        n = int(RATE * dur * SCALE)
        for i in range(n):
            x = i / max(1, n - 1)
            # log-glide sounds more natural than linear
            f = f0 * (f1 / f0) ** (x ** glide_curve)
            if wobble[0]:
                f *= 1 + wobble[1] * math.sin(2 * math.pi * wobble[0] * t_all)
            phase += 2 * math.pi * f / RATE
            s = soft_square(phase, hardness)
            if ring:
                s *= (1 - ring) + ring * math.sin(2 * math.pi * f * 0.5 * t_all)
            # short attack/release per segment so blips are distinct
            env = min(1.0, i / (RATE * 0.006), (n - i) / (RATE * 0.02))
            out.append(s * env * vol)
            t_all += 1 / RATE
    return lowpass(out, 0.18)


def lowpass(samples, a):
    y, out = 0.0, []
    for s in samples:
        y += a * (s - y)
        out.append(y)
    # second pass for a gentler top end
    y, out2 = 0.0, []
    for s in out:
        y += a * 1.6 * (s - y) if a * 1.6 < 1 else (s - y)
        out2.append(y)
    peak = max(1e-9, max(abs(s) for s in out2))
    return [s / peak * 0.5 for s in out2]


def rest(sec):
    return [0.0] * int(RATE * sec)


def write(path, samples):
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, s)) * 32767)) for s in samples))


# Round 4: smooth, short, and less busy: two gestures each.

# Finished: a calm statement. One note, then a soft settle downward.
FINISHED = {
    'A': voice([(659, 659, 0.14), ('rest', 0.05), (740, 554, 0.40)], hardness=1.4, glide_curve=0.7),
    'B': voice([(587, 740, 0.14), (659, 494, 0.45)], hardness=1.5, glide_curve=0.7),
    'C': voice([(784, 784, 0.12), ('rest', 0.06), (659, 659, 0.42)], hardness=1.3),
}

# Needs input: a question. One note (or none), then a rise at the end.
NEEDS_INPUT = {
    'A': voice([(700, 700, 0.12), ('rest', 0.05), (700, 1400, 0.30)], hardness=1.8, glide_curve=2.2),
    'B': voice([(700, 640, 0.08), (640, 1300, 0.34)], hardness=1.8, glide_curve=2.5),
    'C': voice([(880, 880, 0.08), ('rest', 0.05), (740, 1250, 0.30)], hardness=1.6, glide_curve=2.0),
}

# Error: low and falling, rounded rather than buzzy.
ERROR = {
    'A': voice([(330, 330, 0.12), ('rest', 0.04), (300, 160, 0.45)], hardness=2.4, wobble=(10, 0.03), ring=0.1),
    'B': voice([(392, 247, 0.16), ('rest', 0.05), (220, 130, 0.40)], hardness=2.2, wobble=(7, 0.03)),
    'C': voice([(294, 196, 0.20), ('rest', 0.05), (196, 110, 0.42)], hardness=2.6, wobble=(12, 0.035), ring=0.15),
}

out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
for name, group in (('finished', FINISHED), ('needs-input', NEEDS_INPUT), ('error', ERROR)):
    reel = []
    for key, s in group.items():
        write(out / f'{name}-{key}.wav', s)
        reel += s + rest(1.2)
    write(out / f'{name}-reel.wav', reel)
print('ok')
