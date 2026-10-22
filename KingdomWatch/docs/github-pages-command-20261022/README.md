# GitHub Pages 一条命令发布（2026-10-22）

脚本：[`tools/publish-github-pages.ps1`](../../tools/publish-github-pages.ps1)。沿用现有发布仓库与Cocos构建流程，补齐只校验、代理还原、预制包复用、分阶段报告和独立状态查询。没有创建重复仓库或修改游戏源码。

在 `D:/AI/S4Game/KingdomWatch` 执行：

```powershell
./tools/publish-github-pages.ps1
```

网络需要当前本地代理时：

```powershell
./tools/publish-github-pages.ps1 -ProxyUrl http://127.0.0.1:7897
```

固定游戏：https://enjoylura.github.io/kingdom-watch-play/  
托管诊断（不启动游戏）：https://enjoylura.github.io/kingdom-watch-play/hosting-diagnostics.html  
独立公开运行包仓库：https://github.com/EnjoyLura/kingdom-watch-play

## 脚本行为

1. 调用原正式构建、DPR与缓存准备。
2. 导出仅浏览器运行所需的包，适配 `/kingdom-watch-play/`，包含 `.nojekyll`。
3. 核对清单中每个文件的长度与SHA256、Cocos资源引用、WASM头/内存要求、体积预算和不应出现的开发文件；不执行JS、WASM或测试入口。
4. 只在独立运行包仓库快进同步、提交、推送main；原项目HEAD和暂存区保持。拒绝未提交工作和分叉，不重置、不强推。保留上一版运行资源的规则保持。
5. 等待Pages，核对远端commit、版本指针、固定入口和线上资源样本。压缩传输解码后比对文件散列。上传成功与部署完成分别记录；排队退出2后可单独查询。

只检查：`-ValidateOnly`，不读取GitHub凭据，不提交或上传；记录与部署报告分开。  
已有生产构建：`-SkipBuild`。已有导出包：`-PreparedPackage <目录>`。  
仅查部署：`-StatusOnly`，不构建或推送。代理参数仍可同时使用。  
等待上限：`-WaitSeconds`，默认240秒；0为查询一轮。  
配置文件：`-ConfigPath`，默认 `tools/github-pages/config.json`。

当前WASM不依赖共享内存，因此没有新增隔离Service Worker。以后遇到共享内存会中止，待明确适配后发布。凭据仅进程内使用，代理结束后精确恢复，包括移除原本不存在的进程变量；不改系统代理。CF脚本保留，本命令不调用CF发布。

## 本次实际执行

- `-ValidateOnly`：2103文件、645.7MiB，所有文件散列及引用通过；未上传。
- 完整构建发布命令退出0：Creator生产构建19134ms，退出36，DPR/缓存准备通过；提交 `8f85546a3f45ffad00bbf28fdc8ff65d9e95faef`，运行版 `9e7cd310850b8080`，Pages已built。
- 固定网址、清单、入口及11份线上文件样本SHA核对通过，覆盖JS/JSON/PNG/字体/MP3/WASM与gzip解码。不是本次全量CDN媒体下载。
- `-StatusOnly -WaitSeconds 0`：退出0，同一发布commit与运行版校验完成，没有新提交；进程代理变量恢复核对通过。
- 2078份游戏assets全量SHA保持；原开发仓库HEAD/暂存区保持；没有原项目Git提交。
- 原CF v73 HTML仍HTTP200且SHA与已发布记录相同。本轮没有CF部署。

[核对摘要](verification.json)、[完整命令结果](full-command-deployment.json)、[单独状态查询](status-deployment.json)、[代理还原](status-and-proxy.json)、[CF保留](cf-preserved.json)。参数与失败处理见[正式发布说明](../github-pages-publishing/README.md)。旧入口离线测试保留作历史，本次默认命令不调用。

没有启动游戏、浏览器、测试脚本、模拟、音频或WASM。手机首次进入、再次进入及更新后的游戏表现由用户人工确认；新网址与CF的浏览器本地存档独立。
