# 200MB混合编码试用版v88

2026-10-24。用户授权“先git推送远程，然后试试你的方案”。先将当前完整源码、已采用游戏资源和文本制作记录推送 `EnjoyLura/S4Game` 的main，备份提交 `eaf6599050d24b799b44f96e73f51ef143eae395`，远程HEAD一致后才修改导出管线。忽略的原稿、视频、日志和缓存保留本地。

试玩入口：https://enjoylura.github.io/kingdom-watch-play/?v=art-mixed-v88

| 完整当前运行包，含版本指针和清单 | 字节 | MB，十进制 |
| --- | ---: | ---: |
| v87无损基准 | 373,735,451 | 373.74 |
| v88混合编码 | 177,952,789 | 177.95 |
| 减少 | 195,782,662 | 195.78，52.39% |
| 距200MB上限 | 22,047,211 | 22.05 |

这不是首次下载量或内存占用，也不包含源码、制作母稿、Git历史。全部16章当前已接入资源均计入运行包。纹理尺寸保持，解码后的基础纹理内存不会随文件压缩同比下降。

## 编码规则与边界

- 默认模式 `mixed-webp-q95`：159张适合的大幅场景、插画和动画图集采用WebP Q95 RGB编码；237张继续逐RGBA一致的无损WebP，1张78字节PNG保持。现有JPG保持原字节。
- 保护comic界面和装备、九宫格、UI边框和按钮、头像、图标、最大边不超过512的小图、原fx特效和未知来源。分类使用源UUID和真实资源路径，不根据发布UUID文件名猜测。后续未知分类自动保留无损，不为满足预算自动降低质量。
- Q95有RGB损失，不宣称像素无损。所有转换保持宽高、逐字节Alpha和ICC；不缩图、不删帧、不改动画时序、UV矩形、锚点或游戏数值。保护图全RGBA与源图一致。原PNG母稿保持，可按图改回无损或整包回退。
- 同时比较PNG、无损WebP和允许使用的Q95，只采用至少节省256字节的较小候选，不发布双份图片。2编码并发，缓存键包含原SHA、编码参数和Pillow/libwebp版本；命中也重新解码核对。缓存写入用独立临时名防并发冲突。
- 继续更新ImageAsset fmt、native/import/config/bundle/settings的内容版本。编码步骤前后全部JS字节一致；最终游戏主包与v87一致。发布链接扫描区分源路径记录与真实native下载地址，源图不会因记录了路径而被误传。

## 可重复发布与回退

在项目目录执行，包含正式构建、编码、完整包预算、资源/散列检查、独立运行仓库提交推送、Pages状态和HTTP校验：

```powershell
./tools/publish-github-pages.ps1 -PrunePreviousRelease -ProxyUrl http://127.0.0.1:7897
```

当前包连同版本指针和清单严格不超过200,000,000字节；发布器也检查保留上一版后的站点总量，超限提示显式Prune，不暗中删除或降低质量。Prune只清理独立发布目录中旧版独有的已跟踪运行文件；母稿与Git历史保留。源项目不由发布器提交，CF不触发。

需要回退整个编码方式时重新发布，显式回退版本保留500MB预算：

```powershell
./tools/publish-github-pages.ps1 -TextureMode lossless-webp -PrunePreviousRelease -ProxyUrl http://127.0.0.1:7897
./tools/publish-github-pages.ps1 -TextureMode original-png -PrunePreviousRelease -ProxyUrl http://127.0.0.1:7897
```

## 校验记录

- Creator3.8.8生产构建21738ms、退出码36，DPR、原图尺寸审计与缓存准备成功。源PNG合计454,534,081字节/397张，说明母稿本身确实较大，但不需要通过删除或缩小母稿来实现下载包177.95MB。
- `audit_export.py` 检查真实导出：1874份源文件全部保持、主包与v87相同、545条非Q95原生资源路径及字节保持，只替换159张Q95图；396张转换图片的输出像素/文件SHA、宽高、Alpha与ICC及Cocos版本关系通过。
- `package-static-verification.json` 包含1912文件完整散列与子路径、WASM头检查结果；未编译或实例化WASM。`source-before.json`、`baseline-package.json`、`build-record.json`、`export-report.json` 保存基准与结果。
- Python和PowerShell语法检查通过，`git diff --check`通过。类型检查仍为原有10条诊断，本轮没有修改任何TS或美术源文件。
- 第一份本地导出被链接扫描器将源路径误认下载链接拦截，未上传；修正扫描后重新生成独立r2包，全量检查通过。正式包为 `build/github-pages-art-mixed-v88-r2`，版本 `12ec0530039779bc`。
- Pages已built，独立运行提交 `9be20ec2e93bc9e4bda96ad02677903a80efc1b1`、版本 `12ec0530039779bc`；完整1912文件在本地/发布Git清单中核对，线上16样本（含无损/Q95各大小样本）SHA、gzip解码和WebP MIME通过，固定根入口、指针一致性与条件重访304通过。详见 `deployment.json` 和 `publication-directory.json`；没有全量重复下载CDN。不启动游戏、浏览器、战斗模拟、性能基准、音频或测试脚本；实际画质、动画边缘和加载体验由用户手机试玩确认，静态通过不等于视觉认可。

本次磁盘满后，三份旧的可重建构建副本移到 `C:/Users/user/AppData/Local/Temp/kingdom-watch-generated-build-archive` 腾出空间，文件保留；Git自动维护遗留临时包未清理。之后用户自行为D盘腾出了空间，本轮未继续清理磁盘。
