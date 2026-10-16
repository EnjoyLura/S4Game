# 网页启动与重复刷新加载优化 v1

用户反馈Cloudflare线上游戏每次刷新约需半分钟。本轮仅检查本地代码、部署配置和构建文件；没有测量用户设备、真实网络耗时或线上缓存命中，不将这些静态发现断言为完整网络根因。

已确认的配置问题：

- 旧版所有静态文件均为 `Cache-Control: no-cache`，刷新必须校验；并非每张图片都重新全量下载，但会产生额外请求往返。
- 旧版debug=true，未压缩JS约7.60MB（十进制），引擎主文件约5.68MB。实际网络传输通常压缩，不能直接将磁盘大小当作流量。
- 默认关卡页在页面创建时立即预热上阵英雄整张序列图集，启动800ms后旧通用美术清单每16ms发出一个请求，不等待上一张完成；旧注释称串行，实际大量并发，还包含已废弃素材。

改动：

1. 统一 `tools/build-web.ps1` + `tools/web-release-build.json`，debug=false、md5Cache=true、关闭源码映射；保留当前Cocos模块和所有已认可的完整人物素材。
2. DPR补丁支持压缩引擎及 `index.<hash>.js`。准备脚本给修改后的所有引擎JS依赖及import map URL加同一内容版本，DPR补丁更新也会换URL，防止只依赖补丁前的Cocos文件名。
3. HTML保持no-cache，带MD5版本的代码、图片、音频、字体缓存一年；effect.bin未带版本，保持校验。写回真实 `_headers` 文件名，因为Cocos MD5构建会将模板文件也改成 `_headers.<hash>`，该名字不被Pages识别。规则不重叠；检查assets目录每个文件或父目录带版本，避免给无版本资源长期缓存。
4. 五个启动代码/设置URL从HTML提前请求，减少SystemJS逐层发现的请求串行；无新增纹理预载。
5. 关卡页的战斗素材预热等待当前页面美术及交接完成，并给首屏额外350ms；页面销毁/后续渲染会丢弃过期调度，隐藏标签页暂缓。点击开始战斗仍立即走真实素材准备与原城门流程。
6. 通用美术预热改为当前12张小范围共用素材，首屏就绪后延迟8秒，每次等待上一张结束、再间隔150ms；可见UX请求未结束时等待，后台不新发请求。卡牌仍由已有上阵英雄预热入口负责，保留三选一首帧保护。

不改游戏数值、存档、门的1.5秒停留、英雄图集像素和音效。没有安装Service Worker，避免再引入一套缓存更新生命周期。

`before-metrics.json` / `after-metrics.json` 为离线文件清单和统一gzip体积估算；整包约400MB含大量历史资源，按资源路径动态加载，**不代表首次进入必须下载整包**。JS总大小从7,601,341降至3,562,688字节，约减少53.1%；统一离线gzip估算从1,385,806降至960,592字节，约减少30.7%。Cloudflare实际压缩方式与设备解码/网络延迟未测量，不能承诺首开或刷新固定秒数。

本轮按项目约定完成源码和本地构建产物审阅、Cocos构建、DPR和发布，不运行测试、模拟、游戏、浏览器或线上验收。第一次访问仍需下载所用内容，升级到本版也要补齐版本化URL；后续收益由用户人工刷新体验确认。

依据：[Cloudflare Pages缓存](https://developers.cloudflare.com/pages/platform/serving-pages/)、[Cloudflare自定义缓存头与规则合并](https://developers.cloudflare.com/pages/configuration/headers/)、[Cocos Asset Bundle与MD5版本](https://docs.cocos.com/creator/3.8/manual/en/asset/bundle.html)、[Cocos命令行JSON配置](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-in-command-line.html)。

已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=web-load-v1-1792131057) · [部署快照](https://52e59ae1.kingdom-watch.pages.dev)。构建16233ms，实际加载耗时待用户确认。
