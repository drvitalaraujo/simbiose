"""Prepara fontes CC0 baixadas. Requer ffmpeg.
Uso: python scripts/prepare-audio.py <Free Firearm Sound Library extraída> <Kenney Impact Sounds extraído>
"""
import array
import json
from pathlib import Path
import subprocess
import sys

firearms, impact = map(Path, sys.argv[1:3])
destination = Path(__file__).resolve().parents[1] / 'public' / 'audio'
destination.mkdir(parents=True, exist_ok=True)
manifest = []


def convert(name, path, duration, target=0.8):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'])
    samples = array.array('f', raw)
    peak = max(abs(v) for v in samples)
    onset = max(0, next(i for i, v in enumerate(samples) if abs(v) > peak * 0.12) / 44100 - 0.003)
    cut = samples[int(onset * 44100):int((onset + duration) * 44100)]
    gain = target / max(abs(v) for v in cut)
    filters = f'atrim=start={onset}:duration={duration},asetpts=PTS-STARTPTS,highpass=f=70,volume={gain},afade=t=out:st={duration - 0.035}:d=0.035'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(path), '-af', filters, '-ac', '1', '-ar', '44100', '-c:a', 'libvorbis', '-q:a', '5', str(destination / f'{name}.ogg')], check=True)
    manifest.append({'file': f'{name}.ogg', 'source': path.name, 'folder': path.parent.name, 'onset': round(onset, 6), 'duration': duration, 'targetPeak': target})


for name, folder, source, duration in [
    ('rifle', 'AR-15', 'D_32P.wav', 0.3),
    ('smg', 'Carl Gustav M45', 'G_31P.wav', 0.2),
    ('sniper', 'Tikka', 'W_29P.wav', 0.65),
    ('shotgun', 'Nova', 'O_21P.wav', 0.45),
]:
    convert(name, firearms / folder / source, duration)
for i in range(4):
    convert(f'step-{i}', impact / 'Audio' / f'footstep_concrete_00{i}.ogg', 0.24, 0.65)
for name, source, duration in [
    ('mag-out', 'impactMetal_light_000.ogg', 0.12), ('mag-in', 'impactMetal_medium_001.ogg', 0.16),
    ('bolt', 'impactMetal_light_002.ogg', 0.16), ('metal', 'impactMetal_medium_003.ogg', 0.24),
    ('slap', 'impactPunch_heavy_001.ogg', 0.2), ('debris', 'impactGeneric_light_002.ogg', 0.2),
]:
    convert(name, impact / 'Audio' / source, duration, 0.7)
(destination / 'sources.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(f'{len(manifest)} sons mono, {sum(p.stat().st_size for p in destination.glob("*.ogg"))} bytes')
