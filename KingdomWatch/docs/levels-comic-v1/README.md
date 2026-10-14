# 关卡页漫画美术 v1

2026-10-11，沿用用户已选定的“清爽漫画奇幻”，与商店及英雄页 v3 共用美术体系。

已发布：[打开新版游戏](https://kingdom-watch.pages.dev/?v=levels-comic-v1-1791709829)。关卡与编队 12 项、英雄页 16 项、商店 12 项检查通过；线上 51 个文件（47 张共用/新增素材与 4 个构建文件）的 SHA-256 与本地一致。

## 页面与组件

关卡页以公会作战室的木桌承托微缩战场，暖木色、蓝旗、冷色窗景提供前后层次。前哨、深林、兽穴使用三张独立透明插画，保持完整轮廓和自然比例。场景只延伸到奖励区上缘，奖励和动作区采用米色纯色背景。

普通、精英、地狱使用统一深色/金色单层页签，配盾牌、双剑、骷髅插画；切关复用英雄页 v3 的圆石按钮。关卡路线、通关说明、星级、宝箱、开始战斗和编队入口全部更新。文字由代码渲染，标题与主动作使用正文粗体，与商店保持一致。按钮只压下 2px，不添加偏移底板、投影条或呼吸光。

编队页同步采用同风格正圆头像、方形选择卡、米色背板和下阵确认弹窗。四个站位从左到右；五名英雄卡总宽 662，在 704 宽的背板内，修正旧版 840 宽溢出。手机字号和触控面积均放大，返回/完成会同步关卡入口人数。

## 素材、工具与提示词

本次使用 imagegen 技能的内置 **image_gen.imagegen**，共生成 10 张生产插画。每张单独生成，打开宝箱基于关闭宝箱编辑，确保同一造型。风格参考使用已认可的 [商店风格板](../shop-comic-v1/style-reference.png) 和 [商店场景](../../assets/resources/scenes/bg_shop_comic_v1.jpg)。

- 场景：`assets/resources/scenes/bg_levels_comic_v1.jpg`。
- 三种地形和难度、宝箱、星星：`assets/resources/ux/levels_comic_v1/`。
- 原始文件：本目录 `sources/`；内置工具的原文件也保留。
- [generation.json](generation.json)：完整实际提示词、参考图及原始输出路径。
- [asset-contact-sheet.jpg](asset-contact-sheet.jpg)：全部组件插画总览。
- [assets.json](assets.json)：生产路径、尺寸与字节数。

导入只清理近透明边缘、裁去空白和按比例缩放，保留真实 alpha；未在 Python 中重绘素材。地形保持 24px 透明脚底边距，代码据此对齐轻微接触阴影。组件几何由 ComicUI 统一。

## 功能与验证

沿用原有关卡解锁和难度解锁条件，星级、已领取状态分别使用普通/精英/地狱存档键；奖励数值、4 人编队限制、上阵顺序和空队拦截不变。GameData 当前上阵会同时标记拥有英雄，本次未更改该原有规则。

[check_levels.cjs](check_levels.cjs) 使用独立存档检查 430×932、375×667 两种手机尺寸，覆盖三种场景、难度与关卡切换、锁定和回退、一次性奖励、编队增减及确认取消、共享资源栏和跨页返回。战斗入口通过拦截场景加载检查 Main + flow 的关卡/难度参数，不进入真实战斗。

使用 Creator 3.8.8 web-mobile 构建，并运行 DPR 补丁。完整结果见 [ui-validation.json](ui-validation.json) 与发布后的 [deployment-validation.json](deployment-validation.json)。商店和英雄页继续使用各自回归脚本验证。冰法技能 v10、128 颗错峰大招、寒冬延续卡和冰晶普攻保持原实现。

## 预览

- [手机短屏](levels-small.png)
- [前哨](levels-outpost.png)、[深林](levels-forest.png)、[兽穴](levels-lair.png)
- [编队](squad-one.png)、[下阵确认](squad-confirm.png)
