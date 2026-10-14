"""Remove the three exposed muzzle-flash frames from the supplied video.

Masks are in the original 1280x720 coordinates and stop outside the crossbow.
The character, weapon, motion timing, watermark and original audio are retained.
No generated replacement, pose tracking, resizing or frame skipping is used.
"""
from pathlib import Path
import hashlib
import json
import shutil

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw


HERE = Path(__file__).resolve().parent
USER_SOURCE = Path('C:/Users/user/Downloads/弓箭手姿势描述 (3).mp4')
SOURCE = HERE / 'source.mp4'
OUTPUT = HERE / 'sniper-attack-no-flash.mp4'

# Frame 52: follow the empty space along the upper edge of the crossbow.
# Frames 53/54: the detached flash is entirely above the weapon.
MASKS = {
    52: [(250, 0), (515, 0), (515, 111), (481, 111), (471, 113),
         (466, 114), (465, 122), (464, 132), (455, 134), (444, 137),
         (432, 140), (423, 144), (415, 151), (408, 161), (250, 161)],
    53: [(250, 0), (475, 0), (475, 120), (250, 120)],
    54: [(250, 0), (475, 0), (475, 120), (250, 120)],
}


def main():
    if not SOURCE.exists():
        shutil.copy2(USER_SOURCE, SOURCE)
    reader = imageio_ffmpeg.read_frames(str(SOURCE), pix_fmt='rgb24')
    meta = next(reader)
    if tuple(meta['size']) != (1280, 720) or meta['fps'] != 24:
        raise RuntimeError('These masks apply only to the supplied 1280x720 / 24fps clip')

    masks = {}
    for n, points in MASKS.items():
        image = Image.new('L', meta['size'], 0)
        ImageDraw.Draw(image).polygon(points, fill=255)
        image.save(HERE / f'flash-mask-{n:02d}.png')
        masks[n] = np.asarray(image) > 0

    writer = imageio_ffmpeg.write_frames(
        str(OUTPUT), meta['size'], fps=meta['fps'], codec='libx264',
        pix_fmt_in='rgb24', pix_fmt_out='yuv420p', macro_block_size=1,
        audio_path=str(SOURCE), audio_codec='copy',
        output_params=['-crf', '15', '-preset', 'medium', '-movflags', '+faststart'],
    )
    writer.send(None)
    changed = []
    count = 0
    try:
        for n, data in enumerate(reader):
            frame = np.frombuffer(data, dtype=np.uint8).reshape(720, 1280, 3).copy()
            if n in masks:
                # Sample the original pure-black background. It stays black in
                # this clip; do not paint over any part of the weapon or hero.
                background = np.median(frame[200:300, 100:200], axis=(0, 1)).astype(np.uint8)
                before = frame[masks[n]].copy()
                frame[masks[n]] = background
                changed.append({
                    'index': n, 'timeSeconds': n / meta['fps'],
                    'polygon': MASKS[n], 'backgroundRGB': background.tolist(),
                    'modifiedPixels': int(np.any(before != background, axis=1).sum()),
                })
                Image.fromarray(frame).save(HERE / f'clean-frame-{n:02d}.png')
            writer.send(frame)
            count += 1
    finally:
        writer.close()

    report = {
        'userSource': str(USER_SOURCE), 'source': SOURCE.name, 'output': OUTPUT.name,
        'sourceSHA256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'sourceSize': list(meta['size']), 'fps': meta['fps'], 'frameCount': count,
        'videoSeconds': count / meta['fps'], 'sourceDuration': meta['duration'],
        'changedFrames': changed,
        'method': 'Fixed original-coordinate background replacement outside the weapon; no resynthesis.',
        'preserved': ['97 original frame positions', '24fps timing', 'full canvas',
                      'character and weapon motion', 'watermark', 'original audio stream'],
        'review': 'User manual review; no game or browser QA.',
        'gameIntegrated': False,
    }
    (HERE / 'processing.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'output': str(OUTPUT), 'frames': count, 'editedFrames': list(MASKS)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
