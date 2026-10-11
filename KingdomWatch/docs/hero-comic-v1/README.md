# 英雄页 · 清爽漫画奇幻 v1

2026-10-11。与用户选定并已应用于商店的漫画美术统一，涵盖整页组件及其交互弹窗。本文保存初版记录；背景、标题、名字底牌、动作图标与空背包的最新规范已由 [v2](../hero-comic-v2/README.md) 替代。

## 视觉规则

深色清晰轮廓，克制的两到三档明暗，少量大块高光；不用软喷枪光晕、微小纹理、花纹堆叠和塑料金属反光。人物身份沿用原头像，服装、武器和主色沿用商店漫画头像。头像用真正的正圆裁切，装备品质用底色区分。组件只保留一层轮廓和细顶部亮线，避免底部阴影条和重复底板。

背景为明亮的城堡军械室。英雄标题、角色名称有独立底牌，保持文字对比度。长屏增加立绘高度和背包可视区域；375×667 的短屏保留装备、立绘和两行完整背包，背包独立滚动。

## 制作方式与资产

使用 imagegen 技能的内置 `image_gen.imagegen`：一张安静背景、一张弓箭手半身头像、五张独立全身立绘；每张使用同一张 [商店风格参考](../shop-comic-v1/style-reference.png)。人物图请求真实透明背景。五张立绘另作一次减少外部柔光的图像编辑。

- [generation.json](generation.json)：初次生成的完整提示词、参考图、原图路径和后续编辑来源。
- [sources](sources/)：初稿和最终生成原图的工作副本，默认生成目录原文件保留。
- [assets.json](assets.json)：实际生产文件、尺寸、体积及原图对应关系。
- [asset-contact-sheet.jpg](asset-contact-sheet.jpg)：五名立绘的统一底色合成预览。
- `assets/resources/scenes/bg_heroes_comic_v1.jpg`：背景。
- `assets/resources/ux/hero_comic_v1/comic_hero_archer_v1.png`：384px 方形透明头像，由运行时正圆裁切。
- `assets/resources/ux/hero_comic_v1/comic_figure_{archer,sniper,pyro,volt,mora}_v1.png`：768px 高透明画布、按比例缩放、16px 脚底透明留白。

生产整理仅做透明边距裁切、同比缩放、Creator 元数据导入。按钮、底牌、分隔线、战力、动作符号由代码绘制；装备及材料直接复用 `shop_comic_v1` 的十张物品插画。其他四名英雄的头像也直接复用商店。七张新资产总计约 2.53 MB。

## 功能与验证

新增 `HeroComic.ts` 封装人物、装备和动作图形；`HeroPage.ts` 使用共用 `ComicUI.ts`。整页包括英雄选择、立绘、装备槽、战力、背包分类，以及属性、故事、材料、装备详情、装备对比、强化、出售/分解确认弹窗。

共用资源栏继续靠右，货币与加号的组件沿用商店版本；底部导航五页共用。装备详情和对比依然直接放在遮罩上，无额外外框及关闭 X，点击空白关闭；其他信息弹窗保留关闭按钮。

`check_heroes.cjs` 使用隔离测试存档，仅检查主界面。覆盖五英雄切换、滚动位置记忆、已穿戴物品排除、换装、出售与分解确认/取消、金币和材料扣除、缺金币/缺材料/满级保护、空背包、未解锁英雄、两种手机尺寸。相关截图保存于本目录，结果见 `ui-validation.json`。商店回归用其现有检查脚本。

构建后运行 DPR 补丁，发布到 Cloudflare Pages 的 main，再用 `verify_release.py` 检查线上入口、全部 27 张漫画生产美术及 DPR 引擎的 SHA-256。线上记录见 `deployment-validation.json`。
