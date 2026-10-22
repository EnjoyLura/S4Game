# 商店武器扩展 v56

已发布：[正式游戏](https://kingdom-watch.pages.dev/?v=weapon-expansion-v56-1792386660)，[部署快照](https://948fce77.kingdom-watch.pages.dev)。Creator3.8.8生产构建25395ms、退出36，DPR和缓存准备完成，引擎`2cb74a1e8caa095a`保持。Wrangler main上传42份、复用2658份。正式入口HTTP200，主脚本及16PNG与发布包SHA256一致；原10条类型诊断无新增。680份原生资源和793份历史预览字节保持。未运行游戏、浏览器、测试、战斗模拟或音频。

用户要求白、绿之外，每种品质每类武器新增两款。当前已实现品质只有白/绿/蓝/紫，武器类型为弓、弩、魔法书、法杖，因此新增16款：蓝8、紫8。全部9款旧武器（4白、4绿、鹰眼重弩）保持原ID、属性、突破、价格、解锁和美术。总武器25款，商店21款，初始白武器不售卖。

| 类型 | 蓝色新武器 | 紫色新武器 | 两种侧重 |
| --- | --- | --- | --- |
| 弓 | 疾羽短弓、铁棘长弓 | 逐风之弓、鸦羽猎弓 | 攻速 / 暴击率 |
| 弩 | 隼翼轻弩、碎岩重弩 | 银隼战弩、裂城重弩 | 暴击率 / 暴击伤害 |
| 魔法书 | 潮汐秘典、烬纹魔典 | 星潮法典、暮鸦秘录 | 充能效率 / 暴击率 |
| 法杖 | 霜晶法杖、回响法杖 | 裂日法杖、月泉法杖 | 暴击伤害 / 充能效率 |

每件保留“攻击＋技能伤害＋一条专属”结构，突破每10级提供攻击/技伤，每30级提供对应副属性。新增蓝色为1阶、1000钻石、1-2解锁；新增紫色为2阶、1600钻石、1-4解锁，同品质两路线同价。紫色沿用tierMul=1.8的既有公式，不能把模板值当成最终Lv.1值；[原始模板与静态提取](catalog.json)，下方另列含阶级倍率的Lv.1预览。数值是本轮初值，未模拟或实测平衡。

弓限弓手、弩限重弩手；书杖均供火/雷/冰法师。继续继承英雄已有武器培养等级，不重置、不迁移旧档。新武器外观不添加元素状态或被动机制，不替换战斗角色手持武器动画，不加入关卡掉落池。既有金币钻石、首通赠送、养成消耗和所有战斗/强化卡保持。

商店新增全部/弓/弩/魔法书/法杖筛选，保留三列货架、现有皮肤和购买弹窗；品质由低到高排列，件数按筛选更新。新商品从WEAPONS生成，详情显示真实Lv.1属性、玩法侧重、阶级、适用英雄及突破。购买继续余额不足反馈/防重复点击/即时保存，并在shopBuy核心层补解锁检查。

## 美术与验证

使用内置image_gen分别生成16张透明PNG；参考现有四种绿色武器的画风，非复制母版换色。圆弓/铁棘、隼翼/铁臂、潮纹/烬纹/星盘/鸦翼、晶簇/环首/日轮/月牙均有独立轮廓。完整原图保留alpha并按原字节复制到assets/resources/ux/weapons_v1/*_v56.png，未裁切、抠图、重采样或覆盖旧图。原生图边缘为透明，最小可见轮廓留边约9px；裂日法杖一个角像素alpha=1，其余角alpha=0，保留原生字节。8%边距提示词只是生成目标，不将其记录为实际已达成。

已只读查看16图总览和160px缩略总览，未启动游戏做视觉验收。详见[完整提示词](image-prompts.json)、[源图与SHA256](art-manifest.json)、[图鉴总览](final-art-contact.png)、[160px预览](small-icon-contact.png)。所有最终素材保存在上述项目目录；各文件路径见art-manifest。

静态核对1900原文件仅3脚本变化，新增16PNG+16meta，原9武器模板逐字段相同，旧媒体和历史预览保持。TypeScript既有10条诊断保持；Creator生产构建、DPR/缓存准备、只读HTTP入口/主脚本/16PNG身份核对。没有运行测试、游戏、浏览器、战斗模拟或音频；实际视觉、购买换装及平衡由用户人工验收，无Git提交。


## 新武器Lv.1实际展示值

已包含阶级倍率和既有取整，非模板原始值；更换后实际等级仍继承英雄武器等级。

| 武器（点击查看最终素材） | 品质/阶级 | 攻击 | 技能伤害 | 第三词条 |
| --- | --- | --- | --- | --- |
| [疾羽短弓](../../assets/resources/ux/weapons_v1/blue_swift_bow_v56.png) | 蓝1阶 | 36 | 20 | 攻速 +10% |
| [铁棘长弓](../../assets/resources/ux/weapons_v1/blue_briar_bow_v56.png) | 蓝1阶 | 40 | 16 | 暴击率 +4.5% |
| [逐风之弓](../../assets/resources/ux/weapons_v1/purple_gale_bow_v56.png) | 紫2阶 | 72 | 40 | 攻速 +18% |
| [鸦羽猎弓](../../assets/resources/ux/weapons_v1/purple_raven_bow_v56.png) | 紫2阶 | 79 | 32 | 暴击率 +8.1% |
| [隼翼轻弩](../../assets/resources/ux/weapons_v1/blue_hawk_crossbow_v56.png) | 蓝1阶 | 46 | 14 | 暴击率 +5% |
| [碎岩重弩](../../assets/resources/ux/weapons_v1/blue_rock_crossbow_v56.png) | 蓝1阶 | 42 | 18 | 暴击伤害 +20% |
| [银隼战弩](../../assets/resources/ux/weapons_v1/purple_falcon_crossbow_v56.png) | 紫2阶 | 94 | 36 | 暴击率 +9.9% |
| [裂城重弩](../../assets/resources/ux/weapons_v1/purple_siege_crossbow_v56.png) | 紫2阶 | 86 | 43 | 暴击伤害 +43.2% |
| [潮汐秘典](../../assets/resources/ux/weapons_v1/blue_tide_book_v56.png) | 蓝1阶 | 18 | 44 | 充能效率 +9% |
| [烬纹魔典](../../assets/resources/ux/weapons_v1/blue_ember_book_v56.png) | 蓝1阶 | 22 | 40 | 暴击率 +4% |
| [星潮法典](../../assets/resources/ux/weapons_v1/purple_star_book_v56.png) | 紫2阶 | 40 | 83 | 充能效率 +18% |
| [暮鸦秘录](../../assets/resources/ux/weapons_v1/purple_dusk_book_v56.png) | 紫2阶 | 47 | 76 | 暴击率 +8.1% |
| [霜晶法杖](../../assets/resources/ux/weapons_v1/blue_frost_staff_v56.png) | 蓝1阶 | 24 | 38 | 暴击伤害 +18% |
| [回响法杖](../../assets/resources/ux/weapons_v1/blue_echo_staff_v56.png) | 蓝1阶 | 20 | 42 | 充能效率 +9% |
| [裂日法杖](../../assets/resources/ux/weapons_v1/purple_sun_staff_v56.png) | 紫2阶 | 50 | 76 | 暴击伤害 +36% |
| [月泉法杖](../../assets/resources/ux/weapons_v1/purple_moon_staff_v56.png) | 紫2阶 | 43 | 83 | 充能效率 +18% |
