# 雷法强化卡与火雷圆形图标 v52

2026-10-19 用户批准连锁清群、感电增伤、连续落雷整套雷法草案，并要求新增落雷眩晕+1.5秒金卡；同时检查火法和雷法图标形状，不符合满圆要求的重新生成。

雷法最终17卡：白2、蓝6、紫5、黄4。共享四张数值卡原样保留，解锁技能/大招改黄。全局抽取权重、上阵归属、通用前置与层数检查保持。

|品质|卡牌|每次效果|上限/前置|
|---|---|---|---|
|白|攻击强化|攻击力×1.2|5层|
|白|攻速强化|攻速×1.15|4层|
|蓝|暴击强化|暴击率+15个百分点|4层|
|蓝|爆伤强化|暴击倍率+30个百分点|3层|
|蓝|法术精研|技能伤害项×1.3，技能和大招生效|3层；技能/大招任一|
|蓝|电弧延伸|连锁跳距×1.3，不增加首次索敌范围|3层；技能|
|蓝|冷却缩减|连锁闪电冷却−2秒|3层；技能|
|蓝|雷霆威能|大招伤害×1.4|3层；大招|
|紫|连锁增幅|连锁目标+2，基础5→7→9→11|3层；技能|
|紫|感电|普攻、技能、大招附加受伤+25%·3秒|1层；所有来源受益|
|紫|高压电流|仅雷法自身对已感电目标伤害+30%，两层共+60%|2层；感电|
|紫|余电不散|雷法所有来源感电持续+1秒，3→4→5|2层；感电|
|紫|快速充能|大招充能需求×.75|2层；大招|
|黄|解锁技能|本局学习连锁闪电|1层|
|黄|解锁大招|本局学习天雷灭世|1层|
|黄|雷暴增援|实际额外落雷5道，15→20→25|2层；大招|
|黄|雷霆震慑|落雷眩晕+1.5秒，基础1→2.5秒|1层；大招|

百分比数值强化逐层相乘；高压电流两层累加，和已有普攻15级对感电增伤作为独立乘区。感电首次施加发生在本次伤害之后，高压只对伤害结算前已感电目标生效；一次连锁不重复命中。感电同类状态取高、重复命中刷新，不按落雷数无限叠易伤。30级感电加深、60级连锁目标、70级概率连锁、80级眩晕+0.5秒、90级感电等局外培养保留：眩晕金卡叠80级时3秒。

额外落雷延续五道一组节奏，前15道时间完全保持；新组起点4.35/5.55秒，每组间隔.16秒。演出及选卡挂起时间随之从4.5延至5.7/6.9秒；最终一道节拍和强视觉组随真实数量调整，普通落雷伤害不因视觉强度加成。目标死亡沿原规则重选存活目标。大招本身保留不暴击；连锁闪电修正原有只显示暴击但未乘暴伤的问题，独立掷骰与实际倍率一致。

普通投射物与连锁/落雷都接入高压和延时；连锁/落雷统计按实际扣血封顶，包含感电及减伤的真实结果。怪物感电结束清空强度，防止过期强感电被后续弱感电继承。移除雷法士气高涨及其专属加速窗口。

## 图标检查和制作

只读检查27张现有候选素材，见existing-art-contact.png、existing-art.json。实际火法卡池不合格5张：法术精研、爆裂火球、爆裂范围、陨星威能、余烬；存在镂空/不规则轮廓。雷法4张：法术精研、连锁增幅、雷霆威能、感电；存在方底、越出圆边或不规则轮廓。上述9张用内置image_gen重做，雷法高压/余电/增援/震慑另做4张。弃用的火/雷士气及旧火震慑不属于实际卡池，不重新接入。

参考assets/resources/ux/ui_icon_skill_archer.png的完整圆形手绘插画。两位法师图标都使用满圆不透明场景、主体不越界、圆外透明；现有符合要求的共享四卡/冷却/充能、技能/大招解锁图及雷法跳距保持。所有选卡入口通过独立圆形图标子树遮罩，火/雷分别配暖棕/深紫兜底，裁切不影响文字、归属头像或邻卡。生成原PNG字节复制入resources/ux的版本化资源；原文件不覆写，提示词/路径/散列见image-prompts.json、art-manifest.json。

只做源代码/资源/散列/类型/生产构建及只读HTTP核对，不运行游戏、浏览器、测试、模拟或音频。原10条类型诊断应保持；实际节奏、平衡和视觉由用户人工验收。无新Git提交，保留现有工作与.tmp-kwsfx。

已发布：[正式游戏](https://kingdom-watch.pages.dev/?v=volt-cards-v52-1792343521)，[部署快照](https://834e89ca.kingdom-watch.pages.dev)。Creator3.8.8生产构建20364ms、退出36，DPR与缓存准备完成；入口index.000b2.js?v=1792343521，引擎revision 2cb74a1e8caa095a保持。Wrangler main上传36、复用2592、共2628文件；正式入口只读HTTP200，13张新图标均200且SHA256与源文件相同。1858原文件只变更6个脚本，新增13PNG与13meta；原资源及793历史预览逐项散列保持。原10条类型诊断无新增。没有运行游戏、浏览器、测试、模拟或音频，实际由用户人工验收，无新Git提交。


## 生成素材

内置image_gen制作；[完整提示词](image-prompts.json)、[图标检查总览](final-art-contact.png)、[来源与散列](art-manifest.json)。最终资源：

- [ui_card_pyro_spell_v2.png](../../assets/resources/ux/ui_card_pyro_spell_v2.png)
- [ui_card_pyro_shards_v2.png](../../assets/resources/ux/ui_card_pyro_shards_v2.png)
- [ui_card_pyro_range_v2.png](../../assets/resources/ux/ui_card_pyro_range_v2.png)
- [ui_card_pyro_war_v2.png](../../assets/resources/ux/ui_card_pyro_war_v2.png)
- [ui_card_pyro_ember_v2.png](../../assets/resources/ux/ui_card_pyro_ember_v2.png)
- [ui_card_volt_spell_v2.png](../../assets/resources/ux/ui_card_volt_spell_v2.png)
- [ui_card_volt_shards_v2.png](../../assets/resources/ux/ui_card_volt_shards_v2.png)
- [ui_card_volt_war_v2.png](../../assets/resources/ux/ui_card_volt_war_v2.png)
- [ui_card_volt_shock_v2.png](../../assets/resources/ux/ui_card_volt_shock_v2.png)
- [ui_card_volt_pressure_v1.png](../../assets/resources/ux/ui_card_volt_pressure_v1.png)
- [ui_card_volt_linger_v1.png](../../assets/resources/ux/ui_card_volt_linger_v1.png)
- [ui_card_volt_strikes_v1.png](../../assets/resources/ux/ui_card_volt_strikes_v1.png)
- [ui_card_volt_stun_v1.png](../../assets/resources/ux/ui_card_volt_stun_v1.png)
