# Blender 金色雷枪接入 v142

用户于 2026-10-27 明确要求将试作雷枪接入普攻、技能与大招。此前“独立预览、不接入与发布”的限制在本次接入范围内由该指示取代。沿用 v2 的枪体、电丝与爆发；手机实战视觉验收由用户完成。

## 游戏表现

- 普攻：Blender 长尖晶状雷枪与活动电丝，沿 v141 弹道投出，命中后沿末切线贯地，地表余电与小型闪爆；插地枪仍参与技能回收。
- 技能：回收与枪雨共用同款枪体，逐柄下落、错峰触地，保留原数量、范围、伤害、延迟与回收时间。
- 大招：放大枪体、85ms 贯地与轻微回稳、雷暴云团/枝状爆发/碎石、密集持续地电与分段向外游离的电丝波；每次原有伤害脉冲触发波形。
- `ThunderLanceHero.ts`、`ThunderLancePlans.ts`、`ThunderLanceConfig.ts` 与 v2 接入前提交 `4697dd22` 字节一致。只改变视觉层和对应入场预加载，不改变英雄面板、伤害、目标、范围或时钟。

## 资源与渲染

从 `../lance-blender-study-v2/golden-thunder-lance.blend` 分离四层，固定画布、固定接触锚点、逐帧直通 RGBA，烘焙柔光后采用标准 `SRC_ALPHA / ONE_MINUS_SRC_ALPHA`。保留透明边缘与每格 2px 外侧间隔，不逐帧自动裁边。

| 图集 | 帧数/帧率 | 单格 | 内容 |
| --- | --- | --- | --- |
| body | 48 / 24 | 192×512 | 不对称尖刃、热芯、外层多股缠绕电丝 |
| impact | 24 / 30 | 384×384 | 破碎雷暴云、电弧冠、火花碎石，尾帧透明 |
| wave | 28 / 30 | 384×256 | 26 股分叉地电主路与不规则游离外缘，尾帧透明 |
| ground | 40 / 24 | 384×256 | 地电、分支、裂纹与接触凹坑循环 |

正式资源为 `assets/resources/fx/thunder_lance_{body,impact,wave,ground}_v142.*`。四张 PNG 约 5.7MiB，纹理原始 RGBA 约 58.5MiB；发布沿用特效无损编码。源 Blender 与制作视频留在 docs，不进入游戏运行包。

`ThunderLanceAtlas.ts` 共享纹理与派生帧，装备雷枪时纳入现有入场等待。固定池：飞行 32、插地/回收 52、爆发 20、地面层 64；每次攻击/地面效果固定加载结果，失败时沿用原程序特效，避免中途切换。埋入枪尖通过预建裁切帧截除，无逐帧建节点或临时纹理。源图锚定真正针尖，飞行到接触不跳位。动画只读取已有战斗 age，暂停、减速和加速沿用游戏模拟；清场后隐藏池内 Sprite，销毁时解除实例引用，共享资源按现有 UX 生命周期复用。

## 可重复制作与检查

```powershell
& 'D:/program/Blender 5.2/blender.exe' --background '../lance-blender-study-v2/golden-thunder-lance.blend' --python export_layers.py
python pack_layers.py
node verify_cosmetics.cjs
python render_review.py
node audit_types.cjs
```

`atlas-audit.json` 记录纹理尺寸、透明像素与 SHA256。`verify_cosmetics.cjs` 仅隔离执行实际视觉类和纯弹道，检查容量上限、贯地裁切、结束清理、普通/巨型资源调用和战斗文件不变。类型比较原 9 条、当前 9 条，无新增。

`ultimate-placement.mp4`、`contact-sheet.jpg` 来自真实渲染调用的离屏合成：静态森林、静态怪物、正式纹理及标准混合，不运行游戏、浏览器、真实战斗、音频或 WASM；图片未包含旧代码绘制的土沿和连锁电弧。此记录不等同于用户实战认可。

实现本地提交 `8a77749a`。Cocos Creator 3.8.8 正式构建 18484ms、退出 36，DPR 修补与资源审计通过；导出版本 `dce6e27300eb9987`，1647 文件、214498961 字节。524 个既有 native 资源原字节保持，新增 4 张无损图集，全部 RGBA 与源图逐像素相同；图集/帧清单注册、透明边缘、15 份 JS 与 5 段内联脚本语法检查通过。回执见 `build-record.json`、`package-static-verification.json` 与 `changed-runtime-files.json`。

已发布：[v142 游戏入口](https://enjoylura.github.io/kingdom-watch-play/?v=lance-blender-live-v142)。运行仓库提交 `60f9a5fd48637790b204fd893f4e9e2ff06ce655`，Pages 与构建状态均为 built，线上版本为 `dce6e27300eb9987`。标准发布验证及额外 9 个文件（四张图集、四个图像导入描述、主脚本）HTTP 200 与 SHA256 全部一致；回执 `deployment.json`、`additional-http-verification.json`。

首次直连 GitHub TLS 超时后，使用本机已运行的 `127.0.0.1:7897` 代理完成发布，未改系统设置。发布期间源码 HEAD `a1f39067` 与索引保持不变；仅推送独立运行仓库，不推送源码、不部署 Cloudflare。游戏/浏览器/战斗/音频/WASM 均未启动，手机实际观感和手感由用户验收。
