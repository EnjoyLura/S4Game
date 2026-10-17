"""Offline audiovisual project reels. Never plays audio or runs the game."""
from pathlib import Path
from functools import lru_cache
import hashlib
import json
import math
import subprocess
import wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps
import prepare as p

HERE=p.HERE
ROOT=p.ROOT
PAGE=HERE/'preview'
MEDIA=PAGE/'media'
W,H,FPS=720,440,18
SR=p.SR
GOLD=(244,197,102)
PALE=(230,233,223)
CASES=[]
names={'archer':'弓箭手','sniper':'重弩手','pyro':'火法师','volt':'雷法师','mora':'冰法师'}
specs=[('archer','bow','skill','crit','bow_ult'),('sniper','crossbow','snipe','pierce_heavy','snipe'),
       ('pyro','fire','fire_skill','fire_heavy','fire_ult'),('volt','thunder','thunder_skill','thunder_heavy','thunder_ult'),
       ('mora','frost','frost_skill','frost_heavy','frost_ult')]
for hero,shot,skill,impact,ult in specs:
    events=[(.3,shot+'_1','普攻 · 第 1 次'),(.82,shot+'_2','普攻 · 第 2 次'),(1.34,shot+'_3','普攻 · 第 3 次'),
            (2.25,skill,'技能'),(3.45,impact,'重击 / 暴击'),(4.65,ult,'大招')]
    CASES.append(dict(id=hero,title=names[hero],hero=hero,duration=6.7,events=events,
        detail={'archer':'弓弦、掠风与箭雨','sniper':'木质机关与有重量的贯穿','pyro':'扑燃、焰流与流星落点','volt':'短电弧、连锁与雷暴','mora':'碎冰、结晶与暴风雪'}[hero]))
CASES += [
    dict(id='cards',title='点击与三选一',duration=4.2,detail='操作轻声，卡牌展开与选中各一次',events=[(.25,'ui_click_1','点击'),(.65,'ui_click_2','点击'),(1.3,'pick_open','卡牌展开'),(2.65,'pick_choose','选择落定')]),
    dict(id='growth',title='升级与阶段突破',duration=5.6,detail='普通成长短句；长按结束集中反馈；突破更饱满',events=[(.4,'growth','普通升级'),(2.05,'growth','长按结束 · 合并反馈'),(3.75,'breakthrough','阶段突破')]),
    dict(id='reward',title='收获与拾取',duration=3.5,detail='领奖、购买和招募共用一次收获短句',events=[(.4,'reward','获得奖励'),(2.05,'loot_pickup','战利品拾取')]),
    dict(id='threat',title='战场重要提示',duration=5.8,detail='只保留精英 / 首领警报、倒地与防线受击',events=[(.3,'surge','精英 / 首领来袭'),(1.5,'wall','防线受击'),(2.6,'heavy_1','精英倒地 · 1'),(3.5,'heavy_2','精英倒地 · 2'),(4.4,'heavy_3','首领倒地 · 3')]),
    dict(id='result',title='胜利与失败',duration=6.0,detail='短铜管凯旋；下行木管收束',events=[(.35,'victory','胜利'),(3.5,'defeat','失败')]),
]

@lru_cache(maxsize=40)
def font(n): return ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc',n)

def text(draw,xy,t,size=24,color=PALE,anchor='mm'):
    draw.text(xy,t,font=font(size),fill=color,anchor=anchor)

@lru_cache(maxsize=10)
def base(hero):
    bg=ImageOps.fit(Image.open(ROOT/'docs/battle-modal-art-concept-v18/assets/ground.png').convert('RGBA'),(W,H))
    bg=Image.alpha_composite(bg,Image.new('RGBA',(W,H),(11,22,30,200)))
    if hero:
        path=ROOT/'assets/resources/ux/hero_comic_v1'/('comic_figure_'+hero+('_v2.png' if hero=='archer' else '_v1.png'))
        figure=Image.open(path).convert('RGBA')
        figure.thumbnail((235,272),Image.Resampling.LANCZOS)
        bg.alpha_composite(figure,(round(161-figure.width/2),round(243-figure.height/2)))
    return bg

def frame(case,t):
    im=base(case.get('hero','')).copy()
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((20,17,700,83),14,fill=(20,36,44),outline=(79,98,98),width=1)
    text(d,(40,43),case['title'],29,GOLD,'lm')
    text(d,(40,69),case['detail'],14,PALE,'lm')
    text(d,(679,44),'V24',17,GOLD,'rm')
    active=[e for e in case['events'] if t>=e[0]]
    e=active[-1] if active else None
    age=t-e[0] if e else 99
    center=(494,230) if case.get('hero') else (360,217)
    if e:
        strength=max(0,1-age/.7)
        radius=48+40*(1-strength)
        if strength:
            color=tuple(round(v*strength+35*(1-strength)) for v in GOLD)
            d.ellipse((center[0]-radius,center[1]-radius,center[0]+radius,center[1]+radius),outline=color,width=4)
        text(d,center,e[2],23,GOLD)
        if case.get('hero') and age<.28:
            x=253+(center[0]-253)*age/.28
            d.line((x-35,center[1],x,center[1]),fill=GOLD,width=4)
    else: text(d,center,'准备',23,(153,174,177))
    # Event markers show sound timing without pretending this is a live game recording.
    left,right,y=38,682,348
    d.line((left,y,right,y),fill=(90,105,102),width=2)
    for at,_,label in case['events']:
        x=left+(right-left)*at/case['duration']
        d.ellipse((x-5,y-5,x+5,y+5),fill=GOLD if t>=at else (114,132,133))
    x=left+(right-left)*min(1,t/case['duration'])
    d.line((left,y,x,y),fill=GOLD,width=3)
    text(d,(360,380),'原创音效 · 项目同步分镜',18,PALE)
    text(d,(360,411),'非实机录像 · 实际播放密度以游戏为准',13,(155,176,180))
    return im.convert('RGB')

def main():
    MEDIA.mkdir(parents=True,exist_ok=True)
    render_dir=HERE/'reel-masters';render_dir.mkdir(exist_ok=True)
    manifest=json.loads((HERE/'manifest.json').read_text(encoding='utf8'))
    lookup={Path(r['file']).stem:r for r in manifest['files']}
    catalog=(ROOT/'assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
    import re
    gains={cue:float(gain) for cue,gain in re.findall(r'^  (\w+): .*?gain: ([\d.]+)',catalog,re.M)}
    info=[]
    for case in CASES:
        samples=round(case['duration']*SR)
        audio=np.zeros((samples,2))
        for at,name,_ in case['events']:
            raw=subprocess.check_output([p.FF,'-v','error','-i',str(p.DEST/(name+'.wav')),'-ac','2','-ar',str(SR),'-f','f32le','-'])
            a=np.frombuffer(raw,'<f4').reshape(-1,2).astype(np.float64)
            a*=gains[lookup[name]['cue']]*.8
            start=round(at*SR);n=min(len(a),len(audio)-start)
            audio[start:start+n]+=a[:n]
        if np.max(abs(audio))>=.95: raise ValueError('Reel clipped')
        wav=render_dir/(case['id']+'.wav')
        with wave.open(str(wav),'wb') as out:
            out.setnchannels(2);out.setsampwidth(2);out.setframerate(SR)
            out.writeframes(np.round(audio*32767).astype('<i2').tobytes())
        mp4=MEDIA/(case['id']+'.mp4')
        proc=subprocess.Popen([p.FF,'-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-',
            '-i',str(wav),'-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k',
            '-ar',str(SR),'-t',str(case['duration']),'-movflags','+faststart',str(mp4)],stdin=subprocess.PIPE)
        try:
            for f in range(math.ceil(case['duration']*FPS)):proc.stdin.write(frame(case,f/FPS).tobytes())
        finally:proc.stdin.close()
        if proc.wait()!=0:raise ValueError('Reel encoding failed')
        frame(case,2.8).save(MEDIA/(case['id']+'.jpg'),quality=86)
        info.append(dict(id=case['id'],title=case['title'],detail=case['detail'],seconds=case['duration'],
            video='media/'+mp4.name,poster='media/'+case['id']+'.jpg',sha256=p.sha(mp4)))
        print('Encoded',case['id'],flush=True)
    listfile=render_dir/'playlist.txt'
    listfile.write_text('\n'.join("file '"+(MEDIA/(c['id']+'.mp4')).as_posix()+"'" for c in CASES),encoding='utf8')
    subprocess.run([p.FF,'-v','error','-y','-f','concat','-safe','0','-i',str(listfile),'-c','copy','-movflags','+faststart',str(MEDIA/'all.mp4')],check=True)
    (PAGE/'scenes.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf8')
    p.write('reel-record.json',dict(scenes=info,totalSeconds=sum(c['duration'] for c in CASES),
        activeCues=31,distinctProductionFiles=44,gameRecording=False,playedOrAuditioned=False))

if __name__=='__main__':main()
