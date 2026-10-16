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
note = (f"2026-10-16 突破滑动与主城入场修复v1已构建发布：[正式游戏]({stage['game']})，部署 `{urls[-1]}`。"
    '等级/武器/技能突破共享ViewGroup横向手势组，整个702×244纸板可拖，6px横向起拖、纵向12px且明显纵向才交还原生ScrollView，修正纵向初始位移方向；不再修改父滚动轴或取消开关。'
    '按纸板本地坐标跟手，35ms速度平滑、130ms有界惯性预估、140–230ms吸附与连续边缘阻尼；拖动取消卡片点击，单击详情、位置记忆、后台/禁用/取消清理保留。'
    '战斗原先只取关卡lineHp且未初始化盾，改每局读取存档keepLv并复用基地keepHp/keepShield，7级1700耐久/400盾；HUD构建后立即同步，入场首次显示就是当前数值，普通/精英/地狱及直进下一关共用；复活沿用本局剩余值。'
    '闭合停留常量原已2秒，但旧dt截断会漏算加载阻塞时间；现按前台单调实时时钟计2秒，后台不累计，240ms合拢/320ms展开及美术首帧保护保持，冷加载仍须等战场就绪。无新美术、无存档迁移。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    '依约仅源码与本地构建产物审阅，不运行测试、模拟、游戏、浏览器或线上验收；实际交互由用户人工确认。详见 [突破滑动与主城入场修复](docs/training-defense-entry-v1/README.md)。')
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
