# 弓箭手特效 v2：细箭与比例修正

## 后续用户调整：恢复 v1 箭矢

用户确认原箭矢素材更合适，问题在显示比例。现已重新使用 archer_v1 图集中的 arrow 帧，取消 archer_arrow_v2 的运行时加载；箭身长度恢复为 30 + size×4.2（普通箭 59.4、强化箭 72）。继续使用 frame.rect 的宽高计算比例，保留修正后的星芒和双束细金线拖尾。v2 独立素材保留为制作记录，不删除。下面为 v2 最初改动记录。

## 本轮调整

用户截图显示 v1 箭身被拉宽、尾羽像横向翅膀，整体短粗。检查 Creator 3.8.8 本地引擎 SpriteFrame 实现，width/height 返回底层整张 texture 的尺寸。v1 使用它们计算图集裁切帧的 UITransform 比例，实际把所有裁切帧撑成近似正方形。现在改用 frame.rect.width / frame.rect.height，修正箭身、箭尖星芒和命中贴片的显示比例。

- 箭身使用新独立素材：更细长、亮绿小尖头、细金杆、向后收拢的尾羽。旧图集只继续提供 wind/impact/glint。
- 普通箭长 67 世界单位，强化箭长 76（46 + size×3），遵循裁切框原始比例。
- 普通箭尖星芒高度 9，强化 17，降低大块闪光对实体的遮挡。
- 拖尾上限普通 86、强化 118；降低雾带宽度及不透明度，增加两束细金线，随距离变细变淡。
- 原有伤害、弹速、穿透、分裂、齐射、连射、大招排数保持原样。暂停/倍速仍随战斗时钟。

## 素材与提示词

使用 imagegen 技能的内置 image_gen.imagegen，transparent_background=true。新图 1095×1437，真实 RGBA，直接复制原文件，未修改像素。Pillow 仅读取 alpha 轮廓生成 SpriteFrame 的裁切矩形（491,71,114,1295）。

- 最终素材：assets/resources/fx/archer_arrow_v2.png
- 裁切信息：assets/resources/fx/archer_arrow_v2.frames.json
- 来源：C:/Users/user/.codex/generated_images/01a11c03-afa8-7ef0-834a-a47cbda4a411/exec-a73fd92a-19a9-42f4-833b-c02618f9a159.png
- 代码：assets/scripts/battle/ArcherVFX.ts

最终生成提示词：

Use case: stylized-concept. Asset type: a single production projectile sprite for a 2D hand-painted fantasy mobile tower-defense game.
Create exactly ONE lightweight slender magical ARROW pointing perfectly vertically UP, isolated on genuine transparent RGBA background. Portrait canvas. The entire arrow is centered and fully visible with transparent margins.
Silhouette is the absolute priority: total visible arrow LENGTH is 8 to 9 times its maximum WIDTH. A straight very THIN smooth muted olive-gold shaft, only 18 percent of the maximum arrowhead width. The arrowhead is a SMALL sharp narrow spear triangle, luminous pale lime-green inset, ivory metal bright bevel on one side, thin muted gold bevel on the other side, subtle dark olive edge. Arrowhead length is 17 percent of total arrow length; arrowhead is the widest part of the arrow. Do not make a broad decorative spade.
At the very bottom are two SHORT CLOSE-FITTING swept-back golden fletchings hugging the shaft, no horizontal wings. Fletchings occupy bottom 17 percent of length, their combined width only 75 percent of arrowhead width. They follow the shaft direction and end in slender tapered points.
Style: simplified polished painted 2D GAME VFX projectile sprite, designed to stay attractive and readable at 65-75 pixels long. Use smooth broad color planes and selective ivory highlights. Thin dark olive outline at most. Mild green tip radiance kept tightly within a few pixels; shaft remains a clean solid object. Light airy fast visual character. No jewelry, no ornate metalwork, no engravings, no cylindrical chunky handle, no toy proportions, no photorealistic grain, no gritty bronze, no heavy black shadow, no huge feathers, no horizontal crossbar, no sword, no dagger. No star, no trail, no scene, no floor, no text, no border, no checkerboard. Actual transparent background. One arrow only.

## 交付

构建 web-mobile，运行 tools/patch-web-dpr.py，并发布至 kingdom-watch 的 main 分支。按用户要求，效果由用户人工体验，本轮不启动浏览器或运行自动化玩法测试。
