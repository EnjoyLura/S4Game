"""Package the untouched original and the cleaned sequence for synchronized manual comparison."""
from pathlib import Path
import json, sys
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parent.parent
USER = GAME / 'docs/sniper-attack-user-v1'
sys.path.insert(0, str(GAME / 'docs/volt-idle-v1'))
from package_idle import key_red, draw_frame
sys.path.insert(0, str(GAME / 'docs/hero-idle-rebuild-v1'))
from build_idle import save_gif
sys.stdout.reconfigure(encoding='utf-8')
manifest = json.loads((ROOT / 'attack.frames.json').read_text(encoding='utf-8'))
scale = manifest['source']['fixedScale']
foot = manifest['source']['fixedFootSource']
count = manifest['source']['frameCount']
cw, ch, cols, capacity = 384, 672, 8, 48
atlases = [Image.new('RGBA', (cw*cols, ch*((min(capacity,count-start)+cols-1)//cols)))
           for start in range(0,count,capacity)]
original = {'frames':{},'textures':['original.png','original-1.png'],'framePages':{},
    'animation':{'frames':[], 'seconds': count/24, 'frameDurations':[1/24]*count},
    'groundAnchor':[v*.5 for v in foot], 'readyHeightPx':manifest['readyHeightPx']/scale*.5,
    'displayHeight':153, 'source':'Unmodified user video frames, fixed half-size atlas only',
    'cellSize':[cw,ch]}
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',20)
duration=manifest['animation']['seconds']
writer=imageio_ffmpeg.write_frames(str(ROOT/'comparison.mp4'),(840,510),fps=24,
    codec='libx264',pix_fmt_in='rgb24',pix_fmt_out='yuv420p',macro_block_size=1,
    output_params=['-crf','17','-preset','medium','-movflags','+faststart'])
writer.send(None)
gif_frames=[]
try:
    for index in range(count):
        raw=Image.open(USER/'original-frames'/f'frame-{index:02d}.png').convert('RGB')
        keyed,_=key_red(raw)
        half=keyed.resize((cw,ch),Image.Resampling.LANCZOS)
        page,local=divmod(index,capacity);x,y=local%cols*cw,local//cols*ch
        atlases[page].paste(half,(x,y));name=f'original{index}'
        original['frames'][name]=[x,y,cw,ch];original['framePages'][name]=page;original['animation']['frames'].append(name)
        cell=Image.open(ROOT/'frames'/f'attack-{index:02d}.png').convert('RGBA')
        panel=Image.new('RGBA',(840,510),'#293c3b');d=ImageDraw.Draw(panel)
        d.text((16,12),'原视频',font=font,fill='#eef1e4');d.text((436,12),'清理后',font=font,fill='#eef1e4')
        draw_frame(panel,half,original,210,486,380)
        draw_frame(panel,cell,manifest,630,486,380)
        gif_frames.append(panel.convert('RGB'));writer.send(panel.convert('RGB').tobytes())
finally:
    writer.close()
for atlas,name in zip(atlases,original['textures']):atlas.save(ROOT/name,optimize=True)
(ROOT/'original.frames.json').write_text(json.dumps(original,ensure_ascii=False,indent=2),encoding='utf-8')
save_gif(gif_frames,ROOT/'comparison.gif',duration,[1/24]*count)
report=json.loads((ROOT/'packaging.json').read_text(encoding='utf-8'))
report.update(sourceVideoNewlyGenerated=False,userProvidedVideo=True,motionAcceptedByUser=True,
              cleanupAcceptedByUser=False,gameIntegrated=False,previewOnly=True)
(ROOT/'packaging.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
manifest['motionAcceptedByUser']=True
manifest['cleanupAcceptedByUser']=False
manifest['animation']['phases']=[{'name':n,'startIndex':a,'endIndexExclusive':b}
    for n,a,b in [('瞄准',0,7),('发射',7,19),('上弩',19,38),('回正',38,count)]]
manifest['source']['origin']='User-supplied video; no new AI video generation'
manifest['processing']['matte']='Prepared video-local VFX matte; imagegen repaired only three bow mechanism patches'
encoded=json.dumps(manifest,ensure_ascii=False,indent=2)
for path in [ROOT/'attack.frames.json',GAME/'assets/resources/ux/sniper_attack_clean_v1/attack.frames.json']:
    path.write_text(encoded,encoding='utf-8')
print(json.dumps({'comparisonFrames':count,'seconds':duration,'previewOnly':True,'gameIntegrated':False}))
