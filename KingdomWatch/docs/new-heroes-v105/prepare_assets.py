"""Authoring metadata and glyph audit; never edits generated image pixels."""
import copy, hashlib, json, uuid
from pathlib import Path
from PIL import Image
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
ART = ROOT / 'assets/resources/ux/new_heroes_v105'
template = json.loads((ROOT / 'assets/resources/ux/hero_comic_v1/comic_figure_sniper_v1.png.meta').read_text('utf-8'))
images = []
for path in sorted(ART.glob('*.png')):
    with Image.open(path) as image:
        w, h = image.size
        assert image.mode == 'RGBA' and (w, h) == (1024, 1536)
        alpha = image.getchannel('A')
        assert alpha.getextrema()[0] == 0, 'Expected transparent source art'
        images.append({'file': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size,
                       'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'size': [w,h],
                       'alphaBounds': alpha.getbbox(), 'alphaExtrema': alpha.getextrema()})
    meta_path = path.with_suffix('.png.meta')
    uid = json.loads(meta_path.read_text('utf-8'))['uuid'] if meta_path.exists() else str(uuid.uuid4())
    meta = copy.deepcopy(template)
    old_uid = meta['uuid']
    meta = json.loads(json.dumps(meta).replace(old_uid, uid).replace('comic_figure_sniper_v1', path.stem))
    frame = meta['subMetas']['f9941']['userData']
    frame.update(width=w,height=h,rawWidth=w,rawHeight=h,trimX=0,trimY=0,offsetX=0,offsetY=0,
                 packable=False,trimType='custom')
    frame['vertices'].update(rawPosition=[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],
        uv=[0,h,w,h,0,0,w,0], minPos=[-w/2,-h/2,0],maxPos=[w/2,h/2,0])
    meta_path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n','utf-8')
for relative in ['config/NewHeroConfig.ts','battle/NewHeroes.ts','ui/NewHeroArt.ts']:
    source = ROOT / 'assets/scripts' / relative
    meta_path = source.with_suffix('.ts.meta')
    if not meta_path.exists():
        meta_path.write_text(json.dumps({'ver':'4.0.24','importer':'typescript','imported':True,
            'uuid':str(uuid.uuid4()),'files':[],'subMetas':{},'userData':{}},indent=2)+'\n','utf-8')
text = ''.join(p.read_text('utf-8') for p in (ROOT/'assets/scripts').rglob('*.ts'))
han = {ord(c) for c in text if 0x4e00 <= ord(c) <= 0x9fff}
fonts = []
for name in ['UIBody','UIHeading']:
    path = ROOT / ('assets/resources/fonts/'+name+'.ttf')
    with TTFont(path) as font:
        missing = ''.join(chr(c) for c in sorted(han-set(font.getBestCmap())))
    fonts.append({'name':name,'missingHan':missing})
(OUT/'art-metadata-audit.json').write_text(json.dumps({'images':images,'imagePixelsModified':False,
    'fullSourceRectForVirtualFrames':True,'fonts':fonts},ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps({'imageBytes':sum(i['bytes'] for i in images),'fonts':fonts},ensure_ascii=False))
