from pathlib import Path
from datetime import datetime, timedelta, timezone
import argparse, json, re

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parent.parent
def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path,value):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
ap=argparse.ArgumentParser()
ap.add_argument('--deployment',required=True)
ap.add_argument('--uploaded',type=int,required=True)
ap.add_argument('--cached',type=int,required=True)
ap.add_argument('--upload-seconds',type=float,required=True)
ap.add_argument('--build-exit',type=int,required=True)
ap.add_argument('--build-log',required=True)
ap.add_argument('--publish-attempts',type=int,default=1)
args=ap.parse_args()
log=Path(args.build_log).read_text(encoding='utf-8-sig',errors='replace')
milliseconds=int(re.findall(r'build-project-total \((\d+)ms\)',log)[-1])
production=read(ROOT/'production.json')
release=read(ROOT/'deployment-stage.json')
release.update(status='published',deployment=args.deployment,
    date=datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds'),
    production=production,animationAcceptedByUser=False,
    build={'creator':'3.8.8','platform':'web-mobile','exitCode':args.build_exit,'milliseconds':milliseconds,'log':args.build_log},
    publication={'tool':'Wrangler3.114.17','exitCode':0,'attempts':args.publish_attempts,'uploaded':args.uploaded,'cached':args.cached,'uploadSeconds':args.upload_seconds},
    dprPatch='completed',
    retained={'sniperIdle':'sniper_idle_natural_v2','voltIdle':'volt_idle_natural_v1','voltIdleAcceptedByUser':True,
              'archer':'media/actions and height 185.64 retained','displayHeight':{'sniper':153,'volt':146}},
    sourceProduction='First generated takes rejected for baked-in effects; complete replacement sources retained',
    review='Source production only; user manual effect review; no tests, browser, game or online QA')
write(ROOT/'release.json',release)
for hero in ['sniper','volt']:
    write(GAME/'docs'/f'{hero}-attack-natural-v1/release.json',{**release,'releaseRoot':'../hero-attack-natural-v1/release.json'})
paragraph=(f"2026-10-14 [重弩手与雷法师完整攻击](docs/hero-attack-natural-v1/README.md) 已构建发布："
    f"[正式游戏]({release['game']}) · [双英雄攻击／待机切换预览]({release['preview']})，部署 `{args.deployment}`。"
    "两段源视频来自当前待机第一帧，沿用确认站姿与握持；首轮烘焙特效源片拒绝发布，重新生成完整动作。"
    f"正式攻击资源 `sniper_attack_natural_v1`／`volt_attack_natural_v1`，分别 {production['sniper']['uniqueFrames']}／{production['volt']['uniqueFrames']} 张完整源帧全程正向播放，"
    "不倒放、不裁短、不透明度过渡；统一固定比例和脚底，高度 153／146。实际普攻、连锁和大招出手回调触发释放，攻击与自然收势优先，空闲回到待机首帧。"
    "两位英雄当前待机视频、图集和时长及弓箭手保持，雷法师待机认可继续有效。"
    f"Cocos 成功退出码 {args.build_exit}、{milliseconds}ms，DPR 完成，Wrangler main 成功；用户人工查看，未运行测试、游戏、浏览器或线上验收，新攻击动画尚未获认可。"
    "详情见 `docs/hero-attack-natural-v1/release.json`。")
for name in ['AGENTS.md','README.md']:
    path=GAME/name
    heading,rest=path.read_text(encoding='utf-8-sig').split('\n',1)
    path.write_text(heading+'\n\n'+paragraph+'\n'+rest,encoding='utf-8')
with (ROOT/'README.md').open('a',encoding='utf-8') as file:
    file.write(f"\n已发布：[双英雄攻击／待机预览]({release['preview']}) · [正式游戏]({release['game']})。\n")
print(json.dumps({'game':release['game'],'preview':release['preview'],'deployment':args.deployment},ensure_ascii=False))
