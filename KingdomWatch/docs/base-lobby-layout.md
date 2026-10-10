# 基地场景布局

2026-10-10，参考用户提供的基地截图中建筑本身作为入口的布局，实现幻想森林营地。

- 使用五主界面共用资源栏和木色底部导航，顶部保留手机防遮挡区；基地页不再使用网页式标题说明卡。
- 上方营地名牌，中间主城，下方道路两侧为研究院与尚未开放的工坊。建筑和名牌都在同一触摸区域，点击主城打开建设预览，点击研究院打开图鉴，工坊仅提示尚未开放。
- 主城读真实等级；金币足够时显示轻微呼吸的升级标记。建筑本身不做上下漂浮动画。
- 研究院读真实图鉴解锁进度、首览奖励未领取数量。研究院标牌提示可领奖励，不虚构每日奖励。
- 下方固定木石建设台集中显示防线耐久、阶段护盾、主城升级费用。建设弹窗换成羊皮纸预览，升级仍调用原有 upKeep。费用、等级上限、耐久与护盾公式不变。
- 图鉴卡片及详情使用已有怪物美术，保留未发现状态、描述、弱点与首次领取钻石的操作。
- 短屏只滚动中间营地，资源栏、建设台和导航固定。保留原背景文件，新版使用独立文件。

## 文件

代码：assets/scripts/ui/pages/BasePage.ts；MainUI 统一五页导航样式并移除已经不再使用的通用网页式标题卡；Ux 预载新资产。

- assets/resources/scenes/bg_base_lobby_v1.png：完整空庭院背景。
- assets/resources/ux/lobby_base_buildings_v1.png：主城、研究院、工坊建筑图集。
- assets/resources/ux/lobby_base_buildings_v1.frames.json：独立建筑矩形。

图片使用 imagegen 技能的内置 image_gen.imagegen 工具生成。背景 transparent_background=false，建筑图集及间距修正 transparent_background=true。选定输出直接复制，未修改像素；Pillow 仅读取透明轮廓生成运行时 SpriteFrame 矩形。

背景参考现有 bg_base.jpg 和 ui_nav_base.png，建筑参考 ui_nav_base.png 与新版庭院背景。建筑名称、等级、提示和通知均由运行时绘制，没有烘焙到图中。

## 庭院提示词

Use case: stylized-concept. Asset type: production mobile fantasy game environment background, portrait 9:20 around 1152x2560. Image1 is the existing base courtyard STYLE reference: preserve its polished hand-painted warm green fantasy style, gray chunky stone, brown timber, royal-blue banners, dark clean outlines and sunny medieval atmosphere. Image2 is the existing blue-roof castle identity reference, for palette only. Create an attractive TOP-DOWN THREE-QUARTER ISOMETRIC forest fortress COURTYARD, an EMPTY buildable scene, used behind separately rendered buildings and clickable labels. Full-bleed opaque portrait landscape, NO UI, NO TEXT. Camera looks diagonally down into a warm sunny mossy stone and packed-earth camp courtyard, richly detailed vegetation at the sides, distant forest hills at top, wooden palisade perimeter and gray stone retaining walls along the outside edges, blue flags, a few barrels and crates at extreme edges. The central 76% width MUST remain open and unobstructed. Important production layout: top 0%-15% reserved for mobile notch and resource HUD, just softly lit distant trees/sky, no castle tower. Upper center building pad at x=50%, y=34%, flat oval paved stones with no structures; lower-left building pad at x=25%,y=56%; lower-right pad at x=75%,y=63%. Broad attractive forked cobblestone paths connect these three EMPTY foundations and lead to an open gateway near x=50%,y=88%. The foundations are subtle flush stone patches, not raised pedestals or square cards. No buildings, tents, towers or tall objects anywhere in the central courtyard; the three buildings will be supplied at runtime. Keep visual emphasis on the open landscaped camp and connecting road, natural scene depth, no floating island edge. Bottom 80%-100% has a relatively quiet dark warm stone approach, suitable behind an overlaid status board and bottom navigation. Match existing hand-painted fantasy mobile videogame, strongly outlined chunky forms, readable lighting, warm stone with fresh green foliage and blue flags. No sci-fi, no industrial buildings, no people, no monsters, no words, no numbers, no symbols, no watermarks, no UI frame, no resource icons, no blank solid panels. Background only.

## 建筑提示词

Use case: stylized-concept. Asset type: production transparent fantasy mobile game building sprite atlas, three independent buildings. Image1 is the existing castle identity: gray chunky stone, blue conical roof, blue-and-gold royal banners and wooden arch door. Image2 is the approved NEW EMPTY base courtyard backdrop, match its lush bright hand-painted medieval fantasy style, camera angle, sun from upper left and bold clean dark outlines. Create ONE very WIDE landscape 3:1 TRANSPARENT canvas (about 3072x1024), containing EXACTLY THREE fully isolated hand-painted ISOMETRIC BUILDINGS in one horizontal row, all facing viewer/front-left, same perspective and scale. Each sprite must fit fully inside its OWN THIRD of canvas, centered at x16.7%,50%,83.3% and y50%, fill ONLY about 70% cell width and 73% canvas height, leave at least 14% clear transparent margin on both sides in each cell and 12% above and below. Do not overlap or touch neighboring cells. Completely show all roof flags, chimneys, bases and stairs. LEFT: MAIN KEEP, handsome stout circular gray stone tower with one large blue conical shingle roof, blue flag on top, crenellated side battlements, wooden arch double-door with a brass blue shield over it, two blue royal banners, stone stairs and torches, appealing detailed fortified keep faithful to image1 but large high-detail building not a flat nav icon. MIDDLE: RESEARCH ACADEMY, one compact medieval scholar's stone and dark timber building with teal-blue steep roof, small bronze-trimmed observatory dome, cyan crystal at the dome, glowing arched window, a sturdy open illustrated book prop near its doorway and small scroll stand, warm light from windows, recognizable fantasy library/monster-research house. RIGHT: LOCKED WORKSHOP construction site: one sturdy dark timber smithy with unfinished muted slate roof, cold gray chimney, closed door, anvil and stacked timber at front, scaffold beams attached to one side and folded canvas. Make workshop desaturated stone/timber tones to communicate not operating, but NO written signs, no padlocks, no lock icon. Lock UI added at runtime. All three buildings sit on their own modest uneven cobblestone foundation strip only just wider than building, not huge landscape islands or tall floating rock platforms. NO surrounding landscape, no trees, no mountains, no sky, no floor/background, no external cast shadows outside silhouette, NO people or monsters, NO text, words, numbers, labels, badges, dots, glow rings, UI buttons, or navigation. Full true alpha transparency around the three entire building silhouettes. Clean sprite sheet intended for independent SpriteFrames, generous gutters are critical.

## 建筑间距修正提示词

Edit only layout spacing and scale of the supplied THREE building sprites, preserving their appearance and details exactly. Keep castle LEFT, research academy MIDDLE, unfinished workshop RIGHT. Transparent wide 3:1 canvas with ONE ROW of THREE fully isolated buildings. REDUCE all three buildings to only 68% of each own third's width and about 68% canvas height. Place their centers at x16.67%,50%,83.33%,y50%. Critical EMPTY TRANSPARENT margin: at least 16% cell width on both sides of EACH building and 14% canvas height above and below. No sprite may touch another sprite or any canvas edge. All entire flags, roof tips, stone foundations, books, chimney, scaffolding and canvas must be visible and uncut. Do not crop the left building's foundation or flag. Match original shapes, colors, materials, lighting, camera and dark outlines. Remove no building features. No new props, no words, no UI labels, no background scene, no solid background, no checkerboard, no cast shadows outside foundation. Genuine alpha transparency. Final image is simply a neatly spaced reusable three-building atlas, generous transparent gutters are mandatory.

## 交付

按项目流程构建 web-mobile、运行 DPR 与入口缓存版本补丁并发布。按用户要求，手机视觉与交互由用户人工体验，不运行浏览器验证或测试。

