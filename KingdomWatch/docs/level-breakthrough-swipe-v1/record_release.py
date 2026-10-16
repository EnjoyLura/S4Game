"""Write publication receipts without starting the game or browser."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import hashlib
import json
import re

out = Path(__file__).resolve().parent
game = out.parents[1]
stage = json.loads((out / 'deployment-stage.json').read_text(encoding='utf-8-sig'))
build = json.loads((out / 'build-record.json').read_text(encoding='utf-8-sig'))
log = (out / 'publish.log').read_text(encoding='utf-8-sig')
urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', log)
if not urls:
    raise RuntimeError('Successful publication receipt required')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
record = {**stage, 'status': 'published', 'deployment': urls[-1], 'build': build,
    'creatorBuildMilliseconds': milliseconds,
    'date': datetime.now(timezone(timedelta(hours=8))).isoformat(),
    'mainBundleSha256': hashlib.sha256((Path(stage['stage']) / 'assets/main/index.js').read_bytes()).hexdigest(),
    'validation': {'sourceReview': True, 'localBundleInspection': True, 'cocosBuild': True, 'DPRPatch': True,
        'testsRun': False, 'gameRun': False, 'browserRun': False, 'onlineAcceptance': False, 'manualAcceptance': 'pending user'}}
(out / 'release.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
note = (f"2026-10-16 等级与武器突破滑动v1已构建发布：[正式游戏]({stage['game']})，部署 `{urls[-1]}`。"
    '等级突破和武器突破共用栏改启用技能突破同一MilestoneSwipe，去左右箭头，跟手拖动、松手200ms吸附、边缘阻尼回弹、切档音效；横纵向手势分流，拖动不触发详情，点按仍查看详情。'
    '各英雄及等级/武器分类独立记忆浏览位置，升级刷新保留；原突破数值、档位、高亮和技能滑动保持，仅一处调用参数调整，无新素材或依赖。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    '依约仅源码及本地构建产物审阅，不运行测试、模拟、游戏、浏览器或线上验收；实际手势由用户人工确认。详见 [等级与武器突破滑动](docs/level-breakthrough-swipe-v1/README.md)。')
for name in ['AGENTS.md', 'README.md']:
    path = game / name
    source = path.read_text(encoding='utf-8-sig')
    if stage['game'] not in source:
        at = source.index('\n')
        path.write_text(source[:at+1] + '\n' + note + '\n' + source[at+1:], encoding='utf-8')
readme = out / 'README.md'
if stage['game'] not in readme.read_text(encoding='utf-8'):
    with readme.open('a', encoding='utf-8') as f:
        f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。构建{milliseconds}ms，实际交互待人工确认。\n")
print(json.dumps({'published': True, 'game': stage['game'], 'deployment': urls[-1], 'milliseconds': milliseconds}))
