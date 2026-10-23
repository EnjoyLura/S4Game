from pathlib import Path
import json
import numpy as np
import imageio.v2 as iio
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
ROIS = {
    'goblin_worker': [325, 15, 695, 345],
    'goblin_shaman': [695, 0, 1035, 365],
    'goblin_brute': [305, 350, 705, 750],
    'wolf_rider': [705, 290, 1035, 755],
}
SEEDS = {'goblin_worker': (520, 205), 'goblin_shaman': (867, 210),
         'goblin_brute': (510, 540), 'wolf_rider': (870, 550)}


def matte(rgb):
    arr = np.asarray(rgb).astype(np.float32)
    # Pale neutral background only; green skin, red cloth, dark ink and internal bone stay opaque.
    light = arr.min(2) > 155
    neutral = (arr[..., 0] - arr[..., 2] < 44) & (arr[..., 0] - arr[..., 2] > -9)
    neutral &= (np.abs(arr[..., 0] - arr[..., 1]) < 23) & (np.abs(arr[..., 1] - arr[..., 2]) < 29)
    candidates = light & neutral
    flood = Image.fromarray((candidates * 255).astype('uint8'))
    padded = Image.new('L', (rgb.width + 2, rgb.height + 2), 255)
    padded.paste(flood, (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 128, thresh=0)
    external = np.asarray(padded)[1:-1, 1:-1] == 128
    mask = Image.fromarray((~external * 255).astype('uint8'))
    # Close codec pinholes, but do not enlarge silhouettes or blur internal artwork.
    mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    mask = mask.filter(ImageFilter.GaussianBlur(.28))
    result = rgb.convert('RGBA')
    result.putalpha(mask)
    return result


def features(im):
    small = im.resize((80, 96), Image.Resampling.BILINEAR)
    arr = np.asarray(small).astype('float32') / 255
    alpha = arr[..., 3:4]
    # Composite on a fixed gray; lower body and hands contribute more than an unmoving head.
    comp = arr[..., :3] * alpha + .65 * (1 - alpha)
    weights = np.ones((96, 80, 1), dtype='float32')
    weights[48:] = 1.7
    return np.concatenate([comp * weights, alpha * 1.3], axis=2).ravel()


def main():
    reader = iio.get_reader(ROOT / 'source/user-four-monsters.mp4')
    frames = [Image.fromarray(f) for f in reader]
    fps = reader.get_meta_data()['fps']
    reader.close()
    report = {}
    full = [matte(im) for im in frames]
    for name, roi in ROIS.items():
        folder = ROOT / 'cutouts' / name
        folder.mkdir(parents=True, exist_ok=True)
        images = []
        for im in full:
            binary = im.getchannel('A').point(lambda v: 255 if v > 128 else 0)
            ImageDraw.floodfill(binary, SEEDS[name], 128, thresh=0)
            component = Image.fromarray(((np.asarray(binary) == 128) * 255).astype('uint8'))
            component = component.filter(ImageFilter.MaxFilter(3))
            selected = im.copy()
            alpha = np.minimum(np.asarray(im.getchannel('A')), np.asarray(component))
            selected.putalpha(Image.fromarray(alpha))
            images.append(selected.crop(roi))
        boxes = []
        for i, im in enumerate(images):
            im.save(folder / f'{i:03d}.png')
            boxes.append(im.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox())
        feat = np.stack([features(im) for im in images])
        velocity = np.diff(feat, axis=0)
        candidates = []
        adjacent = np.mean(np.abs(np.diff(feat, axis=0)), axis=1)
        for start in range(1, len(images) - 12):
            min_length = 10 if name == 'wolf_rider' else 20
            for end in range(start + min_length, min(start + 35, len(images) - 2)):
                pose = float(np.mean(np.abs(feat[start] - feat[end])))
                context = float(np.mean(np.abs(feat[start - 1:start + 2] - feat[end - 1:end + 2])))
                vel = float(np.mean(np.abs(velocity[start] - velocity[end])))
                loop_jump = float(np.mean(np.abs(feat[end - 1] - feat[start])))
                cuts = sum(1 for box in boxes[start:end] if box[1] <= 0 or box[0] <= 0 or box[2] >= roi[2]-roi[0] or box[3] >= roi[3]-roi[1])
                seam_excess = max(0, loop_jump - float(np.median(adjacent)))
                score = pose + context * .8 + vel * .4 + seam_excess + cuts * .1
                candidates.append(dict(start=start, end=end, length=end-start, seconds=(end-start)/fps,
                                       pose=pose, context=context, velocity=vel, seam=loop_jump,
                                       seamVsMedian=loop_jump/float(np.median(adjacent)), clippedFrames=cuts, score=score))
        candidates.sort(key=lambda c: c['score'])
        report[name] = dict(roi=roi, boxes=boxes, adjacentMedian=float(np.median(adjacent)), candidates=candidates[:18])
        sheet = Image.new('RGB', (8 * 150, 7 * 190), '#a7c4cc')
        draw = ImageDraw.Draw(sheet)
        for i, im in enumerate(images):
            thumb = im.copy(); thumb.thumbnail((146, 170))
            x, y = i % 8 * 150, i // 8 * 190
            sheet.paste(thumb, (x + (150-thumb.width)//2, y + (170-thumb.height)//2), thumb)
            draw.text((x+4, y+172), str(i), fill='#111111')
        sheet.save(ROOT / f'{name}-all-frames.jpg', quality=94)
    (ROOT / 'loop-candidates.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: info['candidates'][:5] for name, info in report.items()}, indent=2))


if __name__ == '__main__':
    main()
