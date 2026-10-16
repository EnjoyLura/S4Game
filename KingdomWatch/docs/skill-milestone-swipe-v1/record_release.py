"""Save build and deployment receipts; gameplay acceptance remains manual."""
from pathlib import Path
from datetime import datetime
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
deployment = deployments[-1]
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
integration = read(OUT/'integration.json')
integration.update(status='published', game=stage['game'], deployment=deployment)
write(OUT/'integration.json', integration)
write(OUT/'release.json', {**stage, **integration, 'date': datetime.now().astimezone().isoformat(),
    'build': build, 'creatorBuildMilliseconds': milliseconds, 'deploymentSucceeded': True,
    'uploadedFiles': int(uploaded[1]), 'cachedFiles': int(uploaded[2])})
note = (f"2026-10-15 技能突破横向滑动已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    "用户要求移除技能突破左右切换按钮：普攻／技能／大招卡片改为裁剪横排、跟手拖动、200ms吸附与边界回弹，"
    "短甩切阶段、标题滑动提示及位置、分英雄技能记忆，滑动不重建整页。"
    "保留点击详情，方向锁定后取消卡片点击，横向锁住外层纵滚、纵向交还原滚动，结束／取消／后台／销毁恢复状态。"
    "切阶段使用原选择音，支持减少动态效果；等级和武器突破操作保持。上一轮页面白闪修复及按钮／音效保持。"
    f"Cocos成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "依用户要求不运行测试、游戏、浏览器或线上效果验收，手感由用户人工体验。"
    "详见 [技能突破横向滑动](docs/skill-milestone-swipe-v1/README.md)。")
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    text = path.read_text(encoding='utf-8-sig')
    at = text.index('\n')
    path.write_text(text[:at+1]+'\n'+note+'\n'+text[at+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as f:
    f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。手感待用户体验。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
