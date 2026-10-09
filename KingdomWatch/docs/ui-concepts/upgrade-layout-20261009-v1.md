# 升级页布局概念图 v1

2026-10-09，参考现有升级页组件、已确认的关卡页风格和五名英雄展示素材生成。当前仅为用户审阅的设计预览，未修改运行时代码。

图片：[升级页布局图](./upgrade-layout-20261009-v1.png)。

页面组件：共用资源栏、五名英雄头像、等级/武器/技能/装备四类培养页签、英雄立绘及名字职业等级战力、属性入口、当前与下一等级属性比较、横向突破路线、升级金币消耗与行动按钮、五个主界面底部导航。以等级页签、无装备加成、武器及技能1级的9级弓手为示例。实施时均读取真实存档和现有培养公式；突破节点只是达到指定等级后的效果展示。

生成方式：imagegen 技能的内置 image_gen.imagegen 工具，transparent_background=false。图片直接复制，未修改像素。

参考：已确认的关卡页概念图、assets/resources/scenes/bg_upgrade.jpg、assets/resources/ux/lobby_heroes_v1.png。

## 生成提示词

Use case: ui-mockup.
Asset type: ONE high-fidelity portrait mobile fantasy GAME upgrade screen concept for Kingdom Watch, for the player to review before implementation. Full screen front view, approximately 900x1950, sharp readable Simplified Chinese typography.
Input images: image1 is the APPROVED level screen visual language: use its warm wood, brass, parchment-gold beveled controls and bottom navigation style, NOT its forest or island layout. Image2 is the game's existing smithy background: use this warm stone-and-timber forge interior. Image3 contains the game's FIVE existing heroes: use exactly their identities for the five portrait selectors and the leftmost male brown-haired elf archer as the large selected hero.
Primary request: redesign the existing upgrade screen as an appealing cohesive game training/workshop scene, retaining ONLY existing functions: shared gold/diamond resource bar, 5 hero selectors, hero name/job/level/power, attributes entry, FOUR categories level/weapon/skill/equipment, current-versus-next upgrade stats, level milestone effects and gold cost/upgrade action, 5 bottom navigation tabs. The displayed category is 等级. Do NOT invent new systems.

Scene/backdrop: a warmly lit illustrated blacksmith workshop, left furnace embers, right weapon rack, weathered wood beams, stone walls, warm amber lanterns. The environment fills the whole screen and connects the layout. Polished hand-painted mobile fantasy game art, crisp outlines, chunky tactile shapes, controlled material detail, high contrast readable controls. Rich but balanced, no excessive ornament.

Composition from TOP to BOTTOM:
1. Leave the top 5% of the image free of UI for the phone notch. Below this, one shared compact resource row, matching image1: gold coin immediately beside number "12860" then a GREEN plus button, blue diamond immediately beside "20" then a GREEN plus button. Keep tight icon-number spacing. No labels, no stamina, no XP currency.
2. Below resources, ONE row of FIVE square illustrated hero portraits in the exact order from image3: brown-haired male elf archer in green; white-haired blue-hooded sniper; orange-haired fire mage; older white-bearded purple lightning mage; silver-haired female icy blue frost mage. The archer is selected with a warm gold frame and short base glow. Other portraits calm dark wood/brass. Portraits are medium-sized and evenly spaced. No name captions on all five, no extra heroes.
3. A SINGLE joined horizontal category strip across 90% screen width, with FOUR equal tabs. Each tab has a small icon LEFT of its text: "等级" with upward chevrons, "武器" with bow, "技能" with magic spark, "装备" with armor. 等级 is warm yellow/gold active, others dark wood. Joined physical plates, not four floating rounded website cards. This row appears before the main training presentation so it controls the preview below.
4. Main presentation taking about 34% of the screen: a large full-body selected MALE brown-haired pointed-ear elf archer matching image3, green cloak, leather armor, longbow held calmly across lower body. At LEFT occupying roughly 52% screen width, standing firmly on a shallow round STONE training dais on the actual workshop floor. Head, bow and both boots fully visible. No giant spell effects or floating character. A small brass-trimmed wood name plaque above his head reads "艾拉·风羽", smaller text "弓手 · 远程输出". A small level badge "Lv.9". Beneath his feet on the front of the stone dais a compact power plaque with flame icon and text "战力 279".
At RIGHT of the hero, one tactile cream PARchment upgrade scroll pinned to a wooden lectern, about 35% screen width and 20% screen height, generous padding, clean dark ink. Small heading "升级提升". A clear large level comparison "Lv.9 → Lv.10", next level in green. Then ONLY TWO attribute comparisons with readable spacing:
"攻击力"
"164 → 189" with small green "+25"
"技能伤害"
"230 → 274" with small green "+44"
These are grouped inside one scroll, no separated statistic cards, no spreadsheet column headings. Above the parchment at its upper right, a small circular brass button with an information icon and text "属性". Keep the scroll clear of the hero silhouette. The hero and parchment are the visual focal point, not a huge page title.
5. Beneath hero stage, one compact physically illustrated stone-and-wood milestone area taking about 17% height. Heading "等级突破", small subtitle "达到指定等级解锁". A horizontal progression path of THREE carved stone medallions linked by a subtle gold engraved line, all on ONE continuous stone shelf, no three separate rectangular cards. First medallion gold and highlighted as the NEXT breakpoint, label "10级" and effect "攻击力 +10%". Second subdued bronze, "20级" and "攻速 +10%". Third gray stone, "30级" and "强化箭概率 5%". Use intuitive sword, arrow-speed, glowing arrow symbols, tasteful padlocks on the later nodes. No checkmarks because level9 has not reached these milestones. Small chevron at far right implies more milestones horizontally. Beneath the first node only a small warm accent caption "下一级突破". No reward chests, no claim buttons, no new materials, no extra actions.
6. Near screen bottom above navigation, ONE very large gold beveled game button about 84% width, with an upward-chevrons icon, bold text "升级英雄"; immediately below within the same button a compact gold coin + "1940" cost line, slightly smaller and dark high contrast. Coin and number adjacent. This is the primary action. Give it comfortable separation from the milestones and bottom nav. No blue CTA, no secondary fake breakthrough button, no multi-upgrade buttons.
7. Bottom navigation, same shared visual design as image1, FIVE large illustrated icons with exact labels "商店", "英雄", "关卡", "升级", "基地". These icons correspond to gold bag, knight helmet, map scroll, upward golden chevrons, castle. 升级 (fourth) active gold plate; all other tabs dark warm wood. No duplicate category/navigation rows.

Text must be legible Simplified Chinese and rendered verbatim as specified. Clear margins, well balanced, reasonable touch sizes; information never overlaps. Hero training presentation and milestone shelf feel part of the forge. Preserve game fantasy styling and shared UI consistency, restrained decorative bevels. Avoid website dashboard visuals, large rounded dark metric cards, form controls, web sidebar, table grid, long vertical checklist, modern flat SaaS UI, excessive sparkles, empty white background, red notification dots everywhere, phone frame, OS status bar, watermarks, exterior explanatory text or annotations. Produce ONE coherent finished mobile game screen, not a collage of several screens.

