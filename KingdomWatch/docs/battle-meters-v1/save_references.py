"""Preserve the user's reference and before screenshots unchanged."""
from pathlib import Path
import json
import shutil

OUT = Path(__file__).resolve().parent
rows = [
    ('reference-health.png', 'C:/Users/user/AppData/Local/Temp/codex-clipboard-8fea6b0e-ef38-4b14-b151-cd3e6f3d49f5.png'),
    ('reference-damage.png', 'C:/Users/user/AppData/Local/Temp/codex-clipboard-785967ed-e000-4f8b-8196-929f57bad7ad.png'),
    ('before-health.png', 'C:/Users/user/AppData/Local/Temp/codex-clipboard-3e8cad46-8b4e-4c9b-abdd-205e0f55e7b2.png'),
    ('before-damage.png', 'C:/Users/user/AppData/Local/Temp/codex-clipboard-5cf5f4f8-449d-4eb0-a022-b4819fa62e16.png'),
    ('before-shield.png', 'C:/Users/user/AppData/Local/Temp/codex-clipboard-82c468b5-1d2f-4ca1-8874-ba8ee89a8b48.png'),
]
for target, source in rows:
    shutil.copy2(source, OUT / target)
(OUT / 'references.json').write_text(json.dumps([{'saved': name, 'original': source} for name, source in rows], ensure_ascii=False, indent=2), encoding='utf-8')
print('Saved five original user screenshots')
