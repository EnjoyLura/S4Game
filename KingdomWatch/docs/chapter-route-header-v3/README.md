# 删除顶部固定地图图片

用户指出顶部风景始终显示、与滚动地图重复。上一轮的 campaignTerrainBackdrop 是额外固定图片，现删除此节点，只保留 ScrollView 内的路线地图。

顶部改为游戏已有米色纸面，资源栏和章节条保持，标题改为深色文字。地图视口、节点、滚动、底部操作栏与导航接合沿用上一版；无新图片、数值或存档变更，不另作 Git 提交。

仅进行源码/静态类型审阅、Cocos production/MD5 构建、DPR/缓存准备和本地产物核对。遵循项目约定，不运行测试、模拟、游戏、浏览器或线上验收，画面由用户人工确认。

已发布：[正式游戏](https://kingdom-watch.pages.dev/?v=chapter-route-header-v3-1792161784) · [部署快照](https://43ff2245.kingdom-watch.pages.dev)。Cocos 17726ms。
