"""Offline source/atlas/timeline checks and a lightweight image-only preview."""
from pathlib import Path
import hashlib,json,subprocess
from PIL import Image

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    stem=PROJECT/'assets/resources/ux/hero_lobby_idle_v99/pyro'
    manifest=json.loads(Path(str(stem)+'.frames.json').read_text(encoding='utf-8'))
    source=manifest['source'];order=manifest['animation']['frames'];duration=manifest['animation']['frameDurations']
    indices=source['indices'];assert indices==list(range(indices[0],indices[-1]+1))
    assert len(order)==len(indices) and abs(sum(duration)-len(indices)/source['fps'])<1e-9
    assert sha(Path(source['file']))==source['sha256']
    atlas=Image.open(Path(str(stem)+'.png')).convert('RGBA');assert max(atlas.size)<=4096
    for i,name in enumerate(order):
        x,y,w,h=manifest['frames'][name];cel=atlas.crop((x,y,x+w,y+h))
        assert cel.tobytes()==Image.open(ROOT/f'frames/{i:03d}.png').convert('RGBA').tobytes()
        bounds=cel.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox();assert bounds
        assert min(bounds[0],bounds[1],w-bounds[2],h-bounds[3])>=10
    baseline=json.loads((ROOT/'before/asset-hashes.json').read_text())
    current={p.relative_to(PROJECT).as_posix():sha(p) for p in (PROJECT/'assets').rglob('*') if p.is_file()}
    changed=sorted(k for k in baseline if baseline[k]!=current.get(k))
    assert changed==['assets/scripts/ui/HeroLobbyIdle.ts'],changed
    added=sorted(set(current)-set(baseline))
    expected=['assets/resources/ux/hero_lobby_idle_v99.meta']+['assets/resources/ux/hero_lobby_idle_v99/pyro'+suffix for suffix in ['.png','.png.meta','.frames.json','.frames.json.meta']]
    assert added==sorted(expected) and not set(baseline)-set(current)
    git_before=json.loads((ROOT/'before/git-state.json').read_text())
    preservation={'headUnchanged':subprocess.check_output(['git','rev-parse','HEAD'],cwd=PROJECT,text=True).strip()==git_before['head'],
      'stagedEntriesUnchanged':hashlib.sha256(subprocess.check_output(['git','ls-files','--stage'],cwd=PROJECT,text=True).encode()).hexdigest()==git_before['index']}
    assert all(preservation.values())
    page='''<!doctype html><meta charset="utf-8"><title>火法师待机 · v99</title>
<style>body{margin:0;background:#1c3543;color:#f4dbac;text-align:center;font:16px system-ui}header{padding:14px}button{padding:8px 14px;margin:5px}canvas{height:80vh;max-width:95vw;object-fit:contain}</style>
<header>火法师 · 正向待机循环 <button id="play">暂停</button><button id="bg">切换背景</button><small>__RANGE__</small></header><canvas width="352" height="576"></canvas>
<script>const m=__DATA__,im=new Image(),ctx=document.querySelector('canvas').getContext('2d');im.src='../../assets/resources/ux/hero_lobby_idle_v99/pyro.png';let time=0,last=0,paused=false,light=false;
document.querySelector('#play').onclick=()=>{paused=!paused;document.querySelector('#play').textContent=paused?'播放':'暂停'};document.querySelector('#bg').onclick=()=>{light=!light;document.body.style.background=light?'#e1ceaa':'#1c3543'};
function draw(now){const dt=last?Math.min(.1,(now-last)/1000):0;last=now;if(!paused&&!document.hidden)time=(time+dt)%m.animation.seconds;let end=0,i=0;for(;i<m.animation.frames.length-1;i++){end+=m.animation.frameDurations[i];if(time<end)break;}if(im.complete&&im.naturalWidth){ctx.clearRect(0,0,352,576);ctx.drawImage(im,...m.frames[m.animation.frames[i]],0,0,352,576);}requestAnimationFrame(draw)}requestAnimationFrame(draw);</script>'''
    page=page.replace('__RANGE__',f'{indices[0]}–{indices[-1]}帧 · {len(indices)/source["fps"]:.3f}秒').replace('__DATA__',json.dumps(manifest,ensure_ascii=False))
    (ROOT/'preview.html').write_text(page,encoding='utf-8')
    report={'hero':'pyro','source':source,'frames':len(order),'seconds':sum(duration),'atlas':atlas.size,
      'atlasSHA256':sha(Path(str(stem)+'.png')),'continuousForwardOnly':True,'fixedTransform':True,
      'sourceAssetsBefore':len(baseline),'sourceAssetsChanged':changed,'sourceAssetsAdded':added,
      'oldSourceAssetsUnchanged':len(baseline)-len(changed),'git':preservation,'gameBrowserAudioWasmStarted':False,
      'visualApproval':'user pending; endpoint scores are not visual approval'}
    (ROOT/'asset-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'frames':len(order),'seconds':sum(duration),'changed':changed,'newAssets':len(added),'git':preservation}))


if __name__=='__main__':main()
