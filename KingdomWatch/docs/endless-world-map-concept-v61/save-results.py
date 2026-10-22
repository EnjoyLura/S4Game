"""Copy generated originals and record provenance; does not edit image pixels."""
from pathlib import Path
import hashlib
import json
import shutil
import struct
import sys

folder = Path(__file__).resolve().parent
sources = [Path(arg) for arg in sys.argv[1:]]
if len(sources) != 2:
    raise SystemExit("Usage: save-results.py MAP_SOURCE UX_SOURCE")
specs = [
    ("world-map-placeholder-v61.png", "map-prompt.txt", [
        "C:/Users/user/AppData/Local/Temp/codex-clipboard-8c029105-0ca8-486d-8f0e-264c99062b05.png",
        "docs/endless-page-concept-v60/endless-page-concept-v60.png",
    ]),
    ("endless-world-map-ux-v61.png", "ux-prompt.txt", [
        "docs/endless-world-map-concept-v61/world-map-placeholder-v61.png",
        "docs/endless-page-concept-v60/endless-page-concept-v60.png",
    ]),
]
records = []
for source, (name, prompt, references) in zip(sources, specs):
    raw = source.read_bytes()
    if raw[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Not PNG: {source}")
    width, height = struct.unpack(">II", raw[16:24])
    output = folder / name
    shutil.copy2(source, output)
    assert output.read_bytes() == raw
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
    "mode": "generate with reference images",
    "purpose": "Temporary map art and portrait UX mockup for many future endless chapters",
    "integratedIntoGame": False,
    "published": False,
    "userVisualApproval": "pending",
    "temporaryGeographyAndRecords": True,
    "liveVersionUnchanged": "endless-challenge-v59",
    "assets": records,
}
(folder / "generation.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print(json.dumps(records, ensure_ascii=False))

