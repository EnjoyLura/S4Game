# 重弩手待机／攻击切换黑闪修正

已构建并发布：[正式游戏](https://kingdom-watch.pages.dev/?v=sniper-switch-no-fade-1791903506) · [新版预览](https://kingdom-watch.pages.dev/previews/sniper-attack-forward-v4/?v=1791903506)。部署 `https://ee0f5d52.kingdom-watch.pages.dev`；Cocos web-mobile 成功退出码 36、8273ms，DPR 完成，Wrangler main 上传 3 文件、1017 缓存，记录见 `release.json`。

用户在 v4 预览中指出动作切换时角色黑闪。v4 新增的 80ms 透明度过渡同时降低两层人物透明度，常规覆盖合成时两层各 50% 会得到 75% 人物覆盖，深色背景透入，形成瞬间变暗。正式播放器和 Canvas 预览都有同样的过渡逻辑。

本轮移除两处透明度过渡：正式播放器恢复单个 Sprite 直接换帧，预览只绘制当前动作一次，切换不降低人物不透明度。继续使用已有 `sniper_attack_forward_v4` 44 帧与 `sniper_idle_forward_v2`，比例校准、脚底、出箭时序及直接左右镜像沿用既有设置。

不重新生成或修改人物图片、视频、图集；只修正动作切换代码，构建、DPR 补丁和发布，由用户人工查看效果，不执行测试、游戏、浏览器或线上验收。
