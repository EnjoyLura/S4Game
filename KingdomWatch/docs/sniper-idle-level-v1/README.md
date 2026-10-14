# 重弩手水平举弩待机

已构建发布：[镜像与战场合成预览](https://kingdom-watch.pages.dev/previews/sniper-idle-level-v1/?v=1791888847)。部署快照 `https://6d3e7c4e.kingdom-watch.pages.dev`，Cocos web-mobile 构建成功退出码 36，DPR 补丁和 Wrangler main 发布完成。

用户要求重弩不要指向天空，改为水平举弩，并直接制作幅度不夸张的待机序列帧。

本次内置 imagegen 重画平举弩红底首帧，随后使用项目 `art_video_gen.py` 的 MiniMax H3，请求两秒轻微呼吸待机。人物、重弩、披风作为完整视频帧保留。

H3 任务 `task_CUpPtDIDUaGjdCg7k1mMUncewFLpukdi` 已完成，实际返回 768×1344、24fps、56 帧、约 2.33 秒。56 张透明原帧组成 110 项四秒逐帧时序，图集 4096×3584，格子 512×512，文件 8,760,505 字节。该记录说明素材生成与打包完成，动画表现由用户人工查看。

- `ready-red.png`：不透明红底首帧；`image-prompt.txt` 保存实际图片提示词。
- `source.mp4`：原始 H3 视频；`video-task.json` 保存任务，`idle-prompt.txt` 保存待机提示词。
- `package_idle.py`：红底抠图与完整人物序列帧打包。全局红底抠除包含弩内空隙，半透明边缘去红；使用同一个裁剪框、比例和脚底，不逐帧重定位，不冻结或拆分身体。
- `frames/`、`idle.png`、`idle.frames.json`：所有原帧、图集与逐帧时序。保留全部原帧，以四秒往返和两端减速循环，避免硬切末帧到首帧。
- `idle-mirror.gif`、`battle-composite.gif`、`contact-sheet.jpg`：镜像预览、游戏素材合成、逐帧接触表。
- `art.json`、`packaging.json`：图片和打包信息；`release.json` 保存构建发布记录。

新资源为 `assets/resources/ux/sniper_idle_level_v1/`，显示高度沿用 170。原弓箭手图片、动作及显示高度 185.64 保留。

本次完成新待机素材与独立预览，效果由用户人工查看，不执行游戏、浏览器、线上效果验证或测试。
# 当前状态

用户后续指出本版弩的朝向不对：画面内朝左横举与背面人物朝战场前方不一致。本版保留历史，新制作见 `../sniper-idle-forward-v1/`，不将本版记作视觉认可。
