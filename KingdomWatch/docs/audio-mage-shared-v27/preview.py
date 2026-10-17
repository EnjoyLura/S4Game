"""Offline synchronized scene reels for user audition; never opens a player."""
import importlib.util
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import wave
import numpy as np
import prepare as q

original = sys.modules['prepare']; sys.modules['prepare'] = q.p
v = q.module('v24_reel',q.ROOT/'docs/audio-kingdom-v24/preview.py')
sys.modules['prepare'] = original
base_text = v.text
def text(draw,xy,value,*args,**kwargs):
    base_text(draw,xy,value.replace('V24','V27').replace('原创音效 · 项目同步分镜','录音素材编辑 · 同步分镜'),*args,**kwargs)
v.text = text
CASES = [
    dict(id='cast',title='三法师 · 共用施法',detail='普攻与技能使用完全相同的声音',duration=4.8,
        events=[(.3+i*.65,'mage_cast',label) for i,label in enumerate(['火法普攻','火法技能','雷法普攻','雷法技能','冰法普攻','冰法技能'])]),
    dict(id='pyro',hero='pyro',title='火法大招 · 陨石落地',detail='撞击主体与碎石短尾',duration=4.3,
        events=[(.4+i*.65,'meteor_land','陨石接地') for i in range(5)]),
    dict(id='volt',hero='volt',title='雷法大招 · 轻微雷鸣',detail='自然雷声 · 连续落雷限频',duration=5,
        events=[(.4+i*1.4,'thunder_soft','落雷') for i in range(3)]),
    dict(id='mora',hero='mora',title='冰法大招 · 冰晶破碎',detail='真实冰块撞地与碎片散落',duration=3.7,
        events=[(.4+i*.7,'ice_shatter','冰晶接地碎裂') for i in range(4)]),
]

def main():
    page=q.HERE/'preview';media=page/'media';masters=q.HERE/'reel-masters'
    media.mkdir(parents=True,exist_ok=True);masters.mkdir(exist_ok=True)
    lookup={Path(r['file']).stem:r for r in json.loads((q.HERE/'manifest.json').read_text(encoding='utf8'))['files']}
    catalog=(q.ROOT/'assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
    gains={cue:float(gain) for cue,gain in re.findall(r'^  (\w+): .*?gain: ([\d.]+)',catalog,re.M)}
    rows=[]
    for case in CASES:
        mix=np.zeros((round(case['duration']*q.SR),2))
        for at,name,_ in case['events']:
            raw=subprocess.check_output([q.FF,'-v','error','-i',str(q.DEST/(name+'.wav')),'-ac','2','-ar',str(q.SR),'-f','f32le','-'])
            a=np.frombuffer(raw,'<f4').reshape(-1,2)*gains[lookup[name]['cue']]*(.8*.85*math.sqrt(2)*10**(1/20))
            i=round(at*q.SR);n=min(len(a),len(mix)-i);mix[i:i+n]+=a[:n]
        if np.max(abs(mix))>=.95: raise ValueError('Reel PCM clipped')
        out=masters/(case['id']+'.wav')
        with wave.open(str(out),'wb') as w:
            w.setnchannels(2);w.setsampwidth(2);w.setframerate(q.SR);w.writeframes(np.round(mix*32767).astype('<i2').tobytes())
        movie=media/(case['id']+'.mp4')
        proc=subprocess.Popen([q.FF,'-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','720x440','-r','18','-i','-',
            '-i',str(out),'-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k',
            '-ar',str(q.SR),'-t',str(case['duration']),'-movflags','+faststart',str(movie)],stdin=subprocess.PIPE)
        try:
            for i in range(math.ceil(case['duration']*18)):proc.stdin.write(v.frame(case,i/18).tobytes())
        finally:proc.stdin.close()
        if proc.wait()!=0:raise ValueError('Reel encoding failed')
        v.frame(case,.65).save(media/(case['id']+'.jpg'),quality=87)
        rows.append(dict(id=case['id'],title=case['title'],detail=case['detail'],seconds=case['duration'],
            video='media/'+case['id']+'.mp4',poster='media/'+case['id']+'.jpg',sha256=q.p.sha(movie)))
        print('Encoded',case['id'],flush=True)
    playlist=masters/'playlist.txt'
    playlist.write_text('\n'.join("file '"+(media/(c['id']+'.mp4')).as_posix()+"'" for c in CASES),encoding='utf8')
    subprocess.run([q.FF,'-v','error','-y','-f','concat','-safe','0','-i',str(playlist),'-c','copy','-movflags','+faststart',str(media/'all.mp4')],check=True)
    (page/'scenes.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
    old=q.ROOT/'docs/audio-kingdom-v24/preview'
    shutil.copy2(old/'style.css',page/'style.css')
    script=(old/'app.js').read_text(encoding='utf8').replace('media/archer.jpg','media/cast.jpg').replace('全套场景连听','四种声音连听').replace('约一分钟','约 18 秒')
    (page/'app.js').write_text(script,encoding='utf8')
    html=(old/'index.html').read_text(encoding='utf8')
    for a,b in [('AUDIO V24','AUDIO V27'),('全套音效 v24','法师音效 v27'),('让每一次动作，都有回响。','一个施法声，三种大招落点。'),
        ('五位英雄、升级收获、战场警报与胜败结算。全部 31 个发声入口，44 条新制音频。','三法师的普攻与技能共用一个施法声；大招分别使用陨石落地、轻微雷鸣、冰晶破碎声。'),
        ('audio-kingdom-v24','audio-mage-shared-v27'),('media/archer.jpg','media/cast.jpg'),('全套场景连听','四种声音连听'),('全套连听','四种声音连听'),('约一分钟','约 18 秒'),
        ('延续精简播放规则：普通命中、普通死亡、弹窗和数字装饰保持静音；关键音效优先。','弓箭手、重弩手、固定点击和普通受击沿用原版。大招声音跟随接地时刻，连续落点限制播放密度。'),
        ('本页为已制作的音效分镜。参考方向是欧美漫画奇幻；风格与品质仍待实际试听评价。','本页是音效分镜，听感由你试听评价。录音作者：Mechanical Wave、Soundopolis / David Fienup、Coll Anderson、Eiravaein Works；Sonniss GameAudioGDC 授权。')]:html=html.replace(a,b)
    (page/'index.html').write_text(html,encoding='utf8')
    q.write('reel-record.json',dict(scenes=rows,totalSeconds=sum(c['duration'] for c in CASES),files=4,gameRecording=False,audioAuditioned=False))

if __name__=='__main__':main()
