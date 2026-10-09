# 关卡页布局与微缩战场素材

2026-10-09，按用户确认的关卡页概念图实施。

页面使用现有五主界面共用资源栏，预留刘海安全区。章节名、关卡名、横排难度页签在上方；中央使用透明的等距微缩战场，旁边是左右切关入口。下方依次为三个关卡选择牌、波次说明、木石奖励台、金色开始战斗按钮与编队入口。底部导航沿用商店与英雄页的木色及金色高亮。

前哨、深林、兽穴分别展示自己的场景。关卡、难度、星级、宝箱领取状态均读取现有存档，保留原有关卡解锁条件、难度解锁条件、奖励领取、空编队拦截及战斗入口。奖励台按实际状态展示打开的宝箱、发光可领取宝箱和灰色未达成宝箱。宝箱提示光只改变透明度，场景不做悬浮上下动画。

奖励台与动作按钮按底部导航定位，中央场景使用余下空间，保持图片比例。短屏压缩标题、宝箱和按钮高度，长屏展示更大的战场；资源栏组件不另行设计。

## 新资产

- `assets/resources/ux/lobby_levels_v1.png`：前哨、深林、兽穴三张透明场景图集，2172×724。
- `assets/resources/ux/lobby_levels_v1.frames.json`：三个完整场景的紧密矩形。
- `assets/resources/ux/lobby_rewards_v1.png`：三种宝箱状态和空白木石奖励台图集，1768×889。
- `assets/resources/ux/lobby_rewards_v1.frames.json`：四个展示素材的矩形。

所有图片使用 imagegen 技能的内置 `image_gen.imagegen` 工具生成，`transparent_background=true`。原始图片直接复制进项目，未使用 Python 修改图片像素；Pillow 只读取透明轮廓生成 SpriteFrame 矩形清单。代码通过 `Ux.artAtlasSprite` 加载图集，保留图片比例和底部锚点。

概念图参考：`C:/Users/user/.codex/generated_images/01a11c03-afa8-7ef0-834a-a47cbda4a411/exec-cc2186b8-4f32-4ba7-bfbf-310aed60a57d.png`。

## 微缩战场初次提示词

Create a production-ready transparent game environment sprite atlas using the supplied images as visual references. Image 1 is the APPROVED level-selection UI concept; reproduce the rich miniature terrain island in its CENTER as reusable standalone art, and use its hand-painted polished fantasy style. Images 2 and 3 are theme references for the second and third islands. Output a very WIDE LANDSCAPE 3:1 atlas with EXACTLY THREE ISOLATED ISOMETRIC TERRAIN DIORAMAS IN A SINGLE HORIZONTAL ROW, all at the same 3/4 overhead camera angle, same scale, roughly square silhouettes. Each diorama fully inside its own THIRD of the canvas. Canvas ideally 3072x1024. Each island occupies about 76% of its cell width and 75% of canvas height. Generous transparent gutters between islands, at least 10% cell-width margin on BOTH sides, and transparent margin above and below. All rock bottoms, trees and flags completely visible. No overlap or touching. Island 1 FOREST OUTPOST: match the central scene of image1, attractive bright green pine trees, a ochre dirt road passing through a wooden pointed palisade gateway, a tall wooden watchtower at rear right, small red and blue banners, burning braziers, rocks and shrubbery, discarded shield, tiny wooden bridge at front, chunky rocky earth foundation. Island 2 DEEP FOREST: dense dark green pines and huge leafy trees matching image2, a winding ochre dirt path, moss-covered fallen logs, red mushrooms, a few broken fence segments, thick roots, gray boulders, no outpost gate, rocky earth foundation. Island 3 BEAST LAIR: the forest lair from image3, central ochre path, two dark cave entrances shaped like monstrous mouths with bone teeth, horned skull totems, tattered red skull banners, green glowing cave mist, bone piles, brambles and moss, rocky earth foundation. THREE distinct locations, not three repeats. Crisp silhouettes, detailed but game-readable hand-painted textures, strong dark outline, warm sunlight, appealing saturated green/gold, miniature videogame diorama appearance. Critical: this is an ASSET SHEET not a screenshot. NO user interface, NO words, NO numbers, NO badges, NO buttons, NO title, NO arrows, NO stars, NO resource bar, NO border or square frame, NO background scenery or sky, NO white floor, NO ground cast shadows. Truly transparent alpha around each entire isolated island. One row, THREE islands, separated.

参考图为概念图以及现有 `scenes/scene_1_2.jpg`、`scenes/scene_1_3.jpg`。

## 微缩战场最终间距修正提示词

Edit ONLY layout spacing and scale of these THREE terrain islands. Preserve every island's appearance and visual theme exactly: outpost LEFT, deep forest MIDDLE, beast lair RIGHT. Final transparent PNG must be a wide 3:1 canvas with the same THREE islands in ONE row. Reduce ALL three islands so EACH entire visible silhouette occupies ONLY 68% of the WIDTH of its own third of the canvas and about 68% of the HEIGHT of the full canvas. Center each island at x=16.67%,50%,83.33% and y=50%. VERY IMPORTANT leave at least 16% cell-width of EMPTY TRANSPARENT PIXELS on BOTH sides of EACH island. Thus large CLEAR transparent gutters BETWEEN the islands, NOT touching or nearly touching. Also leave at least 15% empty transparent margins at TOP and BOTTOM. No part of any tree, banner, rock or root may enter another island's third. Whole intact island silhouettes with nothing clipped. Do not enlarge the islands to fill the canvas. Keep original colors, outpost palisade/watchtower details, winding forest path, monster caves/bones/red flags. Do not combine locations or add scene. No text, no UI, no platform apart from the existing natural rock foundations, no cast floor shadow, no white background, no new border, no checkerboard. True alpha transparency. This is simply a neatly spaced three-island sprite atlas.

最终场景来源：`exec-b8bc5e02-78a4-4c32-a983-96d51bbbdd0c.png`。

## 奖励图集提示词

Transform the supplied APPROVED fantasy mobile game UI concept into a clean reusable transparent UI ASSET SHEET for ONLY its reward display. Match the illustrated hand-painted dark wood, chunky stone, gold metal and polished fantasy videogame aesthetic. WIDE landscape canvas about 2:1. Four isolated assets, exact arrangement: TOP HALF three chest sprites in three evenly spaced columns, centered at x=17%,50%,83%, each fully isolated with lots of clear transparent gutter. TOP LEFT an OPEN brown wooden treasure chest with brass edges and visible gold coins inside, lid upright, gentle yellow light contained inside, no check icon; TOP CENTER a CLOSED royal BLUE and GOLD chest with large central clasp, subtle warm gold highlight, no red notification dot and no large aura; TOP RIGHT a CLOSED locked gray iron chest with skull ornament and visible padlock, monochrome gray iron and dark wood. The three chests have equal apparent size, broad front three-quarter view facing the viewer, silhouettes around 22% canvas width, around 34% canvas height, bottom baseline at 43% canvas height. BOTTOM HALF one SINGLE wide EMPTY reward shelf: from x=5% to95%, y=58% to93%. It has a shallow dark wood horizontal header plank occupying the top 25% of that shelf height, and rough chunky stone slab beneath it suitable for setting chests on. Center of the wooden header is empty dark wood, NO TEXT; stone slab is shallow with front edge visible, warm gray mossy stone and a slightly weathered carved front edge, flat broad top. The empty shelf must not contain any chests, stars, text or ornaments that could be confused with rewards. Transparent separator between top chests and shelf. CRITICAL no written words, numbers, lettering, symbols of currency, status labels, red dots, checkmarks, stars, circles, navigation, buttons, scene background, sky, decorative outer UI frame. Do not produce a full-screen interface. Only FOUR reusable sprites on TRUE alpha transparent background. No floor/cast shadow extending beyond each sprite, no cropping, no overlap. Clean alpha silhouettes. Asset sheet.

奖励图集来源：`exec-283c7f2b-9980-46b7-94e1-dd2ed00bbda6.png`。
