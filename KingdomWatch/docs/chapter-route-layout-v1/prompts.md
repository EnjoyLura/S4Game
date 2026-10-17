# 内置 imagegen 制作记录

模式：内置 image_gen.imagegen，静态概念稿，transparent_background=false。两张均是有参考图的编辑生成，非已实现游戏截图。原生成文件按字节复制到此目录，没有改图。

用户提供的路线示意参考（仅参考功能思路，不复制形象或构图）：
C:/Users/user/AppData/Local/Temp/codex-clipboard-879df2a6-ca36-4d0f-a330-30673f5607a9.jpg

本游戏美术参考：
D:/AI/S4Game/KingdomWatch/docs/lobby-ui-quiet-v1/approved-direction.png
D:/AI/S4Game/KingdomWatch/docs/levels-comic-v2/sources/bg_levels_outpost_comic_v2.png

## 整章路线图 · 最终选择

编辑目标为本轮较繁复的初稿，另一张参考是本游戏 approved-direction.png。最终图：
C:/Users/user/.codex/generated_images/01a12e7c-9e87-72e0-b3ff-bca4a58686b3/exec-5d73356c-bb26-4981-866f-df4d18193012.png

初稿（不作为最终交付）：
C:/Users/user/.codex/generated_images/01a12e7c-9e87-72e0-b3ff-bca4a58686b3/exec-1210b608-e184-4771-99a8-d3511ac1d8df.png

完整提示词：

```text
Use case: style-transfer and ui-mockup. Image1 is the EDIT TARGET: a chapter-map mobile-game mockup. Image2 is the REQUIRED STYLE REFERENCE from our own game, showing clean comic fantasy, flat illustrated icons, warm paper, navy interfaces, and direct gold selection. Redesign Image1 in Image2's visual language.
Create ONE complete portrait screen with the same overall functional layout and readable Chinese content as Image1. Make a genuinely clean 2D hand-inked CARTOON campaign map with broad flat local colors and only 2-3 clear shadow tones, crisp chunky ink outlines, simple stylized foliage clusters, warm soft amber earth road, low rolling green terrain, a clear turquoise stream, simple stone bridge, blue-roof home castle and a timber outpost. Strong game-ready graphic readability. Substantially REMOVE the cinematic mountain ranges, vast ravines, waterfalls, mist clouds, dense tiny detail, painterly noise, stone bevels, dark vignette and metallic ornament of Image1. Map should feel hand-designed for a mobile game, with flat decorative stylized grass and a few memorable small landmarks. Keep foreground vs background contrast restrained so nodes are the focus.
CRITICAL ORDER CORRECTION: the road in Image1 visually goes from4 to the seal labelled6, then to the seal labelled5. SWAP THE NUMBER LABELS on these two exact seals: the seal immediately up-left of the current gold4 becomes5, the higher left watchtower seal becomes6. The single road must now clearly connect 1→2→3→4→5→6→7→8→9→10, each number used exactly once. Maintain 1,2,3 cleared blue pennants with 3,3,2 gold stars. Keep current4 gold with one restrained warm ring, locked5-10 small gray pennants. Keep selected “石桥隘口”.
UI: top resource bar “远征地图”, coin522, diamond220; chapter “第一章 · 前哨”, “已通关 3/10    ★8/30”. Header should be a calm simple navy shape with gold chevrons, not a metal ornamental plaque. Lower current-stage strip in warm matte ivory: “当前关卡” above “1-4 石桥隘口”, solid matte-gold “出战准备” action with one dark contour and clear sword illustration; no sheen or extra nested gold borders. Bottom exactly five nav labels “商店 英雄 关卡 升级 基地”, graphic 2D illustrated icons matching Image2, flat gold selected “关卡”, no metallic glow or photo-like 3D icons. Preserve layout breathing space and full screen bounds.
The output is the finished game UI itself, not a board, no labels outside the interface, no phone frame, no watermark.
```

## 出战面板 · 最终选择

编辑目标为上面的最终路线图，另一张参考是本游戏 approved-direction.png。最终图：
C:/Users/user/.codex/generated_images/01a12e7c-9e87-72e0-b3ff-bca4a58686b3/exec-248a784c-a2df-47eb-9277-81c392164901.png

完整提示词：

```text
Use case: ui-mockup and precise-object-edit.
Image1 is the edit target: our own cleaned chapter-route game UI mockup. Image2 is the style reference from our own game. Produce ONE complete portrait screenshot showing the next interaction state: clicking gold checkpoint4 has opened a refined BOTTOM STAGE PREPARATION SHEET. Maintain exactly the target's visual language, palette, Chinese typography, resource HUD and five-item bottom navigation. Original UI design.
Behind the sheet keep the frontier map, but pan the MAP ART downward so the selected stone-bridge checkpoint4 is visible just ABOVE the sheet near y30% of the full image, with a gold pin and “石桥隘口”. Keep top “远征地图”, coin522, diamond220, chapter “第一章 · 前哨” and progress “已通关3/10 ★8/30”. Slightly mute only the map behind the sheet; no heavy full-screen black overlay. Bottom navigation remains unobscured with the exact five “商店 英雄 关卡 升级 基地”, “关卡” selected gold.
A single full-width matte warm ivory sheet starts around y38%, stops just above navigation at y92%. Softly rounded upper corners, one subtle outer silhouette, no nested borders, no decorative metallic filigree, no photographic or glossy finishes. Generous clean spacing and clearly legible Chinese. SMALL grab handle at top center. The old compact “当前关卡 / 出战准备” strip is replaced by this sheet, not duplicated.
SHEET hierarchy top to bottom:
1. Header bold “1-4 石桥隘口”, a small plain close X right; subtitle “10波 · 步兵推进，逐步增援”.
2. Three equal simple difficulty segments in ONE quiet shared row: “普通” active matte gold; “精英” and “地狱” subdued with tiny padlocks, because this stage's normal difficulty has not yet cleared. No extra text anywhere claiming equipment drops on normal difficulty.
3. Heading “星级宝箱” at left, “0/3 ★” at right. Three small lovely illustrated timber-and-brass chests floating directly on paper, arranged in 3 columns, no individual outlined cards. Above chests exact condition labels “成功通关” / “50%耐久通关” / “完美通关”. Beneath: coin icon “500”, blue diamond icon “90”, blue diamond icon “225”. Under each small gray text “未达成”. No disabled giant button for every chest. Enough horizontal and vertical breathing room that labels never overlap.
4. Heading “关卡掉落” left with small text action “详情 ›” right. A compact horizontal preview with a gold coin and a pale-blue upgrade stone crystal, modest icon sizes; explanatory short line “普通难度不掉落装备”. Show only these valid normal drops. Do not add green weapons or rare equipment to normal. No full-size tabbed reward shelf.
5. Compact squad row: heading “出战阵容 4/4” left and “编队 ›” right. Below four ROUND cropped hero portraits: a young brown-haired green-cloaked archer, a pale-haired cobalt-blue hooded crossbow hero, an orange-haired red/gold fire wizard, and an old white-haired purple/gold lightning wizard. Match Image2's heroes, clean readable identity and no extra chibi knight. No box around each portrait, no extra invented stats.
6. One comfortably large full-width solid gold button, sword illustration and exact text “开始战斗”, a single dark contour, no nested gold frame or shine. Give it visual weight; preserve generous bottom padding.
All content must fit completely within the single sheet without collisions. Sheet should feel like a polished in-game expedition parchment, not a generic web dashboard or an ornate scroll. Preserve warm ivory/navy/amber hierarchy and high contrast legibility. No outside annotations, no phone frame, no watermark.
```

