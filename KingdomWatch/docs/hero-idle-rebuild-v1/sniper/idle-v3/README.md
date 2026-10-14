# 重弩手待机 v3：固定人物与武器，只保留衣摆运动

已构建发布：[新版预览](https://kingdom-watch.pages.dev/previews/sniper-idle-rebuild-v1/?v=1791856122)。46 张透明帧、两秒连续循环。H3 原视频为 56 帧、24fps、2.33 秒，原始输出与处理后的待机成片分别保留。发布记录见 `release.json`，效果由用户人工审阅。

用户指出 v2 的待机仍包含攻击动作并要求重新生成。本次仍用项目 `美术/tools/art_video_gen.py`、MiniMax H3、两秒请求和相同角色首帧，提示词改为“几乎静止的插画，只有蓝披风底部轻微摆动”。实际提示词见 `idle-prompt.txt`，任务状态见 `video-task.json`。

只靠负向提示词的前两版没满足待机要求，因此本次在新生成视频基础上增加成片合成：保留完整首帧作为静态底图，只有腰部以下蓝色披风布料及紧邻边缘使用 AI 视频中的运动。上身、头、双手、重弩、弩弦、装甲、腿和脚保持首帧。原始 H3 输出保存为 `ai-source.mp4`，合成后的待机成片保存为 `source.mp4`，处理记录见 `cloth-lock.json`。预览提供的是待机成片，不能把它称作未处理的 AI 原视频。

`lock_cloth_motion.py` 只在视频像素层面保留衣摆变化，不重绘人物、不拆开肢体、不做关节动画、不拉伸或扭曲图像，也不逐帧追踪或重新居中。人物与武器固定由成片处理实现，不再只依赖模型遵守提示词。视觉自然度仍由用户人工验收，按既有要求不运行游戏、浏览器或线上效果验证。

新序列帧资源为 `assets/resources/ux/sniper_idle_rebuild_v3/`，不覆盖旧版。原向与镜像共享整套透明帧、固定脚底与统一缩放；同时保留接触表、镜像 GIF、实际游戏地面与城墙合成 GIF。独立预览更新为 v3 文件名，当前游戏内重弩手动作仍沿用，弓箭手显示高度保持 221。

处理已有视频，不重复提交付费任务：

```powershell
python docs/hero-idle-rebuild-v1/lock_cloth_motion.py --take idle-v3
python docs/hero-idle-rebuild-v1/build_idle.py --hero sniper --take idle-v3 --cells 48
python docs/hero-idle-rebuild-v1/make_composite.py --take idle-v3
node docs/hero-idle-rebuild-v1/build_preview.cjs
```
