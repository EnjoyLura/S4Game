"""Record the confirmed build and Wrangler completion; no visual acceptance is inferred."""
from pathlib import Path
import json

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]

def read(name):
    return json.loads((OUT / name).read_text(encoding='utf-8-sig'))

stage, build = read('deployment-stage.json'), read('build-record.json')
release = {
    **stage, 'deployment': 'https://70505f10.kingdom-watch.pages.dev', 'build': build,
    'creatorBuildMilliseconds': 11098, 'uploadedFiles': 2, 'cachedFiles': 1627,
    'deploymentSucceeded': True, 'meterRenderer': 'Cocos native Graphics',
    'health': {'width': 640, 'height': 18, 'bottom': 198, 'number': 'current/max outside bar'},
    'shield': {'height': 6, 'bottom': 188, 'fraction': 'shield/maxHp', 'zero': 'hide entire group', 'number': 'ceil(shield)'},
    'damage': {'height': 10, 'fraction': 'heroDamage/highestHeroDamage', 'percentage': 'heroDamage/totalDamage', 'number': 'outside bar, existing fmtWk'},
    'gameplayTestsRun': False, 'browserValidationRun': False, 'onlineValidationRun': False,
    'visualAcceptance': 'pending user manual review', 'heroMediaChanged': False,
    'damageCalculationChanged': False, 'paidTaskSubmitted': False,
}
(OUT / 'release.json').write_text(json.dumps(release, ensure_ascii=False, indent=2), encoding='utf-8')
note = ('2026-10-14 用户提供绿色生命条／橙色贡献统计参考，要求改进进度条并优化盾量。'
        '已构建发布：[正式游戏](' + stage['game'] + ')，部署 `https://70505f10.kingdom-watch.pages.dev`。'
        '防线保持宽 640、底基 198，亮绿色浅圆角血条高 18，右上心形＋当前／最大值；'
        '盾量改为下方独立高 6 的蓝条与左上盾形＋数值，零盾隐藏，去除覆盖血条的大胶囊和旧底基 176 的错位，'
        '数值与条共同避让大招入口。经验条同步轻量样式。统计条高 10、橙色，伤害数值放条外，'
        '参考图以最高伤害为满格比较，真实全队百分比另用小字保留；不改 DamageService 或伤害结算。'
        '此项按用户本次参考图更新此前“数值仍在条内”的约束；统计背板／标题／头像保持，统计行距 100 调至 96 给末行留白。'
        '原生 Graphics 与心／盾图标无需 AI 生图，英雄媒体与暂停美术保持。'
        'Cocos 成功退出码 36、11098ms，DPR 完成，Wrangler main 成功。'
        '未运行测试、游戏、浏览器或线上验收，效果由用户人工查看，不将发布记作视觉认可。'
        '详见 [进度条与盾量记录](docs/battle-meters-v1/README.md)。')
agents = GAME / 'AGENTS.md'
text = agents.read_text(encoding='utf-8')
agents.write_text(text.replace('# 交付要求\n', '# 交付要求\n\n' + note + '\n', 1), encoding='utf-8')
readme = GAME / 'README.md'
text = readme.read_text(encoding='utf-8')
first, rest = text.split('\n', 1)
readme.write_text(first + '\n\n' + note + '\n' + rest, encoding='utf-8')
with (OUT / 'README.md').open('a', encoding='utf-8') as stream:
    stream.write('\n已发布：[正式游戏](' + stage['game'] + ') · [部署快照](' + release['deployment'] + ')。'
                 'Cocos 成功退出码 36、11098ms，DPR 完成，Wrangler main 成功上传 2 文件、1627 缓存。\n')
print(json.dumps({'game': stage['game'], 'deployment': release['deployment'], 'release': str(OUT / 'release.json')}, ensure_ascii=False))
