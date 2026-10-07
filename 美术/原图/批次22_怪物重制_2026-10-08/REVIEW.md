# 批次22 怪物重制 · 审查记录（2026-10-08 夜间自动流水线）

## 交付范围
- 静态立绘：6/6 全部重生成并重排进 `battle_mobs_v2`（含狼王；狼王仅图鉴不进战斗波次）
- walk 步态序列帧：5 只战斗怪全部采用（8 帧/只，minimax h3 图生视频 → 边缘洪水填充抠底）
- attack 攻击一次性帧：仅 `wolf_rider` 采用（6 帧）；其余 4 只二轮生成仍身份漂移，全部拒绝
- 引擎图集：`battle_mob_anim_v1`（1920×640，46 帧，160px 格）
- 运行时：`MobAnim.ts` + `BattleSprite.showSeq` + `Monster.tickArt` 序列帧状态机（步态速度随移速/减速映射；缺段自动退化程序化步态）

## 攻击段拒绝原因（rejected/ 目录存档）
| 怪 | 两轮问题 |
|---|---|
| goblin_slinger | 两轮都乱出道具（盾/法杖），服饰漂移（橙衫） |
| goblin_brute | 两轮锤子都坍缩成木桶 |
| goblin_shaman | 两轮都长出白胡子（与 skull mask walk 形象冲突），二轮还扁平化风漂 |
| goblin_worker | r1 挥击帧有暗色裂纹残留；r2 干净但裤子配色与 walk 不一致（白腰布→深蓝裤） |

wolf_rider 攻击段（狼咬+枪刺）与 walk 形象一致，采用。

## 缺 attack 段的战斗表现
攻击瞬间显示 walk 第 0 帧（静止）+ 冲撞前摇节点下沉 + ComicPop 词条，观感可接受；
后续可用更稳的模型或逐帧修图补齐。

## 工具链（可复现）
- `美术/tools/mob_firstframes.py`：立绘 → 768² 纯黑首帧（kw-vfx-src.pages.dev 托管）
- `美术/tools/art_video_gen.py`：lens minimax-h3 提交/续查（`--resume <task_id>` 断点续查可用）
- `美术/tools/mob_video2frames.py`：视频 → 段图集（黑场校正 + 边缘洪水填充抠底 + 联合包围盒 + 底部钉脚）
- `美术/tools/mob_anim_pack.py`：段图集 → `battle_mob_anim_v1` 引擎图集（狼王不打包）
- `美术/tools/mob_atlas_repack.py`：批次22 立绘 → 重排 `battle_mobs_v2`（保持旧布局约定）
- 冒烟：`tools/fire-vfx-smoke.cjs`（GM fixture 20+ 怪，两帧差分 5.09 确认步态在播）
