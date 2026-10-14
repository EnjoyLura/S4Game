"""Preserve the user's green-screen fire mage video and annotate its complete source."""
from pathlib import Path
from datetime import datetime
import hashlib
import json
import shutil
import sys
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[1]
SOURCE = Path('C:/Users/user/Downloads/video (3).mp4')
sys.path.insert(0, str(GAME / 'docs/volt-idle-v1'))
from package_idle import bounds


def key_green(image):
    """Green screen coverage and spill removal for a red/gold hero, preserving dark ink.

    Green dominates no intended fire-mage material. Unlike the red-screen key's
    conservative colored-surface threshold, include mixed codec-edge greens in
    coverage and subtract the screen before unpremultiplication.
    """
    rgb = np.asarray(image.convert('RGB')).astype(np.float32)
    border = np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3),
                             rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)])
    background = np.median(border, axis=0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    other = np.maximum(r, b)
    screen = float(background[1]-max(background[0], background[2]))
    if screen < 100:
        raise RuntimeError('Source border is not green; retain and inspect the original')
    dominance = np.maximum(0, g-other)
    coverage = np.clip(1-dominance/max(screen, 1), 0, 1)
    coverage[(g >= 120) & (g >= other*2)] = 0
    # Tighten by one source pixel to exclude the chroma-subsampling ring, then
    # soften subpixel coverage; this is an alpha edge operation, not body warping.
    coverage = np.asarray(Image.fromarray(np.round(coverage*255).astype(np.uint8))
                          .filter(ImageFilter.MinFilter(3))
                          .filter(ImageFilter.GaussianBlur(.35)), dtype=np.float32)/255
    clean = np.clip((rgb-(1-coverage[..., None])*background)
                    / np.maximum(coverage[..., None], 1/255), 0, 255)
    # Remove the residual green that 4:2:0 chroma interpolation puts into outlines.
    spill = dominance > 0
    clean[..., 1][spill] = np.minimum(clean[..., 1], np.maximum(clean[..., 0], clean[..., 2]))[spill]
    clean[coverage == 0] = 0
    rgba = np.dstack([np.round(clean).astype(np.uint8), np.round(coverage*255).astype(np.uint8)])
    return Image.fromarray(rgba), background.tolist()


def main():
    saved = ROOT / 'source.mp4'
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if saved.exists() and hashlib.sha256(saved.read_bytes()).hexdigest() != digest:
        raise RuntimeError('Different source already saved; retain both takes')
    if not saved.exists():
        shutil.copy2(SOURCE, saved)
    reader = imageio_ffmpeg.read_frames(str(saved), pix_fmt='rgb24')
    meta = next(reader)
    frames = [Image.frombytes('RGB', meta['size'], data) for data in reader]
    boxes = [bounds(key_green(frame)[0]) for frame in frames]
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
    record = {'date': datetime.now().astimezone().isoformat(), 'hero': 'pyro',
              'userSourcePath': str(SOURCE), 'saved': 'source.mp4', 'sha256': digest,
              'metadata': meta, 'frames': len(frames), 'duration': len(frames)/meta['fps'],
              'union': box, 'background': 'green', 'paidTaskSubmitted': False,
              'userVisualAccepted': False, 'gameIntegrated': False, 'kind': 'idle'}
    (ROOT / 'source-origin.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(record, ensure_ascii=True))


if __name__ == '__main__':
    main()

