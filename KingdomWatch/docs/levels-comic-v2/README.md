# 关卡页漫画美术 v2

2026-10-11，按用户反馈缩短上半部、修正奖励遮挡、统一地图与背景，并增加真实横向选关手势。

已发布：[打开新版游戏](https://kingdom-watch.pages.dev/?v=levels-comic-v2-1791711814)。14 组本地界面检查通过；线上 54 个文件（50 张新增/既有图片、4 个构建文件）与本地 SHA-256 一致。

## 页面调整

前哨、深林和兽穴各自使用一张连续室外插画。道路、建筑、树木和远景位于同一个透视场景中，不再把浮空土块模型叠在室内木桌上。插画只覆盖奖励区以上；资源栏和五页导航继续共享，不改动。

标题和难度区压缩，奖励区按屏幕高度保留 316–420 设计像素。三档奖励的条件、宝箱、实际货币数量和领取状态各占独立行，所有子组件都在奖励背板内，且宝箱不侵入标题行。动作按钮位于奖励区之后、导航之前。

关卡条使用原生 Cocos ScrollView + Mask，横向触摸拖动、有惯性、无越界弹性，切换难度、领奖刷新、编队退出和跨页返回都保留偏移。拖动超过 7 设计像素或收到 TOUCH_CANCEL 不切关，避免手势结束误触。原地图两侧圆箭头已移除。

当前 Mobs.ts 仅有 1-1、1-2、1-3 三个实际战斗配置。路线延伸至既有关卡顺序中的 1-4、1-5，但明确显示待开放，点击只提示，不会错误加载 getLevel 的 1-1 兜底。三个可玩关卡原有解锁、难度解锁、独立星级和奖励规则保持不变。

编队页去掉左上返回键，仍通过底部「完成编队」关闭并刷新已上阵数量；上阵顺序、最多四人、下阵确认与取消保留。

## 素材

使用内置 imagegen 生成三张独立场景，参考已认可的商店插画风格。图像保持原始比例，仅转成 JPEG 导入，没有用程序重画、拉伸或拼贴场景。

- `assets/resources/scenes/bg_levels_outpost_comic_v2.jpg`
- `assets/resources/scenes/bg_levels_forest_comic_v2.jpg`
- `assets/resources/scenes/bg_levels_lair_comic_v2.jpg`

实际提示词与输出路径见 [generation.json](generation.json)，原始 PNG 保留于 `sources/`，生产资源记录见 [assets.json](assets.json)。宝箱、星星、难度图标及所有通用组件复用前版。

## 验证

Creator 3.8.8 web-mobile 构建、TypeScript 检查和 DPR 补丁通过。[check_levels.cjs](check_levels.cjs) 的 14 组检查覆盖 430×932、375×667、375×600 三种手机视口，实发触摸滑动、后续入口不可开战、滑动位置记忆、奖励所有子组件边界/上下间距、奖励一次性入账、难度/关卡锁定和回退、编队增减/确认/退出、商店→英雄→关卡回到原页。

战斗入口在独立存档中拦截场景加载，只检查 Main 和 flow 关卡/难度参数，不进入真实战斗。未修改冰法技能 v10、128 颗大招落冰、寒冬延续卡或冰晶普攻。

完整检查见 [ui-validation.json](ui-validation.json)，构建及线上文件核验见发布后的 [deployment-validation.json](deployment-validation.json)。

[线上检查](online-smoke.json) 另用独立存档实测触摸拖动、领取 200 金币、商店/英雄/关卡往返和完成编队；四次刷新/返回都保持选关条偏移，返回键不存在，无运行错误。

## 预览

- [前哨](levels-outpost.png)、[深林](levels-forest.png)、[兽穴](levels-lair.png)
- [拖到后续关卡](levels-route-later.png)
- [短浏览器高度](levels-short-browser.png)
- [编队去掉返回键](squad-one.png)
