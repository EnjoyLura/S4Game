"""Record compiler and publication receipts without gameplay acceptance."""
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
note = (f"2026-10-15 敌人死亡表现已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    "以当前完整帧制作致命冲击、方向冲量、脚底支点失衡倒地、触地收稳、短尘、残骸与轮廓侵蚀消散，普通约0.74–0.89秒、精英约1秒。"
    "物理尘屑、火系焦化余烬、冰系冷色碎冰、雷系短电弧；材质沿真实帧UV、不白闪、粒子尾段收净。"
    "独立尸体列表64上限，不占活怪索敌／碰撞／分离／波次／数量；伤害奖励经验充能仍立即结算。"
    "演出随战斗倍速和顿帧，暂停／三选一冻结，结算只走死亡尾段；池化材质、共享碎屑层、退出销毁脱离节点。"
    "本版沿用命中完整姿态整体倾倒，未生成新逐怪种死亡序列帧；保留英雄、冰技能大招及授权音频。"
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "依用户约定不运行测试、游戏、浏览器或线上验收。详见 [敌人死亡表现](docs/enemy-death-v1/README.md)。")
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    content = path.read_text(encoding='utf-8-sig')
    at = content.index('\n')
    path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as f:
    f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。体验待用户确认。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
