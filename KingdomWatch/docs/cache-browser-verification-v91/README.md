# 内置浏览器缓存实测 v91

2026-10-24 用户明确授权使用内置浏览器检查缓存。本次已实际启动线上游戏、刷新和关闭游戏标签页后重新打开；只停留在主界面，没有进入战斗、购买、重置存档或清除浏览器缓存。此授权仅适用于本次缓存检查，不扩展为其他游戏验收。

游戏：https://enjoylura.github.io/kingdom-watch-play/?v=cache-reopen-v91

诊断：https://enjoylura.github.io/kingdom-watch-play/hosting-diagnostics.html?v=cache-proof-v91

## 结果

缓存已经实际命中，而非仅检查到缓存文件存在。每个缓存命中计数在 Worker 返回 `CacheStorage.match` 的响应时记录，HTTP 获取计数在调用 `fetch` 时记录。

| 场景 | 本地命中次数 | 本地返回资源字节 | 运行资源 HTTP 获取次数 | 未命中/未匹配清单 |
| --- | ---: | ---: | ---: | ---: |
| 更新缓存 Worker 后加载新版本 | 406 | 52,477,132 | 0 | 0 / 0 |
| 普通刷新，主界面显示后取样 | 311 | 14,939,522 | 0 | 0 / 0 |
| 关闭游戏页后新建游戏页，主界面显示后取样 | 431 | 59,085,290 | 0 | 0 / 0 |

普通刷新和重开使用不同的文档 clientId，关闭后的旧客户端已经从活动统计中移除。后两次累计为 742 次、74,024,812 字节；重开场景使用新客户端自身的 431 次统计，不能把 742 次全部归于重开。

最终项目内容缓存包含 426 个文件、56,549,152 字节，采用按需缓存，没有预下载整个 168,030,825 字节的运行包。累计命中字节会重复计算同一资源的多次请求，因此可以大于缓存内独立文件的总字节。不同场景在主界面已显示后的不同时间取样，后台预热请求量不同；这些数据不是首屏加载时间或全量流量对照。

刷新及重开后均正常显示关卡地图，捕获到的控制台 error/warn 数量均为 0。诊断入口、清单子路径和版本一致性检查通过，Spine WASM 大小/SHA 匹配并在浏览器编译成功。源资源和画面未修改。

## 统计范围与限制

- 表中运行资源是经过项目资源缓存处理的请求。入口导航、版本指针、Worker 更新检查及诊断的 no-store 请求仍联网，不计入这些运行资源数字；零 HTTP 获取不表示整个页面零网络流量。
- HTTP 获取次数表示 Worker 调用 `fetch` 的次数；非零时仍可能由浏览器 HTTP 缓存返回，不直接等于实际网络传输次数。记录的字节是响应体字节，不是 gzip 传输字节。
- 命中计数只保留在当前 Worker 的内存中，Worker 休眠或重启后重计。每份报告记录 `observations.since`，不能跨统计起点直接相减。
- 初次检查 v90 时已有 235 个文件、27,209,459 字节缓存；本次未清除用户数据，因此不声称完成了干净环境的首次下载测试。
- 更新测试观察到新旧版本目录并存，新版本实际复用了内容缓存；本次仅改托管 Worker/诊断页，游戏内容未变，不等同于完成所有游戏内容更新场景。
- 已验证关闭游戏标签页后重开，未退出整个浏览器或 Codex 应用；未测试手机、离线启动、存储不足、主动清理、自动回收或无痕模式。浏览器未授予持久存储，系统仍可能回收缓存。

## 本次改动和发布

只给 `tools/github-pages/runtime-cache-sw.js` 添加内存中的总计/客户端命中、未命中、HTTP 获取、校验字节和重试统计；诊断页增加「刷新缓存统计」按钮和摘要。刷新统计只读取状态，不重复执行完整资源下载或 WASM 检查。

复用已验证的 v90 生产构建导出新托管包，无需重新构建 Cocos。静态比较确认只改变 `hosting-cache-sw.js`、`hosting-diagnostics.html` 两份运行文件；1454 个源 assets、游戏入口、其他游戏和引擎运行文件保持原字节。完整包 1493 文件、168,030,825 字节，比 v90 增加 2586 字节，低于 200,000,000 字节预算。

发布命令（只操作独立发布仓库，不提交源工程）：

```powershell
./tools/publish-github-pages.ps1 -PreparedPackage build/github-pages-cache-observation-v91 -PrunePreviousRelease -ProxyUrl http://127.0.0.1:7897 -WaitSeconds 120
```

发布版本 `3fd186b7aee76e4e`，独立运行仓库提交 `88eeea5c6d300872a3450371839c631d149b271d`。发布器完成完整包校验、远程提交核对和 19 个线上 HTTP 样本的 SHA/MIME/压缩检查；其 API 状态采样当时仍为 building，随后浏览器已实际读取此新版本和诊断代码，不把旧状态采样当作后续部署失败。未触发 Cloudflare。源工程在发布期间 HEAD/暂存保持，随后单独提交本次源码及报告。

## 证据文件

- [browser-observations.json](browser-observations.json)：诊断页 DOM 导出的四阶段原始报告及控制台记录。
- [package-static-verification.json](package-static-verification.json)：逐文件校验、改动范围及源资源保持结果。
- [export-report.json](export-report.json)、[deployment.json](deployment.json)：导出及发布阶段记录。
- [baseline-v90-package.json](baseline-v90-package.json)：比较基准。
- `cache-proof.jpg`、`game-reload.jpg`、`game-reopen.jpg`：通过内置浏览器截图 API 保存到本目录；按项目媒体忽略规则仅本地保留。

![诊断页缓存命中摘要](cache-proof.jpg)

![关闭游戏页后重新打开的主界面](game-reopen.jpg)
