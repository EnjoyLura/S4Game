# 战斗弹窗：原布局只替换资源 v2

用户明确指出 v1 改动过大：没有要求改三选一、暂停、胜利、失败的布局，也没有要求改伤害统计 tips 的背板和文本。此版按改版前的 [original-layout.ts](original-layout.ts) 恢复原坐标、组件尺寸、标题、文字、字号、文字颜色、按钮位置、连体页签与选择动画。

`Panels.ts` 重新负责原布局，`BattlePanelSkin.ts` 只做局部资源替换；没有统一外层大纸板、新增副标题、独立伤害数值列或等宽刷新按钮。属性 Tips 原实现保持不变。

伤害统计 tips 恢复原 360×470、#14181E / 0.94 半透明背板。原标题、姓名、右侧橙色百分比、条内伤害数值、关闭说明的位置和样式均保持。仅占比条换成简洁纹理，按实际份额设置填充宽度；0% 不绘制填充。补齐原遗漏的冰法师头像资源，不改变头像位置和大小。

## 资源

[assets.json](assets.json) 收录 14 个局部 PNG，合计 53,804 字节：原位置的标题条、卡片底图、三色按钮面、三段连体页签、开关三态与伤害条。用明确的轮廓、少量明暗和现有漫画配色绘制矢量源图，再导出 PNG；本次没有重新调用 AI 生图。源图在 `vectors/`，[prepare_skin.cjs](prepare_skin.cjs) 可重新导出，[import_meta.py](import_meta.py) 维护 Creator 元数据，Ux 中的局部九宫格参数保持圆角比例。

金币、经验、星星、英雄头像复用已认可的漫画插画。能力图标继续使用对应技能与大招资源；解锁卡仍进入原卡位。v1 的胜败徽章与整体纸板版式不再接入。

## 验证

[check_restore.cjs](check_restore.cjs) 在独立浏览器存档中，把原代码和恢复版分别加载到实际引擎上，用静态战场素材合成，未启动 BattleDirector.start()、波次或真实战斗。

430×932、375×600 的三选一、暂停三页签、胜利两页签、失败两页签、伤害提示，共 18 个视图逐项比较文字、字号、颜色、对齐、行高、坐标与宽高，均与原版一致。另验证原动画选卡解锁、刷新次数与保存扣费、双倍领取、复活 +30% 耐久和暂停开关／继续回调。[ui-validation.json](ui-validation.json) 保存本地结果；线上结果与构建素材一致性另存 `online-validation.json`、`deployment-validation.json`。

预览：[原布局三选一](pick-0-932.png)、[原布局胜利](win-0-932.png)、[原布局失败](lose-0-932.png)、[原布局暂停](pause-2-932.png)、[原背板伤害提示](tip-0-932.png)。

## 发布

已发布：[恢复版](https://kingdom-watch.pages.dev/?v=battle-skin-v2-1791723401)，[本次部署快照](https://f68998cd.kingdom-watch.pages.dev)。TypeScript 检查和 Creator 3.8.8 web-mobile 构建通过，DPR 补丁版本为 1791723401。本地 6 组检查、线上 5 组检查通过；入口、主脚本、资源配置、DPR 引擎及 14 张新素材，共 18 个线上文件的 SHA-256 与本地构建一致。详细记录见 [deployment-validation.json](deployment-validation.json)。
