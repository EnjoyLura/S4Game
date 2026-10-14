from pathlib import Path
from datetime import datetime
import argparse
import json

ROOT=Path(__file__).resolve().parent
GAME=ROOT.parents[1]
ap=argparse.ArgumentParser()
ap.add_argument('--deployment',required=True)
ap.add_argument('--uploaded',type=int,required=True)
ap.add_argument('--cached',type=int,required=True)
ap.add_argument('--upload-seconds',type=float,required=True)
args=ap.parse_args()
stage=json.loads((ROOT/'deployment-stage.json').read_text(encoding='utf-8-sig'))
characters=[]
for hero in ['sniper','volt']:
    folder=GAME/'docs/hero-idle-subtle-v2'/hero
    data=json.loads((folder/'packaging.json').read_text(encoding='utf-8'))
    data['gameIntegrated']=True
    (folder/'packaging.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    characters.append(data)
record={**stage,'status':'published','deployment':args.deployment,
    'date':datetime.now().isoformat(timespec='seconds'),'timezone':'Asia/Shanghai',
    'previousLoopSeconds':4,'newLoopSeconds':4/1.3,'speedMultiplier':1.3,
    'characters':characters,'animationAcceptedByUser':False,
    'unchanged':'Frame pixels and order, small amplitude, stance, grip, painted scale, foot pivot, archer and attack timing',
    'preview':'Canvas reads actual manifest duration; GIF frame durations shortened at the same ratio',
    'build':{'creator':'3.8.8','platform':'web-mobile','exitCode':36,'milliseconds':10503,
        'finishedLocal':'2026-10-14 00:18:21','log':'C:/Users/user/AppData/Local/Temp/kw-hero-idle-speed-v1-20261014-out.log'},
    'dprPatch':'completed','publication':{'tool':'Wrangler3.114.17','exitCode':0,
        'uploaded':args.uploaded,'cached':args.cached,'uploadSeconds':args.upload_seconds},
    'review':'User manual review; no tests, browser, game or online QA executed'}
(ROOT/'release.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
paragraph='2026-10-14 [两位英雄待机速度调整](docs/hero-idle-speed-v1/README.md) 已构建发布：[正式游戏]('+stage['game']+') · [待机对照]('+stage['preview']+')，部署 `'+args.deployment+'`。按用户“速度有点慢”反馈，重弩手与雷法师当前待机统一提速 30%，单轮由 4 秒缩短为 4/1.3≈3.076923 秒，逐帧时长及 GIF 同步缩短，预览进度条读取实际时长。原 9／8 张完整帧、16／14 项帧序、动作幅度、已确认站姿、武器握持、尺寸和脚底均保持；弓箭手及重弩攻击速度保持。制作脚本同步新时长，勿恢复历史四秒循环。Cocos 成功退出码 36、10503ms、DPR 完成，Wrangler main 成功；用户人工查看，未运行测试、浏览器、游戏或线上验收，不将速度反馈当作完整动画认可。详情见 `docs/hero-idle-speed-v1/release.json`。'
for name in ['AGENTS.md','README.md']:
    file=GAME/name
    content=file.read_text(encoding='utf-8')
    if paragraph not in content:
        head,rest=content.split('\n',1)
        file.write_text(head+'\n\n'+paragraph+'\n'+rest,encoding='utf-8')
file=GAME/'docs/hero-idle-subtle-v2/README.md'
content=file.read_text(encoding='utf-8')
head,rest=content.split('\n',1)
note='2026-10-14 最新速度已调整：两位英雄待机统一提速 30%，当前单轮约 3.076923 秒；下文四秒为初版历史值。见 [待机速度调整](../hero-idle-speed-v1/README.md)。'
if note not in content:
    file.write_text(head+'\n\n'+note+'\n'+rest,encoding='utf-8')
file=ROOT/'README.md'
file.write_text(file.read_text(encoding='utf-8')+'\n已发布：[正式游戏]('+stage['game']+') · [待机对照]('+stage['preview']+')。\n',encoding='utf-8')
print(json.dumps({'release':str(ROOT/'release.json'),'game':stage['game'],'preview':stage['preview']},ensure_ascii=False))
