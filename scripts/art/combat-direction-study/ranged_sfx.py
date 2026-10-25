#!/usr/bin/env python3
"""Deterministic, mono PCM combat effects built from oscillators and filtered noise."""
import argparse
import base64
import hashlib
import io
import json
import math
from pathlib import Path
import random
import struct
import wave

RATE = 48000
TAU = math.tau
SPECS = [
    ('swordRelease', 'sword-release.wav', .130, .50, 'short brushed steel and cloth pass'),
    ('lightHit', 'light-hit.wav', .140, .62, 'cut transient, small metal ring and low collision'),
    ('heavyCharge', 'heavy-charge.wav', .260, .40, 'rising metallic tension'),
    ('heavyImpact', 'heavy-impact.wav', .270, .74, 'blade crack, low impact and short grit'),
    ('dodge', 'dodge.wav', .120, .38, 'close cloth flutter'),
    ('enemySlam', 'enemy-slam.wav', .240, .66, 'heavy body and stone crack'),
    ('playerHit', 'player-hit.wav', .150, .58, 'short cloth and blunt collision'),
    ('groundStrike', 'ground-strike.wav', .220, .54, 'descending blade and small stone contact'),
]


def synth(index, key, seconds, peak):
    rng = random.Random(260126 + index * 7919)
    count = round(seconds * RATE)
    low = mid = high = 0.0
    coeff = [1 - math.exp(-TAU * hz / RATE) for hz in (220, 1800, 8500)]
    samples = []
    for i in range(count):
        t, u = i / RATE, i / (count - 1)
        n = rng.uniform(-1, 1)
        low += coeff[0] * (n - low)
        mid += coeff[1] * (n - mid)
        high += coeff[2] * (n - high)
        grain, edge = mid - low, high - mid
        if key == 'swordRelease':
            air = math.sin(math.pi * u) ** 1.8
            metal = math.sin(TAU * (3900 * t - 8200 * t * t)) * math.exp(-t / .018)
            v = .90 * edge * air + .18 * grain * math.exp(-t / .040) + .085 * metal
        elif key == 'lightHit':
            v = .75 * edge * math.exp(-t / .010) + .24 * grain * math.exp(-t / .028)
            v += .27 * math.sin(TAU * 96 * t) * math.exp(-t / .038)
            v += (.065 * math.sin(TAU * 2260 * t) + .035 * math.sin(TAU * 3571 * t)) * math.exp(-t / .025)
        elif key == 'heavyCharge':
            envelope = u ** 1.3 * min(1, (1 - u) / .045)
            v = envelope * (.20 * math.sin(TAU * (850 * t + 2700 * t * t))
                            + .08 * math.sin(TAU * (1741 * t + 1900 * t * t)) + .14 * edge)
        elif key == 'heavyImpact':
            v = .70 * edge * math.exp(-t / .011) + .30 * grain * math.exp(-t / .055)
            v += .48 * math.sin(TAU * (66 * t - 18 * t * t)) * math.exp(-t / .072)
            v += .17 * math.sin(TAU * 117 * t) * math.exp(-t / .038)
            v += .075 * math.sin(TAU * 1163 * t) * math.exp(-t / .042)
        elif key == 'dodge':
            flutter = sum(math.exp(-max(0, t - at) / .012) if t >= at else 0 for at in (.006, .027, .051, .075))
            v = (.72 * edge + .20 * grain) * flutter * math.sin(math.pi * u)
        elif key == 'enemySlam':
            v = .42 * math.sin(TAU * (74 * t - 22 * t * t)) * math.exp(-t / .068)
            v += .42 * grain * math.exp(-t / .042) + .48 * edge * math.exp(-t / .006)
        elif key == 'playerHit':
            v = .38 * math.sin(TAU * 128 * t) * math.exp(-t / .033)
            v += .64 * grain * math.exp(-t / .019) + .20 * edge * math.exp(-t / .006)
        else:
            v = .22 * math.sin(TAU * (2350 * t - 3200 * t * t)) * math.exp(-t / .036)
            v += .62 * edge * math.exp(-t / .012) + .20 * grain * math.exp(-t / .050)
            v += .18 * math.sin(TAU * 142 * t) * math.exp(-t / .032)
        fade = min(1, i / (RATE * .0015), (count - 1 - i) / (RATE * .006))
        samples.append(v * max(0, fade))
    factor = peak / max(abs(x) for x in samples)
    return [round(x * factor * 32767) for x in samples]


def wav_bytes(samples):
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(struct.pack('<' + 'h' * len(samples), *samples))
    return buf.getvalue()


def metrics(samples, data):
    return {'durationSeconds': len(samples) / RATE, 'sampleCount': len(samples),
            'peak': max(abs(x) for x in samples) / 32767,
            'rms': math.sqrt(sum(x * x for x in samples) / len(samples)) / 32767,
            'clippedSamples': sum(abs(x) >= 32767 for x in samples),
            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[3] / 'docs/art/combat-ranged-20261026/audio')
    parser.add_argument('--check', action='store_true', help='Compare deterministic output in memory, without writing')
    parser.add_argument('--overwrite', action='store_true')
    args = parser.parse_args()
    generated, assets, cues = {}, {}, {}
    audition = [0] * round(.25 * RATE)
    segments = []
    for index, (key, filename, seconds, peak, layers) in enumerate(SPECS):
        samples = synth(index, key, seconds, peak)
        data = wav_bytes(samples)
        generated[filename] = data
        assets[key] = 'data:audio/wav;base64,' + base64.b64encode(data).decode('ascii')
        cues[key] = {'file': filename, 'layers': layers, 'seed': 260126 + index * 7919, **metrics(samples, data)}
        for take in (1, 2):
            segments.append({'cue': key, 'take': take, 'startSeconds': len(audition) / RATE, 'durationSeconds': len(samples) / RATE})
            audition.extend(samples)
            if take == 1:
                audition.extend([0] * round(.12 * RATE))
        if index < len(SPECS) - 1:
            audition.extend([0] * round(.30 * RATE))
    audition.extend([0] * round(.35 * RATE))
    data = wav_bytes(audition)
    generated['audition.wav'] = data
    generated['audio-data.json'] = (json.dumps(assets, separators=(',', ':')) + '\n').encode()
    metadata = {'id': 'ranged-procedural-sfx-v001', 'sampleRate': RATE, 'channels': 1, 'encoding': 'PCM signed16 little-endian',
                'generation': 'deterministic local oscillators and filtered pseudorandom noise', 'defaultMasterVolume': .35,
                'cues': cues, 'audition': {'file': 'audition.wav', **metrics(audition, data), 'segments': segments,
                                          'betweenTakesSeconds': .12, 'betweenCueGroupsSeconds': .30},
                'embeddedAssets': {'file': 'audio-data.json', 'sha256': hashlib.sha256(generated['audio-data.json']).hexdigest()},
                'reviewStatus': 'engineering metrics checked; main-agent listening pending'}
    generated['metadata.json'] = (json.dumps(metadata, ensure_ascii=False, indent=2) + '\n').encode()
    if args.check:
        bad = [name for name, data in generated.items() if not (args.output / name).is_file() or (args.output / name).read_bytes() != data]
        if bad:
            raise SystemExit('Deterministic readback differs: ' + ', '.join(bad))
    else:
        if args.output.exists() and any(args.output.iterdir()) and not args.overwrite:
            raise FileExistsError('Existing audio output protected: ' + str(args.output))
        args.output.mkdir(parents=True, exist_ok=True)
        for name, data in generated.items():
            (args.output / name).write_bytes(data)
    print(json.dumps({'output': str(args.output), 'cues': len(cues), 'audition': str(args.output / 'audition.wav'),
                      'auditionSeconds': metadata['audition']['durationSeconds'], 'maxPeak': max(c['peak'] for c in cues.values()),
                      'clippedSamples': sum(c['clippedSamples'] for c in cues.values()), 'deterministicReadback': args.check}, ensure_ascii=False))


if __name__ == '__main__':
    main()
