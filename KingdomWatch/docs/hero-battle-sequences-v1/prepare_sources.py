"""Prepare opaque black first frames without changing the generated identity."""
from pathlib import Path
from PIL import Image
import json, shutil
ROOT = Path(__file__).resolve().parent
HOST = Path("D:/AI/S4Game/美术/vfx_host")
ids = ["archer", "sniper", "pyro", "volt", "mora"]
report = {}
for hero in ids:
    im = Image.open(ROOT / "sources" / (hero + "-ready.png")).convert("RGBA")
    alpha = im.getchannel("A")
    bbox = alpha.point(lambda x: 255 if x > 24 else 0).getbbox()
    if not bbox or alpha.getextrema()[0] != 0:
        raise RuntimeError("Expected transparent sprite: " + hero)
    crop = im.crop(bbox)
    scale = min(568 / crop.height, 590 / crop.width)
    size = (round(crop.width * scale), round(crop.height * scale))
    sprite = crop.resize(size, Image.Resampling.LANCZOS)
    xy = ((768 - size[0]) // 2, 686 - size[1])
    canvas = Image.new("RGBA", (768,768), (0,0,0,255))
    canvas.alpha_composite(sprite, xy)
    filename = "hero_seq_v1_" + hero + "_ff.png"
    canvas.convert("RGB").save(ROOT / "sources" / filename)
    shutil.copy2(ROOT / "sources" / filename, HOST / filename)
    report[hero] = {"sourceSize":im.size,"alphaExtrema":alpha.getextrema(),
                    "sourceBBox":bbox,"firstFrameRect":[*xy,*size],"footY":686,"url":"https://kw-vfx-src.pages.dev/" + filename}
(ROOT / "source-layout.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(report,ensure_ascii=False))
