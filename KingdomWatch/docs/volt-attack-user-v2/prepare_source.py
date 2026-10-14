"""Preserve and annotate the user's replacement mage video, without generating media."""
from pathlib import Path
from datetime import datetime
import hashlib
import json
import shutil
import sys
import imageio_ffmpeg
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[1]
SOURCE = Path('C:/Users/user/Downloads/video (1).mp4')
sys.path.insert(0, str(GAME / 'docs/volt-idle-v1'))
from package_idle import key_red, bounds

saved = ROOT / 'source.mp4'
digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
if saved.exists() and hashlib.sha256(saved.read_bytes()).hexdigest() != digest:
    raise RuntimeError('Different source already saved; preserve both takes')
if not saved.exists():
    shutil.copy2(SOURCE, saved)
reader = imageio_ffmpeg.read_frames(str(saved), pix_fmt='rgb24')
meta = next(reader)
frames = [Image.frombytes('RGB', meta['size'], data) for data in reader]
boxes = [bounds(key_red(frame)[0]) for frame in frames]
box = [min(b[0] for b in boxes), min(b[1] for b in boxes),
       max(b[2] for b in boxes), max(b[3] for b in boxes)]
contact = Image.new('RGB', (7*175, ((len(frames)+6)//7)*230), '#28383b')
draw = ImageDraw.Draw(contact)
original = ROOT / 'original-frames'
original.mkdir(exist_ok=True)
for i, frame in enumerate(frames):
    frame.save(original / f'frame-{i:02d}.png')
    image = frame.crop((max(0, box[0]-10), max(0, box[1]-10),
                        min(meta['size'][0], box[2]+10), min(meta['size'][1], box[3]+10)))
    image.thumbnail((169, 202))
    x, y = i % 7*175, i // 7*230
    contact.paste(image, (x+(175-image.width)//2, y))
    draw.text((x+5, y+207), f'{i:02d} {i/meta["fps"]:.2f}s', fill='white')
contact.save(ROOT / 'source-contact.png')
record = {'date': datetime.now().astimezone().isoformat(), 'userSourcePath': str(SOURCE),
          'saved': 'source.mp4', 'sha256': digest, 'metadata': meta,
          'frames': len(frames), 'duration': len(frames)/meta['fps'], 'union': box,
          'paidTaskSubmitted': False, 'userVisualAccepted': False, 'gameIntegrated': False}
(ROOT / 'source-origin.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(record, ensure_ascii=True))
