"""Append the user's six new crops and reuse the existing selected axe soldier."""
from pathlib import Path
import hashlib
import json
import shutil
from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent / 'monster-selection-catalog-v1'
SET_ID = 'chapter1-picked-20261023-v1'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    data = json.loads((ROOT / 'catalog.json').read_text(encoding='utf-8'))
    if any(s['id'] == SET_ID for s in data.get('reviewSets', [])):
        raise SystemExit('This selection is already imported; no files changed.')
    before = json.loads((HERE / 'before/catalog.json').read_text(encoding='utf-8'))
    if data != before:
        raise RuntimeError('Catalogue changed after the recorded baseline.')
    source_specs = [
        ('S64', HERE.parent / 'chapter1-selected-four-standing-20261023-v1/selected-four-monsters-standing.png', [
            ('S64-01', '普通哥布林', 1, 1, [0, 0, 675, 545]),
            ('S64-02', '兽族萨满', 1, 2, [675, 0, 1254, 545]),
            ('S64-03', '兽族盾兵', 2, 1, [0, 545, 675, 1254]),
            ('S64-04', '兽族狼骑兵', 2, 2, [675, 545, 1254, 1254]),
        ]),
        ('S65', Path('C:/Users/user/AppData/Local/Temp/codex-clipboard-56851b87-f132-4e3d-9de3-22764616eeb4.png'), [
            ('S65-04', '兽族攻城车', 2, 1, [0, 341, 341, 683]),
        ]),
        ('S66', Path('C:/Users/user/AppData/Local/Temp/codex-clipboard-d54389b1-9d59-40be-8e8c-6c100e73f9b3.png'), [
            ('S66-01', '兽族投石手', 1, 1, [0, 0, 341, 341]),
        ]),
    ]
    added = []
    for sid, original, tiles in source_specs:
        if any(s['id'] == sid for s in data['sources']):
            raise RuntimeError('Source ID already exists: ' + sid)
        target = ROOT / 'sources' / (sid + '.png')
        if target.exists():
            raise RuntimeError('Refusing to overwrite ' + str(target))
        shutil.copyfile(original, target)
        assert digest(target) == digest(original)
        with Image.open(target) as image:
            source = dict(id=sid, filename=original.name, original=str(original), aliases=[],
                          path=target.relative_to(ROOT).as_posix(), sha256=digest(target),
                          width=image.width, height=image.height, mode=image.mode,
                          count=len(tiles), theme='第一章选定形象')
            for mid, name, row, column, box in tiles:
                assert 0 <= box[0] < box[2] <= image.width
                assert 0 <= box[1] < box[3] <= image.height
                crop = image.crop(box)
                output = ROOT / 'monsters' / (mid + '.png')
                thumb = ROOT / 'thumbs' / (mid + '.webp')
                if output.exists() or thumb.exists():
                    raise RuntimeError('Refusing to overwrite an existing crop: ' + mid)
                crop.save(output, optimize=True)
                with Image.open(output) as saved:
                    assert saved.mode == crop.mode and saved.tobytes() == crop.tobytes()
                ImageOps.contain(crop.convert('RGB'), (260, 260), Image.Resampling.LANCZOS).save(thumb, quality=90, method=4)
                monster = dict(id=mid, name=name, source=sid, row=row, column=column,
                               theme=source['theme'], image=output.relative_to(ROOT).as_posix(),
                               thumb=thumb.relative_to(ROOT).as_posix(), width=crop.width,
                               height=crop.height, box=box, sha256=digest(output),
                               pixelSha256=hashlib.sha256(crop.tobytes()).hexdigest())
                data['monsters'].append(monster)
                added.append(monster)
        data['sources'].append(source)
    assert next(m for m in data['monsters'] if m['id'] == 'S22-01')['name'] == '兽族斧兵'
    ids = ['S64-01', 'S64-02', 'S64-03', 'S64-04', 'S65-04', 'S66-01', 'S22-01']
    selection = dict(id=SET_ID, label='本次选定 7 只', chapter='1', ids=ids,
                     description='包含站姿修订后的四只怪物、攻城车第4个、投石手第1个及S22-01斧兵。')
    data.setdefault('reviewSets', []).append(selection)
    data['sourceFiles'] += len(source_specs)
    assert data['monsters'][:len(before['monsters'])] == before['monsters']
    assert data['sources'][:len(before['sources'])] == before['sources']
    assert len(set(m['id'] for m in data['monsters'])) == len(data['monsters'])
    for monster in data['monsters']:
        assert (ROOT / monster['image']).is_file() and (ROOT / monster['thumb']).is_file()
    (ROOT / 'catalog.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    (ROOT / 'catalog-data.js').write_text('window.MONSTER_CATALOG=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    (ROOT / 'sources.json').write_text(json.dumps(data['sources'], ensure_ascii=False, indent=2), encoding='utf-8')
    (HERE / 'selection.json').write_text(json.dumps(selection, ensure_ascii=False, indent=2), encoding='utf-8')
    report = dict(existingMonstersPreserved=len(before['monsters']), addedMonsters=len(added),
                  totalMonsters=len(data['monsters']), totalSources=len(data['sources']),
                  losslessNewCropsVerified=len(added), newSourceCopiesVerified=len(source_specs),
                  selectedIds=ids, allImagePathsExist=True, gameFilesChanged=0,
                  browserOpened=False, gameStarted=False)
    (HERE / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=True))


if __name__ == '__main__':
    main()
