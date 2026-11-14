# Generates the 22 sounds that are hard to record by hand (SOUNDS.md).
# Usage: python3 tools/makesfx.py /tmp/sfx && for f in /tmp/sfx/*.wav; do ffmpeg -y -i "$f" -b:a 96k -ac 1 "src/audio/$(basename "${f%.wav}").mp3"; done
import sys, wave, numpy as np
SR = 44100
OUT = sys.argv[1]
rng = np.random.default_rng(7)

def T(d): return np.arange(int(SR * d)) / SR
def noise(d): return rng.uniform(-1, 1, int(SR * d))
def env(d, a=.003, decay=8.0):
    t = T(d); e = np.exp(-t * decay); n = max(1, int(SR * a)); e[:n] *= np.linspace(0, 1, n); return e
def band(x, lo=0, hi=SR / 2, soft=.15):
    # FFT band filter with smooth skirts
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo > 0: m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi < SR / 2: m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))
def tone(freq, d, kind='sine'):
    t = T(d); f = np.broadcast_to(freq, t.shape) if np.ndim(freq) else np.full(t.shape, freq)
    ph = 2 * np.pi * np.cumsum(f) / SR
    if kind == 'sine': return np.sin(ph)
    if kind == 'saw': return 2 * ((ph / (2 * np.pi)) % 1) - 1
    if kind == 'square': return np.sign(np.sin(ph))
def sweep(f0, f1, d): return f0 * (f1 / f0) ** (T(d) / d)
def room(x, size=.25, wet=.18):
    ir = noise(size) * np.exp(-T(size) * 18); ir[0] = 1 / wet
    y = np.convolve(x, ir)[:len(x) + int(SR * size * .6)]
    return y
def place(total, *parts):
    y = np.zeros(int(SR * total))
    for at, x in parts:
        i = int(SR * at); y[i:i + len(x)] += x[:len(y) - i]
    return y
def loopify(x, fade=1.0):
    n = int(SR * fade); head, tail = x[:n], x[-n:]; r = np.linspace(0, 1, n)
    body = x[n:-n].copy(); start = tail * (1 - r) + head * r
    return np.concatenate([start, body])
def save(name, x, peak_db=-3.0):
    x = x - np.mean(x); x = x / (np.max(np.abs(x)) + 1e-9) * 10 ** (peak_db / 20)
    n = min(len(x), int(SR * .004)); x[-n:] *= np.linspace(1, 0, n)  # no click at the end
    with wave.open(f'{OUT}/{name}.wav', 'w') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype('<i2').tobytes())

def bell(f, d, decay=3.5):
    return sum(a * tone(f * r, d) * env(d, .002, decay * k) for r, a, k in [(1, 1, 1), (2.76, .45, 1.8), (5.4, .25, 2.6), (8.9, .1, 3.5)])
def thump(d=.25, f0=90, f1=42, decay=14):
    return tone(sweep(f0, f1, d), d) * env(d, .002, decay)
def ping(f, d, decay): return tone(f, d) * env(d, .0005, decay)

# ── Ambience loops ──
d = 21
hum = sum(a * tone(50 * h, d) for h, a in [(1, 1), (2, .5), (3, .25)]) * .05
bed = band(np.cumsum(noise(d)) / 300, 30, 380) + band(noise(d), 200, 2500) * .04
crackle = np.zeros(int(SR * d)); idx = rng.integers(0, len(crackle), 260); crackle[idx] = rng.uniform(-1, 1, 260)
crackle = band(crackle, 600, 6000) * 4
save('amb-room', loopify(bed + hum + crackle), -16)

d = 21.11  # 19 heartbeats of 1.111 s
beat = place(1.111, (0, thump(.22, 62, 40, 16)), (.24, thump(.2, 56, 38, 18) * .7))
hb = np.tile(beat, 20)[:int(SR * d)]
pad = sum(tone(f, d) * (.5 + .5 * np.sin(2 * np.pi * T(d) / d * k)) for f, k in [(55, 1), (82.4, 2), (110.6, 3)]) * .08
air = band(np.cumsum(noise(d)) / 300, 30, 220)
save('amb-memory', loopify(air + pad + hb * .9, 1.11), -12)

d = 9
st = band(noise(d), 300, 4200) * (0.7 + .3 * np.sin(2 * np.pi * T(d) * 2))
pops = np.zeros(int(SR * d)); idx = rng.integers(0, len(pops), 500); pops[idx] = rng.uniform(-3, 3, 500)
save('radio-static', loopify(st + band(pops, 1000, 7000), .5), -8)

# ── Day / night, alerts ──
save('shift', place(1.5, (0, bell(784, 1.1)), (.22, bell(1046.5, 1.25))))
d = .85
sting = sum(tone(f, d, 'saw') for f in (110, 116.5, 164.8)) / 3
sting = band(sting, 60, 1400) * env(d, .006, 3.2) + thump(d, 70, 32, 4) * .9
save('gaze', room(sting, .4, .25))
save('heartbeat', place(.48, (0, thump(.22, 70, 40, 15)), (.22, thump(.22, 62, 38, 17) * .75)))
d = .45
save('hurt', room(thump(d, 110, 45, 9) + band(noise(d), 80, 900) * env(d, .001, 22) * .8, .3, .2))

# ── Clues and progress ──
def vib(f, d):
    t = T(d); return (tone(f, d) + .25 * tone(4 * f, d) * env(d, .001, 9)) * env(d, .002, 3.2) * (1 + .18 * np.sin(2 * np.pi * 5.5 * t))
save('clue', room(place(.85, (0, vib(659.3, .6)), (.13, vib(880, .7))), .5, .2))
d = .32
save('glass', room(thump(d, 130, 90, 18) + band(noise(d), 300, 700) * env(d, .001, 30) * .5 + ping(930, d, 14) * .2, .25, .25))
beep = lambda f, d: band(np.tanh(tone(f, d, 'square') * 1.5), 500, 3000) * env(d, .004, 2) * np.where(T(d) < d - .01, 1, 0)
save('radio', place(.58, (0, beep(810, .22)), (.28, beep(670, .22))) + band(noise(.58), 600, 3500) * .06)
save('tune', band(tone(sweep(1500, 900, .05), .05, 'square'), 600, 4000) * env(.05, .001, 50), -9)

# ── Puzzles ──
d = .14
save('crack', band(noise(d), 2500, 12000) * env(d, .0003, 45) + sum(ping(f, d, 35) * .3 for f in rng.uniform(3000, 7000, 4)))
d = 1.1
sh = band(noise(d), 1800, 14000) * env(d, .0005, 5)
for _ in range(28):
    at = rng.uniform(0, .45) ** 1.6; dd = rng.uniform(.08, .35); f = rng.uniform(2200, 8500)
    sh += place(d, (at, ping(f, dd, rng.uniform(12, 30)) * rng.uniform(.2, .6)))
save('shatter', room(sh + thump(d, 120, 60, 25) * .6, .3, .15))
d = .5
metal = lambda dd: sum(a * ping(f, dd, k) for f, a, k in [(420, 1, 9), (1133, .6, 13), (2210, .4, 18), (3520, .25, 24)])
save('clank', room(place(d, (0, metal(.4)), (.16, metal(.3) * .35)), .2, .2))
d = .03
save('tick', band(noise(d), 2500, 8000) * env(d, .0002, 260) + ping(2400, d, 200) * .4, -6)
d = .04
save('click', band(noise(d), 900, 3500) * env(d, .0002, 180) + thump(d, 400, 250, 120) * .4, -5)
# Garbled dispatcher through a valve radio: buzzy pitch through moving vowel formants.
d = 1.7; t = T(d)
pitch = 125 + 18 * np.sin(2 * np.pi * .9 * t) + rng.normal(0, 1, len(t)).cumsum() / 4000
src = tone(pitch, d, 'saw')
vowels = [(730, 1090), (270, 2290), (530, 1840), (570, 840), (300, 870), (660, 1700)]
syl = np.zeros(len(t)); out = np.zeros(len(t)); seg = int(SR * .19)
for i in range(0, len(t), seg):
    f1, f2 = vowels[(i // seg) % len(vowels)]
    chunk = src[i:i + seg]
    out[i:i + len(chunk)] = band(chunk, f1 * .7, f1 * 1.3) + .6 * band(chunk, f2 * .8, f2 * 1.2)
    syl[i:i + len(chunk)] = np.sin(np.linspace(0, np.pi, len(chunk))) ** .6 * (0 if (i // seg) in (3, 7) else 1)
v = band(np.tanh(out * syl * 3), 320, 3000) + band(noise(d), 400, 4000) * .08
save('voice', v)
d = .09
save('wire', ping(2500, d, 40) * .6 + band(noise(d), 2000, 9000) * env(d, .0002, 120) + ping(3900, d, 60) * .3)
d = .26
sp = np.zeros(int(SR * d)); idx = rng.integers(0, int(SR * .18), 90); sp[idx] = rng.uniform(-1, 1, 90)
save('spark', band(sp, 1500, 12000) * 6 * env(d, .001, 6) + tone(120, d, 'saw') * env(d, .002, 12) * .25)
d = .2; t = T(d)
mot = (tone(72, d, 'saw') + .5 * tone(144, d, 'saw')) * (1 + .4 * np.sin(2 * np.pi * 26 * t))
save('grind', band(mot, 50, 900) + band(noise(d), 300, 1500) * .3, -6)

# ── Menus ──
d = .03
save('ui-hover', band(noise(d), 1800, 6000) * env(d, .0003, 220) + ping(2000, d, 220) * .3, -14)
d = .06
save('ui-press', band(noise(d), 1200, 7000) * env(d, .0002, 140) + thump(d, 220, 120, 70) * .6, -7)
print('ok')
