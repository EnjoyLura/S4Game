# 音量提高与音频许可核对

背景音乐与音效总线各增加约3.01 dB（增益乘√2）。音效开启时的初始化与设置刷新使用同一常量，营地和战斗音乐同步提升；静音、淡入淡出、暂停/三选一压低、重要音效避让、14声部预算及原输出压缩器保持。仅修改GameAudio.ts，不重新编码或替换音频。

2026-10-16通过作者发布页及Creative Commons官方许可说明核对：

| 来源 | 许可 | 原始发布页 |
| --- | --- | --- |
| cynicmusic：Town Theme RPG / Battle Theme A | CC0 | [营地曲](https://opengameart.org/content/town-theme-rpg)、[战斗曲](https://opengameart.org/content/battle-theme-a) |
| Ben Jaszczak & Brian Nelson / Still North Media：武器录音 | CC0 | [Medieval Weapon Textures](https://opengameart.org/content/medieval-sound-effects-weapon-textures) |
| Kenney：RPG、界面、短乐句、打击素材 | CC0 | [RPG](https://kenney.nl/assets/rpg-audio)、[界面](https://kenney.nl/assets/interface-sounds)、[乐句](https://kenney.nl/assets/music-jingles)、[打击](https://kenney.nl/assets/impact-sounds) |
| rubberduck：80 CC0 RPG SFX | CC0 | [发布页](https://opengameart.org/node/86018) |
| Iwan 'qubodup' Gabovitch：Ice & Electricity Magic | CC BY 3.0 | [发布页](https://opengameart.org/content/ice-electricity-magic) |

[CC0](https://creativecommons.org/publicdomain/zero/1.0/)允许复制、改编和商业使用，无须另行请求版权许可。[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)允许商业使用与改编，但须合理署名、保留许可链接和适用的修改说明，不暗示作者背书、不施加抵触许可的额外限制。现有游戏鸣谢包含作品名、作者、来源、许可及混音编辑说明，暂停→设置→音乐与音效鸣谢可访问；完整audio-credits.html随构建发布。

据目前公开许可及本地来源记录，按这些条件使用有明确许可依据，不能承诺绝对无争议；上传者权属真实性与第三方权利不由CC许可担保。两首BGM只依照各自明确标注CC0的发布页使用，不将此结论扩展到作者其他曲目。没有联系作者、购买授权或新增素材。

本地三轮来源清单、原始采样及编辑配方保留，license-audit.json记录来源与资源散列对应关系。产物审阅发现production/MD5把鸣谢页面改名，暂停入口却仍使用固定名；本轮在通用发布准备工具补回audio-credits.html原地址，并设置重新验证缓存，今后每次构建都保留可访问的完整鸣谢。

仅源码和本地构建产物静态审阅、Cocos构建、DPR与production/MD5准备及Pages发布；不运行测试、模拟、游戏、浏览器、线上验收或试听。听感由用户人工体验。

已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=audio-levels-v1-1792158868) · [部署快照](https://8ebae8c1.kingdom-watch.pages.dev)。Cocos 17495ms，听感待用户人工确认。
