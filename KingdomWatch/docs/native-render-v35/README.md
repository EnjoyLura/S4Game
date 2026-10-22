# iQOO 13 原生像素与电脑模式避让 v35

游戏：https://kingdom-watch.pages.dev/?v=native-render-v35-1792313812
诊断：https://kingdom-watch.pages.dev/diagnostics.html?v=native-render-v35-1792313812
快照：https://8461ea74.kingdom-watch.pages.dev

## 用户实测证据

用户文件 Readme(1).txt 逐字节保存为 user-render-reports.txt，分离 mobile-before.json / desktop-before.json。两份报告均已连接引擎且无脚本错误。

| 指标 | 手机模式 | 电脑模式 |
| --- | --- | --- |
| 浏览器DPR / 旧引擎DPR | 4 / 3 | 4 / 3 |
| CSS视口 | 360×792 | 1280×2816 |
| 实际屏幕对应像素 | 1440×3168 | 1440×3168 |
| 原canvas声明尺寸 | 1080×2376 | 3840×8448 |
| 实际GL缓冲 | 1080×2376 | 3840×8192 |
| 页面缩放 | 1 | 报告四舍五入0.281，视口/屏幕反推0.28125 |
| CSS顶部安全区 | 30px | 30px |
| 旧LO.notchTop设计单位 | 62.5 | 17.578125 |

手机画布仅覆盖屏幕每边75%像素，被浏览器放大；这是已确认的降采样问题。项目旧补丁只覆盖3x，漏掉真实4x设备。电脑模式因更大缓冲后缩小而产生超采样效果，但高度已触及实际GL限制；不能将它当作合理的手机渲染预算。其安全区仍报告固定30px，布局换算却被页面缩小，因此顶栏移近屏顶。

## 修改

模板提供 __KW_GET_DPR_CAP getter，默认 min(真实DPR,4)×min(1,visualViewport.scale)。手机号4x/scale1得到4，电脑模式4x/scale0.28125得到1.125，均以约1440×3168绘制，保持750×1334设计分辨率及可视750×1650。?dpr= 显式省电选项保留；放大手势不追加超采样。引擎补丁优先调用该getter，兼容升级旧静态补丁，发布前要求新getter存在，缓存revision更换防止旧引擎复用。

GameConfig.initLayout 的现有安全区换算补偿小于1的 visualViewport.scale，并先重置notchTop避免失败沿用旧值，原避让上限保持。按用户数据，手机与电脑模式预计均为62.5设计单位；手机正常模式不改原避让，底部防线继续贴底。没有硬编码iQOO型号或伪装UA。

诊断标签升级v35，并接受 /diagnostics 与 /diagnostics.html（Pages干净URL会移除后缀）；保留普通链接默认隐藏。用户的两个报告在旧根入口取到，所以此前失显具体原因未单独证实。本轮不修改字体本身或字体缓存策略，也不修改美术、音频、战斗规则。

expected-from-user-data.json 仅为实测输入的算术推算，不是修复后实机报告。修复后手机实际缓冲、画质和帧率仍待用户人工确认。原生4x相对旧3x像素数约增加78%，电脑模式则显著减小超大缓冲，未声称已测性能。

## 静态检查与发布

876既有源码/音频/模板/工具文件散列核对，只改GameConfig.ts、RenderDiagnostics.ts、index模板、patch-web-dpr.py四文件；Boot、其他游戏逻辑及所有音频保持。原10项TypeScript诊断无新增，内联脚本只做node --check语法解析。生产引擎含动态DPR getter、HTML原生4x/缩放策略和双诊断路径，诊断与主HTML逐字节一致，793历史预览保持。Creator3.8.8 production/MD5退出36、22352ms，DPR/缓存完成；engineRevision=2cb74a1e8caa095a，入口index.59059.js?v=1792313812。Wrangler main上传12/已有2564/共2576，部署成功；HTTP只读HTML普通/诊断入口均200且版本正确。

未运行测试、游戏、浏览器、交互模拟、音频或运行验收。没有新的Git提交，原v31/v32/v33/v34及.tmp-kwsfx保留。


## 2026-10-18 用户修复后报告

用户提供 Readme(2).txt，已原样保存为 user-render-reports-after.txt，并拆为 mobile-after.json / desktop-after.json，比较结果见 user-report-comparison-after.json。两份均为 kw-render-diagnostics-v35（地址查询参数保留v33不代表旧运行代码）。手机与电脑模式的canvas、引擎resolution及实际GL缓冲均为1440×3168，backing/display均1，LO.notchTop均62.5，近期脚本错误均空。采样的16个Label在字号、实际绘制字号、字体纹理大小、字体与节点缩放等字段一致；手机32字号数字实际绘制由46提升61，普通文字“补给小道”由29提升39。原降采样及电脑模式顶部避让参数差异已由用户实机报告确认消除，电脑模式GL超高限制不再触发。

这只确认用户设备的渲染和布局参数，尚未获得用户对实际观感、战斗顶栏可见效果和性能的认可，不宣称所有模糊都已解决。没有进一步修改游戏或重新部署，也未由代理运行游戏、浏览器或测试。
