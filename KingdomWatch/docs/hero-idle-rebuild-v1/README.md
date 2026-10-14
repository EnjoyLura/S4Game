# 重弩手战斗图片、待机序列帧与弓箭手尺寸调整

最新已按用户要求接入并发布到[正式游戏](https://kingdom-watch.pages.dev/?v=sniper-live-archer-84-1791868072)。新重弩手完整人物帧与四秒循环现用于实际战斗，战斗时保持新持弩姿态并镜像；此前仅发布预览，所以游戏仍显示旧重弩手。弓箭手待机／攻击已等比缩小 16%，显示高度从 221 改为 185.64。实现与记录见 `../sniper-battle-integration-v1/README.md` 和 `release.json`。下方为此前独立预览的制作记录。

最新修正版已构建发布：[查看预览](https://kingdom-watch.pages.dev/previews/sniper-idle-rebuild-v1/?v=1791866900)。弩弦封闭的空隙增加独立抠底种子，修正透明／黑块的跳变；循环改为完整 56 原帧前进后沿相邻帧返回，共 110 播放项、四秒一轮，并在两端逐渐减速。原始视频保留，没有提交新 AI 任务。预览、镜像 GIF 和场景 GIF 使用同一逐帧时序；新文件名避开旧缓存。详情见 `sniper/idle-v4/matte-fix/README.md` 和 `release.json`。仍由用户人工查看，弓箭手保持原样。

当前 v4 已重新生成、构建并发布：[重弩手完整人物待机预览](https://kingdom-watch.pages.dev/previews/sniper-idle-rebuild-v1/?v=1791866090)。本次从完整人物视频直接制作透明帧，取消静态首帧身体与局部披风的合成；保留连续全部 56 帧，格子分辨率提升到 384×576，并按两秒循环播放。AI 接口实际返回约 2.33 秒、24fps，原始视频同页提供，保持原始节奏。详情见 `sniper/idle-v4/README.md`，发布信息见 `sniper/idle-v4/release.json` 与 `release.json`。

弓箭手继续保持线上图片、待机、攻击和显示高度 221。新重弩手素材仅更新独立预览，由用户人工查看，不替换游戏中的重弩手动作，不运行视觉验收。

v3 已被用户否定：动作太简单，只有披风末尾飘动，局部合成导致披风错位。旧素材与方法只保留历史记录，见 `sniper/idle-v3/REJECTED.md`，不再运行 `lock_cloth_motion.py`。

## 历史制作记录

历史 v2 已被用户否定：用户人工指出待机仍有攻击动作，不能将端点匹配或构建发布视为认可。48 格两秒版只保留制作记录，见 `sniper/idle-v2/README.md` 与 `sniper/idle-v2/REJECTED.md`。

2026-10-13 最新：用户要求弓箭手在 170 的当前大小上再放大 30%，已将线上待机／攻击显示高度同步设为 221，并完成构建发布：[新版游戏](https://kingdom-watch.pages.dev/?v=archer-size-221-1791854860)。原图片、动作和脚底原点沿用。用户同时要求重弩手重新生成两秒纯待机；该请求因视频账户余额不足而在创建任务前被拒绝，未生成新视频、未提交短视频替代品。新提示词与拒绝记录保存在 `sniper/idle-v2/`，充值后可运行 `generate_video.py --hero sniper --take idle-v2 --seconds 2 --image-url https://kw-vfx-src.pages.dev/hero_idle_rebuild_sniper_20261013_ff.png`。当前重弩手预览仍是上一版。发布信息见 `size30-release.json`。

已完成构建、DPR 补丁与 main 发布：[游戏 · 弓箭手放大](https://kingdom-watch.pages.dev/?v=archer-size-1791829898) · [重弩手图片与待机预览](https://kingdom-watch.pages.dev/previews/sniper-idle-rebuild-v1/?v=1791829898) · [部署快照](https://1b181ee6.kingdom-watch.pages.dev)。详情见 `release.json`。新重弩手为 24 张透明帧、46 格往返时序、3.2 秒循环；新弓箭手视频留在本地。

2026-10-13 用户先要求使用项目 AI 视频工具完成两位英雄的待机，随后明确保留弓箭手目前线上图片、待机与攻击，只把弓箭手等比调大。本次实际交付以最新指示为准。

弓箭手继续使用原来的 `archer_idle_v1/idle.png` 与 `archer_attack_v1/attack.png`，没有替换原图集、视频帧或动作时序。两套 `.frames.json` 的 `displayHeight` 由 146 改为 170，约放大 16.4%，固定脚底节点位置仍是 (0,-76)。只等比放大，不横向拉伸；待机范围判断、攻击回调、镜像规则均沿用。原待机制作脚本同步输出 170，攻击脚本从待机读取该尺寸。

重弩手参照现有英雄立绘生成一张完整人物透明图：蓝兜帽与披风、金发、深蓝衣服、棕皮革、银色护甲、木钢重弩；采用后侧视角，头朝上方，两手自然持弩。原图保存为 `sniper/sniper-ready.png` 和 `assets/resources/ux/sniper_combat_rebuild_v1/sniper-ready.png`。图片由内置 image_gen 生成，实际提示词为 `sniper/combat-image-prompt.txt`，记录见 `sniper/image-generation.json`。

待机连续视频使用项目现有 `美术/tools/art_video_gen.py`，模型保持 `lens-minimax-h3-768p`。原本的四秒请求因余额不足未提交成功，改为可用的一秒档；没有升级模型。首帧只进行等比缩放和透明通道黑底合成，角色原画不重绘。任务 ID、实际请求、输出视频保存在 `sniper/video-task.json` 与 `sniper/source.mp4`，提示词见 `sniper/idle-prompt.txt`。密钥由原工具从仓库外文件读取，未写入素材记录。

`build_idle.py --hero sniper` 将完整人物视频抽为透明序列帧，所有帧共用一次联合裁切、一个固定比例和一个脚底原点，不逐帧重新居中、追踪或缩放，也不拆肢体、交叉淡化或扭曲图片。循环从真实连续帧构成；端点差异明显时使用连续往返播放，并把呼吸节奏放慢到 3.2 秒。图集和帧数据在 `assets/resources/ux/sniper_idle_rebuild_v1/`，完整单帧、接触表、镜像 GIF 与源视频在 `sniper/`。

用户改变弓箭手制作范围前，新的 H3 弓箭手待机已经出片并打包；它只保存在本地 `archer/` 和 `archer/unapplied-resource/`，未接入或发布。后续重跑打包脚本也将弓箭手新素材留在本地目录。

独立预览打包到 `previews/sniper-idle-rebuild-v1/`，包含重弩手静态原向／镜像、待机原向／镜像、暂停、逐帧、播放速度，以及实际游戏地面与城墙合成。合成中的弓箭手使用线上原待机，仅显示尺寸为 170。新重弩手动作尚未替换游戏，按既有素材工作流先供用户人工审阅。本次不运行游戏、交互、浏览器或线上效果验证。

重现只需处理已有视频，不会重复提交任务：

```powershell
python docs/hero-idle-rebuild-v1/build_idle.py --hero sniper
python docs/hero-idle-rebuild-v1/make_composite.py
node docs/hero-idle-rebuild-v1/build_preview.cjs
```

`generate_video.py` 会优先续查已记录的任务；不要删除任务记录后重跑，以免重复付费。
