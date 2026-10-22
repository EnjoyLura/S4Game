# GitHub Pages 独立发布

- 固定游戏入口：https://enjoylura.github.io/kingdom-watch-play/
- 不启动游戏的诊断页：https://enjoylura.github.io/kingdom-watch-play/hosting-diagnostics.html
- 公开运行包仓库：https://github.com/EnjoyLura/kingdom-watch-play
- 原 Cloudflare 地址继续保留：https://kingdom-watch.pages.dev/

## 更新命令

在 `D:/AI/S4Game/KingdomWatch` 执行：

```powershell
./tools/publish-github-pages.ps1
```

依次沿用原 `build-web.ps1` 正式导出、DPR 补丁和版本准备，然后生成子路径运行包、检查所有文件散列及资源引用、离线验证入口和 WASM、提交并推送独立仓库，最后等待 Pages 并做 HTTP 校验。第一次已创建仓库并启用 `main` 分支根目录发布，包内包含 `.nojekyll`。

已有最新正式构建时可用 `-SkipBuild`；只检查上一次上传和部署、不构建或推送时用 `-StatusOnly`。默认等候 240 秒，可用 `-WaitSeconds 600` 延长。GitHub 排队超过时间会明确报告未完成，稍后运行 `-StatusOnly`，不要把上传成功当成上线成功。

配置在 `tools/github-pages/config.json`，本机独立发布 checkout 为 `D:/AI/kingdom-watch-pages`。凭据由 Git Credential Manager 在进程内读取，不写入文件、URL 或运行包。需要当前 GitHub 账号拥有该仓库权限；本机使用既有 Python、Node 和 Cocos Creator 3.8.8。

只在独立仓库执行 add / commit / push。原项目的提交、暂存区和 CF 发布脚本不变；该命令不会同步发布 CF。

## 包结构和缓存

仅复制浏览器所需的 `assets/`、`src/`、`cocos-js/` 以及入口、样式和许可说明。排除开发配置、源码目录、日志、缓存、Source Map、CF `_headers` 和函数。公开仓库中的运行资源公开，但不包含原项目开发仓库。CF `functions/report.js` 不会迁入静态托管。

固定 `index.html` 通过 `cache: no-store` 和查询参数读取小型 `hosting-release.json`，再联网读取、验证 SHA-256 后加载对应的 `game.<散列>.html`。引导失败显示错误和重试按钮，不自动刷新。HTML 的 `<base>`、启动设置、import map、引擎脚本、effect 二进制和原资源均适配 `/kingdom-watch-play/`。

游戏资源沿用 Cocos MD5 路径。构建后修改的引擎额外使用 engine revision 路径，启动依赖与 effect 使用实际内容散列路径。更新同时保留上一版需要的文件，防止仍开着的上一版页面立即丢失资源；再上一个版本不长期保留。若未版本化的运行文件内容发生冲突则拒绝发布。

GitHub Pages 的 HTTP 缓存由平台控制，实测 `max-age=600`；本方案不能通过 CF `_headers` 设置一年缓存。入口与清单明确联网，资源使用稳定版本路径。未添加 Service Worker，不抢占同一 GitHub 域名下其他项目。

当前单文件和当前加上一版的总量均在发布前检查。运行包约 646 MiB；后续资源增加超出预算会中止并说明，不会静默漏传。

## WASM 与诊断

本轮 Cocos 导出只有一个 Spine WASM，内存未共享，无 pthread / SharedArrayBuffer 依赖，因此不需要 COOP/COEP 或隔离 Service Worker。诊断页显示 `crossOriginIsolated: false` 在当前包是正常状态。以后检测到共享内存会中止发布，必须先适配并验证隔离。

诊断页只读取环境、版本和资源，不加载 Cocos、不实例化 WASM、不启动战斗。自动核对清单、入口及 WASM 的散列，并只编译 WASM。可手动启动全资源下载校验，流量约 646 MiB。

## 验证记录

首次发布记录：`first-deployment.json`。最新发布记录：`deployment.json`。部署完成才会写入 `complete: true`。

2026-10-20 已完成首次上线和一次实际更新：`698eec5` → `220ff1f`，版本 `6bdf4af8dfa1a891` → `9f7d0d8ad0652a34`，固定网址保持。再用完整 `-SkipBuild` 命令重复发布相同包，commit 不变且上一版文件保留。`full-cdn-audit.json` 记录全量线上校验：当前 2101 个清单内文件，加上一版独有 12 个路径，共 2113 个、680027865 字节，全部字节数和 SHA-256 匹配；版本指针、两版清单也分别核对。WASM 只验证/编译，没有实例化。`update-verification.json` 记录 CF 原入口仍为 v66，`command-validation.json` 记录原构建与一条命令执行情况。

发布命令验证全部本地文件 SHA、独立仓库远端 commit、固定入口和清单、若干线上 JS/JSON/PNG/字体/MP3/WASM 的字节散列及传输解码。离线入口检查覆盖首次、重复访问、新版本和损坏入口，损坏时不执行游戏。这里的离线检查不等于真实手机游戏运行验证。

本轮没有打开游戏或浏览器、没有执行战斗和音频验收。手机上首次进入、再次进入、更新后的实际游戏表现由用户体验。两种托管域名的浏览器存档相互独立，本轮没有做存档迁移。

可用 `python tools/github-pages/audit-live.py` 重跑全量线上文件散列检查，包含当前与上一版保留的旧路径，报告为 `full-cdn-audit.json`。这是只读下载，不启动游戏；本轮流量约 650 MiB。
