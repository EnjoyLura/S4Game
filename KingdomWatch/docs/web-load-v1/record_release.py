"""Record a completed deployment without loading the online game."""
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
    'mainBundleSha256': digest, 'bundleInspection': inspection,
    'validation': {'sourceReview': True, 'localBundleInspection': True, 'cocosBuild': True, 'DPRPatch': True,
        'testsRun': False, 'gameRun': False, 'browserRun': False, 'onlineAcceptance': False,
        'networkTimingMeasured': False, 'manualAcceptance': 'pending user'}}
(out / 'release.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
note = (f"2026-10-16 网页启动与刷新加载优化v1已构建发布：[正式游戏]({stage['game']})，部署 `{urls[-1]}`。"
    '后续正式交付统一使用tools/build-web.ps1和tools/web-release-build.json，debug=false、md5Cache=true；不要恢复历史debug=true构建。'
    'DPR补丁兼容压缩引擎与MD5入口；tools/prepare-web-release.py给补丁后的引擎依赖和import-map加内容查询版本，并提前请求5个启动代码/设置URL，写回Pages实际识别的_headers文件名。'
    'HTML联网校验，MD5代码/图片/音频/字体缓存一年，未版本化effect.bin仍校验；离线核对1350个assets文件或其父目录带版本，1368文件缓存规则无交叉冲突。'
    '默认关卡页等待当前美术与交接、再让出350ms后预热所选队伍；旧16ms连续发包的全清单改当前12张共用美术，首屏后延迟8秒、上一张结束后150ms再发，前台可见请求及后台标签避让，过期页面不新发任务。'
    '三选一按上阵英雄预热和战斗入口就绪保护保持。无新美术，无人物图集或数值/存档/声音变化。'
    'JS离线文件总大小7601341→3562688字节，减少53.13%；统一gzip估算减少30.68%，不代表已测得手机网络或启动耗时。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR和正式准备完成，Wrangler main成功。"
    '依约不运行测试、模拟、游戏、浏览器或线上验收；未量测用户线路，不承诺固定加载秒数，首开及重复刷新由用户人工体验。详见 [网页加载优化](docs/web-load-v1/README.md)。')
for name in ['AGENTS.md', 'README.md']:
    path = game / name
    source = path.read_text(encoding='utf-8-sig')
    if stage['game'] not in source:
        at = source.index('\n')
        path.write_text(source[:at+1] + '\n' + note + '\n' + source[at+1:], encoding='utf-8')
readme = out / 'README.md'
if stage['game'] not in readme.read_text(encoding='utf-8'):
    with readme.open('a', encoding='utf-8') as stream:
        stream.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。构建{milliseconds}ms，实际加载耗时待用户确认。\n")
print(json.dumps({'published': True, 'game': stage['game'], 'deployment': urls[-1], 'milliseconds': milliseconds}))
