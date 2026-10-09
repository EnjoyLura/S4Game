"""Import red-screen monster videos into the existing 160px walk atlas.

Preserves a shared crop/scale across frames and archives the source mapping.
Usage: python import_mob_walks.py --manifest sources.json --ffmpeg ffmpeg.exe
"""
import argparse
import hashlib
import io
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def decode(path, ffmpeg):
    result = subprocess.run([ffmpeg, '-v', 'error', '-i', str(path), '-an',
                             '-vf', 'scale=672:384', '-f', 'image2pipe',
                             '-vcodec', 'png', '-'], capture_output=True, check=True)
    data = result.stdout
    frames = []
    cursor = 0
    while cursor < len(data):
        start = cursor
        cursor += 8
        while True:
            length = int.from_bytes(data[cursor:cursor + 4], 'big')
            kind = data[cursor + 4:cursor + 8]
            cursor += length + 12
            if kind == b'IEND':
                break
        frames.append(Image.open(io.BytesIO(data[start:cursor])).convert('RGB'))
    return frames


def key(image):
    rgb = np.asarray(image).astype(np.float32)
    r, g, b = rgb.transpose(2, 0, 1)
    red = (r > 110) & (r > g * 1.8 + 20) & (r > b * 1.8 + 20)
    # Remove white pillarboxing only when connected to the image boundary;
    # teeth, bones and metallic highlights inside the character stay opaque.
    white = (rgb.min(axis=2) > 225)
    mask = Image.fromarray(np.where(red | white, 255, 0).astype('uint8'))
    for x, y in [(0, 0), (image.width - 1, 0), (0, image.height - 1),
                 (image.width - 1, image.height - 1)]:
        if mask.getpixel((x, y)) == 255:
            ImageDraw.floodfill(mask, (x, y), 128)
    background = red | (np.asarray(mask) == 128)
    # H.264 mixes white/red at the pillarbox boundary into pink pixels.
    # Remove the entire edge strip, including its compressed transition,
    # before computing the shared character crop.
    white_columns = (rgb.min(axis=2) > 200).mean(axis=0) > 0.8
    left = 0
    while left < image.width and white_columns[left]:
        left += 1
    right = image.width
    while right > left and white_columns[right - 1]:
        right -= 1
    if left:
        background[:, :min(image.width, left + 2)] = True
    if right < image.width:
        background[:, max(0, right - 2):] = True
    alpha = np.where(background, 0, 255).astype('uint8')
    rgba = np.dstack([rgb.astype('uint8'), alpha])
    rgba[background, :3] = 0
    return Image.fromarray(rgba)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--ffmpeg', required=True)
    args = parser.parse_args()
    manifest_path = Path(args.manifest)
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    for item in manifest['sources']:
        source = manifest_path.parent / item['archive']
        frames = [key(im) for im in decode(source, args.ffmpeg)]
        start, end = item['startFrame'], item['endFrame']
        assert 0 <= start < end <= len(frames)
        count = end - start
        selected = frames[start:end]
        boxes = [im.getbbox() for im in selected]
        assert all(boxes), 'Empty character frame'
        left = min(b[0] for b in boxes) - 3
        top = min(b[1] for b in boxes) - 5
        right = max(b[2] for b in boxes) + 3
        bottom = max(b[3] for b in boxes)
        width, height = right - left, bottom - top
        scale = min(152 / width, 144 / height)
        size = (round(width * scale), round(height * scale))
        atlas = Image.new('RGBA', (160 * count, 160))
        rects = {}
        contacts = []
        sheet = Image.new('RGB', (160 * min(count, 12), 180 * ((count + 11) // 12)), '#c4a86e')
        draw = ImageDraw.Draw(sheet)
        for index, im in enumerate(selected):
            cell = Image.new('RGBA', (160, 160))
            # A lifted foot is not a moving ground plane. Keep the same crop
            # and pivot for the entire cycle instead of moving the whole body
            # whenever the lowest silhouette pixel changes between poses.
            cropped = im.crop((left, top, right, bottom)).resize(size, Image.Resampling.LANCZOS)
            cell.alpha_composite(cropped, ((160 - size[0]) // 2, 157 - size[1]))
            # Measure soles only in the two leg lanes, excluding low weapons.
            # Export contact data; never shift/rescale the character per frame.
            alpha = np.asarray(cell.getchannel('A'))
            feet = []
            for x0, x1 in [(48, 83), (83, 127)]:
                ys, xs = np.where(alpha[100:, x0:x1] > 160)
                if len(ys):
                    low = int(ys.max())
                    foot_x = float(np.median(xs[ys >= low - 3])) + x0
                    feet.extend([round((foot_x - 80) / 160, 4), round((159 - (100 + low)) / 160, 4)])
                else:
                    feet.extend([(-0.13 if x0 == 48 else 0.13), 3 / 160])
            contacts.append(feet)
            atlas.paste(cell, (160 * index, 0))
            rects[f"{item['mob']}_w{index}"] = [160 * index, 0, 160, 160]
            x, y = index % 12 * 160, index // 12 * 180
            sheet.paste(cell, (x, y), cell)
            draw.text((x + 3, y + 160), str(start + index), fill='black')
        prefix = manifest_path.parent / (item['mob'] + '_w')
        atlas.save(str(prefix) + '.png')
        sheet.save(str(prefix) + '_sheet.png')
        ground_y = round(float(np.median([min(f[1], f[3]) for f in contacts])), 4)
        metadata = {'frames': rects, 'cycle': {'seconds': count / item['fps'], 'cells': count},
                    'ground': {'offset': ground_y, 'feet': contacts}}
        Path(str(prefix) + '.frames.json').write_text(json.dumps(metadata, indent=1), encoding='utf-8')
        item['sha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
        item['cells'] = count
        item['cycleSeconds'] = count / item['fps']
        print(item['mob'], count, 'frames', round(count / item['fps'], 3), 'seconds', flush=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
