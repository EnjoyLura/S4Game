# 交付要求

用户要求每次完成游戏改动后，都构建并发布到 https://kingdom-watch.pages.dev/，供手机浏览器体验。

使用既有 Cocos Creator 3.8.8 的 web-mobile 构建流程；每次构建后运行 `tools/patch-web-dpr.py`，完成相关检查，再通过项目现有 Wrangler 配置发布到 `kingdom-watch` 的 `main` 分支。部署后验证线上版本，交付可直接打开的游戏链接。具体命令见 README 的“构建与部署”一节。

Windows 构建用 `Start-Process -WindowStyle Hidden` 并将标准输出、标准错误重定向到 temp 日志，避免 Creator 的管道 EPIPE。若系统代理已启用，Wrangler 连接超时需在当前发布进程设置 `HTTPS_PROXY` 为系统实际代理地址；不要修改系统代理配置。
