"""Bundle pinned OFL fonts, subset Chinese to project text and preserve licences.
Run with fonttools installed (or add temp/py-fonts to PYTHONPATH).
Original downloads are cached outside assets; no runtime CDN dependency.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import urllib.request
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
REV = "7085eb89a950e85db5b166b7a58d414544b4140c"
BASE = f"https://raw.githubusercontent.com/google/fonts/{REV}/ofl/"
OUT = ROOT / "assets/resources/fonts"
CACHE = ROOT / "temp/font-sources"
SPECS = [
    ("UIBody", "notosanssc", "NotoSansSC[wght].ttf", 500),
    ("UIHeading", "notoserifsc", "NotoSerifSC[wght].ttf", 750),
    ("UINumbers", "barlowcondensed", "BarlowCondensed-Bold.ttf", None),
    ("CombatDigits", "barlowcondensed", "BarlowCondensed-ExtraBoldItalic.ttf", None),
    ("ComicLettering", "bangers", "Bangers-Regular.ttf", None),
]


def download(folder, filename):
    target = CACHE / folder / filename
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        url = BASE + folder + "/" + urllib.parse.quote(filename)
        target.write_bytes(urllib.request.urlopen(url, timeout=90).read())
    return target


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = {(folder, filename) for _, folder, filename, _ in SPECS}
    jobs |= {(folder, "OFL.txt") for _, folder, _, _ in SPECS}
    with ThreadPoolExecutor(max_workers=5) as pool:
        list(pool.map(lambda job: download(*job), sorted(jobs)))
    text = "".join(p.read_text(encoding="utf-8") for p in (ROOT / "assets/scripts").rglob("*.ts"))
    text += "".join(p.read_text(encoding="utf-8") for p in (ROOT / "assets/resources").rglob("*.json"))
    chars = set(range(32, 127)) | {ord(c) for c in text if 0x2000 <= ord(c) <= 0xFFFF}
    chars |= {ord(c) for c in "，。！？：；（）【】《》“”‘’、·—…％×÷±→←↑↓∞★☆✓♥0123456789Lv.MAXKkms%+−"}
    report = {"revision": REV, "glyphsRequested": len(chars), "fonts": []}
    for name, folder, filename, weight in SPECS:
        source = download(folder, filename)
        font = TTFont(source)
        cmap = font.getBestCmap()
        wanted = chars if weight is not None else set(range(32, 127)) | {ord(c) for c in "×÷±→←∞％−"}
        missing_han = sorted(c for c in wanted if 0x4E00 <= c <= 0x9FFF and c not in cmap)
        if missing_han:
            raise RuntimeError(f"{name} misses project Han glyphs: {''.join(map(chr, missing_han))}")
        opts = subset.Options()
        opts.layout_features = ["*"]
        opts.name_IDs = ["*"]
        opts.name_legacy = True
        opts.name_languages = ["*"]
        sub = subset.Subsetter(options=opts)
        sub.populate(unicodes=wanted & set(cmap))
        sub.subset(font)
        if weight is not None:
            font = instantiateVariableFont(font, {"wght": weight}, inplace=True)
        # Derivatives get game-specific names; original copyright/licence IDs remain.
        for record in font["name"].names:
            if record.nameID in (1, 4, 6, 16):
                record.string = ("KW" + name).encode(record.getEncoding())
            elif record.nameID in (2, 17):
                record.string = "Regular".encode(record.getEncoding())
            elif record.nameID == 3:
                record.string = ("KW-" + REV[:12] + "-" + name).encode(record.getEncoding())
        target = OUT / (name + ".ttf")
        font.save(target)
        font.close()
        packed = TTFont(target)
        row = {"file": target.name, "source": BASE + folder + "/" + urllib.parse.quote(filename),
               "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
               "bytes": target.stat().st_size, "glyphs": len(packed.getBestCmap()), "weight": weight}
        packed.close()
        report["fonts"].append(row)
        print(json.dumps(row, ensure_ascii=False), flush=True)
    licence_dir = OUT / "licenses"
    licence_dir.mkdir(exist_ok=True)
    notices = ["KingdomWatch font notices\nSubset derivatives remain under SIL Open Font License 1.1.\n"]
    for folder in sorted({s[1] for s in SPECS}):
        licence = download(folder, "OFL.txt").read_text(encoding="utf-8")
        (licence_dir / (folder + "-OFL.txt")).write_text(licence, encoding="utf-8")
        notices.append(f"\n--- {folder} ---\n{licence}\n")
    (ROOT / "build-templates/web-mobile/font-licenses.txt").write_text("".join(notices), encoding="utf-8")
    (OUT / "manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Total font bytes:", sum(f["bytes"] for f in report["fonts"]), flush=True)


if __name__ == "__main__":
    main()
