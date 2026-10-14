# 战斗弹窗漫画美术 v1

此版布局被用户否定，已停止使用。当前以 [v2：原布局只替换资源](../battle-panels-comic-v2/README.md) 为准；以下内容仅保留历史素材、提示词和验证记录。

胜利、失败、三选一强化、暂停与伤害统计提示统一为用户选定的「清爽漫画奇幻」。采用现有 ComicUI 的米色背板、深蓝未选页签、金色主操作和绿色广告入口。文字、百分比、按钮和占比条由代码绘制；没有旧木纹、撕纸底图、偏移阴影或重复底缘。

## 素材与实现

- 内置 Imagegen 生成胜利／失败徽章，各自导入为 256×256 透明 PNG，总计 143,500 字节。最终资源见 [assets.json](assets.json)，实际提示词、风格参考和原始输出路径见 [generation.json](generation.json)，可复现的导入过程见 [prepare_art.py](prepare_art.py)。原始图保存在 `sources/`。
- 徽章使用商店风格参考和关卡盾牌作约束：明确深色轮廓、少量硬边明暗、蓝金主色、无文字和背景。其他插画复用已接入的金币、钻石、星星、双剑和英雄正圆头像；普攻、技能与大招图标继续使用实际能力素材。
- 生产组件在 `assets/scripts/ui/BattleComicPanels.ts`；`Panels.ts` 继承新组件，能力属性 Tips 保持原行为。`Ux.ts` 预加载新徽章。

## 布局与状态

三选一卡保留名称／品质色带、能力图标、英雄归属和描述，选择有短促确认动画。刷新次数按每次三选一重置；钻石刷新即时保存扣费，广告失败保留次数，等待广告时拦截连续刷新和选卡。

胜利保留星级、防线剩余耐久、金币、当前经验、下一关及双倍金币。双倍入口有加载、失败重试和已领取状态，切换奖励／伤害页签不重置领取状态。失败保留金币保底、广告复活及原有退出回调；复活等待期间拦截重复请求，失败可重试，成功继续原战局。暂停保留奖励、伤害和设置三页签，音乐／音效设置写入存档且跨页签保持，倍速仍走原解锁规则。

伤害提示与结算内统计完整显示所有上阵英雄，包含冰法师。真实圆头像、姓名、伤害值、百分比分列，按英雄颜色绘制占比条。有效条宽乘真实伤害份额，0% 没有伪造的最低填充，0.01% 仍准确；百分比统一两位小数。空数据显示说明，提示点空白关闭且不暂停战斗，内容较多可滚动。

## 验证

仅在独立浏览器存档中用实际引擎、战场／英雄素材、HUD 和弹窗组件合成预览；不启动 BattleDirector.start()、波次或战斗模拟，不修改用户存档。

- TypeScript 与 Creator 3.8.8 web-mobile 构建通过，构建后补齐 DPR。
- [check_panels.cjs](check_panels.cjs) 本地 10 组检查：五类组件、真实选卡解锁、刷新扣费与广告失败／成功、暂停设置、双倍金币、复活、统计点击及零份额；覆盖 430×932、375×667、375×600。
- `tools/ability-unlock-check.cjs` 的五组能力前置检查通过，其中包括 5,000 次首抽／刷新。既有 `docs/ability-unlock-v1/check_hud.cjs` 六组实际组件检查通过；技能／大招仍需战局卡解锁。
- [ui-validation.json](ui-validation.json) 保存本地 10 组结果；[online-validation.json](online-validation.json) 保存线上 8 组实际组件与回调检查，无页面错误或资源请求失败。[deployment-validation.json](deployment-validation.json) 记录入口、主包、资源配置、DPR 引擎和两个新徽章共 6 份线上文件与本地构建的 SHA-256 一致性。

已发布：[手机体验](https://kingdom-watch.pages.dev/?v=battle-panels-comic-1791721090)，部署快照 [7343f705](https://7343f705.kingdom-watch.pages.dev)。最终版本补充复用选卡入场时的透明度组件，确认动画不重复创建该组件；既有六组 HUD／解锁组件检查及线上实际选卡回调均通过。

预览：[胜利](win.png)、[失败](lose.png)、[三选一](pick.png)、[暂停设置](pause-settings.png)、[伤害提示](tip.png)、[短屏统计](win-damage-small-600.png)。

运行相关验证：

```powershell
& 'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' docs/battle-panels-comic-v1/check_panels.cjs
& 'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' tools/ability-unlock-check.cjs
```
