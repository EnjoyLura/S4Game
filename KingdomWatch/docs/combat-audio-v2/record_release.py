"""Record successful compiler and Pages receipts, not listening acceptance."""
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
note = (f"2026-10-15 战斗音效重制v2已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    "用户否定原战斗音效，本版重做48条采样：五位普攻及五类普通命中各3变体，重弩弦机／木质低响／风切，"
    "火焰爆发、短雷电脉冲、柔冰裂，独立元素重命中与技能大招，击杀去怪叫。新的audio/v2路径与UUID避开旧缓存。"
    "增加Kenney Impact Sounds CC0录音，完整来源、编辑配方、许可与网页鸣谢保存，无付费生成或复制其他游戏音频。"
    "战斗总线削3.1kHz与高架高频、温和压缩，取消同帧发射互斥，分家族限流和声部上限、密集声补偿、缩小音调漂移。"
    "普通与重元素命中独立，重弩普通命中与连锁施法音补齐，UI与BGM和既有交互微动画保留。"
    f"Cocos成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "依用户要求不运行测试、游戏、浏览器或线上听音验收，实际听感待用户人工体验。详见 [战斗音效重制](docs/combat-audio-v2/README.md)。")
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    text = path.read_text(encoding='utf-8-sig')
    at = text.index('\n')
    path.write_text(text[:at+1]+'\n'+note+'\n'+text[at+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as f:
    f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。听感待用户体验。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
