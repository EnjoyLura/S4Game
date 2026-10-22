from pathlib import Path
import copy,hashlib,json,shutil,struct,uuid
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
src=Path(r'C:\Users\user\.codex\generated_images\01a1494f-e0d3-7423-88a3-3e1079c0ca5f\exec-82b7aae5-fd2c-487f-876a-0e034e2bb28d.png')
target=ROOT/'assets/resources/scenes/bg_base_endless_v59.png'
assert not target.exists()
shutil.copy2(src,target)
w,h=struct.unpack('>II',src.read_bytes()[16:24])
meta=json.loads((ROOT/'assets/resources/scenes/bg_base_comic_v1.jpg.meta').read_text(encoding='utf-8-sig'))
old=meta['uuid'];uid=str(uuid.uuid4());stem=target.stem
meta=json.loads(json.dumps(meta).replace(old,uid).replace('bg_base_comic_v1',stem))
meta['files']=['.png','.json']
u=meta['subMetas']['f9941']['userData']
u.update(width=w,height=h,rawWidth=w,rawHeight=h)
u['vertices'].update(rawPosition=[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],uv=[0,h,w,h,0,0,w,0],minPos=[-w/2,-h/2,0],maxPos=[w/2,h/2,0])
Path(str(target)+'.meta').write_text(json.dumps(meta,indent=2),encoding='utf-8')
tsmeta=json.loads((ROOT/'assets/scripts/core/Flow.ts.meta').read_text(encoding='utf-8-sig'))
for name in ['config/Endless.ts','core/EndlessProgress.ts']:
    tsmeta['uuid']=str(uuid.uuid4())
    (ROOT/('assets/scripts/'+name+'.meta')).write_text(json.dumps(tsmeta,indent=2),encoding='utf-8')
(HERE/'art.json').write_text(json.dumps(dict(tool='built-in image_gen',source=str(src),target=target.relative_to(ROOT).as_posix(),uuid=uid,width=w,height=h,sha256=hashlib.sha256(target.read_bytes()).hexdigest(),copiedOriginalBytes=True),indent=2),encoding='utf-8')
print('Full scene copied unchanged:',w,h,'; independent image/TS UUIDs assigned')
