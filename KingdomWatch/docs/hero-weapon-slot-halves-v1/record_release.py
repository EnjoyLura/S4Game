"""Save the Wrangler receipt; never load the published game."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import hashlib
import json
import re

out = Path(__file__).resolve().parent
game = out.parents[1]
stage = json.loads((out / 'deployment-stage.json').read_text(encoding='utf-8-sig'))
build = json.loads((out / 'build-record.json').read_text(encoding='utf-8-sig'))
inspection = json.loads((out / 'bundle-inspection.json').read_text(encoding='utf-8'))
log = (out / 'publish.log').read_text(encoding='utf-8-sig')
urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', log)
if not urls:
    raise RuntimeError('Successful publication receipt required')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
digest = hashlib.sha256((Path(stage['stage']) / inspection['mainBundle']).read_bytes()).hexdigest()
if digest != inspection['mainBundleSha256']:
    raise RuntimeError('Published bundle differs from inspected bundle')
record = {**stage, 'status': 'published', 'deployment': urls[-1], 'build': build,
    'creatorBuildMilliseconds': milliseconds,
    'date': datetime.now(timezone(timedelta(hours=8))).isoformat(),
    'mainBundleSha256': digest,
    'validation': {'sourceReview': True, 'localBundleInspection': True, 'cocosBuild': True, 'DPRPatch': True,
        'testsRun': False, 'gameRun': False, 'browserRun': False, 'onlineAcceptance': False,
        'manualAcceptance': 'pending user'}}
(out / 'release.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
note = (f"2026-10-16 英雄页武器栏左右等分v1已构建发布：[正式游戏]({stage['game']})，部署 `{urls[-1]}`。"
    '252×104武器栏左右各126，左侧插画中心-63、范围110×90，右侧名称及品阶等级中心63、文字框宽110且居中；'
    '空槽兜底同步等分，其他装备槽和点击详情保持。仅HeroPage.drawSlot布局调整，未新增美术。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，正式压缩/MD5缓存、DPR完成，Wrangler main成功。"
    '依约仅源码及本地构建产物审阅，不运行测试、模拟、游戏、浏览器或线上验收；实际视觉由用户人工确认。'
    '详见 [英雄页武器栏](docs/hero-weapon-slot-halves-v1/README.md)。')
for name in ['AGENTS.md', 'README.md']:
    path = game / name
    source = path.read_text(encoding='utf-8-sig')
    if stage['game'] not in source:
        at = source.index('\n')
        path.write_text(source[:at+1] + '\n' + note + '\n' + source[at+1:], encoding='utf-8')
readme = out / 'README.md'
if stage['game'] not in readme.read_text(encoding='utf-8'):
    with readme.open('a', encoding='utf-8') as stream:
        stream.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。实际视觉由用户人工确认。\n")
print(json.dumps({'published': True, 'game': stage['game'], 'deployment': urls[-1], 'milliseconds': milliseconds}))
