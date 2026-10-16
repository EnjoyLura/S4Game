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
note = (f"2026-10-16 充能修复与交互动画v2已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    '定位上一版Cocos将super getter错误编译为原型getter，读取实例计时器得到NaN，弓/弩/火/雷即使满能量也无法就绪；四处改直接读取受保护实例字段，构建产物已核对无prototype.ultimateRemaining。冰原父getter保持。满能但仍在演出显示施放中，需求能量/回能/伤害/演出时长保持。'
    '三选一仅参考用户录屏节奏，原创440ms轻抬错峰和460ms选择收稳、边角微光，其他纸卡保持不透明覆暗；刷新等美术逐列交接，重复输入与旧回调保护，布局和自有美术保持。'
    '商品余额不足显示精确差额/当前余额、价格区4px轻摆与语义警告音，弹窗保持不扣款不发货；成功仍走原购买。'
    '开始战斗按钮不再显示进入中或busy皮肤，原生持久Canvas的深蓝双旗/金边/盾徽全屏转场；0.34秒合拢并行预载、完整遮挡才换场，等已追踪美术和绘制帧后0.48秒展开，倒计时在过场后开始；后台/适配/减少动态/失败/清理处理。无新媒体。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    '依约不运行测试、模拟、游戏、浏览器或线上验收，实际效果待用户人工确认。详见 [充能修复与交互动画](docs/pick-motion-v2/README.md)。')
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
