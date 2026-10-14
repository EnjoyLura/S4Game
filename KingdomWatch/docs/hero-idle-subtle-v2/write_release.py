"""Save build and publication evidence, without claiming visual acceptance."""
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
    folder=ROOT/hero
    report=json.loads((folder/'packaging.json').read_text(encoding='utf-8'))
    report['gameIntegrated']=True
    (folder/'packaging.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    choice=json.loads((ROOT/(hero+'-motion-selection.json')).read_text(encoding='utf-8'))
    selected=choice['frames'][:choice['end']+1]
    report['selectionRecord']=hero+'-motion-selection.json'
    report['retainedMarkerMotion']=max(row['maximumMarkerDisplacementInGameUnits'] for row in selected)
    report['fullClipMarkerMotion']=max(row['maximumMarkerDisplacementInGameUnits'] for row in choice['frames'])
    report['pixelProcessing']='Unmodified complete original frame pixels; retained source crop, uniform scale and pivot'
    characters.append(report)
record={**stage,'status':'published','date':datetime.now().isoformat(timespec='seconds'),
    'timezone':'Asia/Shanghai','deployment':args.deployment,'characters':characters,
    'staticMastersAcceptedByUser':True,'animationAcceptedByUser':False,
    'newImageGenerated':False,'newVideoSubmitted':False,
    'sourceReuse':'Earlier MiniMax H3 videos retained; only quiet continuous prefixes enter the new idle atlases',
    'unchanged':{'archer':'Images, idle, attack, displayHeight185.64',
                 'sniperAttack':'sniper_stance_attack_v1; same readyHeight467.1111 and displayHeight153',
                 'voltCombat':'Freeze the same current character during casting; new attack frames still pending',
                 'weaponHold':'The two user-approved standing images and grip retained',
                 'gameplay':'Target range, idle gating, pause, projectiles, damage, speed, skills, ultimates and sound'},
    'legacyPreviewUpdated':'previews/hero-stance-rebuild-v1/ now serves the corrected idle content',
    'build':{'creator':'3.8.8','platform':'web-mobile','exitCode':36,'milliseconds':9672,
             'finishedLocal':'2026-10-14 00:10:41','log':'C:/Users/user/AppData/Local/Temp/kw-hero-idle-subtle-v2-20261014-out.log'},
    'dprPatch':'completed',
    'publication':{'tool':'Wrangler3.114.17','exitCode':0,'uploaded':args.uploaded,
                   'cached':args.cached,'uploadSeconds':args.upload_seconds},
    'review':'Frame selection for production only. User manually reviews effects. No tests, browser, game or online QA; static-image acceptance does not imply animation acceptance.'}
(ROOT/'release.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
paragraph='2026-10-14 用户确认重弩手／雷法师新站姿图片可以，明确否定前轮待机的夸张、奇怪身体动作；[待机幅度修正 v2](docs/hero-idle-subtle-v2/README.md) 已接入并构建发布：[正式游戏]('+stage['game']+') · [新版对照预览]('+stage['preview']+')，部署 `'+args.deployment+'`。沿用已确认图片、武器握持与原 H3 视频，未生成新图片或提交新视频任务；重新筛选安静连续开头段，重弩手仅保留源帧 0–8（9 张完整帧／16 项四秒时序），雷法师保留 0–7（8 张／14 项四秒时序），明显抬肩、扭腰、挪动手臂的后段不再入图集。新资源 `sniper_idle_subtle_v2`／`volt_idle_subtle_v2` 完全保留原帧像素、固定取景、缩放、脚底 `(256,496)` 与高度 153／146；不拆身、不局部形变、不逐帧重新缩放、不加透明度切换。重弩攻击 `sniper_stance_attack_v1`、弓箭手图片／待机／攻击及高度 185.64 保留。旧 `hero-stance-rebuild-v1` 预览入口同时更新到本版。源帧参考图块位移预算仅用于制作范围选择，不等同全身效果验收。Cocos 成功退出码 36、9672ms、DPR 完成，Wrangler main 成功。图片认可不代表新动画已认可；用户人工查看，未运行测试、浏览器、游戏或线上验收。详情见 `docs/hero-idle-subtle-v2/release.json`。'
for name in ['AGENTS.md','README.md']:
    file=GAME/name
    content=file.read_text(encoding='utf-8')
    if paragraph not in content:
        head,rest=content.split('\n',1)
        file.write_text(head+'\n\n'+paragraph+'\n'+rest,encoding='utf-8')
file=ROOT/'README.md'
file.write_text(file.read_text(encoding='utf-8')+'\n已构建发布：[正式游戏]('+stage['game']+') · [轻微待机对照]('+stage['preview']+')，部署 '+args.deployment+'。\n',encoding='utf-8')
print(json.dumps({'release':str(ROOT/'release.json'),'game':stage['game'],'preview':stage['preview']},ensure_ascii=False))
