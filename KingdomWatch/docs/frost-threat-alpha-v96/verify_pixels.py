"""Offline file/pixel validation only; it never imports or launches the game."""
from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    alpha=json.loads((ROOT/'alpha-clean-report.json').read_text());records=[]
    for item in alpha:
        target=PROJECT/f'assets/resources/ux/{item["atlas"]}.png'
        before=np.asarray(Image.open(ROOT/'before'/target.relative_to(PROJECT)).convert('RGBA'))
        now=np.asarray(Image.open(target).convert('RGBA'));manifest=json.loads(target.with_suffix('.frames.json').read_text())
        allowed=np.zeros(before.shape[:2],dtype=bool)
        for frame in item['frames']:
            x,y,w,h=manifest['frames'][frame['frame']]
            for l,t,r,b in item['regions']:allowed[y+t-2:y+b+2,x+l-2:x+r+2]=True
        assert np.array_equal(before[...,:3],now[...,:3])
        assert np.all(now[...,3]<=before[...,3])
        assert not np.any((before[...,3]!=now[...,3])&~allowed)
        records.append({'atlas':item['atlas'],'frames':len(item['frames']),'alphaChanged':int((before[...,3]!=now[...,3]).sum()),
          'rgbIdentical':True,'outsideRequestedRegionsAnd2pxFeatherRGBAIdentical':True,'sha256':sha(target)})
    heroes={};preview={}
    for hero in ['archer','pyro','sniper','volt']:
        path=PROJECT/f'assets/resources/ux/hero_lobby_idle_v96/{hero}.frames.json'
        manifest=json.loads(path.read_text(encoding='utf-8'));atlas=Image.open(path.with_name(hero+'.png')).convert('RGBA')
        source=manifest['source'];order=manifest['animation']['frames'];durations=manifest['animation']['frameDurations']
        assert source['indices']==list(range(0,source['totalFrames'],2))
        assert abs(sum(durations)-source['totalFrames']/source['fps'])<1e-8
        assert max(atlas.size)<=4096 and len(order)==len(source['indices'])
        for i,key in enumerate(order):
            x,y,w,h=manifest['frames'][key];cel=atlas.crop((x,y,x+w,y+h))
            frame=Image.open(ROOT/f'hero-frames/{hero}/{i:03d}.png').convert('RGBA')
            assert cel.tobytes()==frame.tobytes()
            box=cel.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox()
            assert box and min(box[0],box[1],w-box[2],h-box[3])>=10
        assert sha(Path('C:/Users/user/Downloads')/source['file'])==source['sha256']
        heroes[hero]={'frames':len(order),'seconds':sum(durations),'sourceSHA256':source['sha256'],
          'atlasSHA256':sha(path.with_name(hero+'.png')),'canvas':[w,h],'atlas':atlas.size,
          'everyAtlasCelMatchesPNG':True,'sourceDirectionAndTimingPreserved':True,'fixedCropAndScale':True}
        preview[hero]=manifest
    report={'underarmRepairs':records,'heroes':heroes,'gameBrowserOrAudioStarted':False,
      'visualApproval':'pending user inspection; numerical seam scores do not establish a seamless loop'}
    (ROOT/'pixel-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    page='''<!doctype html><meta charset="utf-8"><title>英雄待机 v96</title>
<style>body{margin:0;background:#172b34;color:#f5dfbb;font:16px system-ui}header{padding:25px;display:flex;gap:20px;align-items:center}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;padding:0 24px 24px}article{background:#28414b;border-radius:14px;text-align:center;padding:14px}canvas{display:block;max-width:100%;height:auto;margin:auto}button{padding:10px 20px;cursor:pointer}small{color:#b5c6c6}</style>
<header><b>英雄页 / 升级页 · 待机序列</b><button id="pause">暂停</button><small>原速、正向播放；画布和脚底固定。此页不启动游戏。</small></header><main></main><script>
const clips=__DATA__,names={archer:'弓箭手',pyro:'火法师',sniper:'重弩手',volt:'雷法师'},players=[];let paused=false,last=0;
for(const [hero,m] of Object.entries(clips)){let article=document.createElement('article');article.innerHTML='<b>'+names[hero]+'</b><canvas width="352" height="576"></canvas><small>'+m.animation.frames.length+' 帧 · '+m.animation.seconds.toFixed(3)+' 秒</small>';document.querySelector('main').append(article);let img=new Image();img.src='../../assets/resources/ux/hero_lobby_idle_v96/'+hero+'.png';players.push({m,img,ctx:article.querySelector('canvas').getContext('2d'),time:0});}
document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'播放':'暂停'};
function draw(now){let dt=last?Math.min(.1,(now-last)/1000):0;last=now;for(let p of players){if(!paused&&!document.hidden)p.time=(p.time+dt)%p.m.animation.seconds;let end=0,i=0;for(;i<p.m.animation.frames.length-1;i++){end+=p.m.animation.frameDurations[i];if(p.time<end)break;}if(!p.img.complete||!p.img.naturalWidth)continue;let r=p.m.frames[p.m.animation.frames[i]];p.ctx.clearRect(0,0,352,576);p.ctx.drawImage(p.img,...r,0,0,352,576);}requestAnimationFrame(draw)}requestAnimationFrame(draw);
</script>'''.replace('__DATA__',json.dumps(preview,ensure_ascii=False))
    (ROOT/'hero-idle-preview.html').write_text(page,encoding='utf-8')
    print(json.dumps({'alphaFrames':sum(r['frames'] for r in records),'heroes':len(heroes),'heroFrames':sum(r['frames'] for r in heroes.values()),'gameStarted':False}))


if __name__=='__main__':main()
