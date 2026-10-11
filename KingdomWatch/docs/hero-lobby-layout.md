# 英雄页布局与展示素材

2026-10-11 已更新为用户选定的“清爽漫画奇幻”，完整组件、生产素材、提示词和验证记录见 [英雄页漫画美术 v1](hero-comic-v1/README.md)。以下 2026-10-09 图集说明保留作为历史制作记录；英雄页现使用五张独立的漫画全身立绘与正圆头像，装备和材料复用商店漫画图标。

页面顺序为共用资源栏、五名英雄头像、大立绘与五个已穿戴装备槽、独立滚动的五列背包、底部导航。立绘、装备和背包均读取当前存档。属性、故事、装备详情、锻造、对比、替换、分解、穿戴和出售沿用现有操作。

短屏保留角色与装备的可读尺寸，让背包滚动；长屏增加立绘高度并展示更多背包行。每个英雄和背包分类分别记住滚动位置。

## 2026-10-09 初版资产（历史）

- `assets/resources/ux/lobby_heroes_v1.png`：五名英雄的正面展示图集，2171×724，透明背景。
- `assets/resources/ux/lobby_heroes_v1.frames.json`：五个角色的紧密矩形，供运行时创建 SpriteFrame，不修改图片像素。
- 战斗使用原有 `battle_heroes_v2` 图集；正面图集用于本次英雄页展示。

生成方式：imagegen 技能的内置 `image_gen.imagegen` 工具，`transparent_background=true`。头像参考为现有 `ui_avatar_archer`、`ui_avatar_sniper`、`ui_avatar_pyro`、`ui_avatar_volt`、`ui_avatar_mora`。

## 初次生成提示词

Asset type: a production game character atlas, transparent PNG, for a medieval fantasy mobile game's hero equipment screen.
The five supplied images are identity references to transform from portraits into FULL-BODY hero sprites: image 1 archer, image 2 sniper, image 3 fire mage, image 4 lightning mage, image 5 frost mage.
Create EXACTLY FIVE isolated full-body heroes in ONE HORIZONTAL ROW, in that left-to-right order. Attractive FRONT three-quarter views, faces visible, matching the face, hair, gender and recognizable clothing in each portrait. Preserve the polished hand-painted 2D mobile fantasy game style, strong dark outlines, simplified shaded forms and readable silhouettes of the supplied images. No photorealism, no pencil sketch, no tiny chibi bodies.
All five characters fully visible from hair to soles, natural grounded resting pose, same relative height around 90% of the canvas height, feet aligned along a single horizontal baseline. Broad LANDSCAPE atlas around 3:1 aspect ratio, ideally 3072x1024, split into five equally wide vertical cells. EACH character stays wholly inside their own fifth of the canvas, centered, with transparent gutters of at least 5% of cell width, no overlap between characters or weapons. No grid lines.
Character 1: young MALE elf archer, spiky CHESTNUT BROWN hair and pointed ears matching image 1, green cloak, brown leather vest and boots, quiver with white-fletched arrows. Holds a curved wooden longbow at a relaxed diagonal across his lower body, firm confident calm stance.
Character 2: young white/silver-haired blue-eyed sniper matching image 2, deep BLUE hood, blue/dark leather clothing, brown leather straps and boots. Holds a compact heavy mechanical crossbow with a small scope at waist height, not a huge modern rifle that crosses cell boundaries. Calm alert expression.
Character 3: young handsome male fire mage with ORANGE hair matching image 3, deep red and orange gold-trimmed cloak/robes, leather boots, restrained small flame at one palm and a compact fire-tipped staff at his side. No giant particle effects.
Character 4: older male lightning mage matching image 4, swept gray/white hair, white beard, deep PURPLE and gold-trimmed robe, purple jewel clasp, boots. Holds a slim staff with a small purple crystal, subtle tiny electricity near his hand. No big lightning arcs.
Character 5: young FEMALE frost mage matching image 5, long silver-white hair, icy BLUE and white outfit with subtle fur collar, graceful fitted blue robes and visible boots, ice-crystal head ornament, slim blue crystal staff at her side, tiny subtle frost glow.
Critical constraints: truly transparent background outside the figures, no colored background, no background scene, no platform, no cast floor shadow, no HUD, no text, no labels, no decorative frame, no portrait medallions, no second row, no extra characters, no cropped heads/feet/weapons. FIVE heroes, ONE row, separate readable silhouettes. This is a reusable sprite atlas, not a game UI screenshot.

## 最终间距修正提示词

Edit only the atlas spacing and figure size. Preserve the five heroes, all faces, colors, outfits and weapons exactly as in the supplied transparent atlas. Produce ONE very wide 3:1 transparent sprite atlas, FIVE characters in a SINGLE row, same order. Each character must be cleanly isolated in its own equally wide FIFTH of the canvas. Scale ALL figures down so their visible head-to-feet height is only 70% of the full canvas height. Their feet share the same baseline at 85% of canvas height. Center each complete figure horizontally in its own cell, including the whole bow, cloak, staff or crossbow. Leave at least 12% of each cell's width completely TRANSPARENT on BOTH sides of each figure. In particular, the archer's bow cannot enter the sniper's cell and the purple mage's cloak/staff cannot enter another hero's cell. Need wide obvious transparent gutters, no characters touching or overlapping. Preserve full intact silhouettes with every weapon tip, head and both feet fully visible. Do NOT enlarge the characters to fill the entire height. Do not change their appearance or redraw a different pose. No ground, no shadows, no background, no text, no grid lines. True alpha transparency.
