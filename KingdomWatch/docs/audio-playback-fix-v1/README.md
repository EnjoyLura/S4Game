# 游戏无声修复

用户反馈游戏听不到BGM及音效。本轮仅修复音频启动、预加载与恢复，继续使用audio-upgrade-v1的两首授权配乐和42条采样音效。

## 原因与修改

原GameAudio把touchend、mousedown、keydown的解锁监听挂在document冒泡阶段。本机Cocos Creator 3.8.8源码的pal/input/web/touch-input.ts、mouse-input.ts及keyboard-input.ts会在canvas输入回调调用DOM事件stopPropagation，因此游戏内操作到不了该监听，AudioContext可能始终未创建或恢复。

- 改在window捕获阶段监听真实pointerdown、pointerup、mousedown、touchend、keydown，先于Cocos处理；保持passive，不拦截游戏操作。松开事件覆盖需要在触摸结束时恢复声音的浏览器。
- 进入大厅／战斗即创建可挂起的上下文，提前加载并解码当前BGM与常用采样。播放仍遵循真实用户手势；解锁时直接resume，共用同一混音器。
- 开启音效及回到前台时补齐预热。BGM下载短暂失败时16秒后自动重试，沿用15秒失败退避，关音乐或切后台取消重试。
- 保留原音乐／音效设置、音量、14声部、限流、场景淡入、战斗事件对应关系和后台暂停。没有重置存档开关、补播过期攻击或添加额外音频素材。

构建前检查了现有产物配置和UUID原生文件：两首MP3及UI WAV已随resources资源包存在；UUID URL方案与引擎getUrlWithUuid实现一致，本轮不修改资源路径。

按用户既有约定，只做源码和构建产物诊断、Cocos Creator 3.8.8 web-mobile构建、DPR补丁与Pages main发布。不运行测试、游戏、浏览器或线上听音验收，实际听感由用户人工体验。

已构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=audio-playback-fix-v1-1792003213) · [部署快照](https://c81a24b9.kingdom-watch.pages.dev)。Cocos退出码36、9348ms，DPR完成，main上传2文件、1783缓存。未做听音验收。
