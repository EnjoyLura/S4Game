"""Save build/deployment receipts; visual acceptance belongs to the user."""
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

stage, build = read(OUT / 'deployment-stage.json'), read(OUT / 'build-record.json')
log = (OUT / 'publish.log').read_text(encoding='utf-8-sig')
deployment = re.search(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', log)
uploaded = re.search(r'Uploaded (\d+) files \((\d+) already uploaded\)', log)
if not deployment or not uploaded:
    raise RuntimeError('Successful Wrangler receipt required')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
integration = read(OUT / 'integration.json')
integration.update(status='published', game=stage['game'], deployment=deployment[1])
write(OUT / 'integration.json', integration)
write(OUT / 'release.json', {**stage, **integration, 'date': datetime.now().astimezone().isoformat(),
    'build': build, 'creatorBuildMilliseconds': milliseconds, 'deploymentSucceeded': True,
    'uploadedFiles': int(uploaded[1]), 'cachedFiles': int(uploaded[2]), 'visualAcceptance': 'pending user manual review'})
note = (f"2026-10-15 纯程序普攻发射与盾量显示修正已构建发布：[正式游戏]({stage['game']})，部署 `{deployment[1]}`。"
    "用户明确否定上一轮发射贴图，四张 basic_launch_v2_* 停止加载，只保留历史；发射改用自定义 Shader 计算柔边、细光芯、"
    "短促风压／热脉冲／电弧／霜晶，片元无图片采样，2×2运行时白纹理仅承载四顶点，36槽池，模拟时钟与真实方向驱动，"
    "载入前为原生Graphics回退。弓箭0.24秒、重弩0.28秒、火0.25秒、雷0.22秒、冰0.28秒，收敛出弹点周围占用。"
    "心形和盾形随实际文字宽度紧贴数字左侧，数字右缘仍固定320，生命在上、护盾在下；字体异步载入及位数变化自动重排。"
    "蓝盾按盾量／最大耐久绘制右侧外框，右端固定、受损从左向右消退，零盾隐藏外框且显示0；绿色生命条、数值高度、大招入口、"
    "英雄素材与动作、飞行拖尾、原弹体、伤害、攻速、弹速、碰撞、索敌、技能、大招、命中特效和音效保留。无AI生成调用。"
    f"Cocos成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "用户人工查看，不运行测试、游戏、浏览器或线上验收，不把构建或发布记作视觉认可。详见 [程序发射与盾量修正](docs/basic-launch-procedural-v3/README.md)。")
for name in ['AGENTS.md', 'README.md']:
    path = GAME / name
    source = path.read_text(encoding='utf-8-sig')
    first = source.index('\n')
    path.write_text(source[:first+1] + '\n' + note + '\n' + source[first+1:], encoding='utf-8')
with (OUT / 'README.md').open('a', encoding='utf-8') as handle:
    handle.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment[1]})。Cocos成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。效果由用户人工查看。\n")
print(json.dumps({'published': True, 'game': stage['game'], 'deployment': deployment[1], 'milliseconds': milliseconds}, ensure_ascii=True))
