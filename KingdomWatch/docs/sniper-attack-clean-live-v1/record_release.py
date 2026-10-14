from pathlib import Path
from datetime import datetime,timezone,timedelta
import argparse,json,re

ROOT=Path(__file__).resolve().parent
GAME=ROOT.parent.parent
ap=argparse.ArgumentParser()
ap.add_argument('--deployment',required=True)
ap.add_argument('--uploaded',type=int,required=True)
ap.add_argument('--cached',type=int,required=True)
ap.add_argument('--upload-seconds',type=float,required=True)
ap.add_argument('--attempts',type=int,default=1)
args=ap.parse_args()
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
build=read(ROOT/'build-record.json')
log=Path(build['log']).read_text(encoding='utf-8-sig',errors='replace')
milliseconds=int(re.findall(r'build-project-total \((\d+)ms\)',log)[-1])
integration=read(ROOT/'integration.json')
integration['status']='published'
write(ROOT/'integration.json',integration)
release=read(ROOT/'deployment-stage.json')
release.update(status='published',deployment=args.deployment,date=datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds'),
    integration=integration,previewOnly=False,gameAttackChanged=True,selectedForGameByUser=True,gameVisualAcceptedByUser=False,
    build={**build,'creator':'3.8.8','platform':'web-mobile','milliseconds':milliseconds},
    publication={'tool':'Wrangler 3.114.17','exitCode':0,'attempts':args.attempts,'uploaded':args.uploaded,'cached':args.cached,'uploadSeconds':args.upload_seconds},
    retained={'sniperIdle':'sniper_idle_natural_v2','archer':'existing media, actions and height 185.64',
              'volt':'existing idle/attack media, timing and height 146'},
    review='User manual game review; no tests, game, browser or online QA')
write(ROOT/'release.json',release)
media=GAME/'docs/sniper-attack-clean-v1'
live={'status':'published','gameIntegrated':True,'game':release['game'],'preview':release['preview'],
      'deployment':args.deployment,'liveRelease':'../sniper-attack-clean-live-v1/release.json',
      'selectedForGameByUser':True,'gameVisualAcceptedByUser':False}
write(media/'game-release.json',live)
for name in ['processing.json','packaging.json']:
    record=read(media/name)
    record.update(gameIntegrated=True,previewOnly=False,game=release['game'],selectedForGameByUser=True)
    write(media/name,record)
paragraph=(f"2026-10-14 用户要求将清理后的重弩手攻击应用到游戏，[正式接入](docs/sniper-attack-clean-live-v1/README.md) 已构建发布："
    f"[正式游戏]({release['game']}) · [原片／清理后预览]({release['preview']})，部署 `{args.deployment}`。"
    "重弩手攻击引用从 `sniper_attack_natural_v1` 更换为 `sniper_attack_clean_v1`，56 帧完整正向准备、释放、上弩、回正，实际发弹回调触发，收势时长沿用攻速适配。"
    "保持当前待机 `sniper_idle_natural_v2`、画内基准 467.1111、脚底 `(256,496)`、高度 153，全不透明直接换帧并整图镜像。"
    "攻击或收势时不播放待机；自身攻击范围内无目标、无排队攻击且动作结束后恢复待机。"
    f"伤害、攻速、弹道、音效、弓箭手和雷法师保持。Cocos 成功退出码 {build['exitCode']}、{milliseconds}ms，DPR 完成，Wrangler main 成功；用户人工查看，不运行测试、游戏、浏览器或线上验收，未记录游戏视觉已获认可。"
    "此条替代此前该清理版仅作预览、正式游戏未替换的状态。")
for name in ['AGENTS.md','README.md']:
    path=GAME/name
    heading,rest=path.read_text(encoding='utf-8-sig').split('\n',1)
    path.write_text(heading+'\n\n'+paragraph+'\n'+rest,encoding='utf-8')
with (ROOT/'README.md').open('a',encoding='utf-8') as file:
    file.write(f"\n已发布：[正式游戏]({release['game']}) · [素材对照]({release['preview']})。构建 {milliseconds}ms，Cocos 退出码 {build['exitCode']}，DPR 完成，Wrangler main 成功。\n")
with (media/'README.md').open('a',encoding='utf-8') as file:
    file.write(f"\n更新：用户要求正式应用，本版已接入并构建发布：[正式游戏]({release['game']})。详见 `../sniper-attack-clean-live-v1/release.json`；上方仅预览、未替换游戏的说明为前一阶段历史状态。\n")
print(json.dumps({'game':release['game'],'preview':release['preview'],'deployment':args.deployment},ensure_ascii=False))
