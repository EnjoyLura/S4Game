# 章节路线关卡页 v1

将已确认效果方案接入正式关卡页。前哨、深林、兽穴各有一张连续路线地图，仍各十关。关卡旗帜、星级、解锁状态、选中提示和可领奖励提示由代码与真实存档生成，没有烘焙进地图。

地图上下惯性拖动，按钮采用7单位拖动取消阈值，章节独立记住选择和位置。首次定位当前进度，关卡退出消耗原有 levelReturn 返回同一关卡与难度，打开准备面板。已通关蓝旗、当前金旗与局部呼吸环、未解锁灰旗；第十关标注章末。章节可浏览，未解锁关卡不可出战。

点击可选节点或出战准备，底部纸面展开，地图平移保留选中地标。面板关闭回到原地图位置。顶部资源与五个底部导航沿用原组件。面板顺序为难度、星级宝箱、关卡掉落、出战阵容、开始战斗；短屏滚动内容，标题关闭和开始战斗固定。

普通/精英/地狱仍为10/12/15波，沿用原解锁、怪物、掉落池及概率。普通预览金币与材料，精英地狱预览装备与概率；所有预览图标都可点开详情，完整目录入口保留。宝箱优先，点击任意可领宝箱仍通过原 claimAllChests 一次领取当前关卡当前难度全部已达成未领档，再显示实际到账回执。调整编队、领取宝箱和切难度只局部刷新，保留地图与面板状态。

只替换 LevelsPage，新增 CampaignRoute UI 辅助；GameData、Campaign、LevelDifficulty、战斗、音频和其他原脚本保留本轮开始时散列。没有存档迁移、奖励数值修改或额外Git提交。

## 美术

使用内置 image_gen.imagegen，三张完整PNG直接复制，未编辑像素，尺寸均887×1774。只在进入章节时请求该章底图，不提前下载三章图片。关卡坐标为独立的归一化路面锚点；节点、文字和按钮为代码生成。

- [前哨底图](../../assets/resources/scenes/bg_campaign_outpost_v1.png)
- [深林底图](../../assets/resources/scenes/bg_campaign_forest_v1.png)
- [兽穴底图](../../assets/resources/scenes/bg_campaign_lair_v1.png)
- [完整提示词](image-prompts.json)、[原图来源与SHA256](art.json)、[制作脚本](prepare_assets.py)

## 交付核对

仅审阅源码、图片、元数据和本地构建产物，执行Cocos正式构建、DPR与production/MD5准备及Pages发布。类型审阅仍存在此前 ButtonFeedback、MilestoneSwipe、Panels、UINotice 诊断，本轮改动模块无新增诊断，不宣称全项目类型通过。没有运行测试、模拟、游戏、浏览器或线上验收，实际布局、拖动、动画与交互由用户人工确认。

构建、产物散列和发布回执见 build-record.json、bundle-inspection.json、release.json。

已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=chapter-route-live-v1-1792160607) · [部署快照](https://3c530d93.kingdom-watch.pages.dev)。Cocos 16380ms，实际视觉交互由用户人工确认。
