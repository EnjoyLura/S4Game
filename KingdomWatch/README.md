# 王国守望 (Kingdom Watch)

竖屏单机塔防射击 H5 游戏（TapTap 小游戏），Cocos Creator **3.8.8** 构建。
当前进度：**M0 工程骨架 + 1-1 战斗框架**（代码全部 TypeScript，引擎级 tsc 类型检查通过）。

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

M0 所有画面元素（怪物/英雄/防线/UI）均为 **Graphics 程序化占位**（手绘卡通取向配色）。
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

```bash
# 1. 命令行构建 web-mobile（不需要打开 Creator 界面，约 40s）
"C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe" \
  --project "D:/AI/S4Game/KingdomWatch" \
  --build "platform=web-mobile;debug=true"

# 2. 部署到 Cloudflare Pages（wrangler 已 OAuth 登录）
cd build/web-mobile
npx -y wrangler@3 pages deploy . --project-name=kingdom-watch --branch=main --commit-dirty=true
```

线上地址：<https://kingdom-watch.pages.dev/> （手机浏览器直接跑；边缘缓存约半分钟生效，可加 `?v=1` 绕过）

## 构建与上传（TapTap）

1. Creator 菜单「项目 → 构建发布」→ 平台 **Web Mobile** → 构建
2. MCP 流程：`prepare_h5_upload`（确认 build 目录，如 `build/web-mobile`）→ `upload_h5_game`
3. 真机验收（M0 标准）：进关 → 战斗 → 升级三选一 → 复活/胜利 → 结算 全流程 + 30fps

## 存档

`localStorage['kw_save_v1']`：金币 500 / 钻石 20 初始；`debug:true` 时倍速与满充能按钮常开（真机验收可关）。
