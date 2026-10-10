# 寒冰领域：AI 冰晶分层特效

按用户提供的冰晶图片材质与 GIF 的表现重做技能：冰晶快速立起、寒气绕行、解冻时碎裂散开。

## 素材

使用用户指定的 `Tools/gpt-image-2-skill` CLI，参考用户冰圈图片和 GIF 第 11 帧生成四个独立的静态图层。提示词：`frost-field-v4/prompt.txt`；源图：`frost-field-v4/ice-layers-matte.png`。

四层为冰晶边缘 `rim`、中央冰柱 `spire`、碎裂爆发 `burst` 和小冰屑 `shard`。它们是独立组件，没有时间帧序列；运行时使用代码控制各层的展开、位置、亮度和消散，不使用 AI 视频。

CLI chroma 透明提取使用自动识别的 #fc03fa 底色、soft-3d 材质和 spill-suppression=1。`prepare.py` 清理空白边缘的一处杂点并生成 1024×1024 RGBA 图集，大小约 497 KB。最终 effect-profile 严格验收通过，无警告，透明像素约 85.2%。图集与锚点数据：`assets/resources/fx/frost_ice_v4.png` 和 `frost_ice_v4.frames.json`。

## 动画与遮挡

- 冰晶边缘在约 0.14 秒展开，中心留空，地面纹理保持可见。
- 中央冰柱在约 0.16 秒立起，轻微回落定形；摆在地面特效层，怪物绘制在其上方。
- 寒光沿冰晶表面扫过，寒雾沿区域流动。
- 解冻时，中央冰柱迅速淡去，冰面溶解，碎裂图层与六枚冰屑向外飞散；总消散约 0.55 秒。
- 四个领域池槽复用独立材质、时间参数和 Sprite，完全按战斗模拟时间驱动，暂停和倍速跟随战斗。

表现实现为 `battle/FrostVFX.ts`、`fx/frost-ice-v4.effect`，寒雾复用既有 AI 纹理和 shader。基础冻结 1.5 秒、技能倍率 2、解冻后减速 2 秒以及怪物脚底冰块、蓝色染色、Boss 不冰封的规则保持既有实现。

## 验证

生成素材、透明边缘和图集布局已检查；Creator web-mobile 构建完成，新 shader 已导出 GLSL 1/3，DPR 补丁已执行。全工程类型检查仍有原有的四项错误（ArcherVFX 三项，MobAnim 一项），本次 FrostVFX 无新增类型错误。

`frost-field-v4/ice-effect-preview.gif` 是在游戏地面图片上合成的素材动画预览，用于检查大小、锚点、展开和消散，不是实机录像。实机战斗观感仍由用户手动验证。

已发布 main：<https://kingdom-watch.pages.dev/?v=1791645567>。线上入口、主脚本和新冰晶 shader 与本地构建字节一致，Cache-Control 为 no-cache；核验记录为 `frost-field-v4/online-check.json`。
