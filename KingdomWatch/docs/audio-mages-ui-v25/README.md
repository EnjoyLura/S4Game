# 法师声音重做与完整点击反馈 v25

用户 2026-10-17 实际试听反馈：火法师、雷法师、冰法师全部声音刺耳、嘈杂；弓箭手与重弩手很好。明确要求商品图标、章节和英雄左右箭头、导航、页签与空白游戏画面都有点击声，复用原按钮样本；进入关卡的关门动画需要声音。

## 改动

- 火、雷、冰共 18 条新音频：各自 3 个普攻变体、重击、技能和大招。火焰用短气流与低频焰流；雷电用圆润的鼓/雷主体及极轻电流边缘；冰霜用中音区实录竖琴与轻气流。移除原本明显的打火脆响、电流爆裂叠层、碎冰与钟琴高频。本次重新从原录音制作，没有把旧混音仅改名。
- 新素材减少层数，普攻 0.20–0.27 秒，重击 0.32–0.38 秒，技能 0.42–0.48 秒，大招 0.58–0.68 秒。较缓起音、短尾、低中频为主，源文件活动段电平较 v24 全部降低，游戏主音量和背景音乐保持。
- 弓箭手与重弩手已获用户认可：普通攻击、技能、大招、重击，以及既有按钮点击的 13 个生产音频文件与对应配置逐项保持；所有既有 WAV/MP3/元数据散列保持。
- `uiSelect` / `uiOpen` / `uiClose` 从静音改为共用原 `ui`。商品图标、页签、导航、英雄左右切换等既有语义按钮恢复点击，不换点击样本。
- `TouchFeedback` 为短点按补齐声音，包括没有独立声音的组件和空白画面。沿用 canvas 命中与 DOM/引擎重复手势去重；移动超过原阈值、取消、长按 >=450 ms、隐藏、销毁与门动画遮罩不补音。32 ms 延后让 Cocos 先处理实际动作；已有按钮/选择/结果音优先，同次点按不补第二声。仍受音效开关、手势解锁与混音限频控制。
- 关门分为 0.18 秒滑动与 0.43 秒合拢声音：开始动画触发滑动，门真正闭合时触发落点，包括减少动态的较短动画；不用定时器猜测闭合。门声音独立 1 声部，合拢尾音可跨门后的换场景，后台和关闭音效仍会停止。返回关卡页的同款门动画也复用。

保持原伤害、英雄动作、界面图片与布局、存档、交易、背景音乐、主音量和 8 声部总预算。普通命中、普通死亡、数字装饰等原静音规则继续保留。

## 来源

沿用已有可商用原始录音及许可：Varazuvi / Soundopolis / Mechanical Wave / Robert Cordova（Sonniss GameAudioGDC EULA v2.0），rubberduck 与 VSCO 2 CE（CC0）。新增木门原始录音为 Coll Anderson — House / `EFX INT HOUSE DOOR Bedroom Wood O_C Close Medium 01.wav`，从已有官方 2015 下载清单的镜像获取并核对 ZIP 成员 CRC32/长度。

[Sonniss 官方免费发行](https://sonniss.com/gameaudiogdc/) · [许可](https://sonniss.com/gdc-bundle-license/) · [VSCO 2 CE](https://github.com/sgossner/VSCO-2-CE)。原始来源、散列、片段起点、滤波、增益、音符、包络见 `used-sources.json`、`gate-source.json` 与 `manifest.json`。新的作者署名加入资源 CREDITS 和设置中的鸣谢页。公开试听是同步画面的项目成片，不公开 Sonniss 独立音效包。

## 检查与交付

`source-inspection.json` 核对仅 5 个运行脚本发生本轮预期变化，旧素材与其余脚本保持；全工程既有 10 个类型诊断保持，无新增。18 条法师文件活动段电平和 3.5 kHz 以上相对能量均低于对应 v24，20 条新音频无削波。信号指标不代表已听辨或听感认可。

生产包的 20 个新 WAV 资源路径、UUID 与散列一致，13 个获认可 / 沿用的武器与点击文件保持；4 个单项与 1 个整组分镜 AAC 离线解码没有削波。没有运行测试、游戏、浏览器、交互模拟或音频播放，实际听感及点按体验由用户人工确认。

Creator 3.8.8 / web-mobile / production / MD5，退出码 36，构建 18906 ms；DPR 与缓存准备完成。发布使用现有 Wrangler `kingdom-watch` / `main`，历史试听目录逐文件保留。发布记录在 `deployment-stage.json` 与 `publish.log`。

[正式游戏](https://kingdom-watch.pages.dev/?v=audio-mages-ui-v25) · [三法师与关门分组试听](https://kingdom-watch.pages.dev/previews/audio-mages-ui-v25/)。新声音是否符合预期仍待用户试听，不把 v24 武器的认可扩展到本次法师重做。

## 发布结果

Wrangler 已完成 `kingdom-watch` / `main` 部署，日志为 `Deployment complete`，部署快照为 [https://a8a9b018.kingdom-watch.pages.dev](https://a8a9b018.kingdom-watch.pages.dev)。本次上传 61 个文件，2,430 个文件已在线上，合计 2,491 个对象；入口为 `index.3e4e1.js?v=1792233165`。正式游戏与分组试听地址同上方链接，752 个历史预览文件逐一保留。

静态 HTTP 核对正式入口与分组试听均返回 200，正式首页引用上述入口，试听页包含 v25 标识；检查只用 curl 读取 HTML，没有加载脚本、启动浏览器或播放音频。发布日志与机器可读状态分别保存在 `publish.log` 和 `deployment-stage.json`。没有运行游戏、浏览器、交互模拟或音频播放，实际听感与点按体验仍待用户人工确认。
