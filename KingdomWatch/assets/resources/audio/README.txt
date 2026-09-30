音效资源占位说明（美术/音频阶段替换用）
========================================

把音频文件放进本目录（assets/resources/audio/），按以下命名（扩展名可用 mp3 / wav / ogg）：

  sfx_shoot     普攻射箭
  sfx_hit       命中
  sfx_crit      暴击命中
  sfx_kill      击杀
  sfx_ult       大招（扇形箭雨）
  sfx_levelup   升级
  sfx_ready     技能/大招就绪

运行时 Sfx.ts 会自动从 resources 加载这些 AudioClip 并优先播放资源样本；
未提供的音效继续使用内置 WebAudio 合成占位音，无需改任何代码。

注意：
- 文件名必须与上表一致（不含扩展名），首字母小写；
- 建议单条音效时长 <= 1s（shoot/hit/crit 高频触发，代码里已做同类限流）；
- 放入后在 Cocos 编辑器里刷新一次让 meta 生成（CLI 构建前编辑器会自动导入）。
