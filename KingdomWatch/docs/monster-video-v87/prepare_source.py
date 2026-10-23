from pathlib import Path
import hashlib, json, shutil, subprocess
from PIL import Image, ImageDraw
import imageio.v2 as iio

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parent.parent
SOURCE=Path('C:/Users/user/Downloads/lens-api-task_S2F1payDFIr6mT5MbFUoMSBSvLVeriMs.mp4')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    before=ROOT/'before';before.mkdir(parents=True,exist_ok=True)
    marker=before/'assets-sha256.json'
    if not marker.exists():
        files={p.relative_to(PROJECT).as_posix():sha(p) for p in (PROJECT/'assets').rglob('*') if p.is_file()}
        marker.write_text(json.dumps(files,indent=2)+'\n',encoding='utf-8')
        for rel in ['AGENTS.md','docs/github-pages-publishing/deployment.json',
                    'assets/scripts/battle/MobAnim.ts','assets/scripts/battle/Monster.ts',
                    'assets/scripts/ui/BattleEntryWarmup.ts','assets/scripts/config/ChapterContent.ts',
                    'assets/scripts/config/ChapterWaves.ts']:
            target=before/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(PROJECT/rel,target)
        git='C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe'
        for name,args in [('git-head',['rev-parse','HEAD']),('git-index',['ls-files','--stage']),('git-status',['status','--short'])]:
            (before/(name+'.txt')).write_bytes(subprocess.check_output([git,*args],cwd=PROJECT))
    source=ROOT/'source/user-monsters.mp4';source.parent.mkdir(exist_ok=True)
    if not source.exists():shutil.copy2(SOURCE,source)
    reader=iio.get_reader(source);meta=reader.get_meta_data();frames=[Image.fromarray(f) for f in reader];reader.close()
    info={'path':str(SOURCE),'frames':len(frames),'fps':meta['fps'],'size':list(frames[0].size),'bytes':source.stat().st_size,'sha256':sha(source)}
    (ROOT/'source-info.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8')
    sheet=Image.new('RGB',(1280,4*215),'#ddd5c5');d=ImageDraw.Draw(sheet)
    for j,i in enumerate([0,4,8,12,16,20,24,28,32,36,40,44,48,52,len(frames)-2,len(frames)-1]):
        thumb=frames[i].copy();thumb.thumbnail((320,190));x=j%4*320;y=j//4*215
        sheet.paste(thumb,(x,y));d.text((x+5,y+190),str(i),fill='black')
    sheet.save(ROOT/'source-contact.jpg',quality=94)
    frames[0].save(ROOT/'source-first.png');frames[-1].save(ROOT/'source-last.png')
    print(json.dumps(info,indent=2))
if __name__=='__main__':main()
