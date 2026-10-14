# 重弩手去特效攻击正式接入

用户要求把已发布试做预览中的清理版攻击应用到游戏。正式重弩手的攻击资源由 `sniper_attack_natural_v1` 改为 `sniper_attack_clean_v1`，沿用完整的 56 帧正向时序、实际发弹回调和既有按攻速适配的准备／释放／上弩／回正播放流程。

当前待机 `sniper_idle_natural_v2`、共享画内基准 467.1111、显示高度 153 和脚底 `(256,496)` 保持；攻击与收势期间不播放待机，范围内无目标、无排队攻击且收势结束后恢复待机。整图镜像，保持全不透明直接换帧。伤害、攻击间隔、弹道和音效保持。

清理素材、原视频、局部修复与对照来源见 `../sniper-attack-clean-v1/README.md`。弓箭手及雷法师媒体、时序和资源引用保持。用户选择这份素材正式应用，游戏中视觉效果仍由用户人工查看。

只进行接入、Cocos web-mobile 构建、DPR 补丁、预览包装和 Cloudflare Pages main 发布；不运行测试、游戏、浏览器或线上验收。

已发布：[正式游戏](https://kingdom-watch.pages.dev/?v=sniper-attack-clean-live-v1-1791953086) · [素材对照](https://kingdom-watch.pages.dev/previews/sniper-attack-clean-v1/?v=1791953086)。构建 9534ms，Cocos 退出码 36，DPR 完成，Wrangler main 成功。
