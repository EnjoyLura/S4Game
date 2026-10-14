# 用户冰法师待机与攻击

用户提供的 `lens-api-task_yq8OpM3P7gf4lhvYXH3Op1kRdTvRDPGt.mp4` 为攻击（take-a），`lens-api-task_zYSJbUSMnFr9ltP4YS4KqI8j0kuu75sf.mp4` 为待机（take-b）。两段完整原片、SHA、源帧和接触表分别保留于对应目录；各 56 帧、24fps、约 2.333333 秒，未调用付费视频生成。

去除纯绿背景并处理边缘溢色，一段只用一个联合裁框、一次等比缩放和固定脚底；两动作共用 512×512 格子、画内基准高468、显示高146和脚底(256,496)。全部源帧保留，待机按原始时间正向等时循环，攻击参考释放帧22。资源 `mora_idle_user_v1` 与 `mora_attack_user_v1` 通过 `MoraIdleAnimation` 接入已有整图镜像播放器。

普攻冰棱、领域及大招的实际施放回调触发动作。攻击、待发和收势期间不播放待机；自身攻击范围内无目标且无排队攻击、动作结束后恢复。角色始终全不透明直接换帧。未修改冰系伤害、冻结、减速、范围、弹道或游戏特效。

本地素材演示：[待机与镜像](idle-mirror.gif)、[待机至攻击](idle-attack-mirror.gif)。这些是全源帧演示，不代表运行游戏或用户视觉验收。构建与正式发布归档在 `../pick-comic-v1/`，效果由用户人工查看。

已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=pick-comic-v1-1791996687) · [部署快照](https://5894b2f5.kingdom-watch.pages.dev)。Cocos 成功退出码36、8771ms，DPR完成，Wrangler main上传22文件、1660缓存。效果由用户人工查看，未运行测试、游戏、浏览器或线上验收。
