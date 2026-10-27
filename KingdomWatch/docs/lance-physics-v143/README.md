# 雷枪轨迹、流动电芯与大范围雷暴 v143

2026-10-28，修复用户指出的正前投掷突然侧拐、黑色实体枪尖、静态实心枪身与爆炸过小；按追加要求，所有雷枪视觉放到怪物下面。当前手机观感仍由用户实测。

## 修改

普通/巨枪移除 v141–v142 的三次曲线和人为侧弯控制点，改为固定横向速度、固定向下加速度的投掷平面抛物线。位置和速度使用同一个解析式，发射速度由落点/飞行时间解出；伤害仍在同一条弹道到达目标时结算。竖直投掷保持同一 X，斜向投掷的 X 单调前进。枪身沿瞬时速度，低投影速度附近缩短长度，避免正竖直顶点的 atan2 奇点让整柄枪瞬间翻向侧面；这是二维显示处理，不宣称完整三维刚体空气动力仿真。落地沿末速度方向入土，继承长度投影与动画相位。

Blender 枪体删去全部实心网格、金属针尖和静态主芯，改为 32 股持续变形、粗细脉动的电流组成内部轮廓，尖端也是电流汇聚；保留外层缠绕电丝。中心电流采用 2 秒循环关键帧，不靠整柄平移或旋转假装内部流动。

落地雷暴横向形体扩大 2.15 倍，爆发实例按伤害半径 1.2 倍绘制；图集单帧从 384 提升到 512，重新固定取景留出边缘。地电和游离波取消原相机对地图纵向的压缩，与实际圆形伤害计算对应，游离波额外向外延伸 18%。爆发单独校准纵向覆盖。参数不扩大真实伤害或改变伤害数值。

`GroundFxLayer` 位于 `MobLayer` 下面。飞行专属根节点、材质备用渲染、Graphics 备用渲染、插地/回收、枪雨、地电、爆发、连锁电弧及雷枪通用蓄力均在该层。飞行独立根节点跟随弹道层销毁，地面/插地根节点跟随英雄销毁。其他英雄的图层不变。

## 验证

- `verify_trajectory.cjs`：336 个近远、左右、正竖直、下落案例，共 168336 采样。重现旧版正前投掷横向偏移 145.559px；当前为 0。检查固定横向速度、恒重力、精确终点、下降触地和顶点枪身投影连续。
- `verify_cosmetics.cjs`：隔离执行实际视觉类、实际飞行层初始化方法，确认所有雷枪 Sprite 和备用渲染层低于怪物，节点复用、场景销毁、结束清理正常。属性数值配置与 v142 原字节一致；英雄逻辑只传递落地视觉长度。
- `measure_coverage.py`：从实际渲染调用和正式纹理读取像素，在 72 个角向分段测量亮区外缘。接触后 0.25–0.40 秒，雷暴在全部方向越过 250 的真实伤害半径；0.30 秒最短外缘为半径的 1.058 倍，中位 1.46 倍。测量的是不规则亮区外缘，不表示每个像素都被不透明特效填满。48 帧核心区域均存在运动变化。
- `audit_types.cjs`：原 9 条诊断、当前 9 条，无新增。
- `contact-sheet.jpg`、`ultimate-placement.mp4`：真实绘制调用的静态场景离屏合成。`damage-coverage.jpg` 的青色虚线只是实际伤害边界检查标注，不出现在游戏里。

未启动游戏、浏览器、真实战斗、音频或 WASM。自动检查不代替用户手机视觉验收。

## 重现

```powershell
& 'D:/program/Blender 5.2/blender.exe' --background '../lance-blender-study-v2/golden-thunder-lance.blend' --python export_layers.py
python pack_layers.py
node verify_trajectory.cjs
node verify_cosmetics.cjs
python render_review.py
python measure_coverage.py
node audit_types.cjs
```

`revise_scene.py` 在 v2 源场景的内存副本上改造，`electric-lance-v143.blend` 保存新电芯循环和放大雷暴。正式图集沿用 `thunder_lance_*_v142` 的资源地址/UUID，内容随构建 hash 更新：替换 body/impact，ground/wave 图片复用并更新显示比例清单。此前制作与发布记录保留。

实现本地提交 `bdcf09c3`。Creator 3.8.8 正式构建 18468ms、退出36，DPR 修补和资源审计通过。导出版本 `ce62dacd2a195d01`，1647 文件、216088544 字节；526 个既有 native 文件原字节保持，仅 body/impact 两张图集被替换，四张雷枪图集均无损、与源 RGBA 逐像素一致。15 个 JS 与 5 段内联脚本语法检查通过，类型原9无新增。见 `build-record.json`、`package-static-verification.json`。

已发布：[v143 游戏入口](https://enjoylura.github.io/kingdom-watch-play/?v=lance-physics-v143)。运行提交 `e959ee0bad1fa889ea68d8370c63c91c13a898d2`，线上版本 `ce62dacd2a195d01`，Pages/build 均 built。标准验证与额外 9 文件（四图集、四图像导入、主脚本）HTTP200+SHA256 全部通过，见 `deployment.json`、`additional-http-verification.json`。发布时源码 HEAD `5d4d3d26` 与索引保持，只推独立运行仓库，不推源码、不部署 Cloudflare。手机实际视觉验收待用户。
