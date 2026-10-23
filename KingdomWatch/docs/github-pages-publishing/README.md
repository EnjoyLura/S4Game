# GitHub Pages 独立发布

- 固定游戏入口：https://enjoylura.github.io/kingdom-watch-play/
- 不启动游戏的诊断页：https://enjoylura.github.io/kingdom-watch-play/hosting-diagnostics.html
- 公开运行包仓库：https://github.com/EnjoyLura/kingdom-watch-play
- 原 Cloudflare 地址继续保留：https://kingdom-watch.pages.dev/

## 更新命令

在 `D:/AI/S4Game/KingdomWatch` 执行：

```powershell
./tools/publish-github-pages.ps1 -PrunePreviousRelease
```

依次沿用原 `build-web.ps1` 正式导出、DPR 补丁和版本准备，再生成子路径运行包、静态核对全部文件散列和资源引用、检查 WASM 头与内存要求，提交推送独立仓库，最后等待 Pages 并做 HTTP 校验。默认不执行游戏、浏览器、JS/WASM 或旧入口测试脚本。已配置 `main` 分支根目录发布，包内包含 `.nojekyll`。

2026-10-24 已接入[200MB混合编码v88](../art-mixed-v88/README.md)：默认 `mixed-webp-q95`，保护界面、九宫格、小图、头像和原特效，大幅插画及动画图集采用Q95 RGB编码，仅更小时使用；尺寸、透明度、ICC和动画清单保持。源PNG和正常Cocos导出保留，完整运行包（含版本指针和清单）超过200,000,000字节时中止。缓存只在本地；可显式重新导出无损或PNG回退版本，两种回退保留500MB预算。首次切换或保留旧版使站点超过200MB时，须加 `-PrunePreviousRelease` 仅保留当前运行包；独立仓库的Git历史仍保留。前版[无损管线v82](../art-resource-pipeline-v82/README.md)是实现基础，其“默认无损/500MB”已由本条替代。

2026-10-24 [其他资源v89](../resource-other-v89/README.md)将210份非声明旧音效移到本地可恢复归档，完整64类音效声明和4首音乐的80文件保留原字节；构建前新增静态音频目录检查。受保护图片加入method4/6无损择小，196图再省1.20MB，全部图片解码像素与v88相同；完整包168.01MB，200MB限制与发布命令保持。

2026-10-24 [浏览器按需缓存v90](../browser-cache-v90/README.md)添加只限本项目scope的缓存Worker，资源首次使用时下载/验证并保存，更新复用未变内容，不预下载整包。入口/版本指针保持联网，散列入口/清单也可复用，缓存不可用时自动走HTTP。完整包168.03MB，画面和音频原字节保持。此Worker用于普通资源缓存，当前单线程WASM仍不需要跨源隔离。

2026-10-22 已补齐只校验模式、可配置文件、预制包复用、进程代理恢复和分阶段报告。参数如下：

| 参数 | 行为 |
| --- | --- |
| 无参数 | 正式构建 → 导出 → 静态校验 → 提交推送独立仓库 → 等待 Pages → HTTP 核对 |
| `-ValidateOnly` | 只导出、校验现有生产构建；不读 GitHub 凭据，不构建、提交或上传 |
| `-SkipBuild` | 复用已准备的生产构建，继续导出和发布 |
| `-PrunePreviousRelease` | 本次发布只保留新运行包，清掉上一版独有的已跟踪运行文件；保留未跟踪文件与 Git 历史。默认不启用，仅发布模式可用 |
| `-StatusOnly` | 只校验上次运行包并查询部署、核对线上文件；不构建、提交或推送 |
| `-PreparedPackage <目录>` | 校验并发布指定的已导出包，跳过构建与再次导出 |
| `-TextureMode mixed-webp-q95` | 默认混合编码；保护UI等无损，适合的大图Q95，完整包上限200MB |
| `-TextureMode lossless-webp` | 显式无损WebP回退；逐像素验证，仅采用更小结果，上限500MB |
| `-TextureMode original-png` | 新导出保留原PNG，用于兼容回退；不与PreparedPackage/StatusOnly组合 |
| `-ProxyUrl http://127.0.0.1:7897` | 仅本次进程使用指定代理，结束后恢复环境变量；不改系统代理 |
| `-ConfigPath <文件>` | 使用指定的发布配置；默认 `tools/github-pages/config.json` |
| `-WaitSeconds 600` | 最长等候秒数，默认240，可设0～3600；0为查询一轮 |

```powershell
# 本地导出和检查
./tools/publish-github-pages.ps1 -ValidateOnly

# 网络需要当前本地代理时
./tools/publish-github-pages.ps1 -ProxyUrl http://127.0.0.1:7897

# 上传后仍在排队，稍后仅检查部署
./tools/publish-github-pages.ps1 -StatusOnly -ProxyUrl http://127.0.0.1:7897
```

退出码0表示本次操作校验完成，2表示已上传但 Pages 尚未上线，1表示失败。等待超时保留包与部署记录，稍后运行 `-StatusOnly`；不会把上传成功当成上线成功。只校验报告独立写入 `validation.json`，不会覆盖最后一次部署记录。发布前仅在独立仓库快进同步远端，遇到未提交修改或分叉则停止，不强制推送或重置。

配置在 `tools/github-pages/config.json`，本机独立发布 checkout 为 `D:/AI/kingdom-watch-pages`。凭据由 Git Credential Manager 在进程内读取，不写入文件、URL 或运行包。需要当前 GitHub 账号拥有该仓库权限；本机使用既有 Python 和 Cocos Creator 3.8.8 构建工具；静态校验不依赖 Node 运行入口代码。

只在独立仓库执行 add / commit / push。原项目的提交、暂存区和 CF 发布脚本不变；该命令不会同步发布 CF。

## 包结构和缓存

仅复制浏览器所需的 `assets/`、`src/`、`cocos-js/` 以及入口、样式和许可说明。排除开发配置、源码目录、日志、缓存、Source Map、CF `_headers` 和函数。公开仓库中的运行资源公开，但不包含原项目开发仓库。CF `functions/report.js` 不会迁入静态托管。

固定 `index.html` 通过 `cache: no-store` 和查询参数读取小型 `hosting-release.json`，散列命名的入口和完整清单可复用本地已校验缓存，大小/SHA匹配后才加载对应的 `game.<散列>.html`。引导失败显示错误和重试按钮，不自动刷新。HTML 的 `<base>`、启动设置、import map、引擎脚本、effect 二进制和原资源均适配 `/kingdom-watch-play/`。

游戏资源沿用 Cocos UUID/版本路径。v82变换后的图片native、import和bundle配置使用实际内容SHA版本，并同步settings；UUID与运行加载ID保持。构建后修改的引擎额外使用 engine revision 路径，启动依赖与 effect 使用实际内容散列路径。更新默认保留上一版需要的文件，防止仍开着的上一版页面立即丢失资源；再上一个版本不长期保留。若未版本化的运行文件内容发生冲突则拒绝发布；显式PrunePreviousRelease只保留本次运行包。

GitHub Pages 的 HTTP 缓存由平台控制，实测 `max-age=600`；不能通过 CF `_headers` 设置一年缓存。v90在其上添加CacheStorage：当前页面按已校验文件清单访问资源，资源SHA与原路径作为键，缓存命中不再为该资源联网；首次缺失才下载并验证缓存。仅256MiB资源体预算，保留最近两版与活跃页面所需数据，过期无引用条目清理，存储失败走HTTP。导航/版本指针、诊断、Range、no-store与跨域请求绕过资源缓存。scope严格为 `/kingdom-watch-play/`，不会控制同域其他项目。清缓存/浏览器回收/无痕结束可能需重下，不承诺完整离线启动。

单文件、图片尺寸、完整当前包以及保留上一版后的站点总量均在发布前检查。混合模式200MB预算包含版本指针和清单；超过预算时停止发布，不自动降低画质或删除原稿。

## WASM 与诊断

本轮 Cocos 导出只有一个 Spine WASM，内存未共享，无 pthread / SharedArrayBuffer 依赖，因此不需要 COOP/COEP 或隔离 Service Worker。诊断页显示 `crossOriginIsolated: false` 在当前包是正常状态。以后检测到共享内存会中止发布，必须先适配并验证隔离。

诊断页只读取环境、版本和资源，不加载 Cocos、不实例化 WASM、不启动战斗。显示无损WebP解码能力，自动核对清单、入口及 WASM 的散列，并只编译 WASM。可手动启动全资源下载校验，v82流量约335MiB。

## 当前脚本验证

2026-10-22 记录见 [发布命令核对](../github-pages-command-20261022/README.md)。`-ValidateOnly` 已核对2103文件约645.7MiB；完整构建发布与 `-StatusOnly` 结果以本目录 `deployment.json` 为准。当前默认校验仅分析文件与WASM头，不编译或实例化WASM，不执行入口测试；下方2026-10-20离线情景检查只保留为历史记录。首次进入、再次进入及更新后的手机游戏表现仍待人工确认。

## 验证记录

首次发布记录：`first-deployment.json`。最新发布记录：`deployment.json`。部署完成才会写入 `complete: true`。

2026-10-20 已完成首次上线和一次实际更新：`698eec5` → `220ff1f`，版本 `6bdf4af8dfa1a891` → `9f7d0d8ad0652a34`，固定网址保持。再用完整 `-SkipBuild` 命令重复发布相同包，commit 不变且上一版文件保留。`full-cdn-audit.json` 记录全量线上校验：当前 2101 个清单内文件，加上一版独有 12 个路径，共 2113 个、680027865 字节，全部字节数和 SHA-256 匹配；版本指针、两版清单也分别核对。WASM 只验证/编译，没有实例化。`update-verification.json` 记录 CF 原入口仍为 v66，`command-validation.json` 记录原构建与一条命令执行情况。

发布命令验证全部本地文件 SHA、独立仓库远端 commit、固定入口和清单、若干线上 JS/JSON/PNG/字体/MP3/WASM 的字节散列及传输解码。离线入口检查覆盖首次、重复访问、新版本和损坏入口，损坏时不执行游戏。这里的离线检查不等于真实手机游戏运行验证。

本轮没有打开游戏或浏览器、没有执行战斗和音频验收。手机上首次进入、再次进入、更新后的实际游戏表现由用户体验。两种托管域名的浏览器存档相互独立，本轮没有做存档迁移。

可用 `python tools/github-pages/audit-live.py` 重跑全量线上文件散列检查，包含当前与上一版保留的旧路径，报告为 `full-cdn-audit.json`。这是只读下载，不启动游戏；本轮流量约 650 MiB。

配置与状态接口参照 [GitHub发布来源说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) 和 [GitHub Pages REST API](https://docs.github.com/en/rest/pages/pages)。
