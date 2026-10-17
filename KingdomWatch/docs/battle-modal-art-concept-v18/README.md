# 战斗弹窗效果图与动效设计

内置 image_gen 制作暂停、胜利、失败三张效果图，最终提示词在 [prompts.json](prompts.json)，来源和散列在 [asset-manifest.json](asset-manifest.json)。生成原图完整复制，无像素编辑。

- [暂停效果图](pause-v18.png)
- [胜利效果图](victory-v18.png)
- [失败效果图](defeat-v18.png)
- [美术图与可重播动效预览](index.html)
- [动效时序和十项落地清单](motion-spec.md)

预览采用原有独立皇冠、场景、星星、物品和声音文件的完整复制，HTML/CSS分层呈现；不是视频裁切，也不读游戏存档或发奖励。支持三态切换、效果图/动效切换、重播、暂停、拖动时间轴、减少动态、手动开启音效。声音为现有采样，未重新制作。美术静态效果图与动效分层预览的实现媒介不同，动效页专用于审阅节奏。

仅离线读取用户参考录屏并抽帧审阅。没有运行游戏、浏览器、动效预览、测试、模拟或音效试听；预览仅做语法与文件引用静态审阅，真实观感待用户人工确认。正式战斗弹窗未替换；当前正式游戏只单独更新 Toast 中部上移轨迹。

已发布：[正式游戏](https://kingdom-watch.pages.dev/?v=toast-middle-rise-v18-1792217049) · [效果图与动效方案](https://kingdom-watch.pages.dev/previews/battle-modal-v18/) · [部署快照](https://5da001f8.kingdom-watch.pages.dev)。构建18071ms；观感与交互待用户人工确认。
