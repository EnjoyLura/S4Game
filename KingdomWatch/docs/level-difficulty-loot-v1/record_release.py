"""Record successful compiler/publisher receipts. Does not execute or access the game."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import hashlib
import json
import re

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

stage, build = read(OUT / 'deployment-stage.json'), read(OUT / 'build-record.json')
log = (OUT / 'publish.log').read_text(encoding='utf-8-sig')
deployments = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', log)
uploaded = re.search(r'Uploaded (\d+) files \((\d+) already uploaded\)', log)
if not deployments or not uploaded:
    raise RuntimeError('A successful publication receipt is required')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
integration = read(OUT / 'integration.json')
integration.update(status='published', game=stage['game'], deployment=deployments[-1])
integration['validation'].update(cocosBuild=True, DPRPatch=True, localBundleInspection=True)
write(OUT / 'integration.json', integration)
write(OUT / 'release.json', {**stage, **integration,
    'date': datetime.now(timezone(timedelta(hours=8))).isoformat(), 'build': build,
    'creatorBuildMilliseconds': milliseconds,
    'mainBundleSha256': hashlib.sha256((Path(stage['stage']) / 'assets/main/index.js').read_bytes()).hexdigest(),
    'deploymentSucceeded': True, 'uploadedFiles': int(uploaded[1]), 'cachedFiles': int(uploaded[2])})
note = (f"2026-10-16 三档关卡与战斗装备掉落v1已构建发布：[正式游戏]({stage['game']})，部署 `{deployments[-1]}`。"
    '普通10波、精英12波、地狱15波，普通原怪物表保留，精英和地狱插入骑兵/投石/萨满/精英组合，原逐波阶梯保持；金币倍率1/1.5/2.2、固定通关材料和独立星级奖励按关卡递进。'
    '精英普通怪0.10%/精英怪0.80%，地狱0.18%/1.44%装备击杀掉落，越后关卡蓝紫装备池占比提高；普通不掉装备，GM直接击杀排除。'
    '复用背包真实装备插画，身体抛出480ms、落地轻跳240ms，品质圈/柔光柱/8短光，固定86px点击区；点击或30个战斗秒自动拾取，480ms弧线飞背包并吸收回弹碎光，既有授权软确认音，暂停/选卡冻结、倍速随战斗，减少动态缩短运动。'
    '拾取先按UID保存仓库再播放动画，不自动穿戴；胜负/主动离场收回剩余装备，失败复活保留，不重复发奖，32件同屏上限先回收最老物品。'
    '关卡奖励区390–460高，新增掉落/星级宝箱页签及概率和装备池详情，取代旧316–420高度；结算材料/装备数量和聚合清单，广告只双倍金币。修复先领高星箱漏低档，累积发放未领档，原已领记录保持。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    '依约仅源码和本地构建产物审阅，不运行测试、模拟、游戏、浏览器或线上验收；视觉、音效、交互和难度平衡待用户人工确认。详见 [三档关卡与装备掉落](docs/level-difficulty-loot-v1/README.md)。')
for name in ['AGENTS.md', 'README.md']:
    path = GAME / name
    source = path.read_text(encoding='utf-8-sig')
    if stage['game'] not in source:
        at = source.index('\n')
        path.write_text(source[:at+1] + '\n' + note + '\n' + source[at+1:], encoding='utf-8')
readme = OUT / 'README.md'
if stage['game'] not in readme.read_text(encoding='utf-8'):
    with readme.open('a', encoding='utf-8') as f:
        f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployments[-1]})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成。实际效果待人工确认。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployments[-1], milliseconds=milliseconds)))
