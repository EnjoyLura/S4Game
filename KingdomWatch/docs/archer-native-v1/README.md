# 弓箭手原生分层动画 v1

2026-10-12 用户确认 `../archer-combat-v3/images/archer-ready.png` 的形象，要求直接完成原生动画和效果预览，替代此前静态审查／用户提供视频的等待步骤。本次使用现有 Cocos Creator 3.8.8，无 Spine 编辑器或运行时，未提交视频生成任务。

交付：[互动预览](https://kingdom-watch.pages.dev/previews/archer-native-v1/?v=1791815244)，[手机游戏](https://kingdom-watch.pages.dev/?v=archer-native-1791815244)。预览可选待机、射箭、连射、强化箭、三个方向、速度和逐帧暂停；右下显示战斗原尺寸。动画动图为 [预览录屏](archer-native-preview.gif)，Cocos 战场画面见 [长屏](battle-932.png)／[短屏](battle-600.png)。

## 制作与接入

以确认形象为参考，用 Imagegen 补全独立身体、左右手臂、手、弓和箭筒，另绘左前／右前三分之四身体。第三次修正删除躯干自带的袖子、肩甲，避免重复手臂。生成原图在 `sources/`，提示词在 `prompts/`。`build_parts.py` 只按 alpha 区域裁切、缩放、加留白、打包，不重新绘制；20 部件共用 1280×1024 RGBA 图集，约 1.03 MiB。

- `ArcherRigPose.ts` 计算轻呼吸、披风滞后、拉弦、释放、回位和两节手臂关节约束；人物不整块弹跳或缩放。
- `ArcherNativeRig.ts` 使用 Cocos Sprite 节点与 Graphics 弓弦／搭箭，共享素材加载并复用节点。脚底相对根节点为 `(0, -76)`，箭尖 `(0, 136)` 对应原射击起点 `HERO_Y + 60`。
- 三方向独立绘制，不镜像换手；左手持弓、右手拉弦。瞄准平滑，进入阈值 0.40 rad，退出 0.28 rad，失去目标一秒后回正。目前采用三档身体视图切换，未制作完整连续透视转身。
- `Hero.ts` 的 `fireRow`／`fireFanRow` 按实际箭排释放；齐射列共享一次动作。通用普攻与强化技能脉冲不重复放箭。0.12 秒连射加快搭箭／回位并延续当前手部姿势。
- 动作由战斗 tick 驱动；暂停冻结。首箭保留立即发射规则，后续箭提前准备；发射数量、时间、位置和伤害参数沿用原逻辑。其余四位英雄保留已有连续 UV 动画。
- 预览从同一个姿态 TS 编译、使用同一图集；飞箭为演示。真实游戏仍由 ProjectileManager 发射。

## 检查

`check_pose.cjs` 检查 3000 个姿态、全范围瞄准、固定脚底／箭尖、关节长度、释放连续性、转向缓冲、无目标回正与连射搭箭。[姿态报告](pose-validation.json)。

`check_native.cjs` 在真实 Cocos 静态战场调用 Hero 回调，覆盖 430×932、375×600。四秒 24 排／48 箭恰好 24 次动作；箭雨 2 排／16 箭恰好 2 次动作。脚底渲染像素变化为零，暂停时钟固定，其余英雄和血条检查通过。未启动真实波次。[本地](game-validation.json)／[线上](online-validation.json)。

TypeScript 与 `tools/ability-unlock-check.cjs` 通过。Creator web-mobile 构建后执行 DPR 补丁，Wrangler 发布 main。`verify_release.py` 核对线上入口、脚本、资源清单、图集、姿态清单与预览四文件的 SHA-256，保存 [发布报告](deployment-validation.json)。

```powershell
python docs/archer-native-v1/build_parts.py
node docs/archer-native-v1/build_preview.cjs
node docs/archer-native-v1/check_pose.cjs
node docs/archer-native-v1/check_native.cjs
node docs/archer-native-v1/capture_preview.cjs
python docs/archer-native-v1/make_gif.py
```

Creator 构建与 DPR 补丁后执行 `node docs/archer-native-v1/build_preview.cjs --publish`，将预览复制到 `build/web-mobile/previews/archer-native-v1/` 一并发布。
