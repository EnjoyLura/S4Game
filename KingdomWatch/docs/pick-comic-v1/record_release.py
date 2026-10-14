"""Record successful local build and Wrangler receipts, without online QA."""
from pathlib import Path
from datetime import datetime
import json
import re

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
MORA, PYRO = GAME/'docs/mora-actions-user-v1', GAME/'docs/pyro-actions-user-v2'

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(path, value):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')

stage, build = read(OUT/'deployment-stage.json'), read(OUT/'build-record.json')
log = (OUT/'publish.log').read_text(encoding='utf-8-sig')
deployment = re.search(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)',log)
uploaded = re.search(r'Uploaded (\d+) files \((\d+) already uploaded\)',log)
if not deployment or not uploaded:
    raise RuntimeError('Successful Wrangler receipt required')
buildlog = Path(build['log']).read_text(encoding='utf-8-sig')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)',buildlog)[-1])
release = {**stage, **read(OUT/'integration.json'), 'status':'published',
    'date':datetime.now().astimezone().isoformat(),'game':stage['game'],'deployment':deployment[1],
    'build':build,'creatorBuildMilliseconds':milliseconds,'deploymentSucceeded':True,
    'uploadedFiles':int(uploaded[1]),'cachedFiles':int(uploaded[2]),
    'artMode':'built-in imagegen','artPrompts':['prompts/card_base.txt','prompts/title_plate.txt','prompts/header_strip.txt'],
    'mora':read(MORA/'packaging.json'),'pyro':read(PYRO/'packaging.json'),
    'gameplayTestsRun':False,'browserValidationRun':False,'onlineValidationRun':False,
    'visualAcceptance':'pending user manual review',
    'retained':['archer, sniper and volt media','pause and settlement artwork',
        'health/shield display','existing attack-speed bonuses','projectile, effect and damage-per-hit calculations']}
write(OUT/'release.json',release)
for folder in [OUT,MORA,PYRO]:
    integration = read(folder/'integration.json') if (folder/'integration.json').exists() else read(folder/'packaging.json')
    integration.update(status='published',game=stage['game'],deployment=deployment[1],userVisualAccepted=False)
    write(folder/'integration.json',integration)
    if folder != OUT:
        write(folder/'release.json',{**integration,'build':{**build,'milliseconds':milliseconds},
            'receipt':'../pick-comic-v1/release.json','gameplayTestsRun':False,
            'browserValidationRun':False,'onlineValidationRun':False})
    with (folder/'README.md').open('a',encoding='utf-8') as handle:
        handle.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment[1]})。"
            f"Cocos 成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main上传{uploaded[1]}文件、{uploaded[2]}缓存。"
            "效果由用户人工查看，未运行测试、游戏、浏览器或线上验收。\n")
idle_task = read(PYRO/'idle/video-task.json')
note = (f"2026-10-15 三选一原创美术、冰法师双动作、新火法师攻击／待机循环和基础攻速已构建发布："
    f"[正式游戏]({stage['game']})，部署 `{deployment[1]}`。三选一使用内置imagegen独立生成的纸纹底板、细边线及少量角饰，"
    "整组下移56设计像素、短屏限制下移量，原卡片尺寸、字号、图标、刷新按钮宽度差异、动画及回调保留。"
    "冰法师用户第一段为攻击、第二段为待机，资源 `mora_attack_user_v1`／`mora_idle_user_v1`，各56帧完整正向保留。"
    "用户随后否定旧火法师攻击并提供新视频，替换为 `pyro_attack_user_v2`；旧待机首尾跳跃，沿用同一首帧重新请求两秒MiniMax H3 768p，"
    f"任务 `{idle_task['taskId']}`，新资源 `pyro_idle_loop_v2`。完整源帧正向等时保留，不倒放、删帧裁短、长停或透明淡化。"
    "两法师固定画内高468、显示高146、脚底(256,496)，全不透明换帧、整图镜像，实际施法回调触发；"
    "自身攻击范围内无目标、无排队攻击并且收势结束才恢复待机。"
    "按最新要求，重弩手基础普攻0.5次/秒（2秒一次）、火法师和雷法师各1次/秒，战斗配置与属性显示同步；原攻速加成继续生效。"
    "未改已完成的弓箭手、重弩手或雷法师媒体。"
    f"Cocos成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "用户人工查看，不运行测试、游戏、浏览器或线上验收，不把提示词、制作或发布当作视觉认可。"
    "详见 [三选一及发布](docs/pick-comic-v1/README.md)、[冰法师](docs/mora-actions-user-v1/README.md)、[新火法师](docs/pyro-actions-user-v2/README.md)。")
for name in ['AGENTS.md','README.md']:
    path = GAME/name
    text = path.read_text(encoding='utf-8-sig')
    first = text.index('\n')
    path.write_text(text[:first+1]+'\n'+note+'\n'+text[first+1:],encoding='utf-8')
old_pyro = GAME/'docs/pyro-idle-user-v1/README.md'
text = old_pyro.read_text(encoding='utf-8-sig')
first = text.index('\n')
old_pyro.write_text(text[:first+1]+f"\n2026-10-15 更新：用户指出本版待机首尾跳跃并否定旧攻击，新攻击和新生成待机已替换为 `pyro_attack_user_v2`／`pyro_idle_loop_v2` 并[发布]({stage['game']})；本目录保留历史来源，最新状态见 `../pyro-actions-user-v2/README.md`。\n"+text[first+1:],encoding='utf-8')
print(json.dumps({'published':True,'game':stage['game'],'deployment':deployment[1],
    'milliseconds':milliseconds,'baseAttackRatesPerSecond':release['baseAttackRatesPerSecond']},ensure_ascii=True))
