# 三选一原创美术与合并发布

按用户要求使用内置 imagegen 模式分别生成卡片底板、标题底板、品质色带三张原生透明图片；没有把其他游戏图片传给模型，也没有复制其素材。美术为低对比暖纸纹、细棕金边线、少量菱形与短线角饰，中心留白供原有引擎文本和图标使用。

原图在 `sources/`，实际资源在 `../../assets/resources/ux/pick_comic_v1/`。完整实际提示词：[卡片](prompts/card_base.txt)、[标题](prompts/title_plate.txt)、[色带](prompts/header_strip.txt)。`generation.json` 记录模式与来源；`assets.json` 记录实际裁框、尺寸与校验和。处理仅去透明边与 alpha<8 的灰尘，没有重绘或缩放素材。

`Panels.showPick` 将整组标题、卡片、刷新说明和按钮统一下移 56 个设计像素，短屏按安全区限制下移量。卡片 222×360、三列位置、文本字号、图标、归属头像、稀有度颜色、刷新按钮 300/180 宽度及原选择／广告／钻石回调保留。刷新按钮复用本项目暂停页的金／绿／灰美术。

同批接入用户冰法师待机和攻击，后续收到的新火法师攻击及待机接缝修复也一起发布。基础普攻改为重弩手 0.5 次/秒（2 秒一次）、火法师和雷法师各 1 次/秒；`Cards.ts` 战斗配置与 `GameData.ts` 属性显示同步，装备、卡牌、突破、技能攻速乘区继续生效。

运行 `build_game.ps1` 构建 Cocos 3.8.8 web-mobile 并执行 DPR 补丁；`publish.ps1` 从最新结算发布保留历史预览，部署正式 main。遵照用户要求不运行测试、游戏、浏览器或线上验收，视觉效果由用户人工查看。发布回执在 `release.json`。

已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=pick-comic-v1-1791996687) · [部署快照](https://5894b2f5.kingdom-watch.pages.dev)。Cocos 成功退出码36、8771ms，DPR完成，Wrangler main上传22文件、1660缓存。效果由用户人工查看，未运行测试、游戏、浏览器或线上验收。
