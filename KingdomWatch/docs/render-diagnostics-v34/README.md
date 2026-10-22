# 手机诊断面板入口修订 v34

用户在 iQOO 13 / Via 手机端看不到 v33 面板，电脑浏览器可见。尚无手机报告，未确认 v33 的具体失效点，不把 Shadow DOM、缓存、查询参数或全屏问题推断写成已证实根因。

新固定诊断网址：https://kingdom-watch.pages.dev/diagnostics.html?v=render-diagnostics-v34-1792312706
部署快照：https://1b21b906.kingdom-watch.pages.dev

## 改动

- 将小窗改为 index.html 内的普通静态 HTML，位于 Cocos polyfills/SystemJS/游戏加载之前；激活后立即显示，移除 Shadow DOM 依赖。保留原 renderdiag=1 链接，并增加固定 /diagnostics.html 路径，查询参数丢失仍可启用。
- RenderDiagnostics.ts 只注册只读引擎数据提供器。页面自行采集浏览器、DPR、视口、画布、安全区数据；引擎尚未连接或读取异常时显示状态，基础报告仍可复制。
- 面板改到可视区上部，面板自身按 visualViewport 缩放补偿；监听标准/WebKit 全屏变化并将面板移入非 Canvas 全屏元素。全屏 Canvas 单独呈现的浏览器行为未实机验证。
- 保留手机/电脑两个复制按钮、刷新、原始文本和复制失败后的长按全选回退；隔离面板触控冒泡，采集最近少量脚本错误帮助定位。不上传数据、不读存档；只在启用诊断时采集。
- prepare-web-release.py 保存同内容 diagnostics.html 并配置 no-cache。普通游戏链接的面板隐藏且脚本立即返回；DPR、画布/字体/安全区、战斗与音频参数未改。

## 使用

手机 Via 直接打开上方新固定网址，无需先进入战斗。小窗标题为“清晰度诊断 v34”，摘要显示“HTML 面板 v34 已启动”。分别在手机模式和电脑模式刷新同一链接，点相应复制按钮粘贴到聊天。若复制受限展开原始数据长按全选。若仍不显示，下一步需要用户提供新网址打开后的整屏表现，不能宣称已修复设备显示。

## 静态检查 / 发布

876 个既有源码/音频/模板/工具文件散列核对，只有 RenderDiagnostics.ts、index.html、prepare-web-release.py 改动；Boot、音频和其他游戏逻辑保持。TypeScript 原 10 项诊断无新增；HTML 内联脚本只做 node --check 语法解析，未执行。生产 HTML 包含面板且位于引擎前；固定路径与 index 逐字节一致，缓存头匹配；引擎数据桥编译标记存在。Creator 3.8.8 production/MD5 退出36，21952ms；DPR/缓存准备完成。Wrangler main 成功上传8/复用2568/共2576，793历史预览保持。仅通过 HTTP 读取手机 UA 诊断页和普通入口 HTML，均200且入口 index.1488a.js?v=1792312706，未启动浏览器或游戏。

手机显示及清晰度/安全区根因尚待用户人工取数。未运行测试、游戏、浏览器、交互模拟或音频播放；无新Git提交，既有v31/v32/v33和.tmp-kwsfx保留。
