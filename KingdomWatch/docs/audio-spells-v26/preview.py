"""Encode synchronized demonstration videos offline. No game/audio playback."""
import importlib.util
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import wave
import numpy as np
import prepare as q

original = sys.modules['prepare']
sys.modules['prepare'] = q.p
spec = importlib.util.spec_from_file_location('v24_reel',q.ROOT/'docs/audio-kingdom-v24/preview.py')
v = importlib.util.module_from_spec(spec); spec.loader.exec_module(v)
sys.modules['prepare'] = original
base_text = v.text
def annotated_text(draw,xy,value,*args,**kwargs):
    value = value.replace('V24','V26').replace('原创音效 · 项目同步分镜','授权素材编辑 · 同步分镜')
    base_text(draw,xy,value,*args,**kwargs)
v.text = annotated_text
CASES = [dict(c) for c in v.CASES if c['id'] in ['pyro','volt','mora']]
for c in CASES:
    c['detail'] = {'pyro':'单一火球素材 · 短促喷焰', 'volt':'单一电击素材 · 短尾收束',
                   'mora':'单一冰法术素材 · 结晶发射'}[c['id']]
CASES += [dict(id='click',title='统一点击声',detail='连续五次使用同一个第一条点击样本',duration=3.8,
          events=[(.3+i*.65,'ui_click_1',f'点击 {i+1} · 同一声音') for i in range(5)]),
          dict(id='hit',title='普通伤害 · 通用受击',detail='五位英雄共用 · 无元素附加层',duration=3.2,
          events=[(.3+i*.5,'hit_common',hero+' · 普通伤害')
                  for i,hero in enumerate(['弓箭手','重弩手','火法师','雷法师','冰法师'])])]

def main():
    page = q.HERE/'preview'; media = page/'media'; masters = q.HERE/'reel-masters'
    media.mkdir(parents=True,exist_ok=True); masters.mkdir(exist_ok=True)
    manifest = json.loads((q.HERE/'manifest.json').read_text(encoding='utf8'))
    lookup = {Path(row['file']).stem:row for row in manifest['files']}
    lookup['ui_click_1'] = dict(cue='ui')
    catalog = (q.ROOT/'assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
    import re
    gains = {cue:float(gain) for cue,gain in re.findall(r'^  (\w+): .*?gain: ([\d.]+)',catalog,re.M)}
    rows = []
    for case in CASES:
        mix = np.zeros((round(case['duration']*q.SR),2))
        for at,name,_ in case['events']:
            source = q.ROOT/'assets/resources/audio/v24/ui_click_1.wav' if name=='ui_click_1' else q.DEST/(name+'.wav')
            raw = subprocess.check_output([q.FF,'-v','error','-i',str(source),'-ac','2','-ar',str(q.SR),'-f','f32le','-'])
            a = np.frombuffer(raw,'<f4').reshape(-1,2)*gains[lookup[name]['cue']]*(.8*.85*math.sqrt(2)*10**(1/20))
            i = round(at*q.SR); n = min(len(a),len(mix)-i); mix[i:i+n]+=a[:n]
        out = masters/(case['id']+'.wav')
        with wave.open(str(out),'wb') as w:
            w.setnchannels(2);w.setsampwidth(2);w.setframerate(q.SR);w.writeframes(np.round(mix*32767).astype('<i2').tobytes())
        movie = media/(case['id']+'.mp4')
        proc = subprocess.Popen([q.FF,'-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','720x440','-r','18','-i','-',
            '-i',str(out),'-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k',
            '-ar',str(q.SR),'-t',str(case['duration']),'-movflags','+faststart',str(movie)],stdin=subprocess.PIPE)
        try:
            for i in range(math.ceil(case['duration']*18)): proc.stdin.write(v.frame(case,i/18).tobytes())
        finally: proc.stdin.close()
        if proc.wait()!=0: raise ValueError('Reel encoding failed')
        v.frame(case,1.2).save(media/(case['id']+'.jpg'),quality=87)
        rows.append(dict(id=case['id'],title=case['title'],detail=case['detail'],seconds=case['duration'],
            video='media/'+case['id']+'.mp4',poster='media/'+case['id']+'.jpg',sha256=q.p.sha(movie)))
        print('Encoded',case['id'],flush=True)
    playlist = masters/'playlist.txt'
    playlist.write_text('\n'.join("file '"+(media/(c['id']+'.mp4')).as_posix()+"'" for c in CASES),encoding='utf8')
    subprocess.run([q.FF,'-v','error','-y','-f','concat','-safe','0','-i',str(playlist),'-c','copy','-movflags','+faststart',str(media/'all.mp4')],check=True)
    (page/'scenes.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
    old = q.ROOT/'docs/audio-kingdom-v24/preview'
    shutil.copy2(old/'style.css',page/'style.css')
    script = (old/'app.js').read_text(encoding='utf8').replace('media/archer.jpg','media/pyro.jpg').replace('全套场景连听','本次更新连听').replace('约一分钟','约 27 秒')
    (page/'app.js').write_text(script,encoding='utf8')
    html = (old/'index.html').read_text(encoding='utf8').replace('AUDIO V24','AUDIO V26').replace('全套音效 v24','法术与通用受击 v26').replace('让每一次动作，都有回响。','火、雷、冰：重新选材。')
    html = html.replace('五位英雄、升级收获、战场警报与胜败结算。全部 31 个发声入口，44 条新制音频。',
        '三法师共 18 条法术全部换成单一法术素材，去掉乐器混搭。点击固定第一种，普通伤害共用一个短受击声。')
    html = html.replace('audio-kingdom-v24','audio-spells-v26').replace('media/archer.jpg','media/pyro.jpg').replace('全套场景连听','本次更新连听').replace('全套连听','本次更新连听').replace('约一分钟','约 27 秒')
    html = html.replace('延续精简播放规则：普通命中、普通死亡、弹窗和数字装饰保持静音；关键音效优先。',
        '弓箭手、重弩手沿用现有音效。普通受击全场共用，0.18 秒限频、最多一个声部；点击不再交替。')
    html = html.replace('</body>', '<p class="intro">法术素材：<a href="'+q.SOURCE_PAGE+'">JC Sounds · Fantasy SFX Pack Vol 1</a>，CC BY 4.0；本项目做片段、均衡、渐变和电平编辑。通用受击与点击录音署名见游戏音频鸣谢。</p></body>')
    (page/'index.html').write_text(html,encoding='utf8')
    q.write('reel-record.json',dict(scenes=rows,totalSeconds=sum(c['duration'] for c in CASES),
          mageFiles=18,commonHitFiles=1,clickFiles=1,gameRecording=False,audioAuditioned=False))

if __name__=='__main__': main()
