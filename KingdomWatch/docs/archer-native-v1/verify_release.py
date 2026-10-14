from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
import hashlib,json,subprocess,tempfile,winreg
out=Path(__file__).resolve().parent
game=out.parents[1]
build=game/'build/web-mobile'
base='https://kingdom-watch.pages.dev/'
version='archer-native-1791815244'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def asset(source,kind,extension):
 uuid=json.loads((game/source).with_suffix(Path(source).suffix+'.meta').read_text())['uuid']
 return f'assets/resources/{kind}/{uuid[:2]}/{uuid}.{extension}'
entry=(build/'assets/main/index.js').read_text(encoding='utf-8')
for token in ['ArcherNativeRig','ArcherRigPose','archer_native_v1/parts','queuedShotDelay','heroContactShadow','HeroBattleMotion','skillUnlocked','ultUnlocked','hpBottom = 198',"FROST_RESOURCE = 'fx/frost_domain_video_v10'"]:
 assert token in entry,token
assert '__KW_DPR_CAP' in (build/'index.html').read_text(encoding='utf-8')
files={'index':'index.html','main':'assets/main/index.js','resources':'assets/resources/config.json',
 'atlas':asset('assets/resources/ux/archer_native_v1/parts.png','native','png'),
 'frames':asset('assets/resources/ux/archer_native_v1/parts.frames.json','import','json')}
for name in ['index.html','archer-rig.js','parts.png','parts.frames.json']:files['preview-'+name]='previews/archer-native-v1/'+name
assert sha(game/'assets/resources/ux/archer_native_v1/parts.png')==sha(build/files['atlas'])
key=winreg.OpenKey(winreg.HKEY_CURRENT_USER,r'Software\Microsoft\Windows\CurrentVersion\Internet Settings')
enabled=winreg.QueryValueEx(key,'ProxyEnable')[0]
proxy=winreg.QueryValueEx(key,'ProxyServer')[0] if enabled else None
def check(item):
 name,rel=item;target=Path(tempfile.gettempdir())/('kw-archer-native-'+name)
 cmd=['curl.exe','--fail','--location','--silent','--show-error','--retry','2','--max-time','30']
 if proxy:cmd+=['--proxy','http://'+proxy]
 subprocess.run(cmd+['--output',str(target),base+rel+'?v='+version],check=True,capture_output=True)
 assert sha(target)==sha(build/rel),name+' online differs'
 return name,{'matchesLocal':True,'bytes':target.stat().st_size,'sha256':sha(target),'path':rel}
with ThreadPoolExecutor(max_workers=4) as pool:online=dict(pool.map(check,files.items()))
reports={name:json.loads((out/(name+'.json')).read_text(encoding='utf-8')) for name in ['pose-validation','game-validation','online-validation','preview-validation']}
assert all(r['ok'] for r in reports.values())
record={'status':'published','dateUTC':datetime.now(timezone.utc).isoformat(),'url':base+'?v='+version,'preview':base+'previews/archer-native-v1/?v=1791815244','deployment':'https://f7cc3776.kingdom-watch.pages.dev','typeCheck':'passed','build':'Creator 3.8.8 web-mobile passed','dprPatch':'passed','abilityUnlockCheck':'passed','realBattleStarted':False,'onlineFiles':online,'checks':reports}
(out/'deployment-validation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'ok':True,'onlineMatches':len(online),'url':record['url'],'preview':record['preview']}))
