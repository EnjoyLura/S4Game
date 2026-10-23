# 浏览器按需缓存v90

2026-10-24，用户询问玩家是否每次重新下载、能否缓存。本轮在独立GitHub运行包接入Service Worker与CacheStorage，不修改Cocos游戏源码或美术。

试玩：https://enjoylura.github.io/kingdom-watch-play/?v=browser-cache-v90

原来已使用浏览器HTTP缓存，并非每次下载完整168MB，但GitHub Pages缓存头由平台控制，缓存失效后可能重新请求或重验。本轮额外保存已用过的运行资源；它与本机离线编码缓存、Git仓库大小、GPU内存是不同概念。

| 内容 | 策略 |
| --- | --- |
| 固定入口、hosting-release.json | 导航不被Worker拦截，版本指针继续no-store联网、有限重试，无自动刷新 |
| 散列命名入口HTML和文件清单 | CacheStorage优先；每次读取核对字节数与SHA，失配删除重取；各保留最多两份 |
| 游戏请求的图片、完整音频、字体、脚本、JSON、WASM | 只处理当前页面已校验清单内的同源GET；本地命中直接返回，缺失才下载；200完整响应大小/SHA通过才写缓存 |
| 新版本 | 页面按clientId绑定已验证版本；键包含完整SHA与原文件路径，未改资源复用，改动内容单独保存；HTTP旧内容失配仅强制重取一次 |
| 清理 | 保留最近两版和所有仍开着页面所需目录；删除仅本项目已过期、未引用的缓存条目；资源体预算256MiB，超限跳过新写入 |
| 不支持/超时/空间不足 | 有限等待后走普通HTTP；写失败静默降级并暂停写入一分钟，不阻塞游戏、不清存档 |

Worker固定脚本为`/kingdom-watch-play/hosting-cache-sw.js`，scope仅本项目子路径。安装只skipWaiting/claim，没有precache、整包后台下载、强制重载或跨源隔离头。首次页面通过MessageChannel完成版本绑定后再加载引擎；缓存准备最多等3.5秒，普通存储读取也有超时回退。已有控制器可直接绑定版本，脚本更新检查并行进行。

不同路径即使内容相同也保留原路径键，避免CSS/module的Response.url影响相对依赖；相同路径不同版本内容不同则使用不同SHA键。清单在窗口和Worker两侧独立验证，Worker重启后从项目自己的元数据缓存恢复版本与客户端绑定。数据写入串行计量，避免并发超预算；缓存读写失败不会变成启动异常。

导航、诊断的`diag/check`请求、no-store、Range和跨域请求绕过Worker资源缓存。断网后已缓存资源可复用，但不承诺完整离线启动：入口仍检查版本，没用过的章节/资源也仍需网络。缓存只在当前浏览器/设备/网址内；手动清数据、无痕关闭或浏览器回收空间后需重新下载。本轮不请求持久存储权限，也不更改localStorage存档。256MiB仅资源体预算，实际浏览器统计还含元数据、HTTP缓存、响应头和同源其他项目。

诊断页新增浏览器缓存文件数、字节、目录版本、预算和浏览器存储估计；只向本项目注册发状态消息，不注册其他Worker，也不预下载资源。存储估计和persisted状态由整个origin统计，文案保留origin前缀避免误认为仅本游戏。资源诊断仍绕过缓存检查真实CDN。

## 静态校验与发布

原Creator构建16332ms、退出36，DPR、资源审计、版本准备完成。导出1493文件、完整168,028,239字节（168.03MB），比v89仅增加18,297字节，继续低于200,000,000字节预算。1454源assets原字节保持，1487原运行文件保持，包括全部图片、音频、字体、游戏和引擎脚本。入口HTML只有原生产流程的构建时间查询参数改变；游戏加载和首屏预取布局不变。

`audit_export.py`只做实际文件、尺寸/像素、SHA、子路径、WASM头和JS语法解析；没有执行入口、Worker、游戏、浏览器、测试、音频或WASM。保护分支源码存在检查是静态审阅记录，不当作行为测试。首次缓存、关闭后重访、升级时旧标签、空间不足及断网恢复仍待用户手机人工确认。

```powershell
./tools/publish-github-pages.ps1 -PreparedPackage build/github-pages-browser-cache-v90 -PrunePreviousRelease -ProxyUrl http://127.0.0.1:7897
```

新增稳定Worker文件允许跨发布替换，仍保持其余文件的未版本化冲突阻断。线上校验额外验证Worker SHA、大小与JavaScript MIME；发布状态见`deployment.json`。CF未触发。Git源库提交在发布器结束后另行完成，发布器自身仍只提交独立运行包。

版本`f26aacc9f6682c92`已上线，运行提交`15836419ddbb74a3b4acfe0affd77604136e4247`；Pages built，19线上样本大小/SHA、gzip解码与MIME通过，Worker为11669字节、application/javascript。固定根入口、清单和条件重访一致。这里是静态文件及HTTP验证，没有实际执行Worker或浏览器缓存情景。

API依据：[Cache更新/清理/回收规则](https://developer.mozilla.org/en-US/docs/Web/API/Cache)、[Worker scope与更新缓存选项](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)、[FetchEvent.clientId](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent/clientId)。
