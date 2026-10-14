from pathlib import Path
from datetime import datetime, timezone, timedelta
import argparse, json

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
release=read(ROOT/'deployment-stage.json')
release.update(status='published',deployment=args.deployment,date=datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds'),
    motionAcceptedByUser=True,cleanupAcceptedByUser=False,previewOnly=True,gameAttackChanged=False,
    packaging=read(ROOT/'packaging.json'),processing=read(ROOT/'processing.json'),
    build={'preview':'Completed original/cleaned atlases, frame manifest, synchronized video and GIF, HTML controls',
           'cocosRebuild':False,'gameStage':'Preserved previous complete published build'},
    publication={'tool':'Wrangler 3.114.17','branch':'main','exitCode':0,'uploaded':args.uploaded,'cached':args.cached,
                 'uploadSeconds':args.upload_seconds,'attempts':args.attempts},
    review='Local source production only; user manual cleanup review; no game, browser, tests or online QA')
write(ROOT/'release.json',release)
origin=read(GAME/'docs/sniper-attack-user-v1/source-origin.json')
origin.update(cleanupTrial='../sniper-attack-clean-v1',effectsCleanedForPreview=True,cleanupAcceptedByUser=False,integrated=False,preview=release['preview'])
write(GAME/'docs/sniper-attack-user-v1/source-origin.json',origin)
paragraph=(f"2026-10-14 用户认可 `Downloads/video.mp4` 重弩攻击并要求试着去掉枪焰和灰尘。"
    f"[去特效试做](docs/sniper-attack-clean-v1/README.md) 已制作并发布 [原片／清理后同步预览]({release['preview']})，部署 `{args.deployment}`。"
    "56 帧、24fps、约 2.333333 秒原时序全部保留；内置 imagegen 修复第 7–9 帧局部弩头，背景火星和烟尘在限定区域按连通人物轮廓排除。"
    "完整视频、RGBA 序列、共享尺度 512×512 图集、镜像 GIF 和同步对照均已生成，人物高度仍为 153。"
    "此轮为试做对照，正式游戏攻击引用未替换；基于此前已发布目录只新增预览，未重建 Cocos 游戏，不改当前待机、弓箭手或雷法师。"
    "原动作认可不等于本次清理已认可，待用户人工查看；未运行游戏、浏览器、测试或线上验收。详情 `docs/sniper-attack-clean-v1/release.json`。")
for name in ['AGENTS.md','README.md']:
    path=GAME/name
    heading,rest=path.read_text(encoding='utf-8-sig').split('\n',1)
    path.write_text(heading+'\n\n'+paragraph+'\n'+rest,encoding='utf-8')
with (ROOT/'README.md').open('a',encoding='utf-8') as file:
    file.write(f"\n已发布：[同步对照预览]({release['preview']})。清理后本地视频 `attack-cleaned.mp4`，使用内置 imagegen 的提示词保存在 `../sniper-attack-user-v1/weapon-repair-prompt.txt`。\n")
with (GAME/'docs/sniper-attack-user-v1/README.md').open('a',encoding='utf-8') as file:
    file.write(f"\n后续试做已完成局部去特效并发布对照：[清理后试做预览]({release['preview']})。原视频仍完整保留，正式游戏未替换，本次清理效果待用户查看。\n")
print(json.dumps({'preview':release['preview'],'deployment':args.deployment,'gameChanged':False},ensure_ascii=False))
