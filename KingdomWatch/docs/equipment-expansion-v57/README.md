# 装备扩展 v57

新增16件非武器装备：蓝色、紫色各8件；头盔、饰品、手套、衣服在每种品质各有两件新选择。现有白绿与4件原装备保留，武器扩展v56完整保留。

已发布：[正式游戏](https://kingdom-watch.pages.dev/?v=equipment-expansion-v57-1792387418)，[部署快照](https://2912b99e.kingdom-watch.pages.dev)。Creator3.8.8生产构建19311ms、退出36，DPR和缓存准备完成，引擎`2cb74a1e8caa095a`保持。Wrangler main上传42份、复用2706份。正式入口HTTP200，主脚本及16PNG与发布包SHA256一致；原10条类型诊断无新增。696份原生资源和793份历史预览字节保持。未运行游戏、浏览器、测试、战斗模拟或音频。

新蓝装1阶、1800金币、通关1-2解锁；新紫装1阶、6000金币、通关1-4解锁。价格是本轮配置初值，同品质两路线同价，且高于新装备Lv.1的原出售公式，避免新增买入即卖的套利。既有装备价格/阶级保持；品质、阶级和强化等级共同决定实际属性，高品质1阶不保证每条属性超过已有高阶装备。

头盔在基础攻击/攻击加成之间取舍；饰品在暴击率/暴击伤害之间取舍；手套在攻速/攻击范围之间取舍；衣服在技能伤害/充能效率之间取舍。全部英雄可穿戴四部位，新装备从Lv.1开始，沿用每个实例独立的装备强化等级。所有词条直接沿既有装备聚合进入战斗，不增加元素被动或职业限制。

商店“装备”页增加全部/头盔/饰品/手套/衣服筛选、品质升序和计数，商品详情显示真实初始属性、侧重和适用英雄。复用现有购买、背包、穿戴、强化、出售、保存流程；新装备只加入商店，不改关卡掉落与奖励。

美术使用内置 **image_gen**，一件一图、分别以4件既有部位插画为风格参考，透明背景。提示词集见[prompts.json](prompts.json)，最终逐件路径/生成来源/SHA256见[art-manifest.json](art-manifest.json)。PNG保留生成原始字节，不进行像素裁切、缩放或补绘；Cocos元数据独立登记。总览见[final-art-contact.png](final-art-contact.png)，缩略尺寸见[small-icon-contact.png](small-icon-contact.png)。

静态源代码、类型、资源身份检查与生产构建/发布，不执行游戏、浏览器、测试、战斗模拟或音频。实际交互、美术观感与数值平衡由用户人工验收。


## 新装备Lv.1实际属性与最终文件

全部新装备为1阶；按现有强化公式随各实例等级增长。

| 装备（点击查看原始PNG） | 品质/部位 | 词条一 | 词条二 | 侧重 |
| --- | --- | --- | --- | --- |
| [铁脊战盔](../../assets/resources/ux/shop_comic_v1/helm_ironridge_v57.png) | 蓝1阶 · 头盔 | 攻击 +18 | 攻击加成 +4% | 基础攻击 |
| [鹰卫兜帽](../../assets/resources/ux/shop_comic_v1/helm_hawkguard_v57.png) | 蓝1阶 · 头盔 | 攻击 +10 | 攻击加成 +10% | 攻击加成 |
| [日牙护符](../../assets/resources/ux/shop_comic_v1/acc_sunfang_v57.png) | 蓝1阶 · 饰品 | 暴击率 +6% | 暴击伤害 +16% | 暴击率 |
| [赤晶指环](../../assets/resources/ux/shop_comic_v1/acc_crimson_v57.png) | 蓝1阶 · 饰品 | 暴击率 +3% | 暴击伤害 +30% | 暴击伤害 |
| [游隼手套](../../assets/resources/ux/shop_comic_v1/glove_swift_v57.png) | 蓝1阶 · 手套 | 攻速 +12% | 攻击范围 +35 | 攻速 |
| [远望护手](../../assets/resources/ux/shop_comic_v1/glove_longwatch_v57.png) | 蓝1阶 · 手套 | 攻速 +7% | 攻击范围 +70 | 攻击范围 |
| [余烬法衣](../../assets/resources/ux/shop_comic_v1/armor_cinder_v57.png) | 蓝1阶 · 衣服 | 技能伤害 +30 | 充能效率 +5% | 技能伤害 |
| [潮纹外衣](../../assets/resources/ux/shop_comic_v1/armor_tide_v57.png) | 蓝1阶 · 衣服 | 技能伤害 +18 | 充能效率 +12% | 充能效率 |
| [狮脊重盔](../../assets/resources/ux/shop_comic_v1/helm_lioncrest_v57.png) | 紫1阶 · 头盔 | 攻击 +32 | 攻击加成 +8% | 基础攻击 |
| [夜羽兜帽](../../assets/resources/ux/shop_comic_v1/helm_nightfeather_v57.png) | 紫1阶 · 头盔 | 攻击 +18 | 攻击加成 +18% | 攻击加成 |
| [星瞳吊坠](../../assets/resources/ux/shop_comic_v1/acc_stareye_v57.png) | 紫1阶 · 饰品 | 暴击率 +10% | 暴击伤害 +24% | 暴击率 |
| [龙鳞指环](../../assets/resources/ux/shop_comic_v1/acc_dragonscale_v57.png) | 紫1阶 · 饰品 | 暴击率 +5% | 暴击伤害 +48% | 暴击伤害 |
| [风暴护手](../../assets/resources/ux/shop_comic_v1/glove_storm_v57.png) | 紫1阶 · 手套 | 攻速 +20% | 攻击范围 +50 | 攻速 |
| [远星护腕](../../assets/resources/ux/shop_comic_v1/glove_farstar_v57.png) | 紫1阶 · 手套 | 攻速 +12% | 攻击范围 +110 | 攻击范围 |
| [焰印长袍](../../assets/resources/ux/shop_comic_v1/armor_flameseal_v57.png) | 紫1阶 · 衣服 | 技能伤害 +54 | 充能效率 +8% | 技能伤害 |
| [月泉祭衣](../../assets/resources/ux/shop_comic_v1/armor_moonwell_v57.png) | 紫1阶 · 衣服 | 技能伤害 +32 | 充能效率 +20% | 充能效率 |
