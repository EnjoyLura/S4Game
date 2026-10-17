# 战斗准备抽屉美术与固定布局 v2

本轮按用户效果图继续制作：原生加粗标题、难度图标、三档宝箱、一键领取按钮；材料数量前加×，移除“通关必得”，概率掉落装备标题居中。抽屉所有难度采用同一布局高度，固定保留两行装备位置，普通难度仅显示解锁描述。无内部滚动、无整页缩放。

素材通过内置imagegen生成，原始PNG完整保留，导入区域排除透明留白；提示词、来源、散列、静态审阅和部署收据留档。仅源码、本地图片和构建产物审阅，不执行测试、游戏、浏览器或线上验收。

难度图标按用户最后纠正：普通、精英、地狱各一枚，共三枚；选中和锁定复用这些图标。宝箱为棕木、蓝金、红金三档；金色领取按钮采用九宫格保留边饰，点击仍一键领取当前关卡与难度可领取的全部星箱并显示实际奖励。

装备、武器、材料统一使用方形品质底板，普通灰、优秀绿、稀有蓝、史诗紫。外层商品卡保持中性纸面，应用于商店、英雄穿戴与背包、材料详情和掉落预览。底板为原生绘制，可随展示尺寸变化。

抽屉高度不随难度变化，装备固定预留两行、每行最多六件，末行居中；普通难度留白显示解锁描述。内部无滚动；短屏使用更紧的组件间距，不整页缩放。抽屉中的出战阵容仍已移除，地图位置与底部独立编队入口保持。

以下七张均为内置imagegen生成的透明PNG，实际提示词与源图路径记录在 [来源记录](art-provenance.json)。表中是已接入项目的完整原图，未进行像素编辑。

| 素材 | 文件 | 提示词 |
| --- | --- | --- |
| 普通图标 | [PNG](../../assets/resources/ux/preparation_art_v2/difficulty_normal_v2.png) | [提示词](prompts/difficulty_normal_v2.txt) |
| 精英图标 | [PNG](../../assets/resources/ux/preparation_art_v2/difficulty_elite_v2.png) | [提示词](prompts/difficulty_elite_v2.txt) |
| 地狱图标 | [PNG](../../assets/resources/ux/preparation_art_v2/difficulty_hell_v2.png) | [提示词](prompts/difficulty_hell_v2.txt) |
| 木质宝箱 | [PNG](../../assets/resources/ux/preparation_art_v2/chest_bronze_v2.png) | [提示词](prompts/chest_bronze_v2.txt) |
| 蓝金宝箱 | [PNG](../../assets/resources/ux/preparation_art_v2/chest_sapphire_v2.png) | [提示词](prompts/chest_sapphire_v2.txt) |
| 红金宝箱 | [PNG](../../assets/resources/ux/preparation_art_v2/chest_crimson_v2.png) | [提示词](prompts/chest_crimson_v2.txt) |
| 一键领取按钮 | [PNG](../../assets/resources/ux/preparation_art_v2/claim_button_v2.png) | [提示词](prompts/claim_button_v2.txt) |

静态类型诊断与上一版相同，保留十项既有主诊断，改动模块无新诊断。构建产物审阅核对七张图片完整原文件、导入矩形、资源注册、源码散列和实际发布包；不代表手机视觉或交互验收。

已发布：[正式游戏](https://kingdom-watch.pages.dev/?v=preparation-art-v2-1792172540) · [部署快照](https://32e24370.kingdom-watch.pages.dev)。Cocos 16865ms。
