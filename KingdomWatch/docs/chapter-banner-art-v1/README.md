# 章节标题背板美术资源 v1

删除左上角卷轴图标与“远征地图”文字，保留连续路线地图及资源栏。使用内置 imagegen，按用户效果图制作独立的透明深蓝金边章节牌匾；章节名、真实进度和箭头仍由游戏代码绘制。

生成提示词见 `banner-prompt.txt`。源图原样复制到版本化资源目录，保留透明像素；仅进行本地图片、源码、类型诊断和构建产物审阅，不启动游戏、浏览器、模拟或测试。实际手机视觉效果由用户人工确认。

- 正式素材：`assets/resources/ux/campaign_chrome_v1/chapter_banner_v1.png`，2098×749 RGBA，780,446字节。
- 导入区域：`(16,216,2068,298)`；以 `Sprite.trim=true` 显示有效牌匾，完整PNG未作像素编辑。
- 章节栏694×100，透明图片置于动态文字/箭头下方，资源加载后隐藏程序兜底。节点名称签继续使用原组件。
- 本次只调整 `LevelsPage.ts` 和 `CampaignChrome.ts`；路线、底部按钮、准备抽屉和其他原脚本散列保持。
- Cocos构建完成；静态类型诊断与上一版相同，改动文件无诊断。全项目仍有原先10项主诊断，不记为完整类型检查通过。

已发布：[正式游戏](https://kingdom-watch.pages.dev/?v=chapter-banner-art-v1-1792171089) · [部署快照](https://8c4c000e.kingdom-watch.pages.dev)。Cocos 18428ms。
