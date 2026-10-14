"""Derive video inputs from current idle RGB frames without altering the artwork."""
from pathlib import Path
import hashlib, json
import imageio_ffmpeg
from PIL import Image

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parent.parent
HOST = GAME.parent / '美术/vfx_host'
SOURCES = {'sniper': 'sniper-idle-natural-v2', 'volt': 'volt-idle-natural-v1'}
for hero, source in SOURCES.items():
    folder = GAME / 'docs' / f'{hero}-attack-natural-v1'
    folder.mkdir(parents=True, exist_ok=True)
    video = GAME / 'docs' / source / 'source.mp4'
    reader = imageio_ffmpeg.read_frames(str(video), pix_fmt='rgb24')
    info = next(reader)
    first = Image.frombytes('RGB', info['size'], next(reader))
    reader.close()
    name = f'hero_{hero}_attack_natural_v1_20261014_ff.png'
    first.save(folder / 'video-first-frame.png')
    first.save(HOST / name)
    record = {'hero': hero, 'sourceIdle': source, 'sourceVideoSha256': hashlib.sha256(video.read_bytes()).hexdigest(),
              'sourceFrame': 0, 'size': list(first.size), 'hostFilename': name,
              'imageRegenerated': False, 'purpose': 'Exact RGB first frame of the current idle; identical hero, grips and framing'}
    (folder / 'first-frame-layout.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
    print(json.dumps(record))
