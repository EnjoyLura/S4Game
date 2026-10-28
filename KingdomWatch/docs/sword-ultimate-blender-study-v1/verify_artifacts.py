"""Artifact-only verification of the independent sword-ultimate study.

No game module is imported, started or modified.
"""
import hashlib
import json
from pathlib import Path

import imageio.v2 as imageio
import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent
frames = sorted((OUT / 'frames').glob('frame_*.png'))
assert [p.name for p in frames] == [f'frame_{i:04d}.png' for i in range(1, 241)], len(frames)
for p in frames:
    im = Image.open(p)
    assert im.mode == 'RGB' and im.size == (1280, 720), (p.name, im.mode, im.size)
# The last raw frame is a foggy empty seal; the composed video carries the black fade.
last = np.asarray(Image.open(frames[-1]).convert('L'), dtype=np.float32) / 255

marks = json.loads((OUT / 'impact-marks.json').read_text())
assert len(marks) == 5 and marks[-1]['final'] is True

videos = {}
for name, expected_frames, expected_size in [
    ('five-peaks-heavenfall.mp4', 240, (1280, 720)),
]:
    reader = imageio.get_reader(OUT / name)
    meta = reader.get_meta_data()
    count = reader.count_frames()
    last_frame = reader.get_data(count - 1)
    reader.close()
    assert count == expected_frames, (name, count)
    assert abs(meta['fps'] - 24) < 1e-6 and abs(meta['duration'] - 10) < .05, meta
    assert tuple(meta['size']) == expected_size, meta['size']
    assert float(np.asarray(last_frame, dtype=np.float32).mean()) < 2.5, 'video must end black'
    videos[name] = {'frames': count, 'fps': meta['fps'], 'seconds': meta['duration'], 'size': list(meta['size'])}

gif = Image.open(OUT / 'five-peaks-heavenfall.gif')
assert gif.n_frames == 120, gif.n_frames
webp = Image.open(OUT / 'five-peaks-heavenfall.webp')
assert webp.n_frames == 120, webp.n_frames

for name in ['contact-sheet.jpg', 'beauty-0020.jpg', 'beauty-0056.jpg', 'beauty-0092.jpg',
             'beauty-0140.jpg', 'beauty-0149.jpg', 'beauty-0155.jpg', 'beauty-0166.jpg',
             'beauty-0205.jpg', 'five-peaks-heavenfall.blend']:
    p = OUT / name
    assert p.exists() and p.stat().st_size > 1000, name

hashed = ['build_scene.py', 'compose_preview.py', 'five-peaks-heavenfall.blend',
          'five-peaks-heavenfall.mp4', 'five-peaks-heavenfall.gif', 'five-peaks-heavenfall.webp',
          'contact-sheet.jpg', 'impact-marks.json']
hashes = {name: hashlib.sha256((OUT / name).read_bytes()).hexdigest() for name in hashed}
report = {
    'status': 'PASS',
    'scope': 'independent Blender visual study; game not integrated, built, deployed or started',
    'frames': len(frames),
    'size': [1280, 720],
    'fps': 24,
    'seconds': 10,
    'lastFrameMean': round(float(last.mean()), 5),
    'impactMarks': len(marks),
    'videos': videos,
    'previewFrames': {'gif': gif.n_frames, 'webp': webp.n_frames},
    'gameStarted': False,
    'gameIntegrated': False,
    'gameBuilt': False,
    'deployed': False,
    'hashes': hashes,
}
(OUT / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n',
                                       encoding='utf8')
print(json.dumps(report, ensure_ascii=False, indent=2))
