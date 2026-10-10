"""Runtime texture preparation: downsample the extracted decal and clear invisible RGB."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
image = Image.open(Path(__file__).with_name('ice-domain-alpha.png')).convert('RGBA')
source_size = image.size
image = image.resize((768, 768), Image.Resampling.LANCZOS)
# Use the extraction tool's near-transparent cutoff (5/255) after downsampling.
image.putdata([(0, 0, 0, 0) if pixel[3] <= 5 else pixel for pixel in image.get_flattened_data()])
destination = root / 'assets/resources/fx/frost_domain_v2.png'
image.save(destination, optimize=True)
print(f'{source_size} -> {image.size}: {destination} ({destination.stat().st_size} bytes)')
