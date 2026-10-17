# 分批音效试听 · 第 1 批

用户要求按组分批为每个用途制作新旧试听，沿用 v21 的逐条试听方式。此目录只制作独立预览；正式游戏保留当前 v21 音效。

## 最新：免费卡通风重选 cartoon-r1

用户已否定全部 growth-r1 新候选，并进一步明确要求免费、高质量、欧美卡通方向。本轮使用两套免费作者成品重新准备 [cartoon-r1 试听](https://kingdom-watch.pages.dev/previews/audio-comparison-batches-v22/cartoon-r1/?v=cartoon-r1)：仅 D01–D03，每项旧版 + A/B，两条升级乐句来自 Tim Beek 的 Casual SoundFX Pack（免费 CC BY 4.0，随包许可与 `Audio by timbeek.com` 署名完整保留）；四条短反馈来自 Dustyroom 的 Free Casual Game Sounds（官网非 Unity 版，随包 CC0 许可已核对）。完整来源、选择依据与处理见 [本轮素材记录](cartoon-sources-20261017.md)。不重复使用此前已否定的九条候选。

共 6 个新候选、3 个当前 v21 对照、3 个五连升示例。保留立体声、完整乐句与尾音，只去近静音、2ms 首尾淡变、匹配参考活动段 RMS；不变调、不变速、不重新合成、不添加压缩或效果。五连升每 240ms 一次，供判断实际重复节奏。两套素材下载费用均为零，未购买无署名授权或付费音包。

页面支持单条/顺序/整批试听、音量、停止、后台清理、独立保存选择和导出；连听留 450ms 间隔，不让前后尾声混在一起。原第一批及 growth-r1 页添加最新入口，历史记录保留。本轮仅离线解码与文件/采样检查，未播放音频、运行浏览器/游戏或验收听感；作者用途说明及信号分析只是初选依据，音色是否对味仍待用户确认。正式游戏、C01/C03/C04/D04/D05 保留旧版的决定均保持。

离线记录：`cartoon-report.json`，12 条立体声文件约 2.19MB，零削波，组内参考 RMS 差不超过 0.001dB；JavaScript 语法检查通过。旧生产快照 2,243 文件散列不变；发布目录共 55 个本次及历史比较预览文件、65 个本地引用有效。`stage.py` 同时核对本轮源文件/原包/许可散列。没有修改游戏脚本和运行资源，无需 Cocos 重构建。

已完成 Wrangler main 部署：<https://016e432b.kingdom-watch.pages.dev/previews/audio-comparison-batches-v22/cartoon-r1/?v=cartoon-r1>。正式域名入口见本节首段；发布不代表听感获认可。

## 第一批选择与升级反馈重选

用户已选择 C01 领奖、C03 购买、C04 招募、D04 突破、D05 主城升级保留 v21；D01 单次升级、D02 连续升级、D03 数字落点对第一批候选不满意，现已单独发布第二组比较：[重选 D01–D03](https://kingdom-watch.pages.dev/previews/audio-comparison-batches-v22/growth-r1/?v=growth-r1)。每项保留当前 v21，并提供 3 个公开素材候选；播放、选择记录和备注均独立保存。正式游戏仍使用 v21，未有候选被默认接入。

本轮校验通过：旧生产快照 2,243 个文件无变化、37 个预览文件、40 个本地页面/音频引用有效，来源音频散列一致；JavaScript 语法检查通过。只发布预览，不运行游戏、浏览器或试听音频；音色是否满意由用户选择决定。

- 预览入口：<https://kingdom-watch.pages.dev/previews/audio-comparison-batches-v22/>
- 第一批：C01 领奖、C03 购买、C04 招募、D01 单次升级、D02 连续升级、D03 数字落点、D04 突破、D05 主城升级，共 8 对。
- 旧版基线：当前 `assets/resources/audio/v21`，不再使用 v21 预览中的更早基线冒充当前版本。
- 新候选：David McKee（ViRiX / VIRiX Dreamcore）的三套公开样本；依据 CC BY 3.0 使用，逐条源文件、源页面、散列、处理参数在 `preview/data.json`。作者鸣谢在预览可见的 `CREDITS.txt`。
- 两侧仅用标量增益匹配活动段 RMS，统一 44.1kHz / 16bit / mono。新候选去近静音、2ms 边缘淡变；D04 完整乐句无变调加速 1.25 倍。没有重写旋律、EQ、压缩或限幅。不把单纯变响作为音质改进。

## 使用

逐条点击“旧版 / 新候选”，或点击“旧 → 新 连听”。也可连听本批全部旧版或新候选；同一时间只播放一条。停止、切后台、离开页面会结束播放，页面不自动播放。

可选保留旧版、选新候选、都不满意或未决定，可填写备注。结果仅保存在当前浏览器，按候选修订号隔离；不会上传。用户点击复制结果或下载 JSON 后发回，才视为收到明确选择。未选择不默认接入候选。

## 全量计划

完整 61 个用途各出现一次，保留 `docs/audio-replacement-list/音效用途映射.json` 的编号；本轮只准备第一批，其余状态明确为待制作：

1. 奖励与成长：8
2. 胜败与奖励落点：5
3. 三选一：4
4. 界面操作：8
5. 艾拉：5
6. 凯尔：5
7. 焰辉：5
8. 沃尔：5
9. 莫拉：5
10. 战斗提示与战利品：6
11. 击杀：5

分组编号、名称和状态见 `batch-plan.json`，页面也列出完整用途。背景音乐不在 61 项音效之内。

## 来源与复现

原作者页面与下载记录见 `sources/downloads.json`，下载的原包和页面证据保存在 `sources/`。公开页面：

- <https://opengameart.org/content/ui-sfx-pack-2-sample>
- <https://opengameart.org/content/ui-and-item-sound-effect-jingles-sample-2>
- <https://opengameart.org/content/ui-and-item-sounds-sample-1>
- 本次另保存 `UI Sound effects pack`，未用于本批候选，不发布该原包。

运行 `prepare.py` 仅离线解码和打包，不播放音频，不启动浏览器。`offline-audio-report.json` 是文件/采样检查，不是听感验收。候选听感未由 Codex 试听或获用户认可。

发布时复制上次正式 v21 发布快照，仅新增该预览目录。对原快照逐文件比较散列，保留游戏入口、所有 native 资源、原鸣谢与历史预览；没有修改游戏脚本和资源，因此不重新构建 Cocos。部署记录与离线发布文件检查由 `publish.ps1` 保存。未运行测试、模拟、游戏、浏览器、音频播放或线上效果验收。

已完成部署：<https://dcbcec2c.kingdom-watch.pages.dev/previews/audio-comparison-batches-v22/?v=batch-01-r1>。生产main预览入口见上文。原2243份发布文件逐一散列保持，仅新增21份预览文件。
