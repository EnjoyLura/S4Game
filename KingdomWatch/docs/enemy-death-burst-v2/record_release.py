"""Record the Creator and Pages receipts without gameplay acceptance."""
from pathlib import Path
from datetime import datetime
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
write(OUT/'release.json', {**stage, **integration, 'date': datetime.now().astimezone().isoformat(),
    'build': build, 'creatorBuildMilliseconds': milliseconds, 'deploymentSucceeded': True,
    'uploadedFiles': int(uploaded[1]), 'cachedFiles': int(uploaded[2])})
note = (f"2026-10-15 原地爆散死亡v2已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    "用户明确否定enemy-death-v1整张怪物倾倒，本次以用户提供的向僵尸开炮录屏为视觉参考，取消整人旋转／位移／倒地／落地扬尘／尸体停留。"
    "25–35ms后以当前本游戏角色帧在单四边形内形成6块曲边材质碎散，普通190ms、精英220ms内收净，脚底少量不规则绿色残迹约0.9–1.15秒淡去。"
    "碎块有方向、独立旋转及重力；交接不重影、不白闪，材质未就绪固定原地快退兜底，不中途闪回。"
    "火余烬／冰屑／100ms雷弧为局部收尾，沿用模拟时钟、64演出上限与池化清理；伤害奖励、英雄媒体、冰技能大招、授权音频保持。"
    "v1视觉明确记为用户否定，不得视作认可默认。"
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "依用户约定不运行测试、游戏、浏览器或线上验收。详见 [原地爆散死亡v2](docs/enemy-death-burst-v2/README.md)。")
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    content = path.read_text(encoding='utf-8-sig')
    at = content.index('\n')
    path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as f:
    f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。体验待用户确认。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
