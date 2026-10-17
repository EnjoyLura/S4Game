"""Render mage/gate audiovisual previews without playing them."""
from pathlib import Path
import importlib.util
import json
import math
import re
import shutil
import subprocess
import sys
import wave
import numpy as np
from PIL import Image, ImageDraw, ImageOps
import prepare as q

HERE=q.HERE
ROOT=q.ROOT
PAGE=HERE/'preview'
MEDIA=PAGE/'media'
original_prepare=sys.modules['prepare']
sys.modules['prepare']=q.p
spec=importlib.util.spec_from_file_location('v24_preview',ROOT/'docs/audio-kingdom-v24/preview.py')
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
sys.modules['prepare']=original_prepare
CASES=[dict(c) for c in v.CASES if c['id'] in ['pyro','volt','mora']]
for c in CASES:
    c['detail']={'pyro':'短促气流与低频焰流','volt':'圆润的雷击主体，减少电流碎裂','mora':'柔和的竖琴共鸣，去掉尖锐碎片'}[c['id']]
CASES.append(dict(id='gate',title='进入关卡 · 木门合拢',detail='滑动 → 实际闭合落点 → 停留 → 开门',duration=3.3,
    events=[(.4,'gate_slide','开始滑动'),(.64,'gate_close','门扇合拢')]))
gate=Image.open(ROOT/'assets/resources/ux/battle_entry_v3/outpost_gate.png').convert('RGBA')
gate=ImageOps.fit(gate,(640,276),method=Image.Resampling.LANCZOS)

def frame(case,t):
    if case['id']!='gate':
        im=v.frame(case,t)
        draw=ImageDraw.Draw(im);draw.rounded_rectangle((610,28,690,61),5,fill=(20,36,44));v.text(draw,(657,44),'V25',17,v.GOLD)
        return im
    im=v.base('').copy();draw=ImageDraw.Draw(im)
    draw.rounded_rectangle((20,17,700,83),14,fill=(20,36,44));v.text(draw,(40,43),case['title'],27,v.GOLD,'lm')
    v.text(draw,(40,69),case['detail'],14,v.PALE,'lm');v.text(draw,(660,44),'V25',17,v.GOLD)
    if t<.4:coverage=0
    elif t<.64:coverage=1-(1-(t-.4)/.24)**3
    elif t<2.14:coverage=1
    else:
        progress=min(1,(t-2.14)/.32);coverage=1-progress*progress*(3-2*progress)
    panel=Image.new('RGBA',(640,276),(0,0,0,0))
    slide=round((1-coverage)*320)
    panel.alpha_composite(gate.crop((0,0,320,276)),(-slide,0))
    panel.alpha_composite(gate.crop((320,0,640,276)),(320+slide,0))
    im.alpha_composite(panel,(40,100))
    draw=ImageDraw.Draw(im);v.text(draw,(360,410),'项目同步分镜 · 非实机录像',14,(180,195,195))
    return im.convert('RGB')

def main():
    MEDIA.mkdir(parents=True,exist_ok=True)
    masters=HERE/'reel-masters';masters.mkdir(exist_ok=True)
    manifest=json.loads((HERE/'manifest.json').read_text(encoding='utf8'))
    lookup={Path(r['file']).stem:r for r in manifest['files']}
    cat=(ROOT/'assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
    gains={cue:float(gain) for cue,gain in re.findall(r'^  (\w+): .*?gain: ([\d.]+)',cat,re.M)}
    records=[]
    for case in CASES:
        mix=np.zeros((round(case['duration']*q.SR),2))
        for at,name,_ in case['events']:
            raw=subprocess.check_output([q.p.FF,'-v','error','-i',str(q.DEST/(name+'.wav')),'-ac','2','-ar',str(q.SR),'-f','f32le','-'])
            a=np.frombuffer(raw,'<f4').reshape(-1,2)*gains[lookup[name]['cue']]*.8
            i=round(at*q.SR);n=min(len(a),len(mix)-i);mix[i:i+n]+=a[:n]
        out=masters/(case['id']+'.wav')
        with wave.open(str(out),'wb') as w:
            w.setnchannels(2);w.setsampwidth(2);w.setframerate(q.SR);w.writeframes(np.round(mix*32767).astype('<i2').tobytes())
        mp4=MEDIA/(case['id']+'.mp4')
        proc=subprocess.Popen([q.p.FF,'-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','720x440','-r','18','-i','-',
            '-i',str(out),'-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k',
            '-ar',str(q.SR),'-t',str(case['duration']),'-movflags','+faststart',str(mp4)],stdin=subprocess.PIPE)
        try:
            for i in range(math.ceil(case['duration']*18)):proc.stdin.write(frame(case,i/18).tobytes())
        finally:proc.stdin.close()
        if proc.wait()!=0:raise ValueError('Encoding failed')
        frame(case,1.2).save(MEDIA/(case['id']+'.jpg'),quality=87)
        records.append(dict(id=case['id'],title=case['title'],detail=case['detail'],seconds=case['duration'],
            video='media/'+case['id']+'.mp4',poster='media/'+case['id']+'.jpg',sha256=q.p.sha(mp4)))
        print('Encoded',case['id'],flush=True)
    playlist=masters/'playlist.txt'
    playlist.write_text('\n'.join("file '"+(MEDIA/(c['id']+'.mp4')).as_posix()+"'" for c in CASES),encoding='utf8')
    subprocess.run([q.p.FF,'-v','error','-y','-f','concat','-safe','0','-i',str(playlist),'-c','copy','-movflags','+faststart',str(MEDIA/'all.mp4')],check=True)
    (PAGE/'scenes.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf8')
    prev=ROOT/'docs/audio-kingdom-v24/preview'
    shutil.copy2(prev/'style.css',PAGE/'style.css')
    script=(prev/'app.js').read_text(encoding='utf8').replace('media/archer.jpg','media/pyro.jpg').replace('全套场景连听','本次更新连听').replace('约一分钟','约 24 秒')
    (PAGE/'app.js').write_text(script,encoding='utf8')
    html=(prev/'index.html').read_text(encoding='utf8').replace('AUDIO V24','AUDIO V25').replace('全套音效 v24','法师与关门音效 v25').replace('让每一次动作，都有回响。','法师声音，收敛而清晰。')
    html=html.replace('五位英雄、升级收获、战场警报与胜败结算。全部 31 个发声入口，44 条新制音频。','火、雷、冰的 18 条音效重新制作，新增木门滑动与合拢声。弓箭手、重弩手与按钮点击声保留。')
    html=html.replace('audio-kingdom-v24','audio-mages-ui-v25').replace('media/archer.jpg','media/pyro.jpg').replace('全套场景连听','本次更新连听').replace('全套连听','本次更新连听').replace('约一分钟','约 24 秒')
    html=html.replace('延续精简播放规则：普通命中、普通死亡、弹窗和数字装饰保持静音；关键音效优先。','游戏中的商品图标、导航、页签、左右切换与空白区域复用原点击声；拖动和长按不补点按声。')
    (PAGE/'index.html').write_text(html,encoding='utf8')
    q.write('reel-record.json',dict(scenes=records,totalSeconds=sum(c['duration'] for c in CASES),newAudioFiles=20,gameRecording=False,auditioned=False))

if __name__=='__main__':main()
