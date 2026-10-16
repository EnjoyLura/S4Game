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
note = (f"2026-10-16 养成连升与英雄栏滑动v1已构建发布：[正式游戏]({stage['game']})，部署 `{urls[-1]}`。"
    '升级页武器大图采用独立容器上下各7单位、4秒一轮正弦浮动，文字及按钮固定；共享相位保持升级刷新位置连续，减少动态偏好下静止，无额外计时器或循环Tween。'
    '英雄页装备底板/标题/数量/五插槽整体分组，以英雄脚底和展示高度计算垂直中心后下移对齐；内部尺寸间距及武器栏左右等分保持。无新美术，无数值或存档变更。'
    '英雄/武器升级长按450ms开始连升、240→160ms间隔，逐次调用原保存操作；松手/拖出/后台/切页/不足/满级停止，松手不补升，慢帧不批量追补。'
    '等级/属性/成本/余额原位更新，按钮和页面存活，十级突破仅局部更新突破栏；局部金环碎光与大图/锤头回弹，战力数字280ms滚动并合并增量浮字，突破加重反馈，复用原有短确认/升级音。'
    '等级和武器属性板上移到展示区y16，压紧属性行并预留底部战力徽章。英雄页/升级页英雄栏共用686宽水平ScrollView与144宽卡，惯性/回弹/拖动取消点选和独立位置记忆。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，正式压缩/MD5缓存和DPR完成，Wrangler main成功。"
    '依约仅源码及本地构建产物审阅，不运行测试、模拟、游戏、浏览器或线上验收；实际视觉由用户人工确认。'
    '详见 [武器悬浮与装备栏](docs/training-weapon-float-v1/README.md)。')
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
