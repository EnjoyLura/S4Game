# 全套漫画奇幻音效 v24

2026-10-17 用户明确要求“完成所有游戏音效制作，《王国保卫战》的音效风格和质量”。本次授权替代此前只做三个代表、确认后再扩展的阶段限制。完成并接入全部 **31 个实际发声入口、44 条新制音频**，保留 v23 的 21 项静音与 9 项共用策略；没有把历史未认可候选标作用户已认可。

参考作品用于制作方向：有材质感、动作清楚、欧美漫画奇幻、短促有力、关键事件有性格。制作和发布不等同于达到参考作品品质；本次没有听辨能力，也未进行音频播放或实机听感验收，实际效果待用户试听。

## 覆盖

| 场景 | 新素材与处理 |
|---|---|
| 五英雄普通攻击 | 长弓、重弩、火、雷、冰各 3 个变化版本，共 15 条；0.19–0.32 秒 |
| 重击 / 暴击 | 贯穿、火焰、雷电、碎冰、暴击，共 5 条 |
| 技能与大招 | 箭矢技能、箭雨、重弩狙击（原技能与大招共用）、火雷冰技能与大招，共 9 条 |
| 战场反馈 | 精英 / 首领倒地 3 变体、防线受击、精英 / 首领警报、拾取，共 6 条 |
| 通用操作与卡牌 | 点击 2 变体、卡牌展开、卡牌选定，共 4 条 |
| 成长与结算 | 普通升级、阶段突破、共用收获、胜利、失败，共 5 条 |

点击 0.085 秒；普通成长 0.685 秒；收获 0.87 秒；突破 1.1 秒；胜利 1.98 秒；失败 1.27 秒。普通成长、选择、收获和胜利采用 D 大调的相近动机，失败用下行 D 小调木管。均从实录乐器音符重新编排，未采用旧候选成品，也没有合成振荡器提示音。

战斗文件单声道，关键界面乐句立体声。全部 44.1 kHz / 16 bit WAV，总计 2,545,772 字节。原 v1/v2/v21 音频及其元数据保留；背景音乐、主音量、混音器、触发规则、战斗数值、动作、美术和存档不变。

## 来源与可复现制作

- [Sonniss GameAudioGDC 官方免费发行](https://sonniss.com/gameaudiogdc/) 2015 bundle：Mechanical Wave、NoizBoy、Mattia Cellotto、Eiravaein Works、Soundopolis、Varazuvi、Robert Cordova。本次新增专业拟音素材由官方列出的镜像下载，逐成员核对长度与 CRC32，另保存 SHA-256。
- [Sonniss EULA v2.0](https://sonniss.com/gdc-bundle-license/) 于 2026-10-17 通过网页工具核对：允许在商业游戏及同步媒体项目中修改使用，不允许独立音效 / 素材包分发，不用于 AI 训练。原素材及本地制作母带留在工作项目，公开试听只提供同步游戏美术分镜的 MP4 成片。脚本请求许可证页面返回 HTTP 403，未绕过访问控制；官方网页工具可读取当前条款。
- [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE)，CC0 1.0，Versilian Studios / Sam Gossner 与贡献者。沿用已保存、锁定 revision `440300901dfe9275fd84e0b7763af1f8443ae62e` 的原录音与 LICENSE。
- Still North Media（Ben Jaszczak、Brian Nelson）的 [Medieval Weapon Textures](https://opengameart.org/content/medieval-sound-effects-weapon-textures)、[rubberduck RPG](https://opengameart.org/node/86018)、[Kenney RPG Audio](https://kenney.nl/assets/rpg-audio)，均为项目已有 CC0 原始素材。只沿用原录音，不复用 v21 混音成品。

`fetch_sources.py` 下载素材；`prepare.py render` 制作音频；`integrate.py` 在快照基础上安装新目录。`manifest.json` 保存每条音频的片段起点、滤波、移调、叠层、音符、声像、包络、输出电平和散列；`used-sources.json` 保存真正使用的来源与散列；`sources.json` 是下载清单，包含未采用的候选，不能等同于实际使用清单。

峰值以标量调整和最多 4 dB 离线短时前瞻控制留出余量；不提高游戏总音量，不硬削波。四倍采样检查最高峰值 -4.5 dBFS，44 条均无削波，首尾为零采样。指标只用于发现文件问题，不代表已确认风格、音色或主观品质。

## 接入与交付

运行时只修改 `AudioCatalog.ts` 中的 31 个有效入口，全部指向 `audio/v24/`。静音与共用映射保持原文；所有旧音频散列保持。新素材均有独立 Cocos UUID。资源 README、历史 CREDITS 与设置中的鸣谢页同步更新。

`preview.py` 生成 10 组项目分镜，覆盖全部 44 个文件，共约 59 秒；整组及每场景可独立播放，有音量、停止与后台暂停。分镜不是游戏录像，也没有代替游戏验收。公开页面无原始素材包或独立 Sonniss 音频下载。

只进行了离线制作、文件与引用检查、静态类型诊断对照、预览 JS 语法检查、生产构建与发布；不运行游戏、浏览器、模拟、自动化测试或音频播放。全工程原有 10 项类型错误保持，无新增，不能称全工程类型检查通过。

构建沿用 Creator 3.8.8 web-mobile / production / MD5，再执行 DPR 补丁与资源缓存准备；发布沿用 Wrangler `kingdom-watch` / `main`。原 727 个历史预览文件逐一保持散列。最终结果见 `build-record.json`、`deployment-stage.json`、`bundle-inspection.json` 与 `publish.log`。

正式游戏：[v24 游戏](https://kingdom-watch.pages.dev/?v=audio-kingdom-v24)。

分组试听：[全套音效 v24](https://kingdom-watch.pages.dev/previews/audio-kingdom-v24/)。

已发布：https://kingdom-watch.pages.dev/?v=audio-kingdom-v24-1792231961

部署快照：https://b4b579bb.kingdom-watch.pages.dev。Creator 退出码 36，构建 23785 ms；DPR / production / MD5 完成。44 个生产资源路径、原 WAV 散列和 UUID 对应检查一致；11 个 AAC 成片解码后无削波。Wrangler 上传 125 个新文件，保留 2313 个已上传文件，报告发布完成。未进行线上或听感验收。
