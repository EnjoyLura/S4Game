"""Save successful build/publication receipts, without running the game."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import hashlib
import json
import re

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')


stage, build = read(OUT / 'deployment-stage.json'), read(OUT / 'build-record.json')
log = (OUT / 'publish.log').read_text(encoding='utf-8-sig')
deployments = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', log)
uploaded = re.search(r'Uploaded (\d+) files \((\d+) already uploaded\)', log)
if not deployments or not uploaded:
    raise RuntimeError('Successful Wrangler receipt required')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
deployment = deployments[-1]
integration = read(OUT / 'integration.json')
integration.update(status='published', game=stage['game'], deployment=deployment)
integration['validation'].update(cocosBuild=True, DPRPatch=True, localBundleInspection=True)
write(OUT / 'integration.json', integration)
main = Path(stage['stage']) / 'assets/main/index.js'
write(OUT / 'release.json', {**stage, **integration,
    'date': datetime.now(timezone(timedelta(hours=8))).isoformat(),
    'build': build, 'creatorBuildMilliseconds': milliseconds,
    'mainBundleSha256': hashlib.sha256(main.read_bytes()).hexdigest(),
    'deploymentSucceeded': True, 'uploadedFiles': int(uploaded[1]), 'cachedFiles': int(uploaded[2])})
note = (f"2026-10-16 结算暂停与战斗界面反馈v2已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    '结算主板和奖励卡复用ComicUI米色纸张单轮廓，文字深色；保留原皇冠横幅和页签。失败去返回及全宽广告行，左下绿色广告复活、右下金色再来一次；广告忙态双按钮防重。再来一次先回关卡页，通过一次性levelReturn定位真实关卡与难度，不自动开战；导航失败回滚，胜利下一关保留原流程。'
    '暂停采用居中680高内容根与安全高度缩放，设置行高60/间隔16，鸣谢独立44高、距末行22/距页签19，页签距按钮28；奖励统计四人分行。'
    '内置image_gen以游戏前哨/商店为风格参考，旧门仅参考布局，新暖木灰铁小蓝百合门替换被否定的大金冠叶饰门，完整原图保存无像素编辑；移除中缝闪光。保留240/60/320ms入场动作与首帧交接。'
    '三选一按上阵英雄提前加载实际纸卡、头像与可抽卡图，两并行请求间让出16ms，使用既有缓存去重且不阻塞入场。触发先显示标题，卡面美术就绪再展；初次展卡440→320ms/错峰35ms，480ms选择和520ms刷新保留。经验回调只入队，在战斗子步结束后建弹窗。未测量运行时延迟，不保证所有设备消除半秒等待；大招及原2秒缓冲保持。'
    '索敌范围普攻亮金/技能浅蓝、填充10%，8px深衬边+4.5px色线+细芯与轻外沿；圆心由HERO_Y+30对齐真实HERO_Y，半径仍取实时属性，仅tips打开绘制，无逐帧开销。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    '依约仅源码与本地构建产物审阅，不运行测试、模拟、游戏、浏览器或线上验收；视觉与性能由用户人工确认。详见 [结算暂停与战斗界面反馈](docs/settlement-pause-layout-v2/README.md)。')
for name in ['AGENTS.md', 'README.md']:
    path = GAME / name
    content = path.read_text(encoding='utf-8-sig')
    if stage['game'] not in content:
        at = content.index('\n')
        path.write_text(content[:at+1] + '\n' + note + '\n' + content[at+1:], encoding='utf-8')
readme = OUT / 'README.md'
if stage['game'] not in readme.read_text(encoding='utf-8'):
    with readme.open('a', encoding='utf-8') as f:
        f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成。实际视觉与性能待用户人工确认。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
