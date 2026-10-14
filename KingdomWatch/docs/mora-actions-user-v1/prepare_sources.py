"""Preserve both user videos and annotate source motion before assigning their roles."""
from pathlib import Path
from datetime import datetime
import hashlib
import importlib.util
import json
import shutil
import imageio_ffmpeg
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
spec = importlib.util.spec_from_file_location('pyro_green_key', GAME/'docs/pyro-attack-user-v1/prepare_source.py')
keyer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(keyer)
from package_idle import bounds

SOURCES = {
    'take-a': 'C:/Users/user/Downloads/lens-api-task_yq8OpM3P7gf4lhvYXH3Op1kRdTvRDPGt.mp4',
    'take-b': 'C:/Users/user/Downloads/lens-api-task_zYSJbUSMnFr9ltP4YS4KqI8j0kuu75sf.mp4',
}

def main():
    records = []
    for name, source_path in SOURCES.items():
        source = Path(source_path)
        folder = OUT/name
        folder.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        saved = folder/'source.mp4'
        if saved.exists() and hashlib.sha256(saved.read_bytes()).hexdigest() != digest:
            raise RuntimeError('Existing source differs; preserve both takes')
        shutil.copy2(source, saved)
        reader = imageio_ffmpeg.read_frames(str(saved), pix_fmt='rgb24')
        meta = next(reader)
        frames = [Image.frombytes('RGB', meta['size'], data) for data in reader]
        boxes = [bounds(keyer.key_green(frame)[0]) for frame in frames]
        box = [max(0,min(b[0] for b in boxes)-8), max(0,min(b[1] for b in boxes)-8),
               min(meta['size'][0],max(b[2] for b in boxes)+8), min(meta['size'][1],max(b[3] for b in boxes)+8)]
        contact = Image.new('RGB', (7*150, ((len(frames)+6)//7)*220), '#293b3a')
        draw = ImageDraw.Draw(contact)
        original = folder/'original-frames'
        original.mkdir(exist_ok=True)
        for i, frame in enumerate(frames):
            frame.save(original/f'frame-{i:03d}.png')
            image = frame.crop(box)
            image.thumbnail((144,194))
            x, y = i%7*150, i//7*220
            contact.paste(image,(x+(150-image.width)//2,y))
            draw.text((x+4,y+198),f'{i:03d} {i/meta["fps"]:.2f}s',fill='white')
        contact.save(folder/'source-contact.jpg', quality=95)
        record = {'date': datetime.now().astimezone().isoformat(), 'hero': 'mora', 'take': name,
            'userSourcePath': source_path, 'saved': str(saved), 'sha256': digest,
            'metadata': meta, 'frames': len(frames), 'seconds': len(frames)/meta['fps'],
            'background': 'green', 'paidTaskSubmitted': False, 'gameVisualAcceptedByUser': False}
        (folder/'source-origin.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
        records.append(record)
    (OUT/'sources.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(records, ensure_ascii=True))

if __name__ == '__main__':
    main()
