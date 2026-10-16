"""Store successful build/publication receipts; user performs gameplay acceptance."""
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
note = (f"2026-10-16 入场美术与三选一反馈v2已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    '内置image_gen原创蓝钢木材金饰双扇城门，原图完整复制、两半SpriteFrame等比覆盖；提示词和原图来源见记录，商业游戏录屏仅离线参考节奏。'
    '入场合拢240ms、最短闭合60ms、展开320ms，温缓存动作约620ms另有场景交接，冷加载不保证固定耗时。大厅优先门图、关卡页预载背景防线与上阵待机缓存；首屏关键美术及绘制帧交接，非关键图标不阻塞，场景建好后美术等待封顶900ms沿用既有兜底，准备倒计时仍等过场结束。'
    '火坑基础半径88→114.4，直径+30%面积+69%，美术与真实持续灼烧/易伤范围同步，分散落点间距适配；瞬间爆炸140、伤害颗数及4秒寿命保持。预警改同一固定落点的柔边深色影子，随真实飞行进度加深放大、实际接地撤除。五英雄大招移除全屏压暗，局部光和节拍保持。'
    '三选一选择480ms压下回弹、抬高与金边碎光及同步确认音；刷新520ms错峰收旧发新、准备好美术后同帧不透明交接、弹性及边缘扫光与音效，无翻空白。全部卡描述按效果代价条件层数手动分行，18px/25px行高，关闭自动换行并缩字兜底；卡效果品质权重不改。重复输入、暂停/后台/减少动态与回调有效性保护保留。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    '依约仅源码与构建产物审阅，不运行测试、模拟、游戏、浏览器或线上验收，实际视觉与手感由用户人工确认。详见 [入场美术与三选一反馈](docs/battle-entry-art-v2/README.md)。')
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    content = path.read_text(encoding='utf-8-sig')
    if stage['game'] not in content:
        at = content.index('\n')
        path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:], encoding='utf-8')
readme = OUT/'README.md'
if stage['game'] not in readme.read_text(encoding='utf-8'):
    with readme.open('a', encoding='utf-8') as f:
        f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成。实际效果待用户人工确认。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
