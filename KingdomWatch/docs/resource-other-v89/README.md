# 其他资源继续瘦身v89

2026-10-24，用户在v88后要求“继续其他资源”。本轮只做确定未使用音效的可恢复归档，以及像素完全相同的更强无损编码，不再提高有损压缩比例。

试玩：https://enjoylura.github.io/kingdom-watch-play/?v=resource-other-v89

| 完整运行包，含版本指针及清单 | 字节 | 十进制MB |
| --- | ---: | ---: |
| v88 | 177,952,789 | 177.95 |
| v89 | 168,009,942 | 168.01 |
| 本轮减少 | 9,942,847 | 9.94，5.59% |
| 距200MB预算 | 31,990,058 | 31.99 |

实际1492文件。大小不包括开发工程、Git历史和本地母稿，也不表示首次访问下载量或内存峰值。

## 音频清理

原290份音频包含286个WAV和4首MP3，多轮替换后尚有旧录音进入resources包。新增 `tools/audit-audio-catalog.cjs` 只解析TypeScript AST，不导入或执行游戏/音频代码：解析64类完整音效声明、版本拼接辅助函数、三个死亡音轮换、16章背景音乐和其他显式引用。

保留全部声明过的76份音效和4首音乐，包括目前静音或映射共用音效的原声明，未仅凭当前静音策略删除。其余210份WAV和对应meta共420文件、8,682,856字节移到忽略的 `D:/AI/S4Game/.local-art-archive/audio-v89/`，没有删除录音。扫描序列化UUID关系，保留直接引用；剩余193份文本没有归档音频UUID，存活1454份assets全部与开始时一致。

正式包WAV从13,831,190降到5,197,006字节，减少8,634,184字节；MP3仍8,383,596字节。80份保留音频与v88和源文件逐字节一致，没有重编码、降采样、改变声道、位深、时长、音量或起播偏移，三份24位大招原录音保持。许可证、制作记录与credits保持。

`build-web.ps1` 现于构建前检查所有声明音频及meta；缺文件或遇到新动态路径/辅助函数会中止并要求更新静态检查。未来要重新采用某个已归档录音，应先恢复对应文件。

归档与恢复命令，均逐绝对路径/链接/完整SHA预检后再移动，不执行递归删除：

```powershell
./tools/archive-unused-audio.ps1
./tools/archive-unused-audio.ps1 -Restore
```

`retirement-plan.json` 是本次确切420文件清单，`source-before.json` 为开始快照，`source-verification.json` 为剩余和归档原字节核对。未来修改目录后不直接覆盖旧计划，另建新版本归档计划。

## 图片、JPEG与字体

237张受保护无损WebP加入method4和method6候选比较，按至少256字节净收益选择：196张更小，合计节省1,195,182字节，全部RGBA/Alpha/ICC及尺寸保持。原Q95的159张文件完全相同，不再叠加有损转换；其他41张无损、1极小PNG和12张JPEG保持原字节。源PNG、九宫格、图标、特效、头像、动画帧清单全部保持。

method6只增加离线编码时间，浏览器继续使用同种WebP解码；编码缓存仍由源SHA/参数/Pillow-libwebp版本区分。正式逐图像素核对，保留旧method4结果作为较小候选，不把新参数强加到每张图。

12张JPEG共4,883,791字节，实测转无损WebP均更大，因此不采用。5套字体共1,111,708字节，项目原管线已做中文字形子集和静态字重，不继续裁字或移除字体，以免省小体积带来缺字或字形变化。此两项结果见 `jpeg-font-audit.json`。本轮未重编码背景音乐；后续若考虑低码率，需单独听感选择，不能称为无损优化。

## 发布与校验

```powershell
./tools/publish-github-pages.ps1 -PrunePreviousRelease -ProxyUrl http://127.0.0.1:7897
```

原混合模式200MB完整包/保留前版总量阻断、显式无损/PNG回退和独立GitHub发布保留。Prune只处理独立发布仓库旧版独有的已跟踪运行文件，Git历史与本地原稿不变，不触发CF。

Creator3.8.8构建18641ms、退出36，DPR/原图尺寸审计/缓存完成。原有10类型诊断保持；Python、PowerShell和Node脚本语法与diff检查通过。`audit_export.py` 对真实输出核对所有1492文件散列、子路径、396图片、native/import/config版本及WASM头：所有图片与v88解码RGBA相同、80音频相同、归档210音频未导出、298条native文件原字节保持，游戏主脚本与v88一致。

`export-report.json`、`package-static-verification.json`、`build-record.json`、`lossless-measurement.json` 记录明细，版本 `a12f91617e43bb0c`。Pages已built，独立运行提交 `17addabdaad6000af5b7e022dc7e8f5a7aac64be`，18线上样本（含WAV大小样本）SHA、gzip解码、WebP MIME及固定根入口/条件重访通过；未全量重复下载CDN。详见 `deployment.json` 和 `publication-directory.json`。未启动游戏/浏览器/战斗模拟/测试/性能基准/音频播放/WASM，手机实际体验仍由用户试玩，不将静态检查当作视觉和听感认可。
