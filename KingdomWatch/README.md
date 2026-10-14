# 王国守望 (Kingdom Watch)

2026-10-15 配乐与采样音效已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=audio-upgrade-v1-1792000789)，部署 `https://bdd94cd8.kingdom-watch.pages.dev`。按用户要求先提交既有版本 `fec68d9`，随后替换音频。大厅／战斗为 cynicmusic 两首奇幻配乐，42条采样音效含真实长弓／重弩、火／雷／冰普攻与独立技能大招、命中、升级、就绪、胜负和UI。单例WebAudio按Cocos UUID加载，手势解锁、变体、14声部与命中限流、总线压缩、配乐跨场景淡入和提示压低；暂停／三选一降低音乐，后台挂起，原音乐／音效开关即时生效。CC0及CC BY 3.0素材保留作者、许可和编辑说明，随游戏发布audio-credits.html并在暂停设置增加鸣谢入口。英雄媒体、战斗数值、攻速、弹道、特效及防线布局保持。无付费生成调用，Cocos成功退出码36、8762ms，DPR完成，Wrangler main成功。依用户要求不运行测试、游戏、浏览器或线上试听，听感由用户人工体验。详见 [音频更新](docs/audio-upgrade-v1/README.md)。

2026-10-15 纯程序普攻发射与盾量显示修正已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=basic-launch-procedural-v3-1791999420)，部署 `https://10714401.kingdom-watch.pages.dev`。用户明确否定上一轮发射贴图，四张 basic_launch_v2_* 停止加载，只保留历史；发射改用自定义 Shader 计算柔边、细光芯、短促风压／热脉冲／电弧／霜晶，片元无图片采样，2×2运行时白纹理仅承载四顶点，36槽池，模拟时钟与真实方向驱动，载入前为原生Graphics回退。弓箭0.24秒、重弩0.28秒、火0.25秒、雷0.22秒、冰0.28秒，收敛出弹点周围占用。心形和盾形随实际文字宽度紧贴数字左侧，数字右缘仍固定320，生命在上、护盾在下；字体异步载入及位数变化自动重排。蓝盾按盾量／最大耐久绘制右侧外框，右端固定、受损从左向右消退，零盾隐藏外框且显示0；绿色生命条、数值高度、大招入口、英雄素材与动作、飞行拖尾、原弹体、伤害、攻速、弹速、碰撞、索敌、技能、大招、命中特效和音效保留。无AI生成调用。Cocos成功退出码36、8881ms，DPR完成，Wrangler main成功。用户人工查看，不运行测试、游戏、浏览器或线上验收，不把构建或发布记作视觉认可。详见 [程序发射与盾量修正](docs/basic-launch-procedural-v3/README.md)。

2026-10-15 防线蓝色外盾与普攻发射／飞行特效已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=shield-projectile-v2-1791998602)，部署 `https://23086d06.kingdom-watch.pages.dev`。耐久条底基198提高至212（上移14），蓝盾按盾量／最大耐久在完整血条外侧包覆空心细框，不盖绿色生命；右上数值生命在上、盾值在下，零盾保留0且隐藏蓝框。大招入口底基240提高至340，已解锁英雄仍紧凑排列。内置image_gen分别生成风压、火焰、雷电、冰霜四张透明发射贴图，原像素与alpha完整保存，配合原生扩散风压／碎屑，弓箭与弩分别0.32／0.36秒，火0.36、雷0.30、冰0.38秒，实际普攻方向触发，齐射每排一次。飞行增加渐隐锥形拖尾与两侧风线、余烬、电丝或霜晶，按距离与模拟年龄驱动，暂停倍速同步；只有普攻及强化普攻箭使用，原弹体与英雄媒体、尺寸、攻速、伤害、弹速、碰撞、技能、大招、命中特效、声音及其他UI保留。Cocos成功退出码36、8890ms，DPR完成，Wrangler main成功。用户人工查看，不运行测试、游戏、浏览器或线上验收，未记作视觉认可。详见 [外盾与普攻特效](docs/shield-projectile-v2/README.md)。

2026-10-15 五英雄普攻发射特效已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=basic-launch-v1-1791997605)，部署 `https://4a0cfb2f.kingdom-watch.pages.dev`。弓箭手0.18秒白青风压音爆，重弩手0.22秒更宽的白蓝风压，火法师0.24秒橙红短焰流与黄芯余烬，雷法师0.18秒紫白分叉电弧，冰法师0.25秒冰蓝霜气与细小晶片。原创原生Graphics按真实普攻方向和同一出弹原点绘制，弓箭每排一次、齐射不叠加、连射每排触发，强化普攻同款微放大；其他四位只在普攻shoot出手时触发。单Graphics、36份预分配数据、无逐发Node/Tween，共用战斗时钟暂停／倍速，随场景清理。没有调用付费图片／视频生成或复制其他游戏素材；五英雄图片和待机／攻击、弹体、飞行尾迹、技能、大招、命中特效、伤害、攻速、弹速、碰撞、索敌、音效与UI保留。Cocos成功退出码36、8193ms，DPR完成，Wrangler main成功。按用户要求不运行测试、游戏、浏览器或线上验收，效果由用户人工查看，未记作视觉认可。详见 [普攻发射特效](docs/basic-launch-v1/README.md)。

2026-10-15 三选一原创美术、冰法师双动作、新火法师攻击／待机循环和基础攻速已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=pick-comic-v1-1791996687)，部署 `https://5894b2f5.kingdom-watch.pages.dev`。三选一使用内置imagegen独立生成的纸纹底板、细边线及少量角饰，整组下移56设计像素、短屏限制下移量，原卡片尺寸、字号、图标、刷新按钮宽度差异、动画及回调保留。冰法师用户第一段为攻击、第二段为待机，资源 `mora_attack_user_v1`／`mora_idle_user_v1`，各56帧完整正向保留。用户随后否定旧火法师攻击并提供新视频，替换为 `pyro_attack_user_v2`；旧待机首尾跳跃，沿用同一首帧重新请求两秒MiniMax H3 768p，任务 `task_JJhDtVBxeaehD29ZATmoltZEiq0RjO4l`，新资源 `pyro_idle_loop_v2`。完整源帧正向等时保留，不倒放、删帧裁短、长停或透明淡化。两法师固定画内高468、显示高146、脚底(256,496)，全不透明换帧、整图镜像，实际施法回调触发；自身攻击范围内无目标、无排队攻击并且收势结束才恢复待机。按最新要求，重弩手基础普攻0.5次/秒（2秒一次）、火法师和雷法师各1次/秒，战斗配置与属性显示同步；原攻速加成继续生效。未改已完成的弓箭手、重弩手或雷法师媒体。Cocos成功退出码36、8771ms，DPR完成，Wrangler main成功。用户人工查看，不运行测试、游戏、浏览器或线上验收，不把提示词、制作或发布当作视觉认可。详见 [三选一及发布](docs/pick-comic-v1/README.md)、[冰法师](docs/mora-actions-user-v1/README.md)、[新火法师](docs/pyro-actions-user-v2/README.md)。

2026-10-15 成功／失败结算美术与布局、火法师用户待机已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=settlement-comic-v1-1791994681)，部署 `https://f9b74360.kingdom-watch.pages.dev`。结算使用内置 imagegen 新生成的金色皇冠／蓝灰破损皇冠横幅、内容底板、奖励卡和青／灰按钮，复用暂停金／绿按钮与连体页签，文字由引擎渲染；布局聚拢为标题关卡、内容页签、广告与导航，矮屏统一适配。用户本次明确允许优化这两个结算页面，替代此前仅换肤的布局限制；其他弹窗保持。统计显示最多五英雄及 MVP，实际伤害和团队占比保留；领取中禁点，原双倍金币、复活、重试、返回、下一关回调沿用。同轮收到 `Downloads/video (3).mp4` 火法师待机，56 帧／24fps／约2.333333秒完整正向循环，绿底去除后资源 `pyro_idle_user_v1` 与已有用户攻击 `pyro_attack_user_v1` 同时接入；画内高468、显示高146、脚底(256,496)，实际火球／施法触发，全不透明换帧、整图镜像，攻击与收势不播待机，攻击范围内无目标且动作结束后恢复。未调用新视频生成，未改其他四英雄媒体、战斗数值、弹道、特效、音效、暂停美术与生命／护盾显示。Cocos成功退出码36、8302ms，DPR完成，Wrangler main成功。未运行测试、游戏、浏览器或线上验收，用户人工查看，不将发布记作视觉认可。详见 [结算美术](docs/settlement-comic-v1/README.md) 与 [火法师待机](docs/pyro-idle-user-v1/README.md)。

2026-10-14 用户提供绿色生命条／橙色贡献统计参考，要求改进进度条并优化盾量。已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=battle-meters-v1-1791992612)，部署 `https://70505f10.kingdom-watch.pages.dev`。防线保持宽 640、底基 198，亮绿色浅圆角血条高 18，右上心形＋当前／最大值；盾量改为下方独立高 6 的蓝条与左上盾形＋数值，零盾隐藏，去除覆盖血条的大胶囊和旧底基 176 的错位，数值与条共同避让大招入口。经验条同步轻量样式。统计条高 10、橙色，伤害数值放条外，参考图以最高伤害为满格比较，真实全队百分比另用小字保留；不改 DamageService 或伤害结算。此项按用户本次参考图更新此前“数值仍在条内”的约束；统计背板／标题／头像保持，统计行距 100 调至 96 给末行留白。原生 Graphics 与心／盾图标无需 AI 生图，英雄媒体与暂停美术保持。Cocos 成功退出码 36、11098ms，DPR 完成，Wrangler main 成功。未运行测试、游戏、浏览器或线上验收，效果由用户人工查看，不将发布记作视觉认可。详见 [进度条与盾量记录](docs/battle-meters-v1/README.md)。

2026-10-14 暂停界面美术已完成并构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=pause-comic-v1-1791991675)，部署 `https://04ef8bf6.kingdom-watch.pages.dev`。内置 imagegen 生成透明组件图集，切分 11 张原像素 PNG，补齐标题窄横幅、奖励圆座、金色退出／绿色继续按钮、连体页签、设置行与开关三态。只接入暂停，原布局、文案、字号、数量、点击与音效设置回调保留；不改变三选一、胜败结算、伤害 tips 或英雄素材。Cocos 3.8.8 web-mobile 成功退出码 36、8627ms，DPR 完成，Wrangler main 成功。用户人工查看，未运行测试、游戏、浏览器或线上验收，未记作视觉认可。原图、提示词、切图、接入与发布记录见 [暂停美术](docs/pause-comic-v1/README.md)。

2026-10-14 用户提供新的雷法师攻击视频 `Downloads/video (1).mp4` 并明确要求直接应用到游戏，已构建发布[正式游戏](https://kingdom-watch.pages.dev/?v=volt-attack-user-v2-1791984777)及[待机切换／镜像预览](https://kingdom-watch.pages.dev/previews/volt-attack-user-v2/?v=1791984777)，部署 `https://09d9da7e.kingdom-watch.pages.dev`。56 帧、24fps、约 2.333333 秒全部正向保留，固定共享当前待机 `volt_idle_natural_v1` 的画内高度 468.7165、显示高度 146 与脚底 (256,496)，释放标注源帧 14。正式攻击引用从 `volt_attack_natural_v1` 改为 `volt_attack_user_v2`，实际施法回调触发，全不透明换帧；攻击与收势期间停播待机，自身攻击范围内无目标、无排队攻击且动作结束后恢复。重弩手已完工素材、雷法师认可待机、弓箭手及伤害、攻速、弹道、雷电特效和声音保持；未调用视频或图片生成模型。Cocos 成功退出码 36、12975ms，DPR 完成，Wrangler main 成功。用户人工查看，未运行测试、浏览器、游戏或线上验收，接入授权不等于视觉已获认可。详见 `docs/volt-attack-user-v2/release.json`。

2026-10-14 用户要求将清理后的重弩手攻击应用到游戏，[正式接入](docs/sniper-attack-clean-live-v1/README.md) 已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=sniper-attack-clean-live-v1-1791953086) · [原片／清理后预览](https://kingdom-watch.pages.dev/previews/sniper-attack-clean-v1/?v=1791953086)，部署 `https://be190d5f.kingdom-watch.pages.dev`。重弩手攻击引用从 `sniper_attack_natural_v1` 更换为 `sniper_attack_clean_v1`，56 帧完整正向准备、释放、上弩、回正，实际发弹回调触发，收势时长沿用攻速适配。保持当前待机 `sniper_idle_natural_v2`、画内基准 467.1111、脚底 `(256,496)`、高度 153，全不透明直接换帧并整图镜像。攻击或收势时不播放待机；自身攻击范围内无目标、无排队攻击且动作结束后恢复待机。伤害、攻速、弹道、音效、弓箭手和雷法师保持。Cocos 成功退出码 36、9534ms，DPR 完成，Wrangler main 成功；用户人工查看，不运行测试、游戏、浏览器或线上验收，未记录游戏视觉已获认可。此条替代此前该清理版仅作预览、正式游戏未替换的状态。

2026-10-14 用户认可 `Downloads/video.mp4` 重弩攻击并要求试着去掉枪焰和灰尘。[去特效试做](docs/sniper-attack-clean-v1/README.md) 已制作并发布 [原片／清理后同步预览](https://kingdom-watch.pages.dev/previews/sniper-attack-clean-v1/?v=1791952850)，部署 `https://2542560e.kingdom-watch.pages.dev`。56 帧、24fps、约 2.333333 秒原时序全部保留；内置 imagegen 修复第 7–9 帧局部弩头，背景火星和烟尘在限定区域按连通人物轮廓排除。完整视频、RGBA 序列、共享尺度 512×512 图集、镜像 GIF 和同步对照均已生成，人物高度仍为 153。此轮为试做对照，正式游戏攻击引用未替换；基于此前已发布目录只新增预览，未重建 Cocos 游戏，不改当前待机、弓箭手或雷法师。原动作认可不等于本次清理已认可，待用户人工查看；未运行游戏、浏览器、测试或线上验收。详情 `docs/sniper-attack-clean-v1/release.json`。

2026-10-14 用户明确否定 `hero-attack-natural-v1` 的两人攻击。最新动作要求：重弩手小幅瞄准 → 机械发射 → 清楚的上弩手势 → 回正继续瞄准；雷法师前脚原地轻踏稳住重心 → 法杖小幅前伸施法 → 收杖回位。当前待机、静态图、握持设计与弓箭手保持，首尾衔接约束继续适用。新制作目录 `docs/hero-attack-choreography-v2/`，重弩手新任务返回的完整源片含两次枪焰且上弩过程不清晰，已作废，禁止包装或发布；雷法师提交因 `insufficient_user_quota` 失败，未创建任务。已告知用户补充 AI 视频额度。游戏代码与资源未更换，未构建或发布，不将旧版或本轮失败源片记为认可。待补充额度后重新生成完整源片，不能裁掉坏帧或强行发布。

2026-10-14 [重弩手与雷法师完整攻击](docs/hero-attack-natural-v1/README.md) 已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=hero-attack-natural-v1-1791943258) · [双英雄攻击／待机切换预览](https://kingdom-watch.pages.dev/previews/hero-attack-natural-v1/?v=1791943258)，部署 `https://308c1b58.kingdom-watch.pages.dev`。两段源视频来自当前待机第一帧，沿用确认站姿与握持；首轮烘焙特效源片拒绝发布，重新生成完整动作。正式攻击资源 `sniper_attack_natural_v1`／`volt_attack_natural_v1`，分别 107／56 张完整源帧全程正向播放，不倒放、不裁短、不透明度过渡；统一固定比例和脚底，高度 153／146。实际普攻、连锁和大招出手回调触发释放，攻击与自然收势优先，空闲回到待机首帧。两位英雄当前待机视频、图集和时长及弓箭手保持，雷法师待机认可继续有效。Cocos 成功退出码 36、8188ms，DPR 完成，Wrangler main 成功；用户人工查看，未运行测试、游戏、浏览器或线上验收，新攻击动画尚未获认可。详情见 `docs/hero-attack-natural-v1/release.json`。

2026-10-14 [重弩手正向待机首尾重做](docs/sniper-idle-loop-close-v1/README.md) 已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=sniper-idle-loop-close-v1-1791941016) · [新重弩手／已确认雷法师预览](https://kingdom-watch.pages.dev/previews/sniper-idle-loop-close-v1/?v=1791941016)，部署 `https://f9572e8f.kingdom-watch.pages.dev`。用户确认当前雷法师待机很丝滑，只否定重弩手首尾衔接；雷法师 `volt_idle_natural_v1` 全部媒体、时序和运行时引用冻结，未提交雷法师任务。重弩手保留确认母版与宽留白首帧，重新请求两秒 MiniMax H3，任务 `task_n97psrwE6KUNSVg89NyBmxIKMMRjjZGK`，56 张完整源帧全部保留，正向等时约 3.076923 秒循环。不倒放、不截短、删帧、停帧或透明度过渡；强调披风端点、轮廓、褶皱和运动相位回归原状。新资源 `sniper_idle_natural_v2`，高度 153、画内基准 467.1111 和脚底保持；弓箭手及重弩攻击保持。Cocos 成功退出码 36、8550ms，DPR 完成，Wrangler main 成功，八个旧预览入口同步。用户人工查看，不运行测试、浏览器、游戏或线上验收；雷法师已认可，新重弩手效果尚未认可。详情见 `docs/sniper-idle-loop-close-v1/release.json`。

2026-10-14 [两位英雄正向待机重做](docs/hero-idle-natural-v1/README.md) 已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=hero-idle-natural-v1-1791913717) · [新原视频与正向序列帧](https://kingdom-watch.pages.dev/previews/hero-idle-natural-v1/?v=1791913717)，部署 `https://779d5e4d.kingdom-watch.pages.dev`。用户否定正放／倒放循环造成披风诡异；本次沿用确认母版重新提交两段两秒 MiniMax H3，任务 `task_PFLqLXlRsFBGgssOVPDIMAngcfd9Xzpb`／`task_WdcJrkRLheKDenC7WXxjJygSyNe4qAGr`。重弩手 56／雷法师 56 张完整源帧全部保留，按原时间顺序等时正向播放，单周期约 3.076923 秒；不追加倒放、不截短、不删帧、不加长停留或透明度过渡。资源 `sniper_idle_natural_v1`／`volt_idle_natural_v1`，固定画内基准、脚底与高度 153／146，弓箭手媒体及重弩攻击保持。共享函数、打包入口、提示词和永久规范已取消默认往返，七个旧预览入口同步新版。Cocos 成功退出码 36、9776ms，DPR 完成，Wrangler main 成功。用户人工查看，不运行测试、浏览器、游戏或线上验收；生成提示词和时序不证明视觉闭合，本轮新动作尚未获用户认可。详情见 `docs/hero-idle-natural-v1/release.json`。

2026-10-14 [两位英雄待机停顿修正](docs/hero-idle-flow-v1/README.md) 已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=hero-idle-flow-v1-1791912847) · [新版待机预览](https://kingdom-watch.pages.dev/previews/hero-idle-flow-v1/?v=1791912847)，部署 `https://f8833bb3.kingdom-watch.pages.dev`。旧时序在往返转折帧额外停留约 0.25／0.32 秒；本轮取消五倍长停帧，仅保留最多 10% 的轻微缓和。完整保留重弩手 56 张／110 项、雷法师 43 张／84 项当前帧序，约 6.153846 秒循环，图集原样复制、相邻首尾及固定比例脚底保持，未生成视频、未裁短或删帧。新资源 `sniper_idle_flow_v1`／`volt_idle_flow_v1`，显示高度 153／146，弓箭手及重弩攻击保持。共享循环函数与永久规范已记住禁止转折长停留，GIF 和预览同步，六个旧入口更新。Cocos 成功退出码 36、10168ms，DPR 完成，Wrangler main 成功。用户人工查看，不运行测试、浏览器、游戏或线上验收；本次节奏修正尚未获用户认可。详情见 `docs/hero-idle-flow-v1/release.json`。

2026-10-14 [重弩手完整待机重新生成](docs/hero-idle-full-v4/README.md) 已接入并构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=hero-idle-full-v4-1791912134) · [新完整视频与序列帧](https://kingdom-watch.pages.dev/previews/hero-idle-full-v4/?v=1791912134)，部署 `https://7a64204d.kingdom-watch.pages.dev`。用户否定从坏源片截短后发布的处理，明确要求重新生成；旧 cape-fix-v3 仅保留历史。本轮用同一确认图的宽留白首帧请求两秒 MiniMax H3，新任务 `task_HrjD0gRZWi1oceFDsHUi3nd0YKbCekNX`，返回 56 张源帧，全部保留为 56 张完整人物帧／110 项相邻往返时序，约 6.153846 秒完整循环；不截短、不筛掉出框坏帧，所有源帧在制作前必须保持原视频四边至少 12 像素留白。新正式资源 `sniper_idle_full_v6`，画内基准 467.1111、游戏高度 153 和脚底保持；雷法师当前媒体与循环、弓箭手媒体及高度 185.64、重弩攻击保持。源码打包默认要求待机全帧，出框拒绝整段并重生；已在 AGENTS 和制作规范记住此纠正。相邻帧闭合和转折缓和继续适用，五个旧预览入口同步新版。Cocos 成功退出码 36、10018ms，DPR 完成，Wrangler main 成功。仅素材制作、构建与发布，用户人工查看，未运行测试、浏览器、游戏或线上验收；新生成动画尚未获用户认可。详情见 `docs/hero-idle-full-v4/release.json`。

2026-10-14 [重弩手斗篷出框修正](docs/hero-idle-cape-fix-v3/README.md) 已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=hero-idle-cape-fix-v3-1791910443) · [完整斗篷预览](https://kingdom-watch.pages.dev/previews/hero-idle-cape-fix-v3/?v=1791910443)，部署 `https://8b0262f6.kingdom-watch.pages.dev`。用户指出斗篷超屏，源片第 28–52 帧已被右边界截断，本轮从认可段保留完整连续源帧 4–26，23 张原像素、44 项相邻往返时序、约 2.762951 秒，随保留运动段缩短时长维持平均节奏。新正式资源 `sniper_idle_cape_safe_v3`，图集 4096×1536，未重新生成视频／图片，固定比例、人物尺寸 153、脚底及原帧像素保持，不靠缩人物或扩大透明画布遮掩原片缺失。首尾相邻衔接、转折减速继续适用；雷法师当前像素与循环、弓箭手及重弩攻击保持。源取景留白要求已写入永久规范和生成提示词，通用打包入口拒绝距源边界不足 12 像素的帧。四个旧预览入口同步新版，原视频作为记录并明确与修正动画区别。Cocos 成功退出码 36、9554ms，DPR 完成，Wrangler main 成功。仅素材制作、构建与发布，用户人工查看，未运行测试、浏览器、游戏或线上验证；原动作认可不等于本轮斗篷修正已验收。详情见 `docs/hero-idle-cape-fix-v3/release.json`。

2026-10-14 [待机循环衔接修正与固定要求](docs/hero-idle-loop-v2/README.md) 已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=hero-idle-loop-v2-1791909949) · [新版循环预览](https://kingdom-watch.pages.dev/previews/hero-idle-loop-v2/?v=1791909949)，部署 `https://db59ee45.kingdom-watch.pages.dev`。用户认可上一版动作，但指出首尾跳跃，并明确要求记住衔接约束。本轮不生成新视频或图片，原 50／43 张动作及图集像素保留，逐相邻帧往返和转折减速，98／84 项约 6.153846 秒完整循环，平均单程时长保持；末尾第 1 帧接首帧，不再第 49／42 帧硬切首帧，不加透明度过渡。正式资源 `sniper_idle_lively_loop_v2`／`volt_idle_lively_loop_v2`，尺寸 153／146 和脚底保持；弓箭手媒体、高度 185.64 及重弩攻击保持。旧三个预览入口同步新版。首尾衔接要求已经写进 AGENTS 永久约束、英雄待机规范和 AI 视频工作流；新视频任务自动追加闭合提示词，打包强制相邻帧闭合，取消宽松像素阈值自动放行。Cocos 成功退出码 36、9646ms，DPR 完成，Wrangler main 成功。用户人工查看，不运行测试、浏览器、游戏或线上验收；原动作已认可，本次循环修正待人工查看。详情见 `docs/hero-idle-loop-v2/release.json`。

2026-10-14 [两位英雄重新生成待机视频](docs/hero-idle-lively-v1/README.md) 已接入并构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=hero-idle-lively-v1-1791909260) · [新视频与序列帧预览](https://kingdom-watch.pages.dev/previews/hero-idle-lively-v1/?v=1791909260)，部署 `https://09a54404.kingdom-watch.pages.dev`。用户明确反馈上一轮仍不够灵动，本次沿用已确认站姿图，重新提交两段 MiniMax H3 两秒视频，任务为 `task_EitBsCykZfpPwn5aCiyusS6EkSgRdIHX`／`task_nFeFWhnNV3ek4aQABCiGLEQ9PWUxtuZX`，各返回 56 张完整源帧。重弩手选新源帧 4–53 共 50 张，雷法师选 2–44 共 43 张，连续循环 3.076923 秒，新正式资源 `sniper_idle_lively_v1`／`volt_idle_lively_v1`；运动重点为整片披风、袍摆和衣物褶皱，限制身体与武器大幅运动，提示词不等于效果验收。保留固定画内比例、脚底和显示高度 153／146，弓箭手素材与高度 185.64、重弩攻击保持。旧 `hero-idle-subtle-v2`／`hero-stance-rebuild-v1` 预览入口同步本版，预览提供本次新原视频。Cocos 成功退出码 36、10330ms，DPR 完成，Wrangler main 成功。仅制作、接入、构建与发布，用户人工查看，不运行测试、游戏、浏览器或线上验收；已确认静态图片，不记录新动画已获认可。详情见 `docs/hero-idle-lively-v1/release.json`。

2026-10-14 [两位英雄待机速度调整](docs/hero-idle-speed-v1/README.md) 已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=hero-idle-speed-v1-1791908337) · [待机对照](https://kingdom-watch.pages.dev/previews/hero-idle-subtle-v2/?v=1791908337)，部署 `https://bb634e90.kingdom-watch.pages.dev`。按用户“速度有点慢”反馈，重弩手与雷法师当前待机统一提速 30%，单轮由 4 秒缩短为 4/1.3≈3.076923 秒，逐帧时长及 GIF 同步缩短，预览进度条读取实际时长。原 9／8 张完整帧、16／14 项帧序、动作幅度、已确认站姿、武器握持、尺寸和脚底均保持；弓箭手及重弩攻击速度保持。制作脚本同步新时长，勿恢复历史四秒循环。Cocos 成功退出码 36、10503ms、DPR 完成，Wrangler main 成功；用户人工查看，未运行测试、浏览器、游戏或线上验收，不将速度反馈当作完整动画认可。详情见 `docs/hero-idle-speed-v1/release.json`。

2026-10-14 用户确认重弩手／雷法师新站姿图片可以，明确否定前轮待机的夸张、奇怪身体动作；[待机幅度修正 v2](docs/hero-idle-subtle-v2/README.md) 已接入并构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=hero-idle-subtle-v2-1791907914) · [新版对照预览](https://kingdom-watch.pages.dev/previews/hero-idle-subtle-v2/?v=1791907914)，部署 `https://ca6d51d1.kingdom-watch.pages.dev`。沿用已确认图片、武器握持与原 H3 视频，未生成新图片或提交新视频任务；重新筛选安静连续开头段，重弩手仅保留源帧 0–8（9 张完整帧／16 项四秒时序），雷法师保留 0–7（8 张／14 项四秒时序），明显抬肩、扭腰、挪动手臂的后段不再入图集。新资源 `sniper_idle_subtle_v2`／`volt_idle_subtle_v2` 完全保留原帧像素、固定取景、缩放、脚底 `(256,496)` 与高度 153／146；不拆身、不局部形变、不逐帧重新缩放、不加透明度切换。重弩攻击 `sniper_stance_attack_v1`、弓箭手图片／待机／攻击及高度 185.64 保留。旧 `hero-stance-rebuild-v1` 预览入口同时更新到本版。源帧参考图块位移预算仅用于制作范围选择，不等同全身效果验收。Cocos 成功退出码 36、9672ms、DPR 完成，Wrangler main 成功。图片认可不代表新动画已认可；用户人工查看，未运行测试、浏览器、游戏或线上验收。详情见 `docs/hero-idle-subtle-v2/release.json`。

2026-10-13 [重弩手与雷法师站姿、轻微待机重做](docs/hero-stance-rebuild-v1/README.md) 已接入并构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=hero-stance-v1-1791906822) · [弓箭手对照／镜像预览](https://kingdom-watch.pages.dev/previews/hero-stance-rebuild-v1/?v=1791906822)，部署 `https://739dad09.kingdom-watch.pages.dev`。两位英雄参考当前弓箭手的前后错脚、放松站姿，武器握持保持；两段 H3 两秒请求各返回 56 张完整帧，四秒缓和往返循环，显示高度分别 153／146。重弩手攻击同步改用同一新母版的前 10 张完整帧、小幅受力并按原帧回位，停止使用后段转弩和旧站姿攻击；单图全不透明直接换帧，共享比例和脚底。雷法师交战冻结新人物，其新攻击序列尚待后续。弓箭手原图片、待机、攻击及高度 185.64 保留。原片、图片及实际提示词均在上述制作目录；旧重弩／雷法师站姿和待机已被用户明确否定，不再推断此前图片认可继续适用。Cocos 成功退出码 36、13120ms、DPR 完成，Wrangler main 成功；用户人工查看，未运行测试、游戏、浏览器或线上验收，未记录视觉认可。详情见 `docs/hero-stance-rebuild-v1/release.json`。

2026-10-13 [雷法师完整待机序列帧](docs/volt-idle-v1/README.md) 已接入并构建发布：[进入最新游戏](https://kingdom-watch.pages.dev/?v=volt-idle-live-v1-1791905367) · [待机原向／镜像预览](https://kingdom-watch.pages.dev/previews/volt-idle-v1/?v=1791905367)。沿用用户认可的紫袍雷法师红底图，H3 两秒请求生成 56 张完整人物帧，四秒逐帧往返循环，固定脚底和显示高度 146；空闲时播放，攻击范围内有目标或施法时冻结同一新人物，空闲后续播，整图直接左右镜像。旧雷法师人物形变停用，新完整攻击序列待后续制作，原技能、弹道、伤害和声音保留。重弩手高度 153、弓箭手高度 185.64 和既有素材保留，效果由用户人工查看。

2026-10-13 [重弩手缩小 10% 与雷法师战斗图](docs/sniper-size90-volt-art-v1/README.md) 已构建发布：[进入最新游戏](https://kingdom-watch.pages.dev/?v=sniper-size90-volt-art-1791904451) · [雷法师原向／镜像预览](https://kingdom-watch.pages.dev/previews/volt-combat-rebuild-v1/?v=1791904451)。重弩手待机与攻击显示高度同步由 170 改为 153，沿用原图集与全不透明直接换帧。雷法师依据紫袍银发立绘及紫晶法杖生成纯红底完整背面备战图，本轮交付静态图片与独立预览，后续待机／攻击动画尚未制作或接入。弓箭手当前图片、动作和高度 185.64 保留，效果由用户人工查看。

2026-10-13 [重弩手动作切换黑闪修正](docs/sniper-transition-fix-v1/README.md) 已构建发布：[进入最新游戏](https://kingdom-watch.pages.dev/?v=sniper-switch-no-fade-1791903506) · [新版预览](https://kingdom-watch.pages.dev/previews/sniper-attack-forward-v4/?v=1791903506)。移除游戏与预览的双图透明度过渡，人物保持全不透明直接换帧。继续使用 [攻击比例与火星修正 v4](docs/sniper-attack-forward-v4/README.md) 的 44 帧、当前待机和共享脚底；攻击／收势时停播待机、左右直接镜像。弓箭手现有图片、动作及高度 185.64 保留，效果由用户人工查看。

历史 [攻击 v3](docs/sniper-attack-forward-v3/README.md) 被用户指出大小切换不自然和残留火星，已由上方 v4 替代。

历史 [重弩手朝前平举弩 v2 正式接入](docs/sniper-forward-integration-v2/README.md) 在新攻击制作前采用静态持弩配合原箭矢，该临时交战表现现已由上方攻击 v3 替代。

历史 [重弩手画面内横向平举弩](docs/sniper-idle-level-v1/README.md) 后续被用户指出朝向不对；原图片、视频和独立预览保留为制作记录，当前正式战斗采用上方 v2。

2026-10-13 [重弩手去枪焰攻击](docs/sniper-attack-no-flash-v1/README.md) 已接入正式战斗：普攻、技能及大招发弹播放完整人物攻击序列，固定脚底与大小、左右镜像，攻击时停播待机；移除弩口闪光。[进入新版游戏](https://kingdom-watch.pages.dev/?v=sniper-attack-noflash-1791870716)。已构建发布，效果由用户人工查看。

2026-10-13 [新重弩手接入正式战斗](docs/sniper-battle-integration-v1/README.md)，读取完整人物待机与四秒逐帧往返时序，按实际攻击方向镜像，攻击范围内有敌人或正在攻击时冻结新姿态。弓箭手待机／攻击显示高度由 221 同步缩小 16% 到 185.64，沿用原图片和动作。[进入最新游戏](https://kingdom-watch.pages.dev/?v=sniper-live-archer-84-1791868072)。

竖屏单机塔防射击 H5 游戏（TapTap 小游戏），Cocos Creator **3.8.8** 构建。
当前进度：**M0 工程骨架 + 1-1 战斗框架**（代码全部 TypeScript，引擎级 tsc 类型检查通过）。

2026-10-13 五位英雄增加 [镜像攻击朝向](docs/hero-mirror-v1/README.md)，攻击范围内有敌人或正在攻击时停止待机，范围内无敌人且攻击结束后恢复；范围外敌人不阻止待机。弓箭手使用用户提供视频的完整 [待机序列帧](docs/archer-idle-v1/README.md) 与 [攻击序列帧](docs/archer-attack-v1/README.md)，放箭回调播放收势、取箭和回位，按攻速适配时长，连射不反复重启当前动作；替代被用户否定的拆分动画。用户自行人工验证，Codex 只完成改动、构建与发布，不执行效果验收脚本。

2026-10-11 战局能力改为三选一解锁：所有英雄新入场仅普攻可用，技能与大招分别学习，未学习的能力不释放、不充能且不进入升级卡池。脚底普攻图标在未学技能时居中；学习后显示对应技能／大招入口。规则、素材合成预览与验证见 [战局能力解锁](docs/ability-unlock-v1/README.md)。

2026-10-07 战斗表现升级：原创英雄/怪物图集、脚底阴影与遮挡排序、紧凑 HUD、命中反馈和职业音效已接入。打击反馈优先采用快速出手、收势、定向碎屑和短促音效；大招不震动战场，冰系不闪屏。完整制作路线、资源规格与剩余验收见 [战斗画面商业级升级方案](docs/战斗画面商业级升级方案.md)。2026-10-11 英雄已从两姿态瞬间跳换，改为稳定准备姿态上的连续上身／武器／衣摆运动；血条整组上移 22，暂停统计完整容纳四人，见 [英雄战斗动作与暂停统计修复](docs/hero-battle-motion-v1/README.md)。专业音频与完整骨骼动画仍在后续制作清单。

字体与飘字已统一升级：中文正文/魔幻标题、HUD 数字、厚实斜体伤害字、漫画拟声字均随包加载。战斗飘字用白色普攻、红色暴击，采用快速撑开、全不透明定住、短压缩退场；保留 75ms 伤害合并、空间避让、暴击预留与暂停冻结。资源、动态演示和验证见 [字体与战斗飘字规范](docs/字体与战斗飘字规范.md)。

2026-10-11 冰法师技能 v10 已通过用户验收：连续 MiniMax H3 视频素材、固定圆度与取景校正、0.4 秒起手 / 0.42 秒主体 / 0.68 秒收尾，总计 1.5 秒。制作方法与失败原因见 [冰系特效制作复盘](docs/冰系特效制作复盘.md)，下一步设计见 [冰法师大招方案](docs/frost-ultimate-v1/README.md)。

冰法师大招已按反馈移除全场寒潮，并修正从天而降、尖端接地和同步碎裂；128 枚落冰、最多 24 处主要碎冰。实际渲染器状态合成预览与发布记录见 [大招 v2](docs/frost-ultimate-v2/README.md)，等待用户游戏内视觉验收。

后续按“更少、先后落下、修正视角”反馈调整为最多 96 枚独立错峰落冰，少怪自动减量，加入地面相对高度、远近尺寸、单尖造型和与怪物共同的深度遮挡；当前预览与发布记录见 [大招 v3](docs/frost-ultimate-v3/README.md)。

最新录像反馈指出上方目标导致中下段落冰不足。现改为固定 128 枚全场随机落冰，落点与怪物位置/数量无关，保留逐颗错峰、地面反馈和遮挡，见 [大招 v4](docs/frost-ultimate-v4/README.md)。普通技能保留前 0.82 秒，收尾改为原材质碎片向下坠落、触地后消散，完整时长仍为 1.5 秒，见 [技能 v11](docs/frost-field-v11/README.md)。

后续人工验收认为 v11 不如原版，技能已恢复完整 v10。新增冰法蓝卡“寒冬延续”，每层延长大招减速 1 秒、最多 3 层；普攻使用同款大招冰晶与稳定蓝白尾迹，见 [普攻与强化卡更新](docs/frost-normal-v1/README.md)。

主界面采用用户选定的“清爽漫画奇幻”：商店的场景、物品插画及通用组件见 [商店漫画美术 v1](docs/shop-comic-v1/README.md)；英雄页的冷暖层次场景、方形英雄卡、装备背板、深色分类页签和放大动作入口见 [英雄页漫画美术 v3](docs/hero-comic-v3/README.md)，五名立绘及交互弹窗沿用 [v1](docs/hero-comic-v1/README.md)。关卡页的连续室外场景、横向滑动关卡条、完整奖励区及编队弹窗见 [关卡页漫画美术 v2](docs/levels-comic-v2/README.md)。升级页的训练场景、四类培养组件、阶段突破与固定升级入口见 [升级页漫画美术 v1](docs/upgrade-comic-v1/README.md)。基地页的连续庭院、主城建设、图鉴及详情弹窗见 [基地页漫画美术 v1](docs/base-comic-v1/README.md)。五页共用紧凑右侧资源栏、底部导航及 ComicUI 单层组件；英雄页空背包只显示说明。

## 如何打开 / 运行

战斗弹窗按用户最新约束恢复原布局与文字，只替换局部美术资源，见 [战斗弹窗资源替换 v2](docs/battle-panels-comic-v2/README.md)。伤害统计 tips 恢复原半透明小背板，伤害值仍在进度条内，百分比仍在原右侧位置；条长按真实份额绘制。刷新、双倍奖励、复活和战局能力解锁保持原有玩法。

1. 打开 Cocos Creator Dashboard（3.8.8）→ 「项目」→「添加」→ 选择本目录 `D:\AI\S4Game\KingdomWatch`
2. 打开工程后，双击 `assets/scenes/Main.scene`
3. 顶部 ▶ 预览（浏览器），即可进入 M0 战斗全流程

## M0 范围（产品文档 §14）

- 完整战斗框架：清场驱动波次（1-1 共 10 波，第 4/8 波 surge）、虫群下行+正弦游动+自动分离、
  索敌范围（最靠下优先）、可见追踪弹道（目标死亡换目标）、防线耐久+盾值
- 弓箭手「艾拉·风羽」：普攻自动 / 技能「穿云箭」(12s CD 直线穿透 5.2×) / 大招「箭雨风暴」
  (击杀充能，上限 60，3 轮 × 12 箭)
- 经验升级：队伍共享经验 → 三选一弹窗（冻结战斗，广告刷新 ×1 + 钻石刷新 ×1）
- 结算：胜利星级（按耐久比例 1-3★）、失败弹窗内圆形广告复活位（+30% 耐久，无限次）、
  30% 金币保底
- HUD 全量（线稿同布局）：波次/横幅/经验条/耐久+盾值/普攻技能图标（点击出属性 Tips）/
  大招充能按钮/倍速（debug 全开）/暂停（奖励总览、伤害统计、设置三页签）

## 目录结构

```
KingdomWatch/
├─ assets/scenes/Main.scene      # 空场景：Canvas/Camera/GameRoot 由 Boot.ts 运行时构建
├─ assets/scripts/
│  ├─ Boot.ts                    # EVENT_AFTER_SCENE_LAUNCH → 750×1334 适配 + Canvas + BattleDirector
│  ├─ config/                    # GameConfig(适配/上限/公式) Mobs(怪物+1-1波次) Cards(卡池)
│  ├─ core/                      # EventBus / ObjectPool / SaveData(localStorage)
│  ├─ platform/AdService.ts      # 广告接口 + Mock 实现（600ms 延迟、10% 概率失败）
│  ├─ battle/                    # WaveManager Monster Projectile Hero LineDefense
│  │                             # BattleDirector(战斗主循环/三选一/结算) DamageService FloatText
│  └─ ui/                        # UIKit(画布坐标系工具) HUD(战斗顶栏) Panels(弹窗全家)
└─ tsconfig 上层校验配置：D:\AI\S4Game\tsconfig.check.json
```

## 美术占位与替换机制

英雄和怪物已使用共享纹理图集（`battle_heroes_v2` / `battle_mobs_v2`）及帧矩形清单，场景/防线/UI 按现有同名资源加载。Graphics 保留作为资源加载失败的兜底；命中、弹道及部分环境表现仍由程序绘制。
后续替换美术时：在 `config/` 增加资产 ID 映射 → 场景节点换 SpriteFrame/Spine，
布局坐标不变（UIKit 的 `WX/WY` 直接换算线稿 750×1334 坐标，与 `UX/wireframe.html` 一一对应）。

## 类型检查

```bash
cd D:/AI/S4Game
npx -y -p typescript@5.4.5 tsc -p tsconfig.check.json
```

`"cc"` 路径映射到本机引擎声明 `.../3.8.8/resources/.../bin/.declarations/cc.d.ts`，
等效于 Creator 内部编译，提前暴露引擎 API 误用。

## 构建与部署（免编辑器 CLI 流程）

默认交付流程（用户要求）：每次游戏改动完成后，构建、补丁和相关检查通过后发布到下方手机体验地址，并验证线上版本。

```bash
# 1. 命令行构建 web-mobile（不需要打开 Creator 界面，约 40s）
"C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe" \
  --project "D:/AI/S4Game/KingdomWatch" \
  --build "platform=web-mobile;debug=true"

# 2. 引擎 dpr 钳制补丁（3x 屏 HUD 清晰度，详见下节；每次构建后必须跑）
cd D:/AI/S4Game/KingdomWatch
python tools/patch-web-dpr.py

# 3. 部署到 Cloudflare Pages（wrangler 已 OAuth 登录）
cd build/web-mobile
npx -y wrangler@3 pages deploy . --project-name=kingdom-watch --branch=main --commit-dirty=true
```

线上地址：<https://kingdom-watch.pages.dev/> （手机浏览器直接跑；边缘缓存约半分钟生效，可加 `?v=1` 绕过）

Windows 上建议用 `Start-Process -WindowStyle Hidden` 启动 Creator，并重定向输出到 temp 日志以避免管道 EPIPE。若已启用系统代理，发布时给当前 Wrangler 进程设置 `HTTPS_PROXY` 为实际代理地址；Node 不会自动沿用 Windows 系统代理。

## HUD 清晰度（dpr 补丁）

引擎 3.8.8 的 web 适配器把 `devicePixelRatio` 钳制为 `min(dpr, 2)`，3x 屏上 canvas
后备缓冲只有 2/3 物理像素，被浏览器 CSS 拉伸后 HUD/文字发糊（2x 屏不受影响）。
处理方式（两件套，构建后缺一不可）：

1. `build-templates/web-mobile/index.html`：构建模板，含 `viewport-fit=cover` 和
   预引擎脚本——定义 `window.__KW_DPR_CAP = min(真实dpr, 3)`，URL 加 `?dpr=2` 可回退省电。
2. `tools/patch-web-dpr.py`：把引擎包 `_virtual_cc-*.js` 里的钳制上限改为读 `__KW_DPR_CAP`。

验证：控制台 `cc.game.canvas.width / cc.game.canvas.clientWidth` 应等于设备 dpr（≤3）。
性能：3x 全开 fill rate 约为 2x 的 2.25 倍，如低端机掉帧可让用户以 `?dpr=2` 访问。

补丁脚本结尾带守卫：构建产物 index.html 若缺 `__KW_DPR_CAP` 引导脚本直接报错退出（禁止部署）。
`build-templates/web-mobile/_headers` 对全站下发 `Cache-Control: no-cache`——游戏主包文件名不带内容哈希，
不加此头手机端会因启发式缓存滞留旧版本（真机"改了没生效/又变糊"均由此起）。排查线上时注意：
`/index.html` 会 308 跳转到 `/`，curl 验证必须打根路径。

## 构建与上传（TapTap）

1. Creator 菜单「项目 → 构建发布」→ 平台 **Web Mobile** → 构建
2. MCP 流程：`prepare_h5_upload`（确认 build 目录，如 `build/web-mobile`）→ `upload_h5_game`
3. 真机验收（M0 标准）：进关 → 战斗 → 升级三选一 → 复活/胜利 → 结算 全流程 + 30fps

## 存档

`localStorage['kw_save_v1']`：金币 500 / 钻石 20 初始；`debug:true` 时倍速与满充能按钮常开（真机验收可关）。

## GM 后台（调试）

左列紫色 **GM** 浮钮打开（`save.debug` 时显示；入口隐藏后可用 URL 参数 `?gm=1` 强制唤出）。按系统分类页签：

- **战斗**：刷怪 ×1/×10/×30、全清怪物、跳过本波、耐久回满、护盾 ±、直接胜利/失败、回主菜单、切换倍速
- **英雄**：升级 ×1/×5/×10（走真实三选一队列）、大招充满/清空、技能 CD 清零、属性面板
- **卡片**：17 张卡双列格子，+1/+5 直接学习生效并实时刷新层数
- **经济**：金币/钻石直加（入档）、解锁倍速、星级全满、调试开关
- **存档**：保存/重载/带参重启、清空存档并重启、存档 JSON 摘要
- **系统**：dpr=1/2/3 快捷切换（`?dpr=N`）、`?gm=1` 重启、画布/可视区/安全区信息

打开即冻结战斗（running→paused），关闭恢复；期间击杀/升级产生的三选一在关闭后按序弹出。三选一/结算弹窗期间 GM 不可打开。
