"""Prepare the generated black-backed RGB mist for additive rendering."""
from pathlib import Path
import json
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[2]
source = Image.open(root / 'docs/frost-field-v3/frost-mist-source.png').convert('RGB')
image = source.resize((512, 512), Image.Resampling.LANCZOS)
rgb = np.asarray(image).astype(np.float32)
# Remove the faint near-black pedestal; it must never brighten a rectangular quad.
rgb = np.clip((rgb - 3.0) * (255.0 / 252.0), 0, 255).astype(np.uint8)
target = root / 'assets/resources/fx/frost_mist_v3.png'
Image.fromarray(rgb).save(target, optimize=True)
report = {
    'source_dimensions': list(source.size),
    'runtime_dimensions': [512, 512],
    'runtime_bytes': target.stat().st_size,
    'mode': 'RGB, black-backed light map; use only with additive shader',
    'dark_pixel_fraction': round(float(np.mean(np.max(rgb, axis=2) < 10)), 4),
    'border_max': int(max(rgb[0].max(), rgb[-1].max(), rgb[:, 0].max(), rgb[:, -1].max())),
}
(root / 'docs/frost-field-v3/asset-check.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
