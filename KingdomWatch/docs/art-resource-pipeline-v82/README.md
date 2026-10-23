# 自动美术资源管线 v82

2026-10-23，第一阶段：无损编码、资源版本校验、预算、尺寸/留白审计与本地画质候选。

本轮基于已上线的四怪视频 v81（版本 c9165776302aea5c），保留其四个脚本与新增怪物图集。所有1860份源 assets 与开始时逐文件 SHA256 完全一致，游戏主包 `assets/main/index.4658a.js` 与 v81 字节一致。

| 项目 | v81 | v82 |
| --- | ---: | ---: |
| 完整运行资源 | 457,785,194字节 / 457.79MB | 351,459,226字节 / 351.46MB / 335.18MiB |
| PNG | 394张 / 424,441,316字节 | 1张 / 78字节 |
| 无损WebP | 0 | 393张 / 317,912,958字节 |

图像编码节省106,528,280字节；计入校验清单和能力探测等新增文件，运行资源净减少106,325,968字节（23.23%）。剩余78字节PNG比WebP小，保留原文件。没有缩小尺寸、改变RGBA像素/透明通道、删帧、改变时长/脚底/取样矩形或修改玩法；音频、字体、JPG等307份其他native字节保持。

## 使用

在项目目录执行正常发布命令，已默认接入无损导出：

```powershell
./tools/publish-github-pages.ps1 -PrunePreviousRelease -ProxyUrl http://127.0.0.1:7897
```

`-PrunePreviousRelease` 是本次只保留当前运行包的显式选择，防止旧PNG仍占发布目录；日常默认仍保留上一版所需文件，具体见发布说明。独立仓库的Git历史保留。

仅导出、验证现有生产构建，不上传：

```powershell
./tools/publish-github-pages.ps1 -ValidateOnly
```

PNG兼容构建/回退：

```powershell
./tools/publish-github-pages.ps1 -TextureMode original-png -PrunePreviousRelease -ProxyUrl http://127.0.0.1:7897
```

现代浏览器的默认包只发布每张图片选定的一种格式，避免同时携带全部PNG和WebP。入口在加载引擎前解码2像素、带透明通道的VP8L样本；不支持的浏览器会看到明确升级/系统浏览器提示，保留原有重试入口，无刷新循环。PNG模式不要求WebP，已静态确认394张原PNG字节一致。它是可重新部署的兼容版本，不是同时在线的自动PNG回退站点。

## 实现与检查

- `tools/art-resource-policy.json` 集中设置编码、并发、收益阈值和预算。当前完整包上限500,000,000字节，单图文件上限64MiB，纹理单边上限8192；32MiB基础纹理及1024以上方形图生成审查提示。预算是本项目起始值，可随内容规划调整。
- `build-web.ps1` 每次构建额外生成 `build/art-source-audit.json`，列出PNG体积、尺寸、基础RGBA8纹理估算、透明范围、重复和帧矩形留白。Cocos原导出继续保留PNG。
- `tools/art_resources.py` 只处理独立的GitHub导出副本。Pillow12.3.0 / libwebp1.6.0，lossless、exact、quality100、method4；每张解码为RGBA核对所有字节，ICC一致，只有至少节省256字节时才采用。
- 遇到16位/动画PNG或特殊颜色解释时保留PNG；遇到不认识的Cocos序列化结构、不能解析的原生地址或像素/哈希不符时中止导出，不静默漏传。
- 按本机Creator3.8.8 `ImageAsset._serialize/_deserialize` 的定义，PNG的fmt0改为WebP的fmt4；UUID、SpriteFrame元数据及游戏加载ID不变。native文件、ImageAsset import、bundle config/index、settings和启动依赖逐级更新内容版本，不仅改文件后缀。所有JS字节在美术变换步骤前后完全一致。
- 编码缓存放在忽略的 `build/art-resource-cache`，键包含原文件SHA、编码参数、Pillow/libwebp版本；缓存命中也重新解码检查RGBA。相同源内容只编码一次。
- 运行包携带内容寻址的 `art-resources.*.json`。发布前重新解析406份ImageAsset与真实native URL，逐份检查393张WebP的RGBA、尺寸、文件SHA和import/config版本；随后原发布器再核对所有1900文件、子路径、入口与WASM头。没有运行引擎、浏览器、战斗、音频或WASM。
- 正式构建Creator3.8.8成功，19591ms、退出码36；DPR及缓存准备通过。自动HTTP检查新增最小和最大WebP样本，核对网络字节与清单。最终部署信息见 `deployment.json`。

本轮未改源图、角色帧清单、运行时资源释放逻辑和Asset Bundle组织。编码减小下载量，基础纹理尺寸保持，不能把351MB运行包当成内存峰值或首次下载量。

## 接下来的画质与内存优化

完整数据见 `source-size-audit.json`；下一阶段边界与具体依据见 [后续处理](next-steps.md)。四份静态Q90候选仅放在本地 `D:/AI/S4Game/.local-art-archive/art-resource-v82-comparisons/index.html`，可以查看原图/候选、100%像素与透明背景。正式游戏继续使用无损版本。

依据：[Cocos纹理导出配置](https://docs.cocos.com/creator/3.8/manual/en/asset/compress-texture.html)、[图集裁边与批次](https://docs.cocos.com/creator/3.8/manual/en/asset/atlas.html)。精确格式号和版本地址以本机3.8.8引擎源码核对，不改引擎实现。
