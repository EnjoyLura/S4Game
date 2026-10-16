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
note = (f"2026-10-16 战斗退出与击杀反馈v3已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    '弓箭手气流沿实际弹道前移36px，重弩同类前移42px，程序材质与Graphics及弓大招出手兜底同步，原大小强度、人物动作与弹道判定保持。'
    '死亡声替换旧低音量kill，新增已授权采样制作的物理/厚重/火/雷/冰各3变体共15段约147–258ms/260KB，独立2声部/75ms组间隔、优先级2，暂停与切场收声，结算保留最后短尾，不持续压BGM。'
    '原地6块材质碎散加强初始冲量、后段淡出，20/30ms停留，8/10碎屑及局部短尖光，物理棕金与元素收尾；继续不倒地、无绿色残迹，无每杀震屏或全屏白闪。'
    '修复父组件销毁时访问已销毁hunterMarks.node导致null.isValid及总线解绑中断；先解绑、幂等清理仅销毁脱离池节点，场景附属节点统一由场景回收，取消多处重复子节点销毁，三选一旧面板严格有效性保护。'
    '退出/下一关/重试共享导航锁，离场停步进与战斗声、失败恢复、过期广告回调保护，重试改重新进入本关原难度。伤害奖励充能攻速保持。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    '依约不运行测试、模拟、游戏、浏览器或线上验收，视觉听觉由用户人工确认。详见 [退出与击杀反馈](docs/battle-exit-death-v3/README.md)。')
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
