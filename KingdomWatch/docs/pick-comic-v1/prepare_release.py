"""Prepare one release for pick art, ice/fire clips and the requested base rates."""
from pathlib import Path
import json

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PYRO = GAME/'docs/pyro-actions-user-v2'
MORA = GAME/'docs/mora-actions-user-v1'
scope = 'original pick artwork and lower placement; ice idle/attack; new fire attack and idle loop; sniper 0.5/s, fire and volt 1/s'

# Retain the previous release's working local build and deployment process.
build = (GAME/'docs/settlement-comic-v1/build_game.ps1').read_text(encoding='utf-8-sig')
build = build.replace('kwSettlement', 'kwPick').replace('settlement-comic-v1', 'pick-comic-v1')
build = build.replace('win/lose settlement artwork and fire-mage idle/attack integration', scope)
(OUT/'build_game.ps1').write_text(build, encoding='utf-8')
publish = (GAME/'docs/settlement-comic-v1/publish.ps1').read_text(encoding='utf-8-sig')
publish = publish.replace('kwSettlement', 'kwPick').replace('settlement-comic-v1', 'pick-comic-v1')
publish = publish.replace('docs/battle-meters-v1/deployment-stage.json', 'docs/settlement-comic-v1/deployment-stage.json')
publish = publish.replace('win/lose settlement artwork and fire-mage idle/attack integration', scope)
(OUT/'publish.ps1').write_text(publish, encoding='utf-8')

# Same whole-source packaging as the ice pair; only hero/resource names, clip roles
# and the observed staff-forward release annotation differ.
package = (MORA/'package_actions.py').read_text(encoding='utf-8')
package = package.replace('from prepare_sources import keyer, bounds',
    "import importlib.util\nspec = importlib.util.spec_from_file_location('pyro_green_key_v2', Path(__file__).resolve().parents[1]/'pyro-attack-user-v1/prepare_source.py')\nkeyer = importlib.util.module_from_spec(spec)\nspec.loader.exec_module(keyer)\nfrom package_idle import bounds")
package = package.replace('mora_', 'pyro_').replace("'mora'", "'pyro'").replace('冰法师', '火法师')
package = package.replace('_user_v1', '_user_v2')
package = package.replace("f'assets/resources/ux/pyro_{kind}_user_v2'", "f'assets/resources/ux/{\"pyro_idle_loop_v2\" if kind == \"idle\" else \"pyro_attack_user_v2\"}'")
package = package.replace("f'pyro_{\"attack\" if kind==\"idle\" else \"idle\"}_user_v2'", "'pyro_attack_user_v2' if kind=='idle' else 'pyro_idle_loop_v2'")
package = package.replace('DISPLAY_HEIGHT, RELEASE = 468, 146, 22', 'DISPLAY_HEIGHT, RELEASE = 468, 146, 16')
package = package.replace('Reference source frame 22:', 'Reference source frame 16:')
package = package.replace("package('idle','take-b')", "package('idle','idle')").replace("package('attack','take-a')", "package('attack','attack')")
package = package.replace("'userProvidedVideo':True", "'userProvidedVideo':kind=='attack'")
package = package.replace("'paidTaskSubmitted':False}", "'paidTaskSubmitted':kind=='idle'}")
package = package.replace("'previewOnly':False,'paidTaskSubmitted':False", "'previewOnly':False,'paidTaskSubmitted':True")
package = package.replace('blue/white materials retained', 'red/gold materials retained')
(PYRO/'package_actions.py').write_text(package, encoding='utf-8')

def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

write(OUT/'integration.json', {'status':'source integrated, build pending', 'mode':'built-in imagegen',
    'newArtResources':['pick_comic_v1/card_base','pick_comic_v1/title_plate','pick_comic_v1/header_strip'],
    'reusedButtons':'pause_comic_v1/button_green, button_gold and button_muted',
    'externalArtworkCopied':False,'layoutDeltaDesignPixels':56,'shortScreenClamp':True,
    'baseAttackRatesPerSecond':{'sniper':0.5,'pyro':1,'volt':1},
    'baseIntervalsSeconds':{'sniper':2,'pyro':1,'volt':1},
    'existingAttackSpeedBonusesRetained':True,'gameplayTestsRun':False,'userVisualAccepted':False})
write(MORA/'integration.json', {'status':'source integrated, build pending','hero':'mora',
    'idleResource':'mora_idle_user_v1','attackResource':'mora_attack_user_v1',
    'frames':{'idle':56,'attack':56},'displayHeight':146,'groundAnchor':[256,496],
    'player':'HeroSequenceAnimation; actual projectile, skill and ultimate callbacks',
    'allSourceFramesRetained':True,'reversePlayback':False,'opacityFade':False,
    'paidTaskSubmitted':False,'gameVisualAcceptedByUser':False})

(OUT/'README.md').write_text('''# 三选一原创美术与合并发布

按用户要求使用内置 imagegen 模式分别生成卡片底板、标题底板、品质色带三张原生透明图片；没有把其他游戏图片传给模型，也没有复制其素材。美术为低对比暖纸纹、细棕金边线、少量菱形与短线角饰，中心留白供原有引擎文本和图标使用。

原图在 `sources/`，实际资源在 `../../assets/resources/ux/pick_comic_v1/`。完整实际提示词：[卡片](prompts/card_base.txt)、[标题](prompts/title_plate.txt)、[色带](prompts/header_strip.txt)。`generation.json` 记录模式与来源；`assets.json` 记录实际裁框、尺寸与校验和。处理仅去透明边与 alpha<8 的灰尘，没有重绘或缩放素材。

`Panels.showPick` 将整组标题、卡片、刷新说明和按钮统一下移 56 个设计像素，短屏按安全区限制下移量。卡片 222×360、三列位置、文本字号、图标、归属头像、稀有度颜色、刷新按钮 300/180 宽度及原选择／广告／钻石回调保留。刷新按钮复用本项目暂停页的金／绿／灰美术。

同批接入用户冰法师待机和攻击，后续收到的新火法师攻击及待机接缝修复也一起发布。基础普攻改为重弩手 0.5 次/秒（2 秒一次）、火法师和雷法师各 1 次/秒；`Cards.ts` 战斗配置与 `GameData.ts` 属性显示同步，装备、卡牌、突破、技能攻速乘区继续生效。

运行 `build_game.ps1` 构建 Cocos 3.8.8 web-mobile 并执行 DPR 补丁；`publish.ps1` 从最新结算发布保留历史预览，部署正式 main。遵照用户要求不运行测试、游戏、浏览器或线上验收，视觉效果由用户人工查看。发布回执在 `release.json`。
''', encoding='utf-8')
(MORA/'README.md').write_text('''# 用户冰法师待机与攻击

用户提供的 `lens-api-task_yq8OpM3P7gf4lhvYXH3Op1kRdTvRDPGt.mp4` 为攻击（take-a），`lens-api-task_zYSJbUSMnFr9ltP4YS4KqI8j0kuu75sf.mp4` 为待机（take-b）。两段完整原片、SHA、源帧和接触表分别保留于对应目录；各 56 帧、24fps、约 2.333333 秒，未调用付费视频生成。

去除纯绿背景并处理边缘溢色，一段只用一个联合裁框、一次等比缩放和固定脚底；两动作共用 512×512 格子、画内基准高468、显示高146和脚底(256,496)。全部源帧保留，待机按原始时间正向等时循环，攻击参考释放帧22。资源 `mora_idle_user_v1` 与 `mora_attack_user_v1` 通过 `MoraIdleAnimation` 接入已有整图镜像播放器。

普攻冰棱、领域及大招的实际施放回调触发动作。攻击、待发和收势期间不播放待机；自身攻击范围内无目标且无排队攻击、动作结束后恢复。角色始终全不透明直接换帧。未修改冰系伤害、冻结、减速、范围、弹道或游戏特效。

本地素材演示：[待机与镜像](idle-mirror.gif)、[待机至攻击](idle-attack-mirror.gif)。这些是全源帧演示，不代表运行游戏或用户视觉验收。构建与正式发布归档在 `../pick-comic-v1/`，效果由用户人工查看。
''', encoding='utf-8')
(PYRO/'README.md').write_text('''# 新火法师攻击与原生待机循环

用户否定旧攻击并提供 `lens-api-task_WHW1YsGLlVVLTH0fgJbd6F9uFMl5zUJG.mp4`，原片与全部56帧保存于 `attack/`。新攻击使用该原片，参考释放帧16，由实际火球／技能／大招回调触发，继续根据攻速适配收势。

用户指出旧待机首尾衔接不顺。保留原视频首帧形象，不更换站姿、衣着和法杖，以该帧重新请求两秒 MiniMax H3 768p 原生正向完整周期。首尾约束包括头肩、手杖、脚底、衣摆轮廓、布料相位和速度方向；不倒放、不删帧裁短、不加停帧或透明淡化。请求与实际提示词、任务号和完整源片保存于 `idle/`。不把生成要求当作视觉通过。

新资源为 `pyro_idle_loop_v2` 和 `pyro_attack_user_v2`，两段共用512×512格子、画内高468、显示高146和脚底(256,496)，各段固定裁框和统一比例，整图直接镜像。攻击范围内无目标、无排队攻击并且收势结束才播放待机。

本批基础火法师普攻另按用户要求调整为1次/秒，原装备／强化／技能加成生效。旧攻击、旧待机和原始视频留作历史。全部效果由用户人工查看；不运行测试、游戏、浏览器或线上验收。合并构建发布记录见 `../pick-comic-v1/`。
''', encoding='utf-8')
print('Prepared release scripts, source manifests and documentation')
