"""Record successful build/publication receipts, without executing the game."""
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
    raise RuntimeError('Successful Wrangler receipt required')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
deployment = deployments[-1]
integration = read(OUT / 'integration.json')
integration.update(status='published', game=stage['game'], deployment=deployment)
integration['validation'].update(cocosBuild=True, DPRPatch=True, localBundleInspection=True)
write(OUT / 'integration.json', integration)
main = Path(stage['stage']) / 'assets/main/index.js'
write(OUT / 'release.json', {**stage, **integration,
    'date': datetime.now(timezone(timedelta(hours=8))).isoformat(),
    'build': build, 'creatorBuildMilliseconds': milliseconds,
    'mainBundleSha256': hashlib.sha256(main.read_bytes()).hexdigest(),
    'deploymentSucceeded': True, 'uploadedFiles': int(uploaded[1]), 'cachedFiles': int(uploaded[2])})
note = (f"2026-10-16 中央预警与基地弹窗v1已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    '内置image_gen原创暗红战旗与交叉战斧爪痕盾徽，完整原图复制保留透明，无像素编辑，实际提示词和来源存档。中央270ms展旗、徽章落位、文字收稳与少量局部火星，总2.35秒，减少动态1.8秒，无红边/全屏染色/战斗停顿。'
    '现有配置仅精英显示精英来袭，未来boss:true显示首领来袭，每特殊波只触发一次，首怪组前0.8秒最早波开始，不改刷怪数量时刻或战斗数值；普通狂潮提示保持，特殊波避免双横幅双声音。预警暂停选卡隐藏冻结，结算清理，不延后选卡；复用已授权surge低通和轻降增益。'
    '基地弹窗会话持有单一遮罩，图鉴列表/详情/返回/领奖回列表等新美术和绘制完成才以全透明度交接，8px/160ms微移，滚动记忆和重复输入保护。主城升级成功后弹窗原位更新下一等级属性/消耗/余额，顶栏即时同步，最终关闭才在遮罩后刷新基地，避免露亮底。'
    '用户最后补充入场关门保持原240ms，闭合后最短2秒，原320ms开门；温缓存基准2.56秒另有场景交接，冷加载可能更长，失败/后台/首帧保护保持。此条取代上版60ms停留。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    '依约仅源码与本地产物审阅，不运行测试、模拟、游戏、浏览器或线上验收；实际视觉听觉交互由用户人工确认。详见 [中央预警与基地弹窗](docs/boss-warning-base-modal-v1/README.md)。')
for name in ['AGENTS.md', 'README.md']:
    path = GAME / name
    content = path.read_text(encoding='utf-8-sig')
    if stage['game'] not in content:
        at = content.index('\n')
        path.write_text(content[:at+1] + '\n' + note + '\n' + content[at+1:], encoding='utf-8')
readme = OUT / 'README.md'
if stage['game'] not in readme.read_text(encoding='utf-8'):
    with readme.open('a', encoding='utf-8') as f:
        f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成。实际视觉与交互待用户人工确认。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
