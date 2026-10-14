"""Record build/publication evidence after Wrangler finishes successfully."""
from pathlib import Path
import argparse
import json
from datetime import datetime

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[1]
ap = argparse.ArgumentParser()
ap.add_argument('--deployment', required=True)
ap.add_argument('--uploaded', type=int, required=True)
ap.add_argument('--cached', type=int, required=True)
ap.add_argument('--upload-seconds', type=float, required=True)
args = ap.parse_args()
stage = json.loads((ROOT/'deployment-stage.json').read_text(encoding='utf-8-sig'))
characters = []
for folder, kind in [('sniper-stance-idle-v3','idle'), ('volt-stance-idle-v2','idle'), ('sniper-stance-attack-v1','attack')]:
    directory = GAME/'docs'/folder
    task = json.loads((directory/'video-task.json').read_text(encoding='utf-8'))
    packaged = json.loads((directory/'packaging.json').read_text(encoding='utf-8'))
    manifest = json.loads((directory/f'{kind}.frames.json').read_text(encoding='utf-8'))
    packaged['gameIntegrated'] = True
    (directory/'packaging.json').write_text(json.dumps(packaged,ensure_ascii=False,indent=2),encoding='utf-8')
    item = {'folder':folder, 'kind':kind, 'hero':manifest['hero'], 'task':task,
        'image':'ready-red.png', 'imageTool':'built-in imagegen',
        'sourceBytes':(directory/'source.mp4').stat().st_size,
        'source':{k:v for k,v in manifest['source'].items() if k!='redFieldPerFrame'},
        'resource':packaged['resource'], 'uniqueFrames':packaged['uniqueFrames'],
        'timelineFrames':packaged['timelineFrames'], 'seconds':manifest['animation']['seconds'],
        'atlas':packaged['atlas'], 'atlasBytes':packaged['atlasBytes'],
        'groundAnchor':manifest['groundAnchor'], 'displayHeight':manifest['displayHeight'],
        'readyHeightPx':manifest['readyHeightPx'], 'processing':manifest['processing'],
        'gameIntegrated':True, 'userAccepted':False}
    if kind=='attack':
        item['releaseIndex']=manifest['animation']['releaseIndex']
        item['recoverySeconds']=manifest['animation']['recoverySeconds']
        item['selection']='selection.json'
    else:
        item['generation']='generation.json'
        item['imagePrompt']='image-prompt.txt'
    item['motionPrompt']=kind+'-prompt.txt'
    item['game']=stage['game']
    item['preview']=stage['preview']
    item['deployment']=args.deployment
    (directory/'release.json').write_text(json.dumps(item,ensure_ascii=False,indent=2),encoding='utf-8')
    characters.append(item)
release = {'date':datetime.now().isoformat(timespec='seconds'), 'timezone':'Asia/Shanghai',
    'status':'published', **stage, 'deployment':args.deployment,
    'characters':characters, 'archer':'Current images, idle and attack retained; displayHeight185.64',
    'runtime':{'sniper':'New idle and small matching complete-frame attack use one painted height and foot pivot',
        'volt':'New idle; freeze same character during in-range combat/casting; new attack sequence remains for later work',
        'idleCondition':'No live in-range enemy, no queued shot, attack or recovery; existing game delta/pause behavior retained',
        'facing':'Whole-character direct horizontal mirror', 'transition':'One full-opacity sprite; no crossfade or body deformation',
        'footNode':[0,-76]},
    'build':{'creator':'3.8.8', 'platform':'web-mobile', 'exitCode':36, 'milliseconds':13120,
        'finishedLocal':'2026-10-13 23:53:25',
        'log':'C:/Users/user/AppData/Local/Temp/kw-hero-stance-v1-20261013-out.log'},
    'dprPatch':'completed',
    'publication':{'tool':'Wrangler3.114.17', 'exitCode':0, 'uploaded':args.uploaded,
        'cached':args.cached, 'uploadSeconds':args.upload_seconds},
    'review':'User manual review. Source-range annotation for production only. No tests, game, browser or online QA; no effect acceptance inferred.',
    'stanceReference':'docs/archer-idle-v1/frames/idle-00.png',
    'firstFrameDeployment':'https://3db5fc14.kw-vfx-src.pages.dev'}
(ROOT/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2),encoding='utf-8')
paragraph = '2026-10-13 [重弩手与雷法师站姿、轻微待机重做](docs/hero-stance-rebuild-v1/README.md) 已接入并构建发布：[正式游戏]('+stage['game']+') · [弓箭手对照／镜像预览]('+stage['preview']+')，部署 `'+args.deployment+'`。两位英雄参考当前弓箭手的前后错脚、放松站姿，武器握持保持；两段 H3 两秒请求各返回 56 张完整帧，四秒缓和往返循环，显示高度分别 153／146。重弩手攻击同步改用同一新母版的前 10 张完整帧、小幅受力并按原帧回位，停止使用后段转弩和旧站姿攻击；单图全不透明直接换帧，共享比例和脚底。雷法师交战冻结新人物，其新攻击序列尚待后续。弓箭手原图片、待机、攻击及高度 185.64 保留。原片、图片及实际提示词均在上述制作目录；旧重弩／雷法师站姿和待机已被用户明确否定，不再推断此前图片认可继续适用。Cocos 成功退出码 36、13120ms、DPR 完成，Wrangler main 成功；用户人工查看，未运行测试、游戏、浏览器或线上验收，未记录视觉认可。详情见 `docs/hero-stance-rebuild-v1/release.json`。'
for file in ['AGENTS.md','README.md']:
    path=GAME/file
    text=path.read_text(encoding='utf-8')
    if paragraph not in text:
        head,rest=text.split('\n',1)
        path.write_text(head+'\n\n'+paragraph+'\n'+rest,encoding='utf-8')
readme=ROOT/'README.md'
readme.write_text(readme.read_text(encoding='utf-8')+'\n正式发布：[游戏]('+stage['game']+') · [新站姿与待机对照]('+stage['preview']+')。构建成功退出码 36，DPR 完成，Wrangler main 发布成功，部署 '+args.deployment+'。\n',encoding='utf-8')
print(json.dumps({'release':str(ROOT/'release.json'), 'game':stage['game'], 'preview':stage['preview']},ensure_ascii=False))
