"""Validate published bytes and image decoding without running the game or WASM."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
sys.path.insert(0,str(ROOT/'tools/github-pages'))
from export import validate_package,image_records
from PIL import Image

package=ROOT/'build/github-pages-wind-ground-loop-v130'
prior_package=ROOT/'build/github-pages-wind-video-v129'
checks=validate_package(package,json.loads((ROOT/'tools/github-pages/config.json').read_text('utf8')))
prior=json.loads((prior_package/'hosting-release.json').read_text('utf8'))
old=json.loads((prior_package/prior['inventory']).read_text('utf8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf8'))['files']
native=[p for p in old if '/native/' in p]
assert len(native)==518
new_uuids=[json.loads((OUT/('art-manifest-'+k+'.json')).read_text('utf8'))['assets'][0]['uuid'] for k in ['eye','tornado']]
replaced=[p for p in native if any(u in p for u in new_uuids)]
assert len(replaced)==2
native=[p for p in native if p not in replaced]
assert all(current.get(p)==old[p] for p in native),'Existing runtime media changed'
records={r['uuid']:r for r in image_records(package)}
new=[]
for kind in ['eye','tornado']:
    report=json.loads((OUT/('art-manifest-'+kind+'.json')).read_text('utf8'))
    asset=report['assets'][0];record=records[asset['uuid']]
    path=record['native'].relative_to(package).as_posix()
    assert path not in old and path in current
    src=Image.open(ROOT/asset['path']).convert('RGBA');encoded=Image.open(package/path).convert('RGBA')
    assert src.size==encoded.size and src.tobytes()==encoded.tobytes(),'Flipbook must export losslessly'
    manifest=json.loads((ROOT/report['assets'][1]['path']).read_text('utf8'))
    assert manifest['frameCount']==48 and manifest['fps']==30
    assert manifest['playbackSpeed']==2
    assert report['sourceFrames']==60 and report['allSourceFramesContribute']
    for i,rect in enumerate(manifest['frames'].values()):
        x,y,w,h=rect;assert w==manifest['cellSize'][0] and h==manifest['cellSize'][1]
        assert 0<=x<x+w<=src.width and 0<=y<y+h<=src.height
        cell=src.crop((x,y,x+w,y+h));a=cell.getchannel('A')
        for box in [(0,0,w,3),(0,h-3,w,h),(0,0,3,h),(w-3,0,w,h)]:assert a.crop(box).getextrema()==(0,0)
    new.append({'kind':kind,'path':path,**current[path],'source':asset['path'],'losslessPixelIdentical':True})
assert len([p for p in current if '/native/' in p])==518
node='C:/Program Files/nodejs/node.exe';syntax=[]
for file in sorted(package.rglob('*.js')):
    result=subprocess.run([node,'--check',str(file)],capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    syntax.append(file.relative_to(package).as_posix())
inline=0
for attrs,script in re.findall(r'<script\b([^>]*)>(.*?)</script>',(package/checks['release']['entry']).read_text('utf8'),re.S|re.I):
    if not script.strip() or 'importmap' in attrs or 'application/json' in attrs:continue
    result=subprocess.run([node,'--check','--input-type=module'],input=script,capture_output=True,text=True)
    assert result.returncode==0,result.stderr;inline+=1
types=json.loads((OUT/'typecheck-comparison.json').read_text('utf8'));assert not types['added']
scope=json.loads((OUT/'verification.json').read_text('utf8'));assert scope['status']=='PASS'
main=next(package.glob('assets/main/index.*.js'));text=main.read_text('utf8')
for marker in ['WindVideoVFX','fx/wind_eye_video_v129','fx/wind_tornado_video_v129']:
    assert marker in text,marker
result={'checks':checks,'baselineRelease':prior['id'],'existingNativeByteIdentical':len(native),'newMedia':new,
    'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,'mainScript':main.relative_to(package).as_posix(),
    'mainSha256':hashlib.sha256(main.read_bytes()).hexdigest(),'typeDiagnosticsBefore':types['beforeDiagnostics'],
    'typeDiagnosticsCurrent':types['currentDiagnostics'],'gameEngineBrowserCombatAudioOrWasmStarted':False,'phoneReview':'pending user'}
(OUT/'package-static-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n','utf8')
(OUT/'build-record.json').write_text((ROOT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf8')
console=OUT/'export-console.txt';raw=console.read_text('utf-8-sig')
(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf8');console.unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
    'nativeByteIdentical':len(native),'newMedia':len(new),'jsSyntaxChecks':len(syntax),'inlineSyntaxChecks':inline,'newDiagnostics':0}))
