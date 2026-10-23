# 深林飞行怪与赤甲蛛王 · 视频序列帧 v87

[游戏试玩](https://enjoylura.github.io/kingdom-watch-play/?v=monster-video-v87) · [四怪独立循环与首尾/缩放对照](preview.html)

用户提供 `lens-api-task_S2F1payDFIr6mT5MbFUoMSBSvLVeriMs.mp4`，要求接入序列帧、选择首尾相近的动作，并修正红蜘蛛越走越大的问题。源片 1344×768、56 帧、24fps，2,907,920 字节，SHA-256 为 `ba02aab70163f1077345a68401144070b14532e6467b0751d2ac3f2574c4a25e`。原片归档在 `source/user-monsters.mp4`。

## 动作与图集

四只分别选择连续正向源帧，帧号从 0 开始、以下范围包含末帧；原视频下一帧仅供首尾比较，不重复加入循环。

| 怪物 / 游戏 ID | 源帧 | 帧数 | 24fps 周期 | 末首变化 / 源相邻变化中位数 |
| --- | --- | --- | --- | --- |
| 黑羽猛禽 / forest_eagle | 17～32 | 16 | 0.666667 秒 | 0.460 |
| 赤翼魔蝠 / forest_bat | 14～32 | 19 | 0.791667 秒 | 0.755 |
| 毒针蜂 / forest_wasp | 23～38 | 16 | 0.666667 秒 | 0.527 |
| 赤甲蛛王 / thorn_ancient | 13～46 | 34 | 1.416667 秒 | 2.263 |

这些数值只辅助选段，不证明动作无缝或已获用户认可。蜘蛛仍有原片腿部形变及轻微衔接差异。没有倒放、交叉淡化、时间补帧或重复端点。

共 85 帧，每帧 320×320；共用图集 `assets/resources/ux/forest_mob_walk_v87.png` 为 3240×2916、6,193,677 字节，SHA-256 `24f59c021db768e3d13b9ed225e708aa626c0231bd53ef437691fe67d348555a`。每只使用固定联合边界、缩放和锚点，所有输出帧四边至少留 12px 透明边距，预乘透明采样避免浅色边污染；没有逐帧按外接框放大或居中。清单记录周期、原速度、头顶及脚底。飞行怪不生成双脚接地阴影点。

## 红蜘蛛尺度处理与翼尖补边

只追踪蜘蛛中央甲壳和面部的固定特征，KLT 正反向检查与 RANSAC 相似变换测得全片缓慢放大约 9.078%。去除线性尺度和缓慢位移趋势，保留腿部动作、起伏和小幅透视变化；校正后的躯干追踪尺度为 0.995340～1.001055。没有用活动腿尖测量大小，避免把走路动作当作缩放而抹掉。见 `spider-stabilization.json`、`spider-body-anchors.png` 和 `spider-scale-comparison.jpg`。

源片少量鹰/蝠翼尖被原画面顶边或右边裁掉，展开时也有邻格重叠。仅在外侧重叠区按颜色及连通前景剔除邻格，随后用**同视频、同侧完整翼尖的边界轮廓配准**补回原视频范围之外的少量缺失。原画面内部 RGBA 保持，逐像素核对通过；不是新生图，也不是把扩大透明画布当作修复。所选循环需要的补边均有有效同源像素，但原片羽尖/形状变化仍有限制，不声称重建了真实三维动作。见两份 `*-wing-restoration.json`。

## 游戏接入

- 黄蜂保留 `forest_wasp` 的全部原数值、毒针及行为，只更换美术。第二章关底首领保留 `thorn_ancient` ID、数值、召唤和强化机制，外观及名称改为赤甲蛛王，仍在 2-10 出现。
- 新增猛禽与魔蝠，复用原林蛛的生命、伤害、速度、半径和奖励。第二章现有前排组按原林蛛、猛禽、灰狼、魔蝠轮换，只替换组内怪种，出怪数量、间隔及其他组不变。无尽怪池沿实际章节波次包含新怪。
- 新四怪走专用图集和现有动画/加载路径，预热清单同步。三只飞行怪驻足攻击时继续拍翼；冰封、眩晕等控制继续停帧。蜘蛛保持行走与驻足路径，强化阶段不跳回旧古树图。
- 上一轮第一章八怪 0.5 倍步态、抠图和体型调整保持；本次深林新动画正常倍率 1。灰狼、林蛛、藤怪 v85 资源和其他所有原媒体保持。

相对本轮开始，仅五份已有 TypeScript 修改：`MobAnim.ts`、`Monster.ts`、`ChapterContent.ts`、`ChapterWaves.ts`、`BattleEntryWarmup.ts`；新增图集、清单及两份 meta，共四个资源文件。原 1870 个 assets 无删除，所有旧媒体保持，当前共 1874 个 assets 文件。`source-changes.diff` 与 `static-asset-audit.json` 保存离线核对结果；类型检查仍为原来相同的 10 条诊断，无新增。

## 构建与发布

最终 Creator 3.8.8 production web-mobile / MD5 构建成功，19,756ms、成功退出码 36；DPR、资源预算及版本缓存准备完成。`build-final-out.log`、`build-final-err.log` 和 `build-record.json` 对应包含飞行驻足拍翼修正的最终构建；早期 `initial-release.json` 仅是中间上传记录。

仅发布独立 GitHub Pages 运行仓库，正式使用无损 WebP。396 张转换图片逐 RGBA 和哈希核对，1 张极小 PNG 保留；最终运行清单 1912 文件、373,404,398 字节（约 356.1MiB），项目子路径和全量本地清单通过。

- 运行仓库提交：`40bb74b6759c860e31f4896407695a9275f9264f`。
- 发布版本：`2f47dd6d51e20fda`；Pages `built`，`release.json` 中 `complete: true`。
- 13 份线上入口、脚本、图片、音频、字体及 WASM 文件样本 SHA/MIME 核对通过；只读取 WASM 字节，没有编译或执行。
- 本次新图集另外完整下载核对：HTTP 200、`image/webp`、4,691,078 字节，SHA-256 `d03c10b9696fe652d64d19580046947123f60dc85037f5405e5711ee8e56dce1`。见 `new-atlas-hosting.json`。
- 前版 703 份 native 路径及字节全部保持。源项目 HEAD 和暂存区保持，没有源码提交、暂存、回退，也没有清理上一版运行资源；未触发 Cloudflare 发布。

没有启动游戏、浏览器、战斗模拟、测试、音频或 WASM。构建和文件核对不代表动作、手机性能或战斗体验已经验收；实际观感请用户试玩确认。

## 制作文件

`prepare_source.py` 保留基线和源片，`analyze_video.py` 提取前景、校正蜘蛛并计算候选循环，`refine_wings.py` 从同源裁片重新补边，`bake_video.py` 烘焙图集和独立 GIF/8 秒预览，`make_comparison.py` 输出缩放对照，`audit_assets.py` 核对资源与配置。在线只读文件核对用 `verify_hosting.py`。

Python 使用 `C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe -X utf8`；OpenCV 位于忽略的 `build/video-processing-deps`。本轮没有生成新 AI 图片或视频。四个 GIF 各展示完整独立循环；8 秒合成 MP4 仅用于观察多次衔接，不是四个周期的公倍数。
