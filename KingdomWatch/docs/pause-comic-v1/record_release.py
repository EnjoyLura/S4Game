"""Record successful build/deploy output; visual acceptance remains the user's decision."""
from pathlib import Path
import hashlib
import json

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]

def read(name):
    return json.loads((OUT / name).read_text(encoding='utf-8-sig'))

stage, build, assets = read('deployment-stage.json'), read('build-record.json'), read('assets.json')
release = {
    **stage, 'deployment': 'https://04ef8bf6.kingdom-watch.pages.dev',
    'build': build, 'creatorBuildMilliseconds': 8627,
    'spriteCount': len(assets), 'spriteBytes': sum(item['bytes'] for item in assets),
    'generationTool': 'built-in image_gen',
    'sourceSha256': hashlib.sha256((OUT / 'source-atlas.png').read_bytes()).hexdigest(),
    'uploadedFiles': 29, 'cachedFiles': 1600, 'deploymentSucceeded': True,
    'gameplayTestsRun': False, 'browserValidationRun': False, 'onlineValidationRun': False,
    'visualAcceptance': 'pending user manual review',
    'heroMediaChanged': False, 'otherBattlePanelsChanged': False,
}
(OUT / 'release.json').write_text(json.dumps(release, ensure_ascii=False, indent=2), encoding='utf-8')
note = ('2026-10-14 暂停界面美术已完成并构建发布：[正式游戏](' + stage['game'] + ')，'
        '部署 `https://04ef8bf6.kingdom-watch.pages.dev`。内置 imagegen 生成透明组件图集，切分 11 张原像素 PNG，'
        '补齐标题窄横幅、奖励圆座、金色退出／绿色继续按钮、连体页签、设置行与开关三态。'
        '只接入暂停，原布局、文案、字号、数量、点击与音效设置回调保留；不改变三选一、胜败结算、伤害 tips 或英雄素材。'
        'Cocos 3.8.8 web-mobile 成功退出码 36、8627ms，DPR 完成，Wrangler main 成功。'
        '用户人工查看，未运行测试、游戏、浏览器或线上验收，未记作视觉认可。'
        '原图、提示词、切图、接入与发布记录见 [暂停美术](docs/pause-comic-v1/README.md)。')
agents = GAME / 'AGENTS.md'
text = agents.read_text(encoding='utf-8')
agents.write_text(text.replace('# 交付要求\n', '# 交付要求\n\n' + note + '\n', 1), encoding='utf-8')
readme = GAME / 'README.md'
text = readme.read_text(encoding='utf-8')
first, rest = text.split('\n', 1)
readme.write_text(first + '\n\n' + note + '\n' + rest, encoding='utf-8')
with (OUT / 'README.md').open('a', encoding='utf-8') as stream:
    stream.write('\n已发布：[正式游戏](' + stage['game'] + ') · [本次部署](' + release['deployment'] + ')。'
                 '11 张 PNG 合计 ' + str(release['spriteBytes']) + ' 字节。构建 8627ms，DPR 完成，Wrangler main 成功。\n')
print(json.dumps({'game': stage['game'], 'spriteCount': len(assets), 'spriteBytes': release['spriteBytes'], 'release': str(OUT / 'release.json')}, ensure_ascii=False))
