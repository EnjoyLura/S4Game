"""Prepare an unchanged full-character illustration as the project's black first frame."""
from pathlib import Path
import argparse, json
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('--image', required=True)
ap.add_argument('--out', required=True)
args = ap.parse_args()
source = Image.open(args.image).convert('RGBA')
target = source.resize((768, 1152), Image.Resampling.LANCZOS)
frame = Image.new('RGBA', target.size, (0, 0, 0, 255))
frame.alpha_composite(target)
out = Path(args.out)
out.parent.mkdir(parents=True, exist_ok=True)
frame.convert('RGB').save(out)
print(json.dumps({'image': str(out), 'size': frame.size, 'processing': 'uniform resize and alpha composite onto black; original illustration retained'}))

