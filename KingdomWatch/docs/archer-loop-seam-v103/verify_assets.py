"""Static pixel, timing and source-preservation audit; update image-only preview."""
from pathlib import Path
import hashlib,json,re,subprocess
from PIL import Image
ROOT=Path(__file__).resolve().parent;PROJECT=ROOT.parents[1]


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    stem=PROJECT/'assets/resources/ux/hero_lobby_idle_v103/archer'
    m=json.loads(Path(str(stem)+'.frames.json').read_text());atlas=Image.open(Path(str(stem)+'.png')).convert('RGBA')
    order=m['animation']['frames'];assert len(order)==52 and len(m['frameProvenance'])==52
    assert all(t==1/30 for t in m['animation']['frameDurations'])
    assert abs(sum(m['animation']['frameDurations'])-m['animation']['seconds'])<1e-8
    assert m['source']['indices']==list(range(6,56))
    assert sha(Path(m['source']['file']))==m['source']['sha256']
    assert max(atlas.size)<=4096;minimum=10000
    for n,name in enumerate(order):
        x,y,w,h=m['frames'][name];cel=atlas.crop((x,y,x+w,y+h))
        assert cel.tobytes()==Image.open(ROOT/f'archer/frames/{n:03d}.png').convert('RGBA').tobytes()
        if n<49:assert cel.tobytes()==Image.open(ROOT.parent/f'hero-key-idles-v102/archer/frames/{n:03d}.png').convert('RGBA').tobytes()
        box=cel.getchannel('A').point(lambda a:255 if a>5 else 0).getbbox();assert box
        minimum=min(minimum,box[0],box[1],w-box[2],h-box[3])
    assert minimum>=10
    before=json.loads((ROOT/'before/asset-hashes.json').read_text());current={p.relative_to(PROJECT).as_posix():sha(p) for p in (PROJECT/'assets').rglob('*') if p.is_file()}
    changed=sorted(k for k in before if before[k]!=current.get(k));assert changed==['assets/scripts/ui/HeroLobbyIdle.ts']
    added=sorted(set(current)-set(before));expected=['assets/resources/ux/hero_lobby_idle_v103.meta']+['assets/resources/ux/hero_lobby_idle_v103/archer'+s for s in ['.png','.png.meta','.frames.json','.frames.json.meta']]
    assert added==sorted(expected);assert not set(before)-set(current)
    git=json.loads((ROOT/'before/git-state.json').read_text())
    assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=PROJECT,text=True).strip()==git['head']
    assert hashlib.sha256(subprocess.check_output(['git','ls-files','--stage'],cwd=PROJECT,text=True).encode()).hexdigest()==git['index']
    page=(ROOT/'before/preview-v100.html').read_text(encoding='utf-8')
    a=page.index('const clips=')+len('const clips=');b=page.index(',names=',a)
    clips=json.loads(page[a:b]);clips['archer']={'manifest':m,'image':'../../assets/resources/ux/hero_lobby_idle_v103/archer.png'}
    page=page[:a]+json.dumps(clips,ensure_ascii=False)+page[b:]
    page=page.replace("+s.length+'格", "+m.animation.frames.length+'格")
    page=page.replace("(hero==='archer'||hero==='mora'?'hero-key-idles-v102/':'hero-key-idles-v100/')", "(hero==='archer'?'archer-loop-seam-v103/':hero==='mora'?'hero-key-idles-v102/':'hero-key-idles-v100/')")
    note='弓箭手接头已修正：50帧原片＋2帧运动补偿过渡，30fps，共1.733秒。原49格主体像素保持，冰法及其余英雄保持上一版。可减速检查披风和脸部接缝；过渡效果待人工确认。'
    page=re.sub(r'<p class="note">.*?</p>',lambda _: '<p class="note">'+note+'</p>',page,flags=re.S)
    (ROOT/'preview.html').write_text(page,encoding='utf-8');(ROOT.parent/'hero-key-idles-v100/preview.html').write_text(page,encoding='utf-8')
    script=re.search(r'<script>(.*?)</script>',page,re.S).group(1);check=ROOT/'preview-syntax-check.cjs';check.write_text(script,encoding='utf-8')
    result=subprocess.run(['C:/Program Files/nodejs/node.exe','--check',str(check)],capture_output=True,text=True);assert result.returncode==0,result.stderr
    report={'frames':52,'originalFrames':50,'motionCompensatedFrames':2,'seconds':52/30,'original49CelsUnchanged':True,'atlasCelsMatch':True,'minimumAlphaMargin':minimum,'oldAssets':len(before),'oldAssetsUnchanged':len(before)-len(changed),'changed':changed,'added':added,'noRemovedAssets':True,'headAndIndexUnchanged':True,'previewSynced':True,'previewSyntaxPassed':True,'gameStarted':False,'deployed':False}
    (ROOT/'asset-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))


if __name__=='__main__':main()
