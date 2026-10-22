# Via / iQOO 13 清晰度诊断 v33

用户提供 iQOO 13 的 Via 浏览器手机/电脑模式截图，反馈电脑模式下文字、UI 和美术都更清晰，但顶部信息栏缺少避让。截图按原文件保留为 user-comparison-01.jpg、user-comparison-02.jpg（不重编码）。仅凭截图未确认画布分辨率或浏览器安全区的具体差异。

诊断链接：https://kingdom-watch.pages.dev/?renderdiag=1&v=render-diagnostics-v33-1792312220
部署快照：https://6f406c98.kingdom-watch.pages.dev

## 用户取数

在 Via 手机模式打开诊断链接，等画面稳定后点“复制手机模式数据”，粘贴到聊天；切换电脑模式并刷新同一链接，再点“复制电脑模式数据”并粘贴。可以在主界面取数；若要观察战斗顶栏，也可收起面板进入关卡后展开重取。复制受限时展开原始数据，长按文本框全选复制。

## 实现与边界

只改 Boot.ts 引入并调用新的 core/RenderDiagnostics.ts。面板仅在 renderdiag=1 下创建，普通链接无 DOM/监听/定时读取。报告为用户自行标记的模式，包含 UA、浏览器/引擎 DPR、原有 DPR 上限、视口与 visualViewport 缩放、画布后备像素及 CSS 尺寸、已有 WebGL 绘制缓冲/属性、设计/可视区域、字体实际离屏 Canvas 尺寸、CSS 安全区与引擎对称/原始安全区、LO.notchTop。每次复制前重新读取当前场景；场景切换不重复创建面板。

只读现有引擎/DOM/GL 数据，不创建 GL 上下文、不覆盖画布、字体、DPR、viewport 或布局、不上传数据、不读存档。面板自身随页面缩放补偿，补偿仅作用在诊断 DOM，未应用到游戏。报告中的 estimatedDisplayPixels / estimatedBackingToDisplay 是考虑 visualViewport.scale 的推算，不冒称真实面板测量。初次读取与 1.5 秒后、视口改变或用户点击时刷新，无逐帧采集。Label 少量只读内部探针针对当前 3.8.8，不可视为跨版本稳定 API。

这是定位版本，尚未实施清晰度修复或顶部避让修复。雷法叠音保持上一轮状态，本轮没有音频改动。手机的实际报告尚待用户提供。

## 静态检查与发布

851 个既有源码/音频/模板文件散列核对，仅 Boot.ts 改动，其旧逻辑剥离两行诊断入口后与快照一致；全部音频、其他游戏脚本与模板保持。类型诊断原 10 项无新增，生产包诊断字段齐全。Creator 3.8.8 production/MD5 构建退出 36，20443ms；DPR 与缓存准备完成。保留 793 个历史预览文件。Wrangler main 部署成功：上传 9，复用 2566，共 2575。只读 HTTP HTML 状态 200，入口 index.02ba5.js?v=1792312220。

未运行测试、游戏、浏览器、交互模拟、音频或运行效果验收。诊断按钮的设备表现及清晰度根因由用户取数后继续确认。未新 Git 提交；原 v31/v32 与 .tmp-kwsfx 保留。
