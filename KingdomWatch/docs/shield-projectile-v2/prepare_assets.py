"""Copy four built-in ImageGen outputs intact and prepare the Creator release."""
from pathlib import Path
import copy
import hashlib
import json
import shutil
import uuid
from PIL import Image

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p, value):
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

inputs = read(OUT/'generation-inputs.json')
template = read(GAME/'assets/resources/fx/archer_v1.png.meta')
assets = []
for item in inputs['assets']:
    key = item['id']
    source = Path(item['source'])
    (OUT/'sources').mkdir(exist_ok=True)
    (OUT/'prompts').mkdir(exist_ok=True)
    shutil.copy2(source, OUT/'sources'/f'{key}.png')
    prompt_path = OUT/'prompts'/f'{key}.txt'
    prompt_path.write_text(item['prompt'], encoding='utf-8')
    target = GAME/'assets/resources/fx'/f'basic_launch_v2_{key}.png'
    shutil.copy2(source, target)
    with Image.open(target) as im:
        width, height = im.size
        mode = im.mode
        bounds = im.getchannel('A').getbbox() if mode == 'RGBA' else None
    meta_path = Path(str(target)+'.meta')
    asset_uuid = read(meta_path)['uuid'] if meta_path.exists() else str(uuid.uuid4())
    meta = json.loads(json.dumps(template).replace(template['uuid'], asset_uuid).replace('archer_v1', target.stem))
    sf = meta['subMetas']['f9941']['userData']
    sf.update(trimThreshold=1, rotated=False, offsetX=0, offsetY=0, trimX=0, trimY=0,
        width=width, height=height, rawWidth=width, rawHeight=height, packable=False, trimType='none')
    sf['vertices'] = {
        'rawPosition':[-width/2,-height/2,0,width/2,-height/2,0,-width/2,height/2,0,width/2,height/2,0],
        'indexes':[0,1,2,2,1,3],
        'uv':[0,height,width,height,0,0,width,0],
        'nuv':[0,0,1,0,0,1,1,1],
        'minPos':[-width/2,-height/2,0], 'maxPos':[width/2,height/2,0]}
    write(meta_path, meta)
    assets.append({'id':key,'source':str(source),'workspaceSource':str(OUT/'sources'/f'{key}.png'),
        'asset':str(target),'prompt':str(prompt_path),'width':width,'height':height,'mode':mode,
        'alphaBounds':bounds,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
        'sourcePixelsAndAlphaPreserved':True})
write(OUT/'generation.json',{'mode':'built-in image_gen','imageTasks':4,'videoTasks':0,
    'noOtherGameArtworkSubmittedToModel':True,'assets':assets})

previous = GAME/'docs/basic-launch-v1'
scope = 'blue shield shell, stacked HP/shield values, raised health and ult icons; painted basic releases and elemental flight wakes'
old_scope = 'five hero basic projectile releases: bow/crossbow wind pressure, fire jet, violet lightning and frost crystals'
for name in ['build_game.ps1','publish.ps1']:
    text = (previous/name).read_text(encoding='utf-8-sig')
    text = text.replace('kwBasicLaunch','kwShieldProjectile').replace('basic-launch-v1','shield-projectile-v2')
    text = text.replace(old_scope,scope).replace('layoutChanged = $false','layoutChanged = $true')
    if name == 'publish.ps1':
        text = text.replace('docs/pick-comic-v1/deployment-stage.json','docs/basic-launch-v1/deployment-stage.json')
    (OUT/name).write_text(text,encoding='utf-8')
write(OUT/'integration.json',{'status':'source integrated, build pending','scope':scope,
    'healthBar':{'bottom':212,'previousBottom':198,'raisedDesignPixels':14,'width':640,'height':18},
    'shield':{'display':'hollow blue chamfered band outside the complete HP track','outerSize':[652,30],
        'innerSize':[644,22],'widthFraction':'shield/maxHp, clamped 0..1','zero':'outline hidden, numeric value 0 retained',
        'values':'right aligned above track, heart/HP first row, shield/value second row'},
    'ultimate':{'previousBottom':240,'bottom':340,'step':110,'compactUnlockedSlots':True},
    'launch':{'renderer':'four intact painted sprites plus original native moving pressure fronts',
        'pool':36,'newNodesPerAttack':0,'lifetimeSeconds':{'archer':.32,'sniper':.36,'pyro':.36,'volt':.30,'mora':.38},
        'sourceOrigin':'same actual projectile origin and normalized aim direction','fan':'once per row, serial rows each release'},
    'flight':{'renderer':'one additional Graphics, before painted body sprites',
        'distanceBased':True,'basicOnly':True,'empoweredArcherBasicIncluded':True,
        'trailLengths':{'archer':126,'sniper':146,'pyro':112,'volt':118,'mora':136},
        'details':{'archer':'fine wind lines and tiny warm glints','sniper':'thicker pale-blue airflow',
            'pyro':'orange tapered wake and backward-flowing embers','volt':'violet wake and paired branching arcs',
            'mora':'blue tapered frost wake and small faceted crystals'},
        'clock':'simulation age/velocity; no render-frame random phase'},
    'retained':['hero images/idle/attack media and sizes','projectile bodies, speed, aim and collision',
        'damage, attack speed, skills and ultimates','hit effects, sounds, pause/pick/settlement UI'],
    'imageGenerationMode':'built-in image_gen','newImageTasks':4,'newVideoTasks':0,
    'gameplayTestsRun':False,'browserValidationRun':False,'onlineValidationRun':False,'userVisualAccepted':False})
print(json.dumps({'assets':len(assets),'releaseScriptsPrepared':True,'alphaModes':[a['mode'] for a in assets]}))
