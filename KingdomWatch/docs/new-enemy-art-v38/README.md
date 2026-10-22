# 新敌人弹窗头像与按钮 v38

已发布：[正式游戏](https://kingdom-watch.pages.dev/?v=new-enemy-art-v38-1792325569)，[部署快照](https://208a9ace.kingdom-watch.pages.dev)。Creator退出36、19437ms；原10项类型诊断无新增。Wrangler main上传8/已有2568/共2576，793历史预览保留；只读HTTP首页200且入口index.b4996.js?v=1792325569一致。

2026-10-18，用户截图指出新敌人弹窗仍显示表情符号，确认按钮使用旧美术。仅修改HUD.showMobIntro局部实现：按CODEX怪物ID读取图鉴同一battle_mobs_v2图集中的真实立绘，150×150范围等比适配，不再渲染emoji；头像底色沿用图鉴浅绿灰。确认按钮替换为ComicUI.comicButton金色共用组件，名称newEnemyConfirm，原位置、尺寸、文案保持，并防止快速连点重复消费怪物介绍队列。

弹窗背板、红色题签、描述/特性布局以及其他按钮保持，本次没有全局替换UIKit旧组件。图集覆盖六种怪物；未新增、重绘或裁切媒体，沿用已有帧映射及加载器。

before.json记录修改前1826个脚本/媒体/模板/工具散列，HUD.before.ts保存改动前源码。release.py仅核对HUD一个既有脚本变化、原10项类型诊断保持、六种图鉴ID与图集矩形一致、生产包新头像/按钮标记及v37教学/v36灼烧/v35渲染标记保留、引擎revision保持、793历史预览完整性。构建使用原Creator3.8.8 production web-mobile/MD5与DPR补丁/缓存流程，Wrangler main发布；部署状态/URL见deployment-stage.json。

未运行测试、游戏、浏览器、交互模拟或音频播放。静态核对和构建不代表视觉验收；由用户打开新敌人介绍人工确认头像与按钮。既有数值、教学、奖励、音效、DPR/安全区与资源不改，不新增Git提交，保留既有未提交工作及.tmp-kwsfx。
