# AI 视频特效工作流（图生视频 → 序列帧图集 → 引擎播放）

> **流程铁律（用户要求）**：序列帧做好后先给用户检查（接触表 + 游戏场景合成预览），
> **用户确认满意后才允许接进游戏**。禁止跳过审查直接集成。

> **模型偏好（用户 2026-10-11 指定）**：本项目视频只用 MiniMax H3；不要使用 Seedance，也不要自动换成更贵的模型。冰领域以用户认可约 80/100 的 v6 为基准，优先修现有素材的圆度与起手节奏，保留原有冰晶、寒气和消散。

> 适用：一次性的流体/燃烧/电弧/寒雾类特效（非循环）。
> 循环类（地面灼烧等）不用序列帧，用噪声滚动 shader。
> 管线成本：MiniMax H3-768p ¥0.06/秒，1-2s 视频约 ¥0.06-0.12，2-3 分钟出片。

## 6. 审查产物怎么给

1. 接触表（video2atlas 自动出 `*_sheet.png`）看逐格质量；
2. 再用 PIL 把格子按时序合成到真实战斗截图上（缩放到游戏内尺寸），
   存成 **GIF 动图** 给用户看"上身后"的动态效果；
3. 用户点头后才做引擎接入。

## 0. 安全

- lens API key 只存仓库外 `C:/Users/user/.kw_secrets/lensapi_key.txt`（0600），前缀见密钥文件名，绝不出现在任何入库文本。
- 仓库 pre-commit 钩子自动拦截已知 key 前缀（含本 key），提交时自动把关。

## 1. 首帧准备（决定成片质量的一半）

1. 选一帧**现有风格锚点**（批次序列里最好的一格，或引擎内截帧放大），
   目的：把画风钉死，避免视频模型自由发挥。
2. 用 PIL 调整：`ImageEnhance.Color(0.80)` + `Brightness(0.92)` 压住 AI 鲜艳感。
3. 裁到内容包围盒+6% 边距，居中铺到 **768×768 纯黑**（`alpha_composite` 到 `(0,0,0,255)`）。
4. 火焰占画面宽度比例 = 成片里火焰的相对大小。普攻小焰用 **~34%**（首批 52% 出来偏大）。
5. 存 `美术/vfx_host/<名>_ff.png`，部署：
   ```bash
   cd 美术/vfx_host && npx -y wrangler@4 pages deploy . --project-name kw-vfx-src --branch main --commit-dirty=true
   ```
   新子域首次部署要等 ~30s 传播，`curl` 到 200 再提交任务。

## 2. 提交视频任务

```bash
python 美术/tools/art_video_gen.py \
  --image https://kw-vfx-src.pages.dev/<名>_ff.png \
  --prompt-file 美术/tools/prompts/<名>.txt \
  --seconds 1 --ratio 1:1 --out 美术/原图/<批次>_<名>/clip.mp4
```

- `--seconds 1` 最短档；消散类特效 1s 足够（2s 会导致尾巴太长，游戏内怪物死了火还在烧）。
- `ratio` 实测会被 H3 渠道忽略（1:1 返回 768×1344 竖幅），管线已兼容任意分辨率。
- Prompt 要点（英文效果最好）：
  - 手绘 cel 画风声明 + 塔防游戏 VFX 元素定位；
  - **运动只描述"衰减过程"**（collapses inward / shrinks / dims / breaks into embers）；
  - 负向明确列出：no smoke / no glow halo / no lens flare / no HDR sheen / no new objects /
    camera locked / background stays pure solid black throughout / not vivid, not exaggerated；
  - 调色板用"muted disciplined 4-color value design"句式（继承批次19风格词库）。

## 3. 抽帧 → 图集

```bash
python 美术/tools/video2atlas.py --video clip.mp4 --prefix pyro_hit \
  --outdir 美术/原图/<批次>_视频帧_日期 --cells 12 --size 256 --grid 4 \
  --fps 12 --pedestal 9
```

工具内建四个关键修正（都是实踩过的坑，别关）：

| 修正 | 原因 |
|---|---|
| `--pedestal 9` 黑场校正 | 编码器把纯黑抬亮 8-9，普通混合下露出取景方框 |
| 裁切区边缘羽化 14% | 视频画幅边界把辉光硬切，ADD/alpha 混合下出现直边 |
| 反预乘 alpha（alpha=最大通道） | 引擎是 alpha 混合非 ADD；此变换在数学上严格等价叠加 |
| 联合包围盒统一取景 | 逐帧 bbox 会左右抖动 |

审 `*_sheet.png`：确认无烟雾（不要的元素直接重新生成，别试图裁——烟雾贯穿整段时裁不掉）、
无风格漂移、末帧近全黑。产出的 `<prefix>.png` + `<prefix>.frames` 拷入
`KingdomWatch/assets/resources/fx/`（.frames 改名 `.frames.json`，Cocos 导入为 JsonAsset）。

## 4. 引擎接入（FireVFX.ts）

- 常量区：`PYRO_CEL_DUR`（每格秒数，快攻慢衰：绽放格 ~0.045、消散格 ~0.07）、
  `PYRO_ANCHOR_Y`（首格火焰亮度质心，格内坐标自顶向下）、`PYRO_FLAME_W`（首格火焰宽度）。
- `hitClip()`：`(heavy ? 58 : 44) / PYRO_FLAME_W` = 屏上火焰目标宽度 ÷ 格内火焰宽，
  普攻 ~44px、重击 ~58px（怪物本体 ~46px，小焰不要盖过怪物）。
- 锚点偏移：`(PYRO_ANCHOR_Y − PYRO_CELL/2) * scale`，让质心对准命中点、烟雾/上升物在上方。
- ImpactFX.hit 里首选 `hitClip`，未就绪回退引擎火团（`fire.hit`），再回退矢量描边。
- 总时长（ΣCEL_DUR）必须 < 普攻间隔（~0.8-1.2s），否则怪物死了火焰还在原地烧。

## 5. 实测参考数据（2026-10-07 首批）

- 任务：`POST /v1/videos` → queued(10%) → completed，全程 ~2.5 分钟。
- 首帧格心质心 157/256（cell0），火焰宽 116/256；联包 768×1344 全幅（烟雾顶到画幅顶）。
- 屏上效果：414px 视口下火焰 ~78px 偏大 → 收敛到 ~44px。
