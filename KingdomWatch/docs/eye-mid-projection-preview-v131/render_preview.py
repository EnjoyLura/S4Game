"""Image-only wind-eye projection review. Does not write game assets or start the game."""
import hashlib,json,subprocess
from functools import lru_cache
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
MANIFEST=ROOT/'assets/resources/fx/wind_eye_video_v129.frames.json'
ATLAS=ROOT/'assets/resources/fx/wind_eye_video_v129.png'
VARIANTS=[{'label':'当前版本','height':.58,'offsetY':-18},
          {'label':'折中方案 · 待确认','height':.80,'offsetY':-9},
          {'label':'原版厚度参考','height':1.,'offsetY':0}]
FONT=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16)
SMALL=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',13)

def sha(file):return hashlib.sha256(file.read_bytes()).hexdigest()
def game_hashes():return {str(p.relative_to(ROOT)).replace('\\','/'):sha(p) for p in (ROOT/'assets').rglob('*') if p.is_file()}

@lru_cache(maxsize=4)
def background(w,h):
    image=Image.open(ROOT/'assets/resources/scenes/scene_1_2.jpg').convert('RGBA')
    return image.crop((int(image.width*.22),int(image.height*.23),int(image.width*.78),int(image.height*.73))).resize((w,h),Image.Resampling.LANCZOS)

def monster():
    data=json.loads((ROOT/'assets/resources/ux/mobs_forest_v66.frames.json').read_text('utf8'))['frames']
    sheet=Image.open(ROOT/'assets/resources/ux/mobs_forest_v66.png').convert('RGBA')
    x,y,w,h=data['forest_spider'];return sheet.crop((x,y,x+w,y+h))

def compose(tile,variant,w,h,mob,manifest):
    canvas=background(w,h).copy()
    effect_w=round(w*.91);effect_h=round(effect_w*manifest['cellSize'][1]/manifest['cellSize'][0]*variant['height'])
    art=tile.resize((effect_w,effect_h),Image.Resampling.LANCZOS)
    # Positive game Y points upward. All variants share hit center/width/layer,
    # differing only in eye height and its original hit-center -> foot offset.
    x=w*.5;y=h*.53-variant['offsetY']*w/460
    ax,ay=manifest['groundAnchor'];canvas.alpha_composite(art,(round(x-ax*effect_w),round(y-(1-ay)*effect_h)))
    # Same monster image, foot registration and draw order in all three columns.
    mw=round(w*.18);mh=round(mw*mob.height/mob.width);body=mob.resize((mw,mh),Image.Resampling.LANCZOS)
    canvas.alpha_composite(body,(round(x-mw/2),round(h*.53-mh*.67)))
    draw=ImageDraw.Draw(canvas);draw.rectangle((0,0,w,52),fill='#19282d');draw.rectangle((0,h-74,w,h),fill='#19282d')
    draw.text((15,13),variant['label'],font=FONT,fill='#f5db8d' if variant['height']==.8 else '#d5f3e5')
    draw.text((15,h-63),f"厚度 {variant['height']:.0%}  ·  2倍速",font=FONT,fill='#d5f3e5')
    draw.text((15,h-36),'相同帧、宽度与遮挡；比较透视厚度',font=SMALL,fill='#adc4bb')
    draw.text((15,h-18),'离屏合成 · 未接入游戏',font=SMALL,fill='#adc4bb')
    return canvas.convert('RGB')

def run():
    before=game_hashes();head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    manifest=json.loads(MANIFEST.read_text('utf8'));atlas=Image.open(ATLAS).convert('RGBA');mob=monster()
    assert manifest['frameCount']==48 and manifest['playbackSpeed']==2 and manifest['displayHeightScale']==.58
    frames=[]
    for n in range(48):
        x,y,w,h=manifest['frames'][manifest['framePrefix']+str(n)]
        frames.append(atlas.crop((x,y,x+w,y+h)))
    comparison=[];proposal=[]
    for tile in frames:
        strip=Image.new('RGB',(360*3,450))
        for j,variant in enumerate(VARIANTS):strip.paste(compose(tile,variant,360,450,mob,manifest),(j*360,0))
        comparison.append(strip);proposal.append(compose(tile,VARIANTS[1],540,620,mob,manifest))
    durations=[round((i+1)*1000/60)-round(i*1000/60) for i in range(48)]
    for name,sequence in [('comparison',comparison),('proposal',proposal)]:
        sequence[0].save(OUT/(name+'.webp'),save_all=True,append_images=sequence[1:],duration=durations,loop=0,quality=90,method=4)
        sequence[4].save(OUT/(name+'-still.jpg'),quality=94)
    # Review the same camera/material at several phases, including the wrap.
    contact=Image.new('RGB',(270*3,310*2))
    for k,n in enumerate([4,16,32,40,47,0]):
        panel=proposal[n].resize((270,310),Image.Resampling.LANCZOS)
        ImageDraw.Draw(panel).text((8,28),f'帧 {n} / 48',font=SMALL,fill='#f5db8d')
        contact.paste(panel,(k%3*270,k//3*310))
    contact.save(OUT/'proposal-contact.jpg',quality=94)
    for name in ['comparison','proposal']:
        with Image.open(OUT/(name+'.webp')) as animation:
            assert animation.n_frames==48 and animation.info.get('loop')==0
    after=game_hashes();assert before==after,'This task must remain preview-only'
    # The public/runtime files remain on v130. Nothing here modifies/builds/publishes them.
    report={'previewOnly':True,'baselineSourceCommit':head,'gameAssetFilesUnchanged':len(before),'gameAssetsShaIdentical':True,
        'atlas':{'path':str(ATLAS),'sha256':sha(ATLAS)},'manifest':{'path':str(MANIFEST),'sha256':sha(MANIFEST)},
        'variants':VARIANTS,'selectedForProposalPreviewOnly':VARIANTS[1],'groundLayerBelowMonster':True,
        'playbackFPS':60,'playbackSpeed':2,'frameCount':48,'loopMilliseconds':sum(durations),
        'sourceArtFrameSequenceAlphaColorsAndWidthUnchanged':True,
        'originalReferenceMeaning':'height=1 uses the current v130 frames, timing and ground layer; only the old thickness is shown',
        'gameEngineBrowserCombatAudioOrWasmStarted':False,'gameBuildRun':False,'deployed':False,
        'artifacts':{p.name:{'bytes':p.stat().st_size,'sha256':sha(p)} for p in OUT.iterdir() if p.suffix in ['.webp','.jpg']}}
    (OUT/'preview-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
    print(json.dumps({k:report[k] for k in ['previewOnly','gameAssetFilesUnchanged','gameAssetsShaIdentical','frameCount','loopMilliseconds','deployed']}))

if __name__=='__main__':run()
