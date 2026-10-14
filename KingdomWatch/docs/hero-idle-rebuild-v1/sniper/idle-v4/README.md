# 重弩手完整人物待机 v4

已按用户最新要求接入[正式游戏](https://kingdom-watch.pages.dev/?v=sniper-live-archer-84-1791868072)，详见 `../../../sniper-battle-integration-v1/README.md`。新形象在整个战斗期间使用，空闲时播放四秒待机，瞄准／射击／收势时保持当前完整持弩姿态并直接镜像；弓箭手同时缩小 16% 到显示高度 185.64。下方为本素材此前的预览制作记录。

当前修正版已构建发布：[最新预览](https://kingdom-watch.pages.dev/previews/sniper-idle-rebuild-v1/?v=1791866900)。修正弩内封闭空隙的黑底残留；循环改为相邻原帧前进／返回，并在两端减速，共 110 个播放项、四秒一轮。保持原视频、56 格完整人物图集与固定比例，详细方法见 `matte-fix/README.md`；修正前材料保存在 `matte-fix/before/`。下方初版两秒直接循环的时序说明已被本次修正取代。

已构建发布：[新版预览](https://kingdom-watch.pages.dev/previews/sniper-idle-rebuild-v1/?v=1791866090)。实际 AI 输出为 768×1344、24fps、56 帧、约 2.33 秒；完整保留 56 帧，统一重定时为两秒循环，图集为 3072×4032。原视频保持接口输出，效果由用户人工查看。

用户否定 v3 的披风局部合成：身体僵硬、只有末尾飘动，披风连接错位。本次保留已选定的完整人物基准图，重新请求两秒 MiniMax H3 视频，目标为整个人物的一次自然呼吸：肩背轻起伏、手臂随肩背带动持弩、披风从肩部到下摆连贯跟随，两脚站稳；武器始终保持机械静止，不开火、不装填、不后坐。

任务记录在 `video-task.json`，提示词在 `idle-prompt.txt`。视频工具仍是项目 `美术/tools/art_video_gen.py`，未升级模型。`source.mp4` 保存原始 AI 输出，不经过首帧身体冻结或局部披风蒙版合成。

序列帧制作改为直接解码原始分辨率、对完整人物抠黑底，再统一裁剪并做一次最终缩放。每个格子为 384 × 576，比旧版 256 × 384 提高 50%；全部帧共用裁剪、比例及脚底原点。抠黑只移除与画面边缘连通的暗色背景，保留人物内部的深色衣服和描边，不再额外全局清除黑色像素或反复羽化。

保存视频中的每一张连续帧。初版按两秒直接循环，用户指出首尾差异造成硬跳后，现已改为四秒往返，并按余弦曲线设置每帧时长，完整保留相邻源帧，不跳帧、不交叉淡化，也不拼接冻结的身体。接口实际返回的时长与帧率保存在图集清单的 `source` 和 `processing` 中；原始视频保留接口节奏。预览同时提供源视频、透明帧镜像、逐帧查看和场景素材合成。循环衔接与动作自然度由用户人工查看。

新素材现已接入正式游戏，运行时读取同一图集与 `animation.frameDurations`；弓箭手继续沿用线上原图、待机与攻击，按最新指示将显示高度调整到 185.64。完成素材接入、Cocos 构建、DPR 补丁及 Pages 发布，效果由用户人工验收，不运行游戏、浏览器或线上效果验收。

重现已有视频的打包流程，不重复提交生成任务：

```powershell
python docs/hero-idle-rebuild-v1/build_idle.py --hero sniper --take idle-v4
python docs/hero-idle-rebuild-v1/make_composite.py --take idle-v4
node docs/hero-idle-rebuild-v1/build_preview.cjs
```

输出尺寸与帧数见 `packaging.json`，发布信息见 `release.json`。
