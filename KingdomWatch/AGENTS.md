# 交付要求

用户要求每次完成游戏改动后，都构建并发布到 https://kingdom-watch.pages.dev/，供手机浏览器体验。

使用既有 Cocos Creator 3.8.8 的 web-mobile 构建流程；每次构建后运行 `tools/patch-web-dpr.py`，完成相关检查，再通过项目现有 Wrangler 配置发布到 `kingdom-watch` 的 `main` 分支。部署后验证线上版本，交付可直接打开的游戏链接。具体命令见 README 的“构建与部署”一节。

Windows 构建用 `Start-Process -WindowStyle Hidden` 并将标准输出、标准错误重定向到 temp 日志，避免 Creator 的管道 EPIPE。若系统代理已启用，Wrangler 连接超时需在当前发布进程设置 `HTTPS_PROXY` 为系统实际代理地址；不要修改系统代理配置。

## 战斗特效经验

制作或调整战斗特效时先读 [冰系特效制作复盘](docs/冰系特效制作复盘.md) 与 `../美术/tools/AI视频特效工作流.md`。冰法师技能 v10（起手 0.4s、主体 0.42s、收尾 0.68s）已获用户认可；以它为冰系材质和运动基准。视频只用 MiniMax H3，不使用 Seedance，不自动切换更贵模型。沿用用户指定的素材合成预览与人工战斗验收流程；用户后续明确指示优先。
