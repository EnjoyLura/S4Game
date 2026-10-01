# 美术资源目录规则（王国守望 · Kingdom Watch）

> 目标：AI 生成 → 切片 → 落盘 → 进游戏 全流程可复用；第二批人工美术按同样规则迭代替换，零代码换肤。

## 一、目录结构与存放规则

```
美术/
├── README.md            ← 本文件（存放规则 + 工具用法）
├── tools/               ← 沉淀工具（生图编排 / 切片 / 抠底 / 九宫格合成 / 批次配置）
│   ├── art_gen.py       ← 批量生图：读批次 JSON → 调 CLI → 实测尺寸 → 记录 manifest.json
│   ├── art_slice.py     ← 批量图切片：网格切格 → alpha 裁边 → 缩放 → 落盘
│   ├── alpha_key.py     ← RGB 生图抠透明底（中转站透明底不保证生效时的兜底）
│   ├── compose_9slice.py← 九宫格素材重排版：端头等比缩放+中段拉伸，输出游戏渲染比例
│   └── batch1.json      ← 第一批生成清单（第二批照抄改 prompt 即可）
├── 基准/                ← 风格基准图（图生图的 ref，风格一致性的锚）
│   ├── 图标风格基准.png   ← 图标类图生图参考
│   ├── 组件风格基准.png   ← UI 组件类图生图参考（= B0）
│   └── 场景风格基准.png   ← 场景/角色类图生图参考（= SCENE）
├── 原图/                ← AI 原始产出，按批次归档，永不直接进游戏
│   └── 批次1_2026-10-01/
│       ├── <id>.png     ← 每张批量图/单图（保留全分辨率）
│       └── manifest.json← 生成记录：prompt、参数、实际尺寸、sha1、耗时
└── 切图/                ← 切片后的成品，按类别存放
    ├── 组件/            ← A1 通用组件（ui_panel_dark、ui_btn_primary_*.png …）
    ├── 图标/            ← A2 通用图标（ui_icon_coin.png …）
    └── 场景/            ← 关卡背景等大图（2K 生成）
```

游戏引用目录（与切图同名同步）：

```
KingdomWatch/assets/resources/ux/   ← 与 UX 清单 ID 同名落图，代码 assetMap 按 ID 加载
```

## 二、命名规则（与 UX 线稿清单一致）

- `<分类>_<名称>[_<态>].png`，如 `ui_btn_primary_press.png`、`ui_panel_dark_gold.png`
- 状态后缀：`_press`（按下）/ `_disabled`（禁用）/ `_active`（激活）/ `_lit`/`_gray`（星）
- 描边/稀有度变体：`_gold`/`_white`、`_white`/`_blue`/`_purple`
- 一律 PNG-32 透明底（场景大图除外）；图标落盘后统一缩到 @2x 设计尺寸附近

## 三、生图规则

- **尺寸**：只有关卡背景这类放大程度高、精度要求高的用 **2K key**（`"key":"2k"`）；其余全部 **1K key**。
  - 注意：中转站不保证请求尺寸（1K 常回 1254×1254，2K 偶尔回 1254），每张必须以实测为准，`art_gen.py` 已自动实测并记录。
- **透明底**：UI 资源一律 `--background transparent`（原生透明已验证可用）；场景大图用 `opaque`。
- **批量一致性**：同类资源拼一张网格图（3×3 / 3×2 / 2×2），prompt 里"strict grid, never crossing cell borders"锁格；用 `images edit --ref-image 基准图` 锁风格。
- **风格**：主参考《王国保卫战》——手绘卡通风、粗深棕描边、高饱和光泽。关键词统一见 batch1.json 各 prompt 前缀。

## 四、工具用法

```bash
# 1) 批量生图（断点续跑：已成功的项自动跳过）
cd 美术/tools
python art_gen.py batch1.json                 # 全部
python art_gen.py batch1.json --only G1_图标A  # 单张重跑

# 2) 切片落盘（原图 → 切图/类别 → 游戏目录，三处一次完成）
python art_slice.py --sheet ../原图/批次1_2026-10-01/G1_图标A.png \
  --cols 3 --rows 3 \
  --names ui_icon_coin,ui_icon_exp,ui_icon_diamond,ui_icon_chest,ui_icon_equip,ui_icon_pause,ui_icon_stats,ui_icon_speed,ui_icon_refresh_ad \
  --out ../切图/图标 --copy D:/AI/S4Game/KingdomWatch/assets/resources/ux --scale 0.5

# 3) 验证透明质量（可选，gpt-image-2-skill 自带）
gpt-image-2-skill --json transparent verify --input <文件.png> --profile icon --strict
```

## 五、第二批（人工美术）迭代指引 —— 换图三步，零代码

**任意分辨率均可，唯一硬要求：与旧图同比例（宽高比）。** 运行时（`ui/Ux.ts`）会按实际文件
尺寸自动换算九宫格 insets 与节点缩放，非九宫格图自动等比缩放——分辨率不再敏感。

1. **替换**：人工图按「二、命名规则」命名，直接覆盖 `切图/对应类别/` 与
   `KingdomWatch/assets/resources/ux/` 的同名文件。图标/头像/星星等非九宫格图到此结束。
2. **九宫格图跑一次合成**（面板/按钮/页签/横幅/血条轨道）：
   `python tools/compose_9slice.py` —— 端头等比缩放保圆弧、中段拉伸补宽度，
   新素材在 `COMPOSE` 表加一行（源文件名 + 目标 2× 渲染尺寸 + 端头宽/边框厚）即可。
3. **构建发布**：Cocos 构建 → `tools/patch-web-dpr.py` → 部署。

其余要点：
- 生图返回 RGB 无透明通道时（看 manifest 的 mode），先 `python tools/alpha_key.py <文件>` 再切片。
- 人工图也是批量大图时复用 `art_slice.py`（`--cols/--rows/--names` 照配置）。
- prompt 与基准图留在 `tools/batch*.json` 与 `基准/`，AI 补缺失项时保持同风格。
- 每批次原图+manifest.json 归档 `原图/批次N_日期/`，可追溯。
- **九宫格出图规范**（给美术的要求）：装饰只放四角，边中点与中心完全平坦；
  长条类（血条/胶囊）端头圆弧半径 = 半高，中心无任何花纹。

## 六、清单对应

A1 通用组件 18 类 / A2 通用图标 14 枚见 `UX/wireframe.html` 底部 MANIFEST；A3（ui_dim_mask、ui_ring_charge、ui_skill_cd_mask、fx_range、ui_aim_line、ui_shield_cap、ui_legend）为程序绘制，无需美术产出。
