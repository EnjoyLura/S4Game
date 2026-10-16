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
note = (f"2026-10-16 关卡奖励页签顺序v1已构建发布：[正式游戏]({stage['game']})，部署 `{urls[-1]}`。"
    '星级宝箱移到左侧、关卡掉落移到右侧，进入关卡页默认选中星级宝箱；可领取提示和内容分支同步交换。'
    '仅LevelsPage三处调整，奖励数值、存档、掉落规则、关卡与难度记忆保持，无新素材。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    '依约只审阅源码与本地构建产物，不运行测试、模拟、游戏、浏览器或线上验收；实际界面由用户人工确认。详见 [关卡奖励页签顺序](docs/level-reward-tabs-v1/README.md)。')
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
