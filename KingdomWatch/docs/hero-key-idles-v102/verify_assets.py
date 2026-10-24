"""Offline source/PNG/atlas preservation and a file:// preview, without starting Cocos."""
from pathlib import Path
import hashlib,json,subprocess
from PIL import Image

ROOT=Path(__file__).resolve().parent;PROJECT=ROOT.parents[1]
HEROES=['archer','mora']


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    preview={};reports={}
    for hero in HEROES:
        stem=PROJECT/f'assets/resources/ux/hero_lobby_idle_v102/{hero}'
        m=json.loads(Path(str(stem)+'.frames.json').read_text(encoding='utf-8'));source=m['source'];order=m['animation']['frames']
        indices=source['indices'];assert indices==list(range(indices[0],indices[-1]+1))
        assert len(order)==len(indices) and abs(sum(m['animation']['frameDurations'])-len(order)/source['fps'])<1e-8
        assert sha(Path(source['file']))==source['sha256']
        iw,ih=source['size'];aw,ah=source['analysisSize']
        assert abs(iw/ih-aw/ah)<.003
        atlas=Image.open(Path(str(stem)+'.png')).convert('RGBA');assert max(atlas.size)<=4096
        minimum=10000
        for n,name in enumerate(order):
            x,y,w,h=m['frames'][name];im=atlas.crop((x,y,x+w,y+h))
            assert im.tobytes()==Image.open(ROOT/f'{hero}/frames/{n:03d}.png').convert('RGBA').tobytes()
            box=im.getchannel('A').point(lambda a:255 if a>5 else 0).getbbox();assert box
            minimum=min(minimum,box[0],box[1],w-box[2],h-box[3])
        assert minimum>=10,(hero,minimum)
        reports[hero]={'frames':len(order),'seconds':len(order)/source['fps'],'firstSourceFrame':indices[0],
          'lastSourceFrame':indices[-1],'atlas':atlas.size,'bytes':Path(str(stem)+'.png').stat().st_size,
          'atlasSHA256':sha(Path(str(stem)+'.png')),'sourceSHA256':source['sha256'],'minimumAlphaMargin':minimum,
          'aspectPreserved':True,'continuousForwardOnly':True,'allCelsMatchPNGs':True}
        preview[hero]={'manifest':m,'image':f'../../assets/resources/ux/hero_lobby_idle_v102/{hero}.png'}
    for hero in ['sniper','volt']:
        path=PROJECT/f'assets/resources/ux/hero_lobby_idle_v100/{hero}.frames.json'
        preview[hero]={'manifest':json.loads(path.read_text(encoding='utf-8')),'image':f'../../assets/resources/ux/hero_lobby_idle_v100/{hero}.png'}
    pyro=PROJECT/'assets/resources/ux/hero_lobby_idle_v99/pyro.frames.json'
    preview['pyro']={'manifest':json.loads(pyro.read_text(encoding='utf-8')),'image':'../../assets/resources/ux/hero_lobby_idle_v99/pyro.png'}
    baseline=json.loads((ROOT/'before/asset-hashes.json').read_text());current={p.relative_to(PROJECT).as_posix():sha(p) for p in (PROJECT/'assets').rglob('*') if p.is_file()}
    changed=sorted(k for k in baseline if baseline[k]!=current.get(k));assert changed==['assets/scripts/ui/HeroLobbyIdle.ts'],changed
    added=sorted(set(current)-set(baseline));expected=['assets/resources/ux/hero_lobby_idle_v102.meta']+[
      f'assets/resources/ux/hero_lobby_idle_v102/{hero}{suffix}' for hero in HEROES for suffix in ['.png','.png.meta','.frames.json','.frames.json.meta']]
    assert added==sorted(expected) and not set(baseline)-set(current)
    before=json.loads((ROOT/'before/git-state.json').read_text());git={
      'headUnchanged':subprocess.check_output(['git','rev-parse','HEAD'],cwd=PROJECT,text=True).strip()==before['head'],
      'stagedEntriesUnchanged':hashlib.sha256(subprocess.check_output(['git','ls-files','--stage'],cwd=PROJECT,text=True).encode()).hexdigest()==before['index']}
    assert all(git.values())
    page='''<!doctype html><meta charset="utf-8"><title>五英雄待机预览</title><style>
body{margin:0;background:#1c3543;color:#f5dfb4;font:16px system-ui}header{padding:18px 24px;position:sticky;top:0;background:#152a34;z-index:2;display:flex;align-items:center;gap:12px;flex-wrap:wrap}button,select{padding:9px 14px;cursor:pointer}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;padding:20px}article{border:1px solid #65808b;border-radius:12px;padding:14px;text-align:center;background:var(--card,#25434e)}canvas{width:100%;height:auto;max-height:65vh;object-fit:contain}small{display:block;color:#cad8d7;font-size:13px;line-height:1.7}a{color:#dfbd73}h3{margin:0 0 5px}.note{padding:0 25px;line-height:1.7;color:#c8d9dc}.light article{color:#263d46}.light article small{color:#43555a}.light article a{color:#294c5c}</style>
<header><b>英雄页 / 升级页待机</b><button id="play">全部暂停</button><button id="bg">切换深浅背景</button><label>速度 <select id="speed"><option value="1">1倍</option><option value=".5">0.5倍</option><option value=".25">0.25倍</option></select></label></header>
<p class="note">本页已换成新视频：弓箭手6–54帧、冰法师6–57帧（0起），原速正向循环；其他三位保持。披风、发丝与衣摆仍可能有轻微源片衔接差异，可用减速及首尾对照检查。冰法此次无外扩光晕，雷法仍是上一版带电弧版本。</p><main></main><script>
const clips=__DATA__,names={archer:'弓箭手',sniper:'重弩手',pyro:'火法师',volt:'雷法师',mora:'冰法师'},players=[];let paused=false,last=0,speed=1,light=false;
for(const hero of ['archer','sniper','pyro','volt','mora']){let p=clips[hero],m=p.manifest,article=document.createElement('article'),s=m.source.indices;article.innerHTML='<h3>'+names[hero]+'</h3><small>'+s[0]+'–'+s[s.length-1]+'帧 · '+s.length+'格 · '+m.animation.seconds.toFixed(3)+'秒</small><canvas width="352" height="576"></canvas>'+(hero==='pyro'?'<small>已接入的上一版</small>':'<a href="'+hero+'/seam-contact.jpg">首尾对照</a>');document.querySelector('main').append(article);let img=new Image();img.src=p.image;players.push({m,img,ctx:article.querySelector('canvas').getContext('2d'),time:0});}
document.querySelector('#play').onclick=()=>{paused=!paused;document.querySelector('#play').textContent=paused?'全部播放':'全部暂停'};
document.querySelector('#speed').onchange=e=>speed=Number(e.target.value);document.querySelector('#bg').onclick=()=>{light=!light;document.body.classList.toggle('light',light);document.body.style.setProperty('--card',light?'#e6d1aa':'#25434e')};
function draw(now){let dt=last?Math.min(.1,(now-last)/1000):0;last=now;for(let p of players){if(!paused&&!document.hidden)p.time=(p.time+dt*speed)%p.m.animation.seconds;let end=0,i=0;for(;i<p.m.animation.frames.length-1;i++){end+=p.m.animation.frameDurations[i];if(p.time<end)break;}if(!p.img.complete||!p.img.naturalWidth)continue;let r=p.m.frames[p.m.animation.frames[i]];p.ctx.clearRect(0,0,352,576);p.ctx.drawImage(p.img,...r,0,0,352,576);}requestAnimationFrame(draw)}requestAnimationFrame(draw);</script>'''
    page=page.replace('__DATA__',json.dumps(preview,ensure_ascii=False))
    page=page.replace("href=\"'+hero+'/seam-contact.jpg\"","href=\"../"+"'+(hero==='archer'||hero==='mora'?'hero-key-idles-v102/':'hero-key-idles-v100/')+hero+'/seam-contact.jpg\"")
    (ROOT/'preview.html').write_text(page,encoding='utf-8')
    # User already has v100 open: refresh that page to inspect the current game assets too.
    (ROOT.parent/'hero-key-idles-v100/preview.html').write_text(page,encoding='utf-8')
    report={'heroes':reports,'sourceAssetsBefore':len(baseline),'sourceAssetsChanged':changed,'sourceAssetsAdded':added,
      'oldSourceAssetsUnchanged':len(baseline)-len(changed),'git':git,'gameBrowserAudioWasmStarted':False,
      'effectLimitations':'new supplied archer and mora videos keyed at full resolution; no outer ice halo in source; volt remains v100; slight source endpoint differences remain possible',
      'visualApproval':'pending user inspection; numerical endpoint scores are not visual approval'}
    (ROOT/'asset-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'heroes':reports,'oldSourceUnchanged':len(baseline)-len(changed),'added':len(added),'git':git}))


if __name__=='__main__':main()
