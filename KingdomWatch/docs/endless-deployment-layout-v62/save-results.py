"""Save image_gen originals and provenance without modifying pixels."""
from pathlib import Path
import hashlib
import json
import shutil
import struct
import sys

folder = Path(__file__).resolve().parent
if len(sys.argv) != 3:
    raise SystemExit("Usage: save-results.py MAP_SOURCE PREPARATION_SOURCE")
specs = [
    ("endless-map-deployment-v62.png", "map-prompt.txt", [
        "docs/endless-world-map-concept-v61/endless-world-map-ux-v61.png",
        "C:/Users/user/AppData/Local/Temp/codex-clipboard-4c8ea9a9-d3c8-4e47-80d1-e07a86dca64d.png",
    ]),
    ("endless-preparation-v62.png", "preparation-prompt.txt", [
        "docs/endless-deployment-layout-v62/endless-map-deployment-v62.png",
        "C:/Users/user/AppData/Local/Temp/codex-clipboard-36d9b488-5a8b-485d-8594-631ab426be35.png",
        "assets/resources/ux/weapons_v1/green_bow_v2.png",
        "assets/resources/ux/weapons_v1/green_book.png",
        "assets/resources/ux/shop_comic_v1/comic_helm_falcon_v1.png",
    ]),
]
records = []
for source_arg, (name, prompt, references) in zip(sys.argv[1:], specs):
    source = Path(source_arg)
    raw = source.read_bytes()
    if raw[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Not a PNG: {source}")
    width, height = struct.unpack(">II", raw[16:24])
    output = folder / name
    shutil.copy2(source, output)
    if output.read_bytes() != raw:
        raise ValueError(f"Copy mismatch: {output}")
    records.append({
        "source": str(source),
        "output": str(output),
        "width": width,
        "height": height,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "copiedOriginalBytes": True,
        "prompt": prompt,
        "references": references,
    })
manifest = {
    "date": "2026-10-19",
    "tool": "built-in image_gen",
    "mode": "edit with local target and reference images",
    "purpose": "Endless map deployment buttons and campaign-style preparation sheet",
    "confirmedUserRequirements": [
        "Reuse campaign preparation and team layout",
        "Endless farms gold and equipment",
        "No star chests or difficulty selection",
    ],
    "integratedIntoGame": False,
    "published": False,
    "userVisualApproval": "pending",
    "liveVersionUnchanged": "endless-challenge-v59",
    "equipmentDropStatus": "Current live endless gearPool empty; feature requires implementation",
    "assets": records,
}
(folder / "generation.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print(json.dumps(records, ensure_ascii=False))

