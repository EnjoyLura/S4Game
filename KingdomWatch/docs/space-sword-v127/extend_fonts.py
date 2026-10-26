"""Append only missing selected-card glyphs to the same pinned local OFL font sources."""
import sys,json,hashlib
from pathlib import Path
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
sys.path.insert(0,str(ROOT/'temp/py-fonts'))
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib.instancer import instantiateVariableFont
manifestPath=ROOT/'assets/resources/fonts/manifest.json'
manifest=json.loads(manifestPath.read_text('utf-8'))
text=''.join(json.loads((OUT/'font-text.json').read_text('utf-8'))['text'])
wanted={ord(c) for c in text if ord(c)>=0x2000}
report=[];addedAll=set()
for row in manifest['fonts'][:2]:
    target=ROOT/'assets/resources/fonts'/row['file'];old=TTFont(target);cmap=set(old.getBestCmap());old.close()
    missing=wanted-cmap;addedAll|=missing
    if not missing:continue
    folder='notosanssc' if row['file']=='UIBody.ttf' else 'notoserifsc'
    source=ROOT/'temp/font-sources'/folder/('NotoSansSC[wght].ttf' if folder=='notosanssc' else 'NotoSerifSC[wght].ttf')
    assert hashlib.sha256(source.read_bytes()).hexdigest()==row['sourceSha256']
    font=TTFont(source);assert not missing-set(font.getBestCmap())
    opts=subset.Options();opts.layout_features=['*'];opts.name_IDs=['*'];opts.name_legacy=True;opts.name_languages=['*']
    sub=subset.Subsetter(options=opts);sub.populate(unicodes=cmap|missing);sub.subset(font)
    font=instantiateVariableFont(font,{'wght':row['weight']},inplace=True)
    name=target.stem
    for r in font['name'].names:
        if r.nameID in (1,4,6,16):r.string=('KW'+name).encode(r.getEncoding())
        elif r.nameID in (2,17):r.string='Regular'.encode(r.getEncoding())
        elif r.nameID==3:r.string=('KW-'+manifest['revision'][:12]+'-'+name).encode(r.getEncoding())
    beforeBytes=target.stat().st_size;font.save(target);font.close()
    packed=TTFont(target);new=set(packed.getBestCmap());packed.close();assert cmap<=new and missing<=new
    row.update(sha256=hashlib.sha256(target.read_bytes()).hexdigest(),bytes=target.stat().st_size,glyphs=len(new))
    report.append({'font':name,'added':''.join(chr(c) for c in sorted(missing)),
                   'existingCodepointsPreserved':len(cmap),'bytesAdded':target.stat().st_size-beforeBytes,'sha256':row['sha256']})
manifest['glyphsRequested']+=len(addedAll)
manifestPath.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n','utf-8')
(OUT/'font-extension.json').write_text(json.dumps({'fonts':report,'source':'same pinned local OFL sources; no downloads','gameStarted':False},ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps({'added':''.join(chr(c) for c in sorted(addedAll)),'bytesAdded':sum(r['bytesAdded'] for r in report)},ensure_ascii=False))
