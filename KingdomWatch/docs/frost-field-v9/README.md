# 冰领域 v9：以认可的 MiniMax H3 v6 为基准精修

本版直接处理已有 v6 素材，没有调用任何生图或生视频接口。用户已明确要求后续视频只使用 MiniMax H3，不使用 Seedance。

修改范围：

- 圆度：所有帧共用同一套六边形到圆形的轻微空间映射，主要展开六个顶点之间的侧边，中心与顶点射线保持原位。最大径向展开约 15.5%，没有逐帧重新居中或追踪。
- 起手：移除原片第 0–21 帧的星芒和缓慢展开。以原片第 22 帧做两格短促透明度起手，40 毫秒后完全显现。
- 主体：继续播放 v6 第 22–55 帧，保留原有冰晶、寒气、碎冰与末尾淡出。完整技能约 0.86 秒。

## 预览与素材

- `frost-domain-preview.gif`：地面素材合成动图。
- `outline-comparison.jpg`：相同原始帧的圆化前后对比。
- `contact-sheet.jpg`：16 张关键帧总览。
- `frost-domain-preview.png`：完全展开的合成静帧。
- `sequence/frost_domain_video_v9.png`：36 格透明图集，8 列 × 5 行，每格 384 × 384。
- `sequence/frost_domain_video_v9.frames.json`：帧坐标与逐帧时长。
- `build_review.py`：可重现的处理脚本。
- `validation.json`：处理结果与原素材未改动的验证。

本次没有进入真实战斗画面，也未修改游戏资源或技能逻辑。v6 原文件保留，等待用户确认本版预览。
