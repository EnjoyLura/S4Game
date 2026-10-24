# 战斗入场与界面修正 v92

2026-10-24，按用户连续反馈合并修正开场遮罩/技能冷却、三选一跳过按钮、两处伤害统计配色和失败结算返回文案。

试玩：https://enjoylura.github.io/kingdom-watch-play/?v=battle-ui-fix-v92

## 行为调整

- 每位英雄的开场 `skillCd` 均为 0，移除按上阵位置设置的 `i * .8` 秒初始冷却。正常技能仍在范围内有目标时自动释放，释放后的冷却继续沿用原公式。
- 大招特效异步就绪前的旧水位回退绘制不再使用灰白罩，改为与正式特效一致的深蓝遮罩。准备倒计时内调用 `hud.sync(0)`，及时接管已加载的特效，不推进战斗、技能或能量时钟。开场大招仍从 0 能量开始，原击杀充能和各英雄能量需求不变。
- 三选一移除「跳过新手引导」的节点、点击回调及专用接口字段。保留新手推荐、自由选卡、广告/钻石刷新及原布局；其他引导弹窗自身的跳过入口不属于本次修改范围。
- 战斗伤害统计浮窗和暂停页统计共用按英雄 ID 选择的颜色，排序变化也不会交换配色。进度条用饱和主色，数字用同色系浅色，百分比保留浅灰；真实份额、最高伤害归一化条长、数字格式、头像、尺寸和布局保持。
- 失败结算右侧按钮由「↻ 再来一次」改为「返回」，辅助文案统一为「返回关卡页」，专用回调名同步改为 `onReturn`。实际仍调用 `exitBattle()` 回到当前关卡/难度的关卡页；不会直接重新开战。广告复活期间仍禁用返回按钮，奖励结算和存档规则不变。

| 英雄 | 进度条 | 伤害数字 |
| --- | --- | --- |
| 弓箭手 | `#67C878` 翠绿 | `#ACEBB5` |
| 重弩手 | `#64B8F1` 天蓝 | `#AFE0FF` |
| 火法师 | `#F39A62` 暖橙 | `#FFD0AA` |
| 雷法师 | `#B48CF0` 紫色 | `#DEC8FF` |
| 冰法师 | `#72D5DE` 冰青 | `#B5F0F4` |

## 构建与校验

仅四个游戏脚本有意修改：`BattleDirector.ts`、`HUD.ts`、`Panels.ts`、`BattleProgressBar.ts`。没有新增美术资源，也没有更改技能伤害、能量需求、波次、英雄媒体和音频。

首轮 Creator 引擎构建子进程异常退出，日志包含空引擎缓存及 `3221225477`，该输出没有发布；重新执行完整生产构建成功，64919ms、退出码 36，DPR 补丁、音频引用审计、原图审计和生产版本准备全部完成，引擎内容版本保持 `2cb74a1e8caa095a`。

`audit_types.cjs` 仅创建 TypeScript 编译器程序，对四个文件用 `a3fe1d0e` 原文覆盖的基准和当前源码比较；9 条原有类型诊断逐项相同，没有新增。没有执行游戏模块。`audit_export.py` 检查真实源文件散列、导出文件 SHA、媒体保持、图像像素/Alpha、项目子路径、资源引用、WASM 文件头和所有运行 JS 的语法。

导出完整运行包 1493 文件、168,030,839 字节（168.03MB，比 v91 增加 14 字节），低于 200,000,000 字节预算。1454 个源 assets 仅上述 4 个脚本变化，其余 1450 文件保持；494 个既有 native 图片/音频/字体等运行文件和美术清单原字节保持。所有运行 JS 语法静态通过。

这里只做构建、静态包与 HTTP 校验；没有启动浏览器、游戏、战斗模拟、音频或 WASM，实际画面和交互由用户试玩。上一轮浏览器授权仅用于缓存实测，本轮没有扩展使用。

## 发布

```powershell
./tools/publish-github-pages.ps1 -PreparedPackage build/github-pages-battle-ui-v92 -PrunePreviousRelease -ProxyUrl http://127.0.0.1:7897 -WaitSeconds 120
```

仅更新独立 GitHub Pages 运行仓库，不触发 Cloudflare。原有项目路径、SHA 缓存、最近版本及活动页面缓存保护保持；发布过程中源 HEAD/暂存保持，源码在完成后另行提交。

本次运行版本 `9c18e6ce6837052d`、独立运行提交 `dcae246abe061c2a5b46d5592588a06b6503604a`。Pages 已 built，发布器线上文件 SHA/MIME/压缩、版本指针及条件重访核对通过；最终线上核对结果见 `deployment.json`。

- [typecheck-comparison.json](typecheck-comparison.json)
- [build-record.json](build-record.json)
- [export-report.json](export-report.json)
- [package-static-verification.json](package-static-verification.json)
- [deployment.json](deployment.json)
