# 王国守望 (Kingdom Watch)

竖屏单机塔防射击 H5 游戏（TapTap 小游戏），Cocos Creator **3.8.8** 构建。
当前进度：**M0 工程骨架 + 1-1 战斗框架**（代码全部 TypeScript，引擎级 tsc 类型检查通过）。

2026-10-07 战斗表现升级：原创英雄/怪物图集、英雄双姿态、脚底阴影与遮挡排序、紧凑 HUD、命中反馈和职业音效已接入。打击反馈优先采用快速出手、收势、定向碎屑和短促音效；大招不震动战场，冰系不闪屏。完整制作路线、资源规格与剩余验收见 [战斗画面商业级升级方案](docs/战斗画面商业级升级方案.md)。当前英雄为两姿态动画，专业音频与完整骨骼动画仍在后续制作清单。

字体与飘字已统一升级：中文正文/魔幻标题、HUD 数字、厚实斜体伤害字、漫画拟声字均随包加载。战斗飘字用白色普攻、红色暴击，采用快速撑开、全不透明定住、短压缩退场；保留 75ms 伤害合并、空间避让、暴击预留与暂停冻结。资源、动态演示和验证见 [字体与战斗飘字规范](docs/字体与战斗飘字规范.md)。

2026-10-11 冰法师技能 v10 已通过用户验收：连续 MiniMax H3 视频素材、固定圆度与取景校正、0.4 秒起手 / 0.42 秒主体 / 0.68 秒收尾，总计 1.5 秒。制作方法与失败原因见 [冰系特效制作复盘](docs/冰系特效制作复盘.md)，下一步设计见 [冰法师大招方案](docs/frost-ultimate-v1/README.md)。

冰法师大招已按反馈移除全场寒潮，并修正从天而降、尖端接地和同步碎裂；128 枚落冰、最多 24 处主要碎冰。实际渲染器状态合成预览与发布记录见 [大招 v2](docs/frost-ultimate-v2/README.md)，等待用户游戏内视觉验收。

后续按“更少、先后落下、修正视角”反馈调整为最多 96 枚独立错峰落冰，少怪自动减量，加入地面相对高度、远近尺寸、单尖造型和与怪物共同的深度遮挡；当前预览与发布记录见 [大招 v3](docs/frost-ultimate-v3/README.md)。

最新录像反馈指出上方目标导致中下段落冰不足。现改为固定 128 枚全场随机落冰，落点与怪物位置/数量无关，保留逐颗错峰、地面反馈和遮挡，见 [大招 v4](docs/frost-ultimate-v4/README.md)。普通技能保留前 0.82 秒，收尾改为原材质碎片向下坠落、触地后消散，完整时长仍为 1.5 秒，见 [技能 v11](docs/frost-field-v11/README.md)。

后续人工验收认为 v11 不如原版，技能已恢复完整 v10。新增冰法蓝卡“寒冬延续”，每层延长大招减速 1 秒、最多 3 层；普攻使用同款大招冰晶与稳定蓝白尾迹，见 [普攻与强化卡更新](docs/frost-normal-v1/README.md)。

主界面采用用户选定的“清爽漫画奇幻”：商店的场景、物品插画及通用组件见 [商店漫画美术 v1](docs/shop-comic-v1/README.md)；英雄页的冷暖层次场景、方形英雄卡、装备背板、深色分类页签和放大动作入口见 [英雄页漫画美术 v3](docs/hero-comic-v3/README.md)，五名立绘及交互弹窗沿用 [v1](docs/hero-comic-v1/README.md)。关卡页的公会作战室、三种微缩战场、难度/奖励/战斗组件及编队弹窗见 [关卡页漫画美术 v1](docs/levels-comic-v1/README.md)。三页共用紧凑右侧资源栏和底部导航；英雄页空背包只显示说明。

## 如何打开 / 运行

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
