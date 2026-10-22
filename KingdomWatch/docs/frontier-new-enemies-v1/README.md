# 新敌人土匪、老鹰、蝙蝠原画 v1

2026-10-18 用户要求参考现有怪物形象，制作三种新敌人。内置image_gen各生成一张，输入参考为assets/resources/ux/battle_mobs_v2.png，只参考画法/配色/轮廓，不覆盖六种原有怪物。

- sources/goblin-bandit-front-blue-v1.png：哥布林土匪，旧兜帽、短刀、钱袋；正面全身，蓝色背景以避开绿色皮肤。
- sources/eagle-front-green-v1.png：老鹰，正面悬停展翅、棕褐羽毛、绿底。用户反馈翼尖太近边缘，作为旧稿保留。
- sources/eagle-front-green-v2-safe-margin.png：按用户要求经内置image_gen编辑，整体缩小居中、增加左右上下绿色空间，作为后续视频首帧优先版本。没有裁掉翼尖。注意生成编辑不是确定性原像素缩放，局部绘画可能存在变化。
- sources/bat-front-green-v1.png：蝙蝠，正面展翼、灰褐身体/暗紫翼膜，绿底。

完整生成提示词见prompts.txt，老鹰留白版实际编辑提示词见eagle-v2-edit-prompt.txt。assets.json记录尺寸、散列和老鹰留白版近似色键主体边界。所有原始生成文件完整保存，没有程序改图。

目前只交付角色概念/视频首帧，不是动作图集，尚未获用户视觉认可。没有新增游戏怪物ID、飞行机制、数值、关卡波次、图鉴、媒体加载或存档，没有替换已有怪物，无需重新部署游戏。用户自行生成视频；没有提交视频任务。先前研究院图鉴修正已在v49独立发布，不与新敌人混同。

用户中途索取哥布林王行走视频首帧，已确认现有文件D:/AI/S4Game/美术/vfx_host/mobwalk_goblin_king_ff.png（768×768黑底）及高清原图D:/AI/S4Game/美术/原图/手动替换_普通哥布林/mob_goblin_king.png，均未修改。

用户随后要求蝙蝠同样增加视频振翅留白，已通过内置image_gen编辑并保存sources/bat-front-green-v2-safe-margin.png；整体居中缩小，上下左右增加绿底空间，旧版保留，提示词见bat-v2-edit-prompt.txt。优先使用此版生成视频。
