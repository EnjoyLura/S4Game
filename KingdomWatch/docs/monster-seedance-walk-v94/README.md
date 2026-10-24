# 三怪行走序列帧 · 用户 Seedance 视频 v94

2026-10-24，按用户要求使用 `C:/Users/user/Downloads/游戏怪物行走视频生成.mp4`，替换第一章小兵、盾兵、萨满的行走。用户说明源视频来自 Seedance 2.0 fast。本次仅处理用户提供的成片，没有调用任何视频/图片生成服务。

源文件720×720、24fps、97帧，容器时长4.06秒、638135字节；SHA256：`2f196554f5eaf202564e054fbbfff0f5f3a466f48b2b2ec3cbbf5ef8d55be5e8`。完整字节副本在 `source/user-seedance-720.mp4`。

已发布试玩：[GitHub Pages 游戏](https://enjoylura.github.io/kingdom-watch-play/?v=monster-seedance-v94)。版本 `855e43fb67acad3d`，独立运行仓库提交 `e5a17f259e0a68158a6994efbe322e85359b391d`。

## 选帧

前1.8秒排除，首个允许索引是44（1.833秒）；仅在之后寻找完整连续步态。下面源索引从0开始，区间包含两端：

| 怪物 | 游戏ID | 源帧 | 首末时间 | 帧数 | 原速周期 | 现有半速下周期 |
|---|---|---|---|---:|---:|---:|
| 小兵 | goblin_worker | 65–90 | 2.708–3.750秒 | 26 | 1.083秒 | 2.167秒 |
| 萨满 | goblin_shaman | 53–79 | 2.208–3.292秒 | 27 | 1.125秒 | 2.250秒 |
| 盾兵 | goblin_brute | 59–86 | 2.458–3.583秒 | 28 | 1.167秒 | 2.333秒 |

边界按姿态、下半身与运动方向共同比较，并查看 `loop-seams.jpg`；各区间下一源帧91/80/87仅作相位参考，不重复添加到末尾。末帧接首帧的特征差约为片内相邻变化中位数的1.009/1.080/1.076倍，仅供选段辅助，不能等同视觉认可或完美无缝。原视频的轻微造型/位置变化依然存在。

去除浅色背景，按完整连通角色分离，排除右下狼骑、字幕和水印。每只怪物以选段全部帧的联合边界决定一次固定裁剪、比例和位置，参照旧角色可见高度放入320×320画布，四边至少12像素透明。保留完整原画，未拆肢体、额外摆动、逐帧重估比例/居中、插帧、倒放或透明混合。来源720p意味着细节较软，导出画布不增加真实细节。

## 游戏接入

新图集 `assets/resources/ux/chapter1_mob_walk_v94.png`，3240×2916，共81帧；配套 `.frames.json` 保存周期、参考移速、固定地面/逐帧足底与头部位置及Cocos元数据。

只修改 `MobAnim.ts` 的三怪图集选择、`ChapterContent.ts` 的同套战斗静态/图鉴形象、`BattleEntryWarmup.ts` 的新图集预热。旧v81图集保留，狼骑兵仍使用原图集和原循环；第一章所有既有0.5倍播放设置、实际移速/攻速、体型、技能、波次与奖励保持。深林及其他怪物素材保持。没有新攻击源片，三怪驻足时沿用同套首帧，避免切回旧形象。

## 查看与静态核对

- `preview.html`：独立GIF、源视频、首尾对照，不运行游戏。
- `goblin_worker.gif` / `goblin_shaman.gif` / `goblin_brute.gif`：游戏现有半速节奏，仅预览GIF使用10ms计时近似；运行时保持精确周期。
- `frames/`：81张透明PNG；`cutouts/`：1.8秒之后各帧的角色原像素；`cycle-samples.jpg` / `loop-seams.jpg`：人工审阅用静态图。
- `analyze_video.py` / `bake_video.py`：重复制作入口；`source-info.json` / `loop-candidates.json` / `bake-report.json`：原视频、选段与统一变换记录。
- `static-asset-audit.json`：81帧均与相应源图经唯一固定变换逐RGBA一致、全部在1.8秒后、至少12像素边距；1454原assets仅3个TS修改，新增PNG/JSON及两份meta，其余1451文件包括旧狼骑图集/清单字节保持。
- `typecheck-comparison.json`：改动前后9条既有TypeScript诊断一致，没有新增；仅编译检查，不执行游戏模块。

生产构建完成，Creator 3.8.8退出36、19953ms，DPR、原图/音频审计与版本缓存准备完成。运行包1497文件、170,691,707字节（170.69MB），原有494份native媒体/字体逐字节保持。沿用用户此前选定的mixed-webp-q95发布策略，新图集发布为2,649,284字节WebP；尺寸、Alpha和动画时序保持，RGB为有损编码，PNG母稿保持。

发布命令：

```powershell
./tools/publish-github-pages.ps1 -PreparedPackage build/github-pages-monster-seedance-v94 -ProxyUrl http://127.0.0.1:7897 -WaitSeconds 60
```

只发布独立GitHub运行仓库，既有Cloudflare保持；不提交源工程。本次保留上一个运行包的旧版文件，未使用Prune。未启动游戏、浏览器、战斗模拟、音频或WASM，实际观感由用户手机试玩确认。部署与线上静态核对完成后记录在 `deployment.json` / `new-atlas-hosting.json`。

Pages 已 built；19个标准线上HTTP样本通过，新增PNG对应的WebP及3份导入JSON另外逐SHA/大小核对通过，WebP MIME正确。发布期间源HEAD与暂存区保持，不将上传或静态检查当作用户对动作/清晰度的认可。

本地怪物图鉴已重新同步，15套动作共366帧，五张图集；Q01和实际使用区的小兵/萨满/盾兵播放新v94，狼骑仍v81，四宫格原始PNG不替换。
