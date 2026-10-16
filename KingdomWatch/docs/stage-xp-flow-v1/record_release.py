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
note = (f"2026-10-16 关卡等级与时间经验v1已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    '去掉Lv圆角背板，等级位置/字号/金色保留，仅2px字描边。经验条移除350ms亮白切色，固定青蓝与同色静态高光，保持长度平滑，升级直接交接剩余经验，初始填充明确为0。'
    '新增每2个战斗秒获得max(1,round(本级升级经验需求×1%))×经验获取倍率的关卡经验，1%为本轮初设；只在运行期间按同一倍速/顿帧时钟累计，准备/进场/暂停/三选一/离场/结算不累计，等待胜利演出时停止，暂停复活保留零头，新局重置，无后台补发。'
    '子步结束后共用gainXp、升级三选一队列和大招演出保护；击杀经验、升级曲线、英雄存档、其他进度条及上一版退出/死亡/气流修复保持。未新增媒体。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    '依约仅源码及构建产物审阅，不运行测试、模拟、游戏、浏览器或线上验收，观感和经验节奏由用户人工确认。详见 [关卡等级与时间经验](docs/stage-xp-flow-v1/README.md)。')
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
