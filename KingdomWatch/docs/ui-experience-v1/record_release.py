"""Record build/publication receipts without launching the game."""
from pathlib import Path
from datetime import datetime
import json
import re

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

stage, build = read(OUT/'deployment-stage.json'), read(OUT/'build-record.json')
log = (OUT/'publish.log').read_text(encoding='utf-8-sig')
deployment = re.search(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', log)
uploaded = re.search(r'Uploaded (\d+) files \((\d+) already uploaded\)', log)
if not deployment or not uploaded:
    raise RuntimeError('Successful Wrangler receipt required')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
integration = read(OUT/'integration.json')
integration.update(status='published', game=stage['game'], deployment=deployment[1])
write(OUT/'integration.json', integration)
write(OUT/'release.json', {**stage, **integration, 'date': datetime.now().astimezone().isoformat(),
    'build': build, 'creatorBuildMilliseconds': milliseconds, 'deploymentSucceeded': True,
    'uploadedFiles': int(uploaded[1]), 'cachedFiles': int(uploaded[2])})
note = (f"2026-10-15 界面交互体验已构建发布：[正式游戏]({stage['game']})，部署 `{deployment[1]}`。"
    "新增UIAudio／UIMotion／TouchFeedback：点击／选择／打开／关闭／开关／确认分层采样音，单次动作合并与35ms总线限流，遵循原音效开关与捕获解锁。"
    "Canvas顶层原生Graphics绘制暖金细环／亮点／4光屑，8槽池，0.38秒释放，拖动取消，不拦截输入，空闲无update、后台清空、换场景解绑。"
    "五页切换200ms淡入与18像素方向位移、旧页120ms淡出；页内刷新120ms从94%回正。"
    "弹窗180ms／97.5%比例／9像素回正，遮罩渐变，120ms关闭与输入拦截，退场内容独立移出防晚回调清新界面。"
    "购买／装备／编队／培养／基地详情、暂停／结算／Tips／GM同步，三选一原入场保留并补版本校验。"
    "提示单条替换、动效和计时随销毁清理，支持系统减少动态效果；按钮回位改cubicOut，无过冲。"
    "既有美术布局、英雄媒体、战斗规则与音频素材保持，无付费媒体调用。"
    f"Cocos成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "按用户要求不运行测试、游戏、浏览器或线上效果验收，实际手感与听感由用户人工体验。详见 [界面交互](docs/ui-experience-v1/README.md)。")
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    source = path.read_text(encoding='utf-8-sig')
    first = source.index('\n')
    path.write_text(source[:first+1]+'\n'+note+'\n'+source[first+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as handle:
    handle.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment[1]})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。未运行交互／视觉／听音验收。\n")
print(json.dumps({'published': True, 'game': stage['game'], 'deployment': deployment[1], 'milliseconds': milliseconds}))
