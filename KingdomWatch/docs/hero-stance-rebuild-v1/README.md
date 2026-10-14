# 重弩手与雷法师站姿、待机重做

用户要求参考当前弓箭手的自然站姿，重做重弩手和雷法师：双脚前后错开、膝盖放松，保留各自的武器握持；待机减小肩背呼吸幅度。此前两位角色的站姿和待机不再作为已认可结果。弓箭手图片、待机、攻击及显示高度 185.64 保持。

用内置 imagegen 编辑各自的红底母版，以当前弓箭手完整待机首帧作为站姿参考。新图保持纯红不透明底，重弩手平举朝前的弩及雷法师法杖／空手手势保持。图片及视频均等待用户人工查看，不将构建或发布记为效果已认可。

| 角色 | 新站姿母版 | 图片提示词 | 待机提示词 | 视频任务 | 正式待机资源 | 显示高度 |
| --- | --- | --- | --- | --- | --- | --- |
| 重弩手 | [ready-red.png](../sniper-stance-idle-v3/ready-red.png) | [image-prompt.txt](../sniper-stance-idle-v3/image-prompt.txt) | [idle-prompt.txt](../sniper-stance-idle-v3/idle-prompt.txt) | task_ZfW2nZiUwOEf2dNqB99lQDQqyq1Ealx1 | sniper_stance_idle_v3 | 153 |
| 雷法师 | [ready-red.png](../volt-stance-idle-v2/ready-red.png) | [image-prompt.txt](../volt-stance-idle-v2/image-prompt.txt) | [idle-prompt.txt](../volt-stance-idle-v2/idle-prompt.txt) | task_ciPdQdcFk87jCS8UmqSL7tBfPMm7YKGX | volt_stance_idle_v2 | 146 |

使用项目 `美术/tools/art_video_gen.py` 的 MiniMax H3，分别请求两秒视频。提示词将肩背运动限定在 768 宽视频的一两像素，双脚、骨盆、头和武器保持稳定；这是生成要求，不代表逐帧运动幅度已经验收。两段源视频实际各为 56 帧、24fps、约 2.33 秒，原片完整保留。每套使用 56 张完整人物透明帧、110 项四秒缓和往返时序，固定取景、固定等比缩放、共同脚底 `(256,496)`、512×512 格子，避免末帧直接跳到首帧。脚底横向基准覆盖前后错开的两只靴子。图集为 4096×3584。

重弩手旧攻击帧使用旧站姿，不再与新待机混用。用同一新母版补做视频任务 `task_1ENUQ3Tk2DH61c2fUwMBjPQD28iJtf0Z`，保存在 [sniper-stance-attack-v1](../sniper-stance-attack-v1/)。原片后段出现弩的逐步降低／转动，仅采用源帧 0–9 的小幅受力动作，以 8–0 完整原帧回位：10 张独立帧、19 项时序、约 0.792 秒、发射索引 9，回位约 0.417 秒。攻击和待机按同一画内高度 467.1111、显示高度 153 与脚底统一缩放；完整人物直接换帧，保持不透明，不进行身体拆分、局部形变或双图透明度切换。提示词见 [attack-prompt.txt](../sniper-stance-attack-v1/attack-prompt.txt)，源帧选择见 [selection.json](../sniper-stance-attack-v1/selection.json)。

正式播放器已改为新资源。范围内有目标、待发、攻击或收势时停止推进待机相位，空闲后续播，整个角色按攻击方向左右镜像。雷法师继续冻结同一新姿态交战，其新的攻击序列尚未制作；技能、大招、弹道、伤害、射速和声音沿用原逻辑。

制作入口为 [package_frames.py](package_frames.py)，独立人工预览为 [preview.html](preview.html)，可播放／暂停、逐帧拖动、查看原向／镜像及实际游戏尺寸下的弓箭手对照。攻击切换按钮用于查看重弩手新动作，不执行自动效果判断。

按用户要求仅制作、接入、构建、DPR 补丁及发布；没有运行测试、游戏、浏览器或线上验收。源帧接触表用于制作时选择动作范围。部署详情完成后记录在 `release.json`。

正式发布：[游戏](https://kingdom-watch.pages.dev/?v=hero-stance-v1-1791906822) · [新站姿与待机对照](https://kingdom-watch.pages.dev/previews/hero-stance-rebuild-v1/?v=1791906822)。构建成功退出码 36，DPR 完成，Wrangler main 发布成功，部署 https://739dad09.kingdom-watch.pages.dev。
