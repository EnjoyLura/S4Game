# 弓箭手特效 v1

本轮只更新弓箭手的发射、弹体、拖尾和命中视觉。伤害、弹速、拦截预判、齐射/连射、分裂与穿透逻辑保持原样，其他英雄沿用原特效。

## 表现

- 独立实体箭矢：翡翠切面箭头、金属包边、木杆、金色尾羽；飞行方向决定贴图角度。
- 发射：每排箭只产生一次短风弧和弓弦星芒，连射每排单独出手，避免齐射数量放大发射光团。
- 拖尾：以飞行距离计算可用长度，普通箭上限 72 世界单位，强化箭 110；三层渐隐条带从箭尾延伸，出生时不伸到发射点后面。
- 强化箭和箭雨：更大弹体、更亮箭尖、更长尾迹；保留大招每排原弹速和穿透机制。
- 命中：定向金色碎光、短白芯与细碎片；普通 0.17 秒，重击 0.24 秒。发射 0.19 秒。
- 所有新动画都使用 BattleDirector 传入的战斗 dt；暂停、倍速、命中停顿与伤害一致，没有新的实时 tween。
- 飞行槽位 80（与 MAX_PROJS 一致）、发射槽位 10、命中槽位 24；资产未就绪时回退原矢量表现，预算用尽只丢装饰。

## 素材与制作记录

使用 imagegen 技能的内置 image_gen.imagegen，transparent_background=true。生成 RGBA 图集保留原像素直接复制，未修改、缩放或抠图。Pillow 只读取透明通道并生成四格 SpriteFrame 裁切矩形；图集 1254×1254，透明通道范围 0–255。

- 素材：assets/resources/fx/archer_v1.png
- 裁切：assets/resources/fx/archer_v1.frames.json
- 来源：C:/Users/user/.codex/generated_images/01a11c03-afa8-7ef0-834a-a47cbda4a411/exec-504b15d4-be06-4d17-9a80-8a3eefdebb45.png
- 实现：assets/scripts/battle/ArcherVFX.ts；通过 ImpactFX 接入 ProjectileManager 和 ArcherHero。

## 最终生成提示词

Use case: stylized-concept. Asset type: production RGBA sprite atlas for a top-down hand-painted fantasy mobile tower-defense game, archer projectile and local combat VFX. Generate ONE square image on genuine transparent background. Exact 2x2 grid of four equally sized cells, invisible grid, NO labels, NO backgrounds, NO frame borders. Each sprite centered within its own cell, with generous transparent gutters and nothing crossing cells.
Top-left cell: ONE long slender physical enchanted arrow pointing straight UP, perfectly vertical, centered. Emerald green faceted triangular arrowhead with pale gold metal edges, sharp tip; slim warm dark wooden shaft with golden specular edge; two elegant golden feather fletchings at bottom. Strong clear silhouette, painted 2D cartoon shading, subtle dark olive outline. Full length fills 80 percent of cell height, body maximum width 22 percent of cell width. NO glow, NO trails, NO star attached, NO text, NO duplicate arrows.
Top-right cell: isolated airy bow-release wind flourish: two asymmetrical tapered ivory brushstroke crescent sweeps wrapping a small transparent center, trailing towards bottom. Soft feathered edges, luminous warm white with very faint golden edging, completely transparent negative space. Not a full circle, not a thick solid ring. Fills 75 percent of cell.
Bottom-left cell: isolated small sharp golden arrow impact burst: bright warm ivory central diamond and six unequal thin golden streaks radiating outward, a few tiny golden chips. Mostly transparent space between streaks, controlled soft edges and no large opaque cloud, no black outline. Fills 70 percent of cell.
Bottom-right cell: isolated golden tip glint, slender four-point star, ivory core, warm yellow gold rays, horizontally short and vertically longer, faint tight soft halo. Fills 55 percent of cell.
Style: hand-painted fantasy game combat sprites, rich confident light/dark planes, readable at tiny size, sharp arrow and soft energy edges, consistent gold-emerald palette. The arrow must feel solid with detailed metal/wood/fletching. VFX must remain translucent and light. No scene, no UI, no characters, no typography, no watermarks. Export actual transparent RGBA, never a baked checkerboard.

## 交付

按项目要求构建 web-mobile、运行 tools/patch-web-dpr.py 并发布。效果由用户人工验证，不启动浏览器、不运行自动化玩法测试。

人工体验建议：先观察普通箭的轮廓和拖尾；再通过 GM 清零技能 CD 观察强化箭，充满大招观察整排箭雨；连射/齐射与倍速用于检查拥挤程度、节奏及可读性。

