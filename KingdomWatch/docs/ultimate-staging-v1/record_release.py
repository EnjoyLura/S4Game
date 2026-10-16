"""Store build and Wrangler receipts; visual/audio acceptance remains manual."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import hashlib
import json
import re

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

stage, build = read(OUT/'deployment-stage.json'), read(OUT/'build-record.json')
log = (OUT/'publish.log').read_text(encoding='utf-8-sig')
deployments = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', log)
uploaded = re.search(r'Uploaded (\d+) files \((\d+) already uploaded\)', log)
if not deployments or not uploaded:
    raise RuntimeError('Successful Wrangler receipt required')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
deployment = deployments[-1]
integration = read(OUT/'integration.json')
integration.update(status='published', game=stage['game'], deployment=deployment)
write(OUT/'integration.json', integration)
main = Path(stage['stage'])/'assets/main/index.js'
write(OUT/'release.json', {**stage, **integration,
    'date': datetime.now(timezone(timedelta(hours=8))).isoformat(),
    'build': build, 'creatorBuildMilliseconds': milliseconds,
    'mainBundleSha256': hashlib.sha256(main.read_bytes()).hexdigest(),
    'deploymentSucceeded': True, 'uploadedFiles': int(uploaded[1]), 'cachedFiles': int(uploaded[2])})
note = (f"2026-10-15 五英雄大招演出延长v1已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    '弓箭3.4秒起、重弩3秒、雷法4.5秒、火法5秒起、冰法4.2秒，均为战斗时钟基准；追加轮次和远落点按实际延长。'
    '弓0.55秒蓄风后逐排推进，排隔0.52/轮隔1.35；重弩1.1秒扫描收拢持稳、全部蓝色枪线和准星对应真实目标，实际出手压缩波及命中余迹延长。'
    '雷法0.65秒蓄电，15道分3组递进，每组5道，最后组视觉能量加强；完整地圈与脚点对齐保持。'
    '火法0.7秒聚火、0.48秒错峰，保留分散怪群覆盖和固定预警落点、真实接地才爆炸火坑，移动预测同步新延迟。'
    '冰法0.5秒蓄冰后全场一次原伤害，固定128颗全场随机冰雨跨2.8秒、碎冰收尾，既有冰素材和普通技能保持。'
    '共用战斗时钟/暂停，蓄力倍速限制保留至少约半秒；背景暗场取最大不叠加、最多17%，峰值仅世界轻震最多3px，HUD稳定。'
    '既有授权采样增加低通淡入蓄力层，释放和接地时发声、峰值短压BGM；不新增媒体。'
    '三选一保护真实队列/在途大招弹/余韵并保留原2秒缓冲，最后清怪等演出结束结算，自动重弩同链路，25秒冷却持续计时。'
    '伤害公式/倍率/数量/范围保持，但蓄力延迟、分段雷击及眩晕时机确有调整，蓄力暂缓新普攻技能出手。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    '依约不运行测试、模拟、游戏、浏览器或线上验收，实际视觉/听觉与平衡待用户人工确认。详见 [五英雄大招演出](docs/ultimate-staging-v1/README.md)。')
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    content = path.read_text(encoding='utf-8-sig')
    if stage['game'] not in content:
        at = content.index('\n')
        path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:], encoding='utf-8')
readme = OUT/'README.md'
content = readme.read_text(encoding='utf-8')
if stage['game'] not in content:
    with readme.open('a', encoding='utf-8') as f:
        f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成。实际效果待用户人工确认。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
