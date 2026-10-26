# 风眼折中透视接入 v133

用户确认 [v131 离屏演示](../eye-mid-projection-preview-v131/README.md) 后，将相同参数接入正式游戏：技能风眼纵向比例从 58% 提到 80%，中心下移从 18 改为 9。只修改 `wind_eye_video_v129.frames.json` 两个显示参数；沿用原图集、48 格帧序、两倍转速、宽度、透明度与怪物下层绘制。龙卷风、伤害、范围、聚怪与持续时间保持。

现有 `WindVideoVFX.ts` 直接读取清单计算 Sprite 高度和位置，无需另一套表现代码或新增资源。对比用户认可的预览来源，原图集 SHA 相同，运行清单参数完全对应中间档。

使用现有 `tools/build-web.ps1` 构建，导出至 `build/github-pages-wind-eye-mid-v133`，逐文件散列/子路径/图片解码/WASM 头静态检查，并检查编译后风眼清单与源一致、其他 native 媒体保持。只发布独立 GitHub Pages 运行仓库，不推源码、不部署 Cloudflare；不启动游戏、浏览器、战斗、音频或 WASM。构建与线上回执完成后补齐。
