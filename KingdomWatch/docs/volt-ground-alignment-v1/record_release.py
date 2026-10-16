"""Record compiler/deployment receipts without claiming visual acceptance."""
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
note = (f"2026-10-15 雷电落点、重弩枪线与火法陨石修复已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    '用户反馈底部少半边且与雷柱错位；定位地面材质x坐标已经居中后又减半宽，圆心落到载体右边缘，默认向右偏137.25且裁掉右半圈。'
    '地面分支独立按UV双轴居中，光圈/中心辉光与原电裂纹/雷柱脚点重合，原尺寸足够覆盖完整径向淡出。'
    '重弩额外枪线演出按ultBolts共绘1/2/3组蓝色瞄准轴和收拢准星，Graphics每帧只清一次、出手汇聚只画一次；保留主目标/其余血量最高规则和死亡转火，最后演出目标数组直接发射，手动和自动共用，敌人不足按实际数。'
    '火法旧普通火球途中碰撞提前爆炸、火坑独立倒计时导致预警错位；改固定地面弹到预告中心才结算爆炸/伤害/音效、撤预警并创建火坑，预算满保留预警重试。'
    '陨石5/7颗改按移动预测优先覆盖不同怪群及147/176优先间距，单簇/Boss以有效命中为先、簇边错开；预告后固定不追踪，预警边界为真实140半径，演出锁按落点飞行时间估算。'
    '原单中心全额/邻居溅射倍率、中心状态、弹速/颗数/发射间隔/火坑数值、人物/音频素材与界面交接保持。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    '依约不运行测试、模拟、游戏、浏览器或线上验收，实际效果由用户人工确认。详见 [雷电落点与重弩枪线修复](docs/volt-ground-alignment-v1/README.md)。')
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    content = path.read_text(encoding='utf-8-sig')
    at = content.index('\n')
    path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as f:
    f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成。实际效果待用户人工确认。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
