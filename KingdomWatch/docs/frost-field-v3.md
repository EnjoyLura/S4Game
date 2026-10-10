# 寒冰领域：轻薄寒雾版

之前的大块碎冰底图覆盖了地形，厚实冰壳也削弱了释放和消散的变化。本版移除运行时的整片冰板，使用留空中心的稀疏寒雾与短促结冰冲击。

## 表现

- 开始约 0.34 秒：断续的柔和寒气波向外扩散，少量冰屑飞出。
- 冻结期间：三缕薄雾沿区域流动，以径向扭曲和两层不同速度的纹理采样避免整张贴图僵硬旋转。
- 冻结结束：寒气略向外散，约 0.55 秒内溶解淡出。
- 加法混合只叠加少量寒光，中心和地面纹理保持清晰，不画厚边、龟裂冰面或高大冰柱。
- 怪物脚底小冰块和冻结、减速的蓝色染色保持既有实现。

## 素材与实现

使用用户指定的 `Tools/gpt-image-2-skill` CLI，参考提供的 GIF 冷风造型生成单张素材。提示词：`frost-field-v3/prompt.txt`；原始输出：`frost-field-v3/frost-mist-source.png`。`frost-field-v3/prepare.py` 缩小为 512×512 RGB 光照纹理并清理接近黑色的底值。

运行时：`assets/resources/fx/frost_mist_v3.png`、`fx/frost-domain-v3.effect`、`battle/FrostVFX.ts`。黑底是加法光照的零贡献值，不作为普通带黑底的 Sprite 绘制；贴图和材质都准备好后才显示。四个池槽复用独立材质、Vec4 时间参数和 SpriteFrame，完全使用战斗模拟时间驱动，不使用视频序列或逐次分配材质。

技能数值维持既有版本：基础冻结 1.5 秒，技能基础倍率 2，解冻后减速 2 秒，Boss 不冰封。

## 验证

生成素材已检查留空中心、黑色边缘与尺寸；Creator web-mobile 构建完成，导出的 GLSL 1/3 均包含寒雾 shader，混合状态为 ONE/ONE。已运行 DPR 补丁。按用户既有偏好，实机战斗观感由用户验证。

全工程 TypeScript 检查仍有原有四项错误：`ArcherVFX.ts` 的 Asset/SpriteFrame 类型和两项 Sprite 混合字段声明、`MobAnim.ts` 的 Texture 导入；本次改动的 FrostVFX 无类型错误。本轮未修改这些文件。

已发布到 main：<https://kingdom-watch.pages.dev/?v=1791642923>。线上入口、主脚本和新 shader 文件与本地构建字节一致，入口 Cache-Control 为 no-cache；检查结果在 `frost-field-v3/build-check.json` 和 `frost-field-v3/online-check.json`。
