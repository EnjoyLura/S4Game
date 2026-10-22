# 雷法师大招报错修复 v58

已发布：[正式游戏](https://kingdom-watch.pages.dev/?v=volt-ultimate-fix-v58-1792387641)，[部署快照](https://7e5d0526.kingdom-watch.pages.dev)。

用户反馈雷法师释放大招报 `Cannot read properties of undefined (reading 'duration')`，无法落雷。源码 VoltHero.ultShowDuration 通过 super.ultShowDuration 访问父类 getter；Cocos Creator 3.8.8 本项目生产编译把它降为 HeroBase.prototype.ultShowDuration。getter 在父类原型上执行时没有实例 id，导致 ULT_TIMING[undefined].duration 抛错。异常发生在充能清零之后、落雷队列创建之前。错误编译片段保存于 [before-bundle-getters.json](before-bundle-getters.json)。

唯一游戏代码改动：改为直接读取 ULT_TIMING.volt.duration，再叠加原额外落雷时长公式。与弓箭手、火法师现有直接读取各自配置的方式一致，避免 Cocos 的 super getter 编译路径。[源码差异](review.diff)、[修复后的生产片段](after-bundle-getter.json)。

基础15道、雷暴增援20/25道，演出4.5/5.7/6.9秒，以及落雷排程、伤害、眩晕、充能、音效、选卡保护等均未改动。没有加入吞错兜底，也不改变其他英雄或本轮之前的装备、武器、关卡及存档。

核对1964份原文件，仅 Hero.ts 的时长读取和说明注释变化；其他1963份及全部712份生产原生资源保持原字节，没有新增游戏资源，历史793份预览保持。类型诊断仍为原10条，无新增。

Creator3.8.8生产构建18510ms、退出36；DPR与缓存准备完成，引擎 2cb74a1e8caa095a 保持。Wrangler main上传8份，复用2740份。入口HTTP200，线上主包SHA256与本地一致，已确认修复后的雷法getter及旧prototype访问消失。

只进行了静态源代码、类型、编译产物、媒体身份与只读HTTP检查，没有运行游戏、浏览器、测试、战斗模拟或音频。实际释放效果由用户刷新后人工体验；更新不恢复报错前旧页面已经消耗的充能，也不将旧页面热替换为新战斗。
