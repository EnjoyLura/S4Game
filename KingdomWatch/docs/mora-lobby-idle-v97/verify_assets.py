"""Offline atlas/source-pixel and timeline validation, never a game test."""
from pathlib import Path
import hashlib,json
from PIL import Image

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    key=PROJECT/'assets/resources/ux/hero_lobby_idle_v96/mora'
    manifest=json.loads(Path(str(key)+'.frames.json').read_text(encoding='utf-8'))
    atlas=Image.open(Path(str(key)+'.png')).convert('RGBA');source=manifest['source']
    order=manifest['animation']['frames'];durations=manifest['animation']['frameDurations']
    assert source['indices']==list(range(0,97,2)) and len(order)==49
    assert abs(sum(durations)-97/24)<1e-8 and max(atlas.size)<=4096
    assert sha(Path('C:/Users/user/Downloads')/source['file'])==source['sha256']
    margins=[]
    for i,name in enumerate(order):
        x,y,w,h=manifest['frames'][name];cel=atlas.crop((x,y,x+w,y+h))
        original=Image.open(ROOT/f'hero-frames/mora/{i:03d}.png').convert('RGBA')
        assert cel.tobytes()==original.tobytes()
        box=cel.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox()
        assert box
        margin=[box[0],box[1],w-box[2],h-box[3]];margins.append(margin)
        assert min(margin)>=10
    report={'hero':'mora','frames':len(order),'seconds':sum(durations),'canvas':[w,h],'atlas':atlas.size,
      'sourceSHA256':source['sha256'],'atlasSHA256':sha(Path(str(key)+'.png')),'fixedCrop':source['fixedCrop'],
      'fixedScale':source['fixedScale'],'fixedOffset':source['fixedOffset'],'sourceDirectionAndTimingPreserved':True,
      'atlasCelsMatchPNGs':True,'minimumOpaqueMargin':min(min(v) for v in margins),
      'noReverseHoldBlendOrWarp':True,'gameBrowserAudioWasmStarted':False,'visualApproval':'user pending'}
    (ROOT/'asset-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    page='''<!doctype html><meta charset="utf-8"><title>冰法师大厅待机</title>
<style>body{margin:0;background:#1b3541;color:#f6dfb8;font:17px system-ui;text-align:center}header{padding:18px}canvas{max-width:95vw;max-height:80vh;height:auto}button{margin:8px;padding:10px 18px;cursor:pointer}</style>
<header>冰法师 · 英雄页与升级页待机<br><button id="play">暂停</button><button id="bg">切换背景</button><small>原速、固定脚底、正向播放</small></header><canvas width="352" height="576"></canvas>
<script>const m=__MANIFEST__,im=new Image(),canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');im.src='../../assets/resources/ux/hero_lobby_idle_v96/mora.png';let time=0,last=0,paused=false,light=false;
document.querySelector('#play').onclick=()=>{paused=!paused;document.querySelector('#play').textContent=paused?'播放':'暂停'};
document.querySelector('#bg').onclick=()=>{light=!light;document.body.style.background=light?'#e3cda6':'#1b3541'};
function draw(now){const dt=last?Math.min(.1,(now-last)/1000):0;last=now;if(!paused&&!document.hidden)time=(time+dt)%m.animation.seconds;let end=0,index=0;for(;index<m.animation.frames.length-1;index++){end+=m.animation.frameDurations[index];if(time<end)break;}if(im.complete&&im.naturalWidth){ctx.clearRect(0,0,352,576);ctx.drawImage(im,...m.frames[m.animation.frames[index]],0,0,352,576);}requestAnimationFrame(draw)}requestAnimationFrame(draw);</script>'''.replace('__MANIFEST__',json.dumps(manifest,ensure_ascii=False))
    (ROOT/'preview.html').write_text(page,encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))


if __name__=='__main__':main()
