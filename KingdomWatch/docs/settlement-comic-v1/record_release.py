"""Persist successful CLI build/deployment receipts; no online validation."""
from pathlib import Path
from datetime import datetime
import json
import re

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PYRO = GAME/'docs/pyro-idle-user-v1'

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

stage, build = read(OUT/'deployment-stage.json'), read(OUT/'build-record.json')
log = (OUT/'publish.log').read_text(encoding='utf-8-sig')
deployment = re.search(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', log)
uploaded = re.search(r'Uploaded (\d+) files \((\d+) already uploaded\)', log)
if not deployment or not uploaded:
    raise RuntimeError('Successful Wrangler receipt required before recording publication')
build_log = Path(build['log']).read_text(encoding='utf-8-sig')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', build_log)[-1])
release = {**stage, 'status': 'published', 'date': datetime.now().astimezone().isoformat(),
    'deployment': deployment[1], 'build': build, 'creatorBuildMilliseconds': milliseconds,
    'uploadedFiles': int(uploaded[1]), 'cachedFiles': int(uploaded[2]), 'deploymentSucceeded': True,
    'artMode': 'built-in imagegen', 'artSource': 'source-atlas.png', 'artPrompt': 'image-prompt.txt',
    'newArtSprites': 8, 'layoutOptimizationAuthorizedByLatestUserRequest': True,
    'settlementStats': 'All up to five heroes; MVP, damage and actual team share; orange leader-normalized bar',
    'settlementCallbacks': 'Existing reward, double gold, revival, retry, return and next level callbacks',
    'pyroIdle': 'pyro_idle_user_v1', 'pyroAttack': 'pyro_attack_user_v1',
    'pyroFrames': {'idle': 56, 'attack': 56}, 'pyroFullSourceRetained': True,
    'pyroReversePlayback': False, 'pyroOpacityFade': False, 'pyroVideoGenerationSubmitted': False,
    'gameplayTestsRun': False, 'browserValidationRun': False, 'onlineValidationRun': False,
    'damageCalculationChanged': False, 'visualAcceptance': 'pending user manual review',
    'retained': ['archer, sniper, volt and mora media', 'pause artwork', 'health and shield display',
                 'damage, attack speed, fire projectiles, effects and sound']}
write(OUT/'release.json', release)
write(PYRO/'release.json', {**read(PYRO/'integration.json'), 'status': 'published',
    'game': stage['game'], 'deployment': deployment[1], 'build': {**build, 'milliseconds': milliseconds},
    'sourceSha256': read(PYRO/'source-origin.json')['sha256'], 'publicationReceipt': '../settlement-comic-v1/release.json',
    'gameplayTestsRun': False, 'browserValidationRun': False, 'onlineValidationRun': False})
integration = read(PYRO/'integration.json')
integration.update({'status': 'published', 'game': stage['game'], 'deployment': deployment[1]})
write(PYRO/'integration.json', integration)
note = (f"2026-10-15 成功／失败结算美术与布局、火法师用户待机已构建发布：[正式游戏]({stage['game']})，"
    f"部署 `{deployment[1]}`。结算使用内置 imagegen 新生成的金色皇冠／蓝灰破损皇冠横幅、内容底板、奖励卡和青／灰按钮，"
    "复用暂停金／绿按钮与连体页签，文字由引擎渲染；布局聚拢为标题关卡、内容页签、广告与导航，矮屏统一适配。"
    "用户本次明确允许优化这两个结算页面，替代此前仅换肤的布局限制；其他弹窗保持。"
    "统计显示最多五英雄及 MVP，实际伤害和团队占比保留；领取中禁点，原双倍金币、复活、重试、返回、下一关回调沿用。"
    "同轮收到 `Downloads/video (3).mp4` 火法师待机，56 帧／24fps／约2.333333秒完整正向循环，"
    "绿底去除后资源 `pyro_idle_user_v1` 与已有用户攻击 `pyro_attack_user_v1` 同时接入；画内高468、显示高146、脚底(256,496)，"
    "实际火球／施法触发，全不透明换帧、整图镜像，攻击与收势不播待机，攻击范围内无目标且动作结束后恢复。"
    "未调用新视频生成，未改其他四英雄媒体、战斗数值、弹道、特效、音效、暂停美术与生命／护盾显示。"
    f"Cocos成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "未运行测试、游戏、浏览器或线上验收，用户人工查看，不将发布记作视觉认可。"
    "详见 [结算美术](docs/settlement-comic-v1/README.md) 与 [火法师待机](docs/pyro-idle-user-v1/README.md)。")
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    text = path.read_text(encoding='utf-8-sig')
    first = text.index('\n')
    path.write_text(text[:first+1]+'\n'+note+'\n'+text[first+1:], encoding='utf-8')
footer = (f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment[1]})。"
    f"Cocos 成功退出码 {build['exitCode']}、{milliseconds}ms，DPR 完成，Wrangler main 上传 {uploaded[1]} 文件、{uploaded[2]} 缓存。"
    "效果由用户人工查看，未进行游戏或线上验收。\n")
for path in [OUT/'README.md', PYRO/'README.md']:
    with path.open('a', encoding='utf-8') as handle:
        handle.write(footer)
attack_readme = GAME/'docs/pyro-attack-user-v1/README.md'
text = attack_readme.read_text(encoding='utf-8-sig')
first = text.index('\n')
update = (f"\n2026-10-15 更新：新的火法师待机视频现已收到，本目录的完整攻击资源已与 `pyro_idle_user_v1` 配对接入并发布"
    f"[正式游戏]({stage['game']})。下面关于“尚未收到待机、仅素材未接入”的描述保留为 2026-10-14 制作历史；"
    "最新状态见 `../pyro-idle-user-v1/README.md` 与其 `release.json`。\n")
attack_readme.write_text(text[:first+1]+update+text[first+1:], encoding='utf-8')
print(json.dumps({'game': stage['game'], 'deployment': deployment[1], 'published': True,
    'milliseconds': milliseconds, 'pyroIdleFrames': 56, 'newSettlementSprites': 8}, ensure_ascii=True))
