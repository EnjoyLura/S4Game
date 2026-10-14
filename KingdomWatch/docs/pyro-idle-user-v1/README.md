# 火法师用户待机与完整动作接入

2026-10-15 更新：用户指出本版待机首尾跳跃并否定旧攻击，新攻击和新生成待机已替换为 `pyro_attack_user_v2`／`pyro_idle_loop_v2` 并[发布](https://kingdom-watch.pages.dev/?v=pick-comic-v1-1791996687)；本目录保留历史来源，最新状态见 `../pyro-actions-user-v2/README.md`。

2026-10-15 用户提供 `C:/Users/user/Downloads/video (3).mp4`，标注为火法师待机动作。完整原文件保存为 `source.mp4`，SHA256 与媒体信息见 `source-origin.json`。没有提交新的图片或视频生成任务。

## 素材

56 帧、24fps、约 2.333333 秒，1344×768 绿底源片。采用与此前火法师攻击相同的绿色覆盖率与反混色方法去绿边，全部原帧按时间顺序保留，正向等时循环；没有倒放、删帧、裁短、补长停帧、身体拆分或透明度淡化。源片全部帧四边预留至少 12 像素，衣摆完整。

通过一次联合裁框、一个固定脚底原点与一次统一缩放制作 512×512 格子，完整人物画内高度 468，显示高度 146，脚底 `(256,496)`，节点位置 `(0,-76)`。与此前 `pyro_attack_user_v1` 的尺度、脚底、显示高度一致，各动作整段固定，避免切换时大小变化。

- `original-frames/`、`rgba-frames/`、`frames/`：原帧、原画布透明帧与格子。
- `idle.png` / `idle.frames.json`：4096×3584 图集与全部正向时序，正式资源 `pyro_idle_user_v1`。
- `idle-mirror.gif`：纯素材左右镜像对照。
- `idle-attack-mirror.gif`：完整待机 → 之前的完整攻击，原向和镜像对照。
- `source-contact.png`、`contact-sheet.jpg`：完整源片与打包帧标注。

## 游戏接入

新的 `PyroIdleAnimation` 复用现有 `HeroSequenceAnimation`。火法师由旧 UV 表现改为完整角色序列帧，待机与此前用户提供的 `pyro_attack_user_v1` 一起接入。实际火球发射、技能和大招施放回调触发攻击；攻击与收势期间停播待机，自身攻击范围内没有目标、没有排队攻击且动作结束后恢复待机。完整人物以脚底整体左右镜像，换帧保持全不透明。

重弩手、雷法师、弓箭手及冰法师媒体保持，伤害、攻速、目标选择、火球轨迹、火焰特效与声音保持。用户明确自行人工验收，不运行测试、游戏、浏览器或线上验收。原生源片首尾闭合与新动作质量仍由用户判断，不把时序打包与发布记录为视觉认可。

本轮与成功／失败结算美术一起构建和发布，发布完成后详见 `release.json`；构建、DPR、部署记录保存在 `../settlement-comic-v1/`。

已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=settlement-comic-v1-1791994681) · [部署快照](https://f9b74360.kingdom-watch.pages.dev)。Cocos 成功退出码 36、8302ms，DPR 完成，Wrangler main 上传 24 文件、1633 缓存。效果由用户人工查看，未进行游戏或线上验收。
