"""Robot-voice sound sketches for session-chimes. Each sound is a list of segments
whose pitch glides; timbre comes from a soft square wave, optional FM wobble and
ring modulation, then a gentle low-pass so it stays pleasant in a headset.

Defaults: sounds/robot-statement.wav is round 6's variant 4 (below);
robot-question.wav and robot-grumble.wav came from round 4 (Needs input A and
Error A: see git history). Run: python tools/robot_sketches.py <out folder>"""
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


# Round 6: variations on round 5's D (two blips on one pitch, the second easing down).

STATEMENT = {
    # D as it was, for reference.
    '0': voice([(698, 698, 0.08), ('rest', 0.05), (698, 600, 0.38)], hardness=1.3, glide_curve=1.8),
    # 1: a smaller fall, subtler.
    '1': voice([(698, 698, 0.08), ('rest', 0.05), (698, 650, 0.38)], hardness=1.3, glide_curve=1.8),
    # 2: the same shape, lower and warmer.
    '2': voice([(587, 587, 0.08), ('rest', 0.05), (587, 505, 0.38)], hardness=1.3, glide_curve=1.8),
    # 3: a shorter tail, crisper.
    '3': voice([(698, 698, 0.08), ('rest', 0.05), (698, 610, 0.26)], hardness=1.3, glide_curve=1.6),
    # 4: tighter: a shorter first blip and gap.
    '4': voice([(698, 698, 0.06), ('rest', 0.03), (698, 600, 0.34)], hardness=1.3, glide_curve=1.8),
    # 5: the tail holds level, then dips only at the very end.
    '5': voice([(698, 698, 0.08), ('rest', 0.05), (698, 600, 0.38)], hardness=1.3, glide_curve=3.5),
}

out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
for name, group in (('statement', STATEMENT),):
    reel = []
    for key, s in group.items():
        write(out / f'{name}-{key}.wav', s)
        reel += s + rest(1.2)
    write(out / f'{name}-reel.wav', reel)
print('ok')
