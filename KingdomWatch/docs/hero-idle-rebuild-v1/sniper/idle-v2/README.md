# 重弩手两秒待机重制

已完成构建、DPR 补丁与 main 发布：[新版预览](https://kingdom-watch.pages.dev/previews/sniper-idle-rebuild-v1/?v=1791855405)。实际输出为 768×1344、24fps、2.33 秒，48 张透明帧以两秒连续循环播放。此次端点匹配成立，没有使用往返循环。发布记录见 `release.json`。

2026-10-13 用户要求重新生成两秒重弩手待机，禁止攻击动作。沿用 `../sniper-ready.png`，不改变人物图片。使用项目 `美术/tools/art_video_gen.py` 与 `lens-minimax-h3-768p`，请求参数 `seconds=2`、`ratio=3:4`；实际提示词见 `idle-prompt.txt`。

第一次请求因余额不足在创建任务前被拒绝，记录保留在 `submission.json`。用户随后要求继续，现已创建新任务 `task_poRuUzKNI9Hs3cc2B7iEYrnPsdsfU6jV`，状态记录在 `video-task.json`。这次没有再改成一秒档，也不使用旧任务结果。

提示词将武器、弦、弩箭、手臂、头、双腿和脚固定在首帧姿态，只允许轻微呼吸造成的布料起伏与披风末端摆动，明确禁止攻击、开火、后坐、装填、转身与弹道光效。生成结果仍由用户人工验收，不把提示词约束当作视觉验证通过。

出片后，保留原视频 `source.mp4`，抽取最多 48 张完整人物透明帧，使用固定联合裁切、固定缩放与脚底原点。新资源存放于 `assets/resources/ux/sniper_idle_rebuild_v2/`，不覆盖上一版。完整帧、接触表、镜像 GIF 与真实游戏素材合成 GIF 保存在本目录。预览采用带 v2 的独立文件名，避免把旧版误认为新视频。

循环端点接近时使用连续两秒播放；端点有明显差异时以连续往返形成四秒循环，保留完整帧而不进行交叉淡化、逐帧居中或肢体变形。视频请求时长与最终循环时长分别记录；实际返回的媒体时长以打包记录为准。

弓箭手保持现有线上图片、待机和攻击，显示高度继续为 221。本轮只更新重弩手独立预览，不替换现有重弩手战斗动作。

处理已有视频，不会重新提交生成任务：

```powershell
python docs/hero-idle-rebuild-v1/build_idle.py --hero sniper --take idle-v2 --cells 48
python docs/hero-idle-rebuild-v1/make_composite.py --take idle-v2
node docs/hero-idle-rebuild-v1/build_preview.cjs
```
