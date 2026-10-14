# 弓箭手战斗基准图重做 v1

当前 v3 已构建发布：[左右镜像预览](https://kingdom-watch.pages.dev/previews/archer-combat-rebuild-v1/?v=1791828720) · [透明 PNG](https://kingdom-watch.pages.dev/previews/archer-combat-rebuild-v1/archer-ready-up-left-v3.png?v=1791828720)。发布记录见 `head-up-release.json`。

2026-10-13 最新微调：用户选择直接左右镜像，先要求头部向中间转，随后要求再更朝正上方一点。通过内置 image_gen 逐次编辑，当前 v3 以接近正背面的后脑视角为主，延续持弓备战姿态。新版保存为 `archer-ready-up-left-v3.png`，原 v1、v2 保留；预览默认展示 v3，脚底原点 `[576,1401]`、人物高度 1287。最终实际提示词见 `head-up-prompt.txt`，来源与保存记录见 `head-up-generation.json`，前次编辑见 `head-center-generation.json`。本次没有接入转身动画，仍由用户人工验收。

2026-10-13 用户要求根据英雄立绘重新生成弓箭手战斗图片，便于镜像并使姿态自然。本轮交付单方向完整人物静态基准图，供后续待机、射箭视频和完整序列帧制作使用。

身份参考是 `assets/resources/ux/hero_comic_v1/comic_figure_archer_v1.png`，背部视角参考为此前的正背面静态图。新图采用朝左上方的后侧视角、轻微俯视、稳定落地站姿、自然弯肘持弓、箭留在箭袋内。棕色短发男性精灵、尖耳、绿斗篷、米白袖子、棕色皮革和绿金反曲弓沿用立绘。运行时可将整张人物图镜像得到右上方向。

通过内置 image_gen 工具生成，最终选用 `ready-prompt.txt` 的输出。1024×1536 RGBA 原图保存在本目录 `archer-ready-up-left.png` 和 `assets/resources/ux/archer_combat_rebuild_v1/archer-ready-up-left.png`。保存为原文件直接复制，保留透明通道；没有代码重绘、拆肢、变形或生成独立右向图。生成过程与实际提示词见 `generation.json`；首两版偏满弓侧射未选用，额外提取版改动了取景也未选用。最终图外部颜色的 alpha 为零，预览按原始透明通道合成。

`art.json` 记录画布、角色区域、脚底原点和显示高度。预览使用同一张图片与固定脚底原点，提供原向、镜像、146 设计单位显示尺寸与浅／深背景。`node docs/archer-combat-rebuild-v1/build_preview.cjs` 打包到 `previews/archer-combat-rebuild-v1/`。

本轮完成静态美术和独立预览，不以这张静态图替换当前战斗的完整视频动作。当前战斗待机／攻击、范围条件和弹道继续沿用既有实现。没有生成新动作视频或声称新图已获认可；按用户要求，效果由用户人工验收，Codex 完成构建、DPR 补丁和发布，不运行自动游戏／交互／线上效果验证。发布信息见 `release.json`。

已构建发布：[原向／镜像对照页](https://kingdom-watch.pages.dev/previews/archer-combat-rebuild-v1/?v=1791826758) · [透明原图](https://kingdom-watch.pages.dev/previews/archer-combat-rebuild-v1/archer-ready-up-left.png?v=1791826758) · [部署快照](https://17733887.kingdom-watch.pages.dev)。
