# 金色雷枪 · 贯地雷暴试作 v2

2026-10-27。用户认可上一版的雷电质感，但指出入地力度、雷暴爆炸、地电密度与范围不足，并希望补回向外游离的雷电丝圈。

**仍为独立 Blender 试作；没有接入、构建或发布游戏，没有推送源码。** `lance-blender-study-v1` 原样保留，作为画质和动效对比基线。

## 从当前游戏借鉴的内容

阅读 `assets/scripts/battle/ThunderLanceVFX.ts`、`assets/resources/fx/thunder-lance-flow.effect`、`assets/scripts/battle/SwordAbilityVFX.ts`，并检查 `docs/lance-storm-v141/ultimate-review.webp` 的已有离屏帧，没有启动游戏。

- 游戏的巨枪命中同时触发入土碎屑、约 0.72 秒的雷暴爆炸和约 0.78 秒的外扩电波。
- 爆炸从紧凑亮核迅速展开成带起伏边缘的雷暴云，伴随强电弧、火花和衰减余光；上一版 Blender 只有分叉电弧与少量尘雾，没有足够大的体积爆发。
- 游戏波前有不等长的断口、偏移的局部外沿、较宽的压力层及第二层余波，既不是单纯放射线，也不是完整规则亮圆。
- 游戏使用入土裁切和前景土唇让枪尖进入地面；上一版 Blender 入土位移较浅，缺乏明显的地面反馈。

## 本轮变化

保留上一版枪体材质、修长尖锋、纵向刃面和游走缠绕的雷电丝，集中改变接触运动与爆发结构。

1. **贯入与停顿**：投掷末段加速，沿枪轴在约 85ms 内贯入 0.66 个场景单位，再快速回稳至 0.57；上一版仅沿竖直方向下移 0.17。触地时刻仍是 1.50 秒。实际视觉力度由用户判断，数值不是性能或美术评分。
2. **雷暴爆炸**：新增两层起伏、侵蚀消散的三维发光云壳；接触时压缩亮核，随后约 0.12–0.24 秒展开。叠加攀附云壳的电弧、沿枪轴回击的强电流和更明显的碎石飞散。
3. **地电密度**：每次脉冲主干由 9 条增至 26 条，各有三处分叉；持续地电生成由 144 次增至 420 次，单次寿命也略延长。
4. **覆盖范围**：脉冲主干最大距离从 5.5 增至 6.8；常驻地电最大距离从 4.6 增至 6.5。仍在固定镜头内留出透明边界。
5. **游离雷电丝圈**：每次脉冲由多个有缺口的扇区组成，每扇区四根错位细丝，独立延迟、传播半径与微小转动。整体能读成向外扩散的电丝带，但没有完整圆周轮廓。
6. **接地**：新增局部暗坑、翻起的近侧土块，枪尖被地面裁切；外扩电流与主体放电按同一时间轴衔接。

这不是游戏内实时特效移植。场景对象数、离线体积与复杂曲线尚未转换成运行时资源或做手机性能优化。

## 观看

- `golden-thunder-lance.mp4`：1280 × 1280、24fps、8 秒正常速度完整演出。
- `golden-thunder-lance.gif` / `.webp`：循环预览。
- `impact-comparison.mp4`：上一版与本次同步触地对比，先正常速度 2 秒，再 0.5 倍速 4 秒。
- `game-context.mp4`：同一渲染叠加既有森林与静态怪物素材，仅用于比例和可读性示意，不是真实游戏。
- `contact-sheet.jpg`：重点展示入地、亮核、扩张雷暴、外扩电丝带与持续放电。
- `golden-thunder-lance.blend`：可编辑工程；`frames/` 为本地 192 张透明母帧。

## 复现

在 `D:/AI/S4Game` 执行：

```powershell
& 'D:/program/Blender 5.2/blender.exe' --background --python KingdomWatch/docs/lance-blender-study-v2/build_scene.py -- --all --size 1280 --samples 64
python KingdomWatch/docs/lance-blender-study-v2/compose_preview.py --all
python KingdomWatch/docs/lance-blender-study-v2/compare_impact.py
python KingdomWatch/docs/lance-blender-study-v2/verify_artifacts.py
```

`build_scene.py` 负责主体和原有分层，调用同目录的 `impact_revision.py` 增加雷暴、破碎外扩电丝与接地几何。全部动画烘焙为可编辑关键帧。`compose_preview.py` 负责展示背景、局部地面照明、辉光和预览编码；原始透明帧不包含后期辉光。

未安装 MCP，未调用付费模型，未下载外部美术资源，未执行 Cocos、浏览器、战斗、音频或 WASM。制作工具仍是用户指定的 Blender 5.2.3 LTS，以及已有 Pillow / NumPy / imageio。

## 检查与边界

检查 192 帧完整、固定 1280² 分辨率、透明导出边缘、末帧清空和三个视频的帧率/时长。正常速度和对比视频保留真实触地时序；半速只存在于对比视频第二段并明确标记。

已有游戏实现只作为参考。所有本轮文件均位于此独立目录；不修改 `assets`、战斗数值或发布渠道。制作脚本、Blender 工程和主要预览只做本地 Git 提交。
