# 重弩手朝前平举弩待机

用户后续人工指出本版待机有射击动作，本版保留源视频和历史产物，不作为合格待机，也不记作视觉认可。新生成见 `../sniper-idle-forward-v2/`，沿用同一红底静态图。

已构建发布：[朝前平举弩待机预览](https://kingdom-watch.pages.dev/previews/sniper-idle-forward-v1/?v=1791893023)。部署为 `https://9a8ecde0.kingdom-watch.pages.dev`，Cocos web-mobile 成功退出码 36，DPR 补丁及 Wrangler main 发布完成。详细记录见 `release.json`。

用户指出上一版弩的朝向不对。上一版误把“水平举弩”解释为画面内朝左横举，与人物朝战场前方的背面姿态不一致。

本版将武器改为朝战场前方、略偏左瞄准，弩与地面平行，使用背面透视和弩身缩短表现深度。双臂随持弩姿态调整。母版为不透明红底 `ready-red.png`，内置 imagegen 的实际提示词与来源保存在 `image-prompt.txt`、`image-generation.json`。

使用项目 MiniMax H3 请求两秒轻微待机，提示词为 `idle-prompt.txt`，任务和原始视频分别保存在 `video-task.json`、`source.mp4`。序列帧保持完整人物，统一裁切、比例与脚底，不拆分身体或披风。循环使用全部原帧的缓和往返时序。

H3 实际返回 768×1344、24fps、56 帧、约 2.33 秒视频；56 张 512×512 透明帧组成 4096×3584 图集，110 项四秒时序。序列帧图集、逐帧时长、全部帧接触表、镜像 GIF 与游戏素材合成 GIF 已随预览发布。资源位于 `assets/resources/ux/sniper_idle_forward_v1/`，正式战斗尚未实例化此序列。

本轮交付新素材、镜像和游戏素材合成预览；效果由用户人工查看。弓箭手现有图片、动作及高度 185.64 保留。新素材暂未替换正式战斗。按用户要求只制作、构建和发布，不执行测试、游戏、浏览器或线上验收。
