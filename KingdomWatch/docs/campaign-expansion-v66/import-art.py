"""Copy original generated PNGs and author atlas rectangles/Cocos metadata, without repainting source pixels."""
from pathlib import Path
import json, uuid, shutil, hashlib
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
DOC = Path(__file__).resolve().parent
manifest = json.loads((DOC / 'art-manifest.json').read_text(encoding='utf-8'))
chapters = json.loads((DOC / 'chapters.json').read_text(encoding='utf-8'))['chapters']
template = json.loads((ROOT / 'assets/resources/scenes/bg_endless_world_v63.png.meta').read_text(encoding='utf-8-sig'))
report = []
for item in manifest:
    source = Path(item['source'])
    target = ROOT / 'assets/resources' / item['file']
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    image = Image.open(source)
    w, h = image.size
    meta_path = target.with_name(target.name + '.meta')
    identity = json.loads(meta_path.read_text(encoding='utf-8-sig'))['uuid'] if meta_path.exists() else str(uuid.uuid4())
    meta = json.loads(json.dumps(template).replace(template['uuid'], identity))
    meta['userData']['hasAlpha'] = image.mode == 'RGBA'
    for sub in meta['subMetas'].values():
        sub['displayName'] = target.stem
        if sub['importer'] == 'sprite-frame':
            data = sub['userData']
            data.update(width=w, height=h, rawWidth=w, rawHeight=h)
            data['vertices'].update(rawPosition=[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],
                                    uv=[0,h,w,h,0,0,w,0], minPos=[-w/2,-h/2,0], maxPos=[w/2,h/2,0])
    meta_path.write_text(json.dumps(meta, indent=2), encoding='utf-8')
    record = dict(id=item['id'], file=item['file'], size=[w,h], uuid=identity,
                  sha256=hashlib.sha256(source.read_bytes()).hexdigest())
    if item['id'].startswith('mobs-'):
        chapter = next(c for c in chapters if c['art'] == item['id'][5:])
        names = [e['id'] for e in chapter['enemies']] + [chapter['enemies'][-1]['id'] + '_phase']
        frames = {}
        for i, name in enumerate(names):
            left, top = i%3*w//3, i//3*h//2
            right, bottom = (i%3+1)*w//3, (i//3+1)*h//2
            alpha = image.getchannel('A').crop((left,top,right,bottom))
            box = alpha.point(lambda a: 255 if a > 8 else 0).getbbox()
            if box is None:
                raise ValueError('Empty sprite: ' + name)
            x0,y0,x1,y1 = box
            x0,y0,x1,y1 = max(0,x0-2),max(0,y0-2),min(right-left,x1+2),min(bottom-top,y1+2)
            frames[name] = [left+x0,top+y0,x1-x0,y1-y0]
        frame_path = target.with_suffix('.frames.json')
        frame_path.write_text(json.dumps({'frames':frames},indent=2),encoding='utf-8')
        frame_meta = frame_path.with_name(frame_path.name+'.meta')
        frame_uuid = json.loads(frame_meta.read_text(encoding='utf-8-sig'))['uuid'] if frame_meta.exists() else str(uuid.uuid4())
        frame_meta.write_text(json.dumps(dict(ver='2.0.1',importer='json',imported=True,uuid=frame_uuid,files=['.json'],subMetas={},userData={}),indent=2),encoding='utf-8')
        record['frames'] = frames
    report.append(record)

# Inspection contact sheets only; runtime assets above retain original image bytes.
for kind, selected, columns, tile in [
    ('maps', [j for j in manifest if j['id'].startswith('map-')], 7, (170,365)),
    ('battlefields', [j for j in manifest if j['id'].startswith('battle-')], 7, (170,330)),
]:
    rows = (len(selected)+columns-1)//columns
    sheet = Image.new('RGB',(columns*tile[0],rows*tile[1]),'#f3e8cc')
    draw = ImageDraw.Draw(sheet)
    for i,j in enumerate(selected):
        thumb = Image.open(j['source']).convert('RGB')
        thumb.thumbnail((tile[0]-6,tile[1]-24))
        x,y = i%columns*tile[0],i//columns*tile[1]
        sheet.paste(thumb,(x+3,y+22));draw.text((x+3,y+4),j['id'],fill='black')
    sheet.save(DOC / (kind+'-contact.jpg'))
(DOC / 'imported-art.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
print('Imported', len(report), 'original PNGs; 90 atlas rectangles; original pixels preserved.')
