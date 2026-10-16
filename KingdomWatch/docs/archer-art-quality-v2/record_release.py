"""Record the successful deployment receipt without loading its URL."""
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
    'validation': {'sourceReview': True, 'staticImageReview': True, 'localBundleInspection': True,
        'cocosBuild': True, 'DPRPatch': True, 'testsRun': False, 'gameRun': False,
        'browserRun': False, 'onlineAcceptance': False, 'manualAcceptance': 'pending user'}}
(out / 'release.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
note = (f"2026-10-16 弓手立绘与品质收敛v2已构建发布：[正式游戏]({stage['game']})，部署 `{urls[-1]}`。"
    '内置image_gen重做弓手正面全身自然侧持弓立绘、狩猎木弓和猎风长弓透明图；完整原图复制到版本化资源，未编辑像素，提示词、UUID及来源相同SHA存档。'
    '立绘沿用身份服装，左手握弓把垂直持弓、右手放松，脚底边距14/1546；两把物品弓简化结构、去掉横穿弓身的箭。'
    'HeroComic及Weapons共用入口覆盖英雄/升级/故事、商店/背包/掉落，战斗人物图集及动作不变。'
    '按用户最新要求取消品质边框和大底板铺色，恢复统一米纸深轮廓及中性文字；品质色仅保留圆形背板与左上角角标，穿戴/背包/详情/掉落/战利品一致，删除圆外闪光，数值存档价格保持。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，production/MD5/DPR与Wrangler main完成。"
    '只审阅静态图片、源码和本地构建产物，不运行测试、模拟、游戏、浏览器或线上验收，实际观感由用户人工确认。'
    '详见 [弓手立绘与品质收敛](docs/archer-art-quality-v2/README.md)。')
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
