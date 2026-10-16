"""Record compiler and deploy receipts; leave visual acceptance to the user."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
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
deployment = deployments[-1]
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
integration = read(OUT/'integration.json')
integration.update(status='published', game=stage['game'], deployment=deployment)
write(OUT/'integration.json', integration)
write(OUT/'release.json', {**stage, **integration, 'date': datetime.now(timezone(timedelta(hours=8))).isoformat(),
    'build': build, 'creatorBuildMilliseconds': milliseconds, 'deploymentSucceeded': True,
    'uploadedFiles': int(uploaded[1]), 'cachedFiles': int(uploaded[2])})
note = (f"2026-10-15 大招演出与界面完整交接v3已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    '雷法师大招替换旧宽描边折线为细白芯/紫色柔光程序落雷，同路回击、不规则分叉与脚点电裂网、短地光，池化及相邻辉光能量抑制。'
    '重弩大招蓝色轴线/汇聚点/收拢准星，实际发弹压缩气浪、渐细长尾、侧流线与方向命中；头顶易伤准星和卡文案改蓝，30%/5秒及原卡面保持。'
    '五页和页内刷新取消整层淡入，旧完整画面保留，新内容全透明度在下方准备，等待嵌套刷新/美术及绘制再交接，仅8px/160ms微位移。'
    '编队关闭保持整页完整，先刷新下方关卡并等其完成绘制，再移除编队，重复输入拦截与过期回调清理。此条取代旧切页淡入和编队先淡出后刷新的方式。'
    '原伤害/大招节奏/目标/范围/人物序列/音频保持，无新媒体生成。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    '依约不运行测试、模拟、游戏、浏览器或线上验收，实际观感由用户人工确认。详见 [大招与界面交接](docs/hero-ultimate-ui-v3/README.md)。')
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    content = path.read_text(encoding='utf-8-sig')
    at = content.index('\n')
    path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as f:
    f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成。实际效果待用户人工确认。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
