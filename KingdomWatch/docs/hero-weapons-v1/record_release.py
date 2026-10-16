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
inspection = json.loads((out / 'bundle-inspection.json').read_text(encoding='utf-8'))
log = (out / 'publish.log').read_text(encoding='utf-8-sig')
urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', log)
if not urls:
    raise RuntimeError('Successful publication receipt required')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
digest = hashlib.sha256((Path(stage['stage']) / 'assets/main/index.js').read_bytes()).hexdigest()
if digest != inspection['mainBundleSha256']:
    raise RuntimeError('Published bundle differs from inspected bundle')
record = {**stage, 'status': 'published', 'deployment': urls[-1], 'build': build,
    'creatorBuildMilliseconds': milliseconds,
    'date': datetime.now(timezone(timedelta(hours=8))).isoformat(),
    'mainBundleSha256': digest, 'imagegen': 'generation.json',
    'offlineResourceInspection': 'bundle-inspection.json',
    'validation': {'sourceReview': True, 'localBundleInspection': True, 'cocosBuild': True, 'DPRPatch': True,
        'testsRun': False, 'gameRun': False, 'browserRun': False, 'onlineAcceptance': False, 'manualAcceptance': 'pending user'}}
(out / 'release.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
note = (f"2026-10-16 必备武器与共用培养v1已构建发布：[正式游戏]({stage['game']})，部署 `{urls[-1]}`。"
    '每位英雄必备武器、可更换不可卸下；弓手狩猎木弓、重弩手制式轻弩、火法学徒魔法书、雷冰法各自学徒法杖。'
    '四白初始与四绿进阶使用内置image_gen新插画，完整透明原图复制无像素编辑，提示词及来源存档。旧档保留有效兼容且独占武器，缺失/重复/不符槽位补发；初始不可售。'
    '武器等级沿用每英雄weaponLv，上限90、成本保持，任何换装沿用该英雄培养；一次迁移保留更高的当前武器旧强化等级。弓偏攻速、弩偏暴击、书偏充能、杖偏暴伤，每10级攻击/技伤与每30级词条按当前武器分别计算。'
    '插槽/背包/对比/升级/突破/通知/商店/战斗聚合共用配置；四绿商店及精英地狱掉落沿用原绿色武器总权重，新增清单局部滚动，防止溢出。'
    '追加城门闭合前台停留2→1.5秒，240ms合拢/320ms展开与首帧就绪保护保持；冰晶雨128→256颗，共用预分配池和原演出窗口，伤害规则保持；火法陨石坑在当前基础再增20%，半径114.4→137.28，美术/灼烧/易伤/分散间距同步，瞬爆140与4秒寿命保持。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，八张新图与编译常量离线核对，Wrangler main成功。"
    '依约仅源码和本地构建产物审阅，不运行测试、模拟、游戏、浏览器或线上验收；实际体验由用户人工确认。详见 [必备武器与共用培养](docs/hero-weapons-v1/README.md)。')
for name in ['AGENTS.md', 'README.md']:
    path = game / name
    source = path.read_text(encoding='utf-8-sig')
    if stage['game'] not in source:
        at = source.index('\n')
        path.write_text(source[:at+1] + '\n' + note + '\n' + source[at+1:], encoding='utf-8')
readme = out / 'README.md'
if stage['game'] not in readme.read_text(encoding='utf-8'):
    with readme.open('a', encoding='utf-8') as f:
        f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。构建{milliseconds}ms，实际体验待人工确认。\n")
print(json.dumps({'published': True, 'game': stage['game'], 'deployment': urls[-1], 'milliseconds': milliseconds}))
