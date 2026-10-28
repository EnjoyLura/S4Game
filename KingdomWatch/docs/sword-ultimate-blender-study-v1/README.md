# 五岳天剑 · 御剑大招 Blender 试作

2026-10-28。用户要求先用 Blender 尝试御剑英雄的大招，先看效果，**不接入游戏**。本目录是独立的 10 秒视觉演出，不是游戏内特效移植，也没有启动游戏、构建运行包或部署。

## 观看文件

- `five-peaks-heavenfall.mp4`：1280 × 720、24fps、10 秒完整演出，无音轨。
- `five-peaks-heavenfall.gif`（480 × 270）/ `.webp`（640 × 360）：循环预览，方便直接查看。
- `contact-sheet.jpg`：起阵、四剑落地、天剑降临、终击与余韵的 16 帧接触表。
- `beauty-0020.jpg` … `beauty-0205.jpg`：带字幕的关键帧静帧。
- `five-peaks-heavenfall.blend`：可编辑工程；全部时序为关键帧，不依赖 MCP 或自动执行脚本。
- `frames/frame_0001.png` … `frame_0240.png`：本地 1280 × 720 渲染母帧（已加入 `.gitignore`，可由脚本重建）。
- `impact-marks.json`：五次落地的屏幕投影坐标，供后期镜头光斑使用。
- `verification.json`：产物校验回执。

> 仓库根 `.gitignore` 有意排除 `KingdomWatch/docs/**` 下的图片/视频，因此 MP4、GIF、WebP、静帧和接触表只保存在本地，不随提交或推送；`.blend`、脚本与记录正常纳入版本管理，可用上面的命令重建全部预览。

## 10 秒演出

| 时间 | 表现 |
| --- | --- |
| 0–1.6 秒 | 暗色石阵，中央剑纹逐段点亮；十二柄剑意小剑从地面升起、悬成一圈。 |
| 1.6–3.9 秒 | 四柄玉金巨剑依次从四个方向贯地；每剑落点有闪光、细光环、扬尘、碎石、地裂与短光照。 |
| 3.9–5.4 秒 | 四剑驻留，剑意小剑开始向中心收束；地面剑纹与外围气流逐渐增强。 |
| 5.4–6.2 秒 | 云层旋涡打开，天光垂落；第五柄更大的天剑从上方显形、悬停、加速下坠。 |
| 6.2 秒 | 终击：白绿闪、向外的压力环、地裂、碎石喷发、尘柱与强烈镜头震动。 |
| 6.2–8.6 秒 | 镜头拉远，五剑成阵；余波、碎屑回落、尘雾慢慢散开。 |
| 8.6–10 秒 | 五柄剑沉回剑阵，玉石光点上升；画面收黑。 |

演出保留游戏里“四柄巨剑 + 中央第五剑”的构图与玉色 + 金色识别，但没有修改任何伤害、范围、冷却或战斗时序。

## 设计要点

- 五柄巨剑均为程序化网格：菱形剑脊、玉色刃芯、发光刃口、金色弧形护手与玉坠、缠柄、鎏金剑首；剑身带金属高光而非平面贴图。
- 十二柄剑意小剑复用同一套网格，按曲线轨道升起、悬停、收束、围绕天剑旋转，终击后被震散。
- 地面剑阵为环线、刻度、篆式折线与五岳纹章；发光强度随时间分阶段变化。
- 每次落地独立生成：闪光、光束、两道以上冲击环、地裂、碎石、火星、扬尘；第五剑的规模更大。
- 相机为一条连续的推近/环绕/拉远路径，并在每次命中叠加随距离衰减的抖动；终击抖动更强。
- 后期在原始渲染上叠加多尺度玉色辉光、命中镜头光斑/横向光晕、轻调色、暗角、颗粒、字幕与收黑。原始 PNG 不含这些后期效果。

## 可重复制作

Windows，在 `D:/AI/S4Game` 执行：

```powershell
& 'D:/program/Blender 5.2/blender.exe' --background --python KingdomWatch/docs/sword-ultimate-blender-study-v1/build_scene.py -- --all --size 1280 --samples 48
python KingdomWatch/docs/sword-ultimate-blender-study-v1/compose_preview.py --all --gif
python KingdomWatch/docs/sword-ultimate-blender-study-v1/verify_artifacts.py
```

Blender 版本 5.2.3 LTS。渲染使用 EEVEE、AgX、运动模糊；合成脚本使用 Pillow、NumPy、imageio 与 imageio-ffmpeg。未调用付费模型，未下载外部美术资源，未启动游戏、浏览器、真实战斗、音频或 WASM。

单独重渲染若干静帧：

```powershell
& 'D:/program/Blender 5.2/blender.exe' --background --python KingdomWatch/docs/sword-ultimate-blender-study-v1/build_scene.py -- --still 56,92,140,149,166 --size 960 --samples 32
```

## 验证与限制

`verify_artifacts.py` 只检查本地产物：240 张 1280 × 720 母帧、视频帧率/时长/尺寸、末帧收黑、五次落地投影记录、GIF/WebP 帧数、关键静帧与工程文件存在，并输出 SHA256。它不启动游戏，也不声称游戏内性能、真实战斗或手机观感已经验收。

本版是**电影化预览**，不是游戏可直接使用的图集或运行时特效；若后续决定接入，需要另做俯视正交分层渲染、透明边缘检查、固定锚点、内存/槽位与手机帧率验证。当前未获得用户视觉确认，不能把本试作当成已批准的正式特效。

## 状态

- 未修改 `assets/` 或任何游戏脚本。
- 未构建、未部署 GitHub Pages、未推送源码仓库。
- 仅在本目录保存 Blender 工程、制作脚本和预览产物。
