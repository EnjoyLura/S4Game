# 冰领域 v8：完整圆形冰面与外围大冰晶

按用户提供的完全展开图描述目标形态：圆润冰面、分支裂纹、明确的外围大冰晶，左右边缘与冰晶尖端完整入画。图片只用于理解造型，未作为视频接口输入。

上一版展开时左右内容触到原视频边界，侧面轮廓被截断。本次先尝试原通道，仍出现竖画幅与裁边，因此改用横幅视频通道。该通道实际要求最短 4 秒；交付视频保留完整单次释放的画面并统一为 2 秒，技能素材按约 1 秒播放。

- `frost-domain-preview.gif`：离线地面素材合成预览。
- `frost-domain-preview.png`：完全展开的素材合成静帧。
- `frost-domain-video-2s.mp4`：2 秒视频。
- `contact-sheet.jpg`：16 张关键帧总览。
- `sequence/frost_domain_video_v8.png`、`sequence/frost_domain_video_v8.frames.json`：透明序列帧图集与播放信息。
- `raw/seedance-4s.mp4`：原始连续 AI 视频。
- `prompts/landscape-4s.txt`：实际生成提示词。
- `generation.json`、`validation.json`：生成与抽帧记录。

横幅原片的视角将冰面压成了宽椭圆，因此另做固定的地面投影校正：只将盘面所在的纵深区域展开，保留后排晶体尖端所在区域的高度，并增加画面留白。整段共用同一套平滑映射，没有按帧追踪或移动控制点。参数记录在 `projection-correction.json`，校正过程可通过 `correct_projection.py` 重现。

图集从连续视频均匀选取 56 张真实帧，不进行 AI 插帧或逐帧重新居中；统一裁切、缩放、位置与末尾淡出。原片为 121 帧、24 FPS，服务实际返回约 5.04 秒；交付视频统一到 2 秒，图集按 1 秒播放。

没有进入真实战斗，也未接入游戏，等待用户确认。
