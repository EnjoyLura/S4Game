"""Video-local VFX rotoscoping with imagegen weapon inserts and unchanged chronological frames."""
from pathlib import Path
import hashlib, json, shutil, sys
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parent.parent
OUT = GAME / 'docs/sniper-attack-clean-v1'
sys.path.insert(0, str(GAME / 'docs/volt-idle-v1'))
from package_idle import key_red
sys.stdout.reconfigure(encoding='utf-8')

def support_from_ink(image):
    rgb = np.asarray(image)
    ink = (rgb.max(axis=2) < 145) & (rgb[...,0] < 145)
    ink = Image.fromarray(ink.astype(np.uint8)*255).filter(ImageFilter.MaxFilter(9))
    filled = ink.copy()
    ImageDraw.floodfill(filled, (0,0), 128, thresh=0)
    shape = Image.fromarray((np.asarray(filled) != 128).astype(np.uint8)*255).copy()
    ImageDraw.floodfill(shape, (400,600), 128, thresh=0)
    connected = Image.fromarray((np.asarray(shape) == 128).astype(np.uint8)*255)
    return np.asarray(connected.filter(ImageFilter.MinFilter(7)))

def main():
    OUT.mkdir(exist_ok=True)
    frames_dir = OUT / 'rgba-frames'
    frames_dir.mkdir(exist_ok=True)
    shutil.copy2(ROOT / 'source.mp4', OUT / 'source.mp4')
    shutil.copy2(GAME / 'docs/sniper-stance-idle-v3/ready-red.png', OUT / 'ready-red.png')
    shutil.copy2(ROOT / 'source-origin.json', OUT / 'source-origin.json')
    info = json.loads((ROOT / 'source-info.json').read_text(encoding='utf-8'))
    size, fps, count = tuple(info['size']), info['fps'], info['frameCount']
    writer = imageio_ffmpeg.write_frames(str(OUT / 'attack-cleaned.mp4'), size, fps=fps,
        codec='libx264', pix_fmt_in='rgb24', pix_fmt_out='yuv420p', macro_block_size=1,
        audio_path=str(ROOT / 'source.mp4'), audio_codec='copy',
        output_params=['-crf','15','-preset','medium','-movflags','+faststart'])
    writer.send(None)
    records = []
    try:
        for index in range(count):
            image = Image.open(ROOT / 'original-frames' / f'frame-{index:02d}.png').convert('RGB')
            repair_rect = None
            if index in [7,8,9]:
                patch = Image.open(ROOT / f'weapon-repair-{index:02d}.png').convert('RGB')
                # Only the bow mechanism. The glove, face, hood, body and cloak stay original.
                image.paste(patch.crop((0,0,200,103)), (100,290))
                repair_rect = [100,290,300,393]
            rgba, bg = key_red(image)
            pixels = np.asarray(rgba).copy()
            mask = np.zeros((size[1],size[0]), dtype=bool)
            if 7 <= index <= 20:
                mask[:330,:] = True
                mask[:,:290] = True
            if 29 <= index <= 48:
                mask[400:1030,450:] = True
            removed = 0
            if mask.any():
                support = support_from_ink(image)
                before = pixels[...,3].copy()
                pixels[...,3][mask] = np.minimum(pixels[...,3][mask], support[mask])
                removed = int(np.count_nonzero(before > pixels[...,3]))
                pixels[pixels[...,3] == 0,:3] = 0
            frame = Image.fromarray(pixels)
            frame.save(frames_dir / f'frame-{index:02d}.png', optimize=True)
            red = Image.new('RGBA', size, tuple(round(v) for v in bg)+(255,))
            red.alpha_composite(frame)
            writer.send(np.asarray(red.convert('RGB')).tobytes())
            if removed or repair_rect:
                records.append({'frame':index, 'timeSeconds': index/fps,
                                'weaponRepairRect':repair_rect, 'excludedBackgroundPixels':removed})
            print(f'prepared {index+1}/{count}', flush=True) if (index+1)%14 == 0 else None
    finally:
        writer.close()
    report = {'source':'../sniper-attack-user-v1/source.mp4',
              'sourceSha256':hashlib.sha256((OUT/'source.mp4').read_bytes()).hexdigest(),
              'cleanedVideo':'attack-cleaned.mp4','preparedFrames':'rgba-frames',
              'size':list(size),'fps':fps,'sourceFrames':count,'retainedFrames':count,'seconds':count/fps,
              'sourceFrameOrder':list(range(count)), 'removedFrames':[], 'reversePlayback':False,
              'perFrameScaling':False, 'opacityTransition':False,
              'imageRepairTool':'built-in imagegen; three local bow mechanism patches',
              'repairFiles':['../sniper-attack-user-v1/weapon-repair-generated.png', '../sniper-attack-user-v1/weapon-repair-layout.json'],
              'matteMethod':'Red-screen matte plus connected ink silhouette only inside external-effect regions; all other original pixels and original motion retained',
              'affectedFrames':records, 'motionAcceptedByUser':True, 'cleanupAcceptedByUser':False,
              'gameIntegrated':False, 'review':'Local source production only; user manual review; no game, browser, tests or online QA'}
    (OUT/'processing.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'output':str(OUT/'attack-cleaned.mp4'),'frames':count,'fps':fps,'motionAccepted':True},ensure_ascii=False))

if __name__ == '__main__':
    main()
