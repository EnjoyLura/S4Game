"""Static release inspection; never executes game code or WASM."""
import hashlib,json,re,subprocess,sys
from pathlib import Path

OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
BASE='4d7c7501'
PATH='assets/resources/fx/wind_eye_video_v129.frames.json'
PACKAGE=ROOT/'build/github-pages-wind-eye-mid-v133'
PRIOR=ROOT/'build/github-pages-sword-jade-v132'
sys.path.insert(0,str(ROOT/'tools/github-pages'))
from export import validate_package,image_records

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def find_clip(value):
    if isinstance(value,dict):
        if value.get('framePrefix')=='eye_':return value
        children=value.values()
    elif isinstance(value,list):children=value
    else:return None
    for child in children:
        hit=find_clip(child)
        if hit:return hit
    return None

before=json.loads(subprocess.check_output(['git','show',BASE+':KingdomWatch/'+PATH],cwd=ROOT,text=True))
current=json.loads((ROOT/PATH).read_text('utf8'))
assert before['displayHeightScale']==.58 and before['displayOffsetY']==-18
expected={**before,'displayHeightScale':.8,'displayOffsetY':-9}
assert current==expected
changed=subprocess.check_output(['git','diff','--name-only',BASE,'--','assets'],cwd=ROOT,text=True).splitlines()
assert changed==['KingdomWatch/'+PATH],changed
preview=json.loads((ROOT/'docs/eye-mid-projection-preview-v131/preview-report.json').read_text('utf8'))
assert sha(ROOT/'assets/resources/fx/wind_eye_video_v129.png')==preview['atlas']['sha256']
proposal=preview['selectedForProposalPreviewOnly']
assert current['displayHeightScale']==proposal['height'] and current['displayOffsetY']==proposal['offsetY']
checks=validate_package(PACKAGE,json.loads((ROOT/'tools/github-pages/config.json').read_text('utf8')))
old_release=json.loads((PRIOR/'hosting-release.json').read_text('utf8'))
old=json.loads((PRIOR/old_release['inventory']).read_text('utf8'))['files']
new=json.loads((PACKAGE/checks['release']['inventory']).read_text('utf8'))['files']
native={p:v for p,v in old.items() if '/native/' in p}
assert native and {p:v for p,v in new.items() if '/native/' in p}==native
compiled=[]
for file in (PACKAGE/'assets/resources/import').rglob('*.json'):
    if b'eye_' not in file.read_bytes():continue
    clip=find_clip(json.loads(file.read_text('utf8')))
    if clip is not None:
        assert clip==current
        compiled.append({'path':file.relative_to(PACKAGE).as_posix(),'sha256':sha(file)})
assert len(compiled)==1
image_uuid=json.loads((ROOT/'assets/resources/fx/wind_eye_video_v129.png.meta').read_text('utf8'))['uuid']
record=next(r for r in image_records(PACKAGE) if r['uuid']==image_uuid)
image_path=record['native'].relative_to(PACKAGE).as_posix()
node='C:/Program Files/nodejs/node.exe';syntax=[]
for file in sorted(PACKAGE.rglob('*.js')):
    subprocess.run([node,'--check',str(file)],capture_output=True,text=True,check=True)
    syntax.append(file.relative_to(PACKAGE).as_posix())
inline=0
for attrs,script in re.findall(r'<script\b([^>]*)>(.*?)</script>',(PACKAGE/checks['release']['entry']).read_text('utf8'),re.S|re.I):
    if not script.strip() or 'importmap' in attrs or 'application/json' in attrs:continue
    subprocess.run([node,'--check','--input-type=module'],input=script,capture_output=True,text=True,check=True);inline+=1
main=next(PACKAGE.glob('assets/main/index.*.js'));main_path=main.relative_to(PACKAGE).as_posix()
assert new[main_path]==old[main_path],'Script content must remain unchanged'
result={'checks':checks,'sourceBaseline':BASE,'baselineRelease':old_release['id'],
    'approvedPreviewParameterMatch':True,'sourceAssetChanges':changed,'existingNativeByteIdentical':len(native),
    'noAddedMedia':True,'mainScriptByteIdentical':True,'compiledEyeManifest':compiled[0],
    'eyeAtlas':{'path':image_path,'sha256':new[image_path]['sha256']},
    'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,
    'gameBrowserBattleAudioOrWasmStarted':False}
(OUT/'package-static-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n','utf8')
(OUT/'build-record.json').write_text((ROOT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf8')
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
    'unchangedNative':len(native),'compiledEyeMatchesApprovedPreview':True,'jsSyntax':len(syntax),'inlineSyntax':inline}))
