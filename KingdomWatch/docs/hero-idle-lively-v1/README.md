# 两位英雄重新生成待机视频

2026-10-14，用户反馈上一轮待机仍不够灵动，明确要求重新生成视频。本轮沿用已确认的重弩手、雷法师站姿图与握持姿态，使用项目 MiniMax H3 分别重新生成视频。没有再次裁用此前 9／8 张安静帧，也没有生成新的静态母版。

本轮提示词把运动重点放在整片披风、袍摆和衣物褶皱的连贯起伏与回落，配合轻微呼吸；限制抬肩、扭腰、移动双脚与武器，不加入攻击、施法或发射光效。提示词是制作目标，动画效果由用户人工查看，不据此记作验收通过。

| 项目 | 重弩手 | 雷法师 |
| --- | --- | --- |
| 已确认母版 | `../sniper-stance-idle-v3/ready-red.png` | `../volt-stance-idle-v2/ready-red.png` |
| 新素材目录 | `../sniper-idle-lively-v1/` | `../volt-idle-lively-v1/` |
| 新视频任务 | `task_EitBsCykZfpPwn5aCiyusS6EkSgRdIHX` | `task_nFeFWhnNV3ek4aQABCiGLEQ9PWUxtuZX` |
| 请求时长／返回 | 2 秒／56 帧，24fps，约 2.33 秒 | 2 秒／56 帧，24fps，约 2.33 秒 |
| 连续循环源帧 | 4–53，共 50 张 | 2–44，共 43 张 |
| 单轮播放 | 3.076923 秒 | 3.076923 秒 |
| 新正式资源 | `sniper_idle_lively_v1` | `volt_idle_lively_v1` |
| 图集 | 4096×3584，7,674,676 字节 | 4096×3072，7,285,589 字节 |
| 画内基准高度／显示高度 | 467.1111／153 | 468.7165／146 |

保留全部原视频和 56 张源帧，用首尾接近的连续运动段制作循环；`loop-selection.json` 记录取帧范围及选择依据，仅用于素材制作。完整人物统一抠红、一次固定取景和等比缩放，512×512 格子与脚底 `(256,496)`，不拆分身体、不逐帧重估比例、不添加双图透明度切换。新待机按旧基准高度校准，重弩攻击资源 `sniper_stance_attack_v1` 保持原样；弓箭手图片、待机、攻击和显示高度 185.64 保持。

范围内没有目标且没有待发、攻击和收势时播放待机；交战、暂停和左右镜像逻辑沿用当前播放器。雷法师当前交战仍冻结同一新人物，其攻击序列不是本轮制作范围。

`preview.html` 同时提供原向、镜像、战场比例、原视频和 GIF 对照。`build_preview.cjs` 将新素材写入 `hero-idle-lively-v1` 并同步更新 `hero-idle-subtle-v2`、`hero-stance-rebuild-v1` 两个旧入口。构建 Cocos web-mobile 后运行 DPR 补丁，再用 `publish.ps1` 发布到 Cloudflare Pages `kingdom-watch/main`；沿用已有预览，排除用户否定的旧拆分动画预览。实际构建、部署和链接记录在 `release.json`。

按用户既有要求，只制作、接入、构建与发布，效果由用户人工查看；不运行测试、游戏、浏览器或线上验收。静态图片已确认，新动画尚未获得用户认可。

已发布：[新预览](https://kingdom-watch.pages.dev/previews/hero-idle-lively-v1/?v=1791909260) · [正式游戏](https://kingdom-watch.pages.dev/?v=hero-idle-lively-v1-1791909260)。部署 `https://09a54404.kingdom-watch.pages.dev`。
