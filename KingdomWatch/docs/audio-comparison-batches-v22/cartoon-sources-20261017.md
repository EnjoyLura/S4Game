# 免费卡通 / 轻奇幻来源 · cartoon-r1

用户在全部否定 growth-r1 后明确：要免费、高质量、欧美卡通风。原保留旧版的五项决定继续有效。本轮不购买音包，不让用户逐个搜索，先整理三项用途、六条新候选供用户听方向。

## 使用的免费原包

1. Dustyroom — Free Casual Game Sounds
   - 官方页面：https://dustyroom.com/free-casual-game-sounds/
   - 官网提供的非 Unity 直接下载：https://dustyroom.com/casualgamesounds/DM-CGS.zip
   - 下载保存：`sources/cartoon-r1/Dustyroom-Free-Casual-Game-Sounds.zip`
   - 官网页和包内 `DM-CGS/license.pdf` 都明确 CC0，可免费商用；没有将 Unity 商店自身的通用授权当作本包来源。
   - 作者说明适用于休闲游戏奖励和 UX/UI；原始 44.1kHz、24-bit、stereo。原包 50 条文件使用数字编号，没有具体事件名。
   - 已保存官方 HTML、包内许可、原文件和 SHA-256。

2. Tim Beek — Casual SoundFX Pack
   - 官方作者发布页：https://timbeek.itch.io/casual-soundfx-pack
   - 使用免费 WAV 下载，不填写支付或邮箱、不购买 $3 无署名版本。
   - 原包：`sources/cartoon-r1/Tim-Beek-Casual-SoundFX-WAV.zip`
   - 免费随附许可：`sources/cartoon-r1/Tim-Beek-Casual-SoundFX-CC-License.pdf`
   - 随包许可明确 CC BY 4.0，允许编辑及商业作品使用，要求 `Audio by timbeek.com`；页面及试听鸣谢提供作者主页、来源、CC 链接及改动说明。
   - 选择明确命名的 Positive Holy1 / Positive Holy2 作为单次升级候选；不把其较长的 UI 音强行剪成每次连升反馈。

## 用途分配

| 用途 | 候选 A | 候选 B | 依据与限制 |
|---|---|---|---|
| D01 单次升级 | Tim Beek / Positive Holy1.wav | Tim Beek / Positive Holy2.wav | 作者明确归为 Positive，保留完整乐句尾声，不用于逐次长按反馈 |
| D02 长按连升 | Dustyroom / DM-CGS-21.wav | Dustyroom / DM-CGS-32.wav | 原文件约 0.12 / 0.19s，适合先评估短反馈节奏；提供五次、240ms 间隔示例 |
| D03 数字落点 | Dustyroom / DM-CGS-07.wav | Dustyroom / DM-CGS-41.wav | 原文件约 0.29 / 0.23s，作为不同于 D02 的短确认候选 |

Dustyroom 的用途细分由离线长度、瞬态/频谱初选，不是作者给各编号的正式事件名称。未播放音频，不能以文件参数、无削波、作者身份代替听感认可；“欧美卡通 / 轻奇幻”是本轮试选方向，不宣称已经达到某商业游戏的音效水平。只有用户回传选择后才可接入。

所有候选与当前游戏 v21 对照使用同用途的共同参考 RMS 和至少 3dB 峰值余量，保留 stereo。不做变速、变调、EQ、压缩、叠加或自制旋律。近静音裁剪保留首尾余量，2ms 边缘淡变仅防点击。只发布选出的六条及三条重复示例，不上传完整源包。

## 未采用来源

- WOW Sound Starter Pack 的免费页链接到 CC BY-ND 3.0；与后续剪辑/同步动效要求不便统一，本轮未下载使用，也没有将其视作普通 CC BY。
- drtwelele 的免费 Casual Game Fx One Shot 页面未直接说明具体许可，本轮未把“免费/royalty free”标签当作单独公开试听的完整授权。
- Kenney 及 growth-r1 的作者素材已在上一轮使用；不把旧素材重新打包称为新专业来源。
- 付费音包、仅试用/带水印的商用库不在此次免费候选内。

## 复现与发布

`prepare_cartoon.py` 仅做离线文件转换和采样检查。`cartoon-source-hashes.json` 保存六条新原件、三条旧对照以及两原包/许可/官网页散列；`cartoon-report.json` 保存格式/峰值/重复样例统计。网页公开 `CREDITS.txt` 与两份原始许可 PDF，旧版来源指向现有生产音频鸣谢。

仅新增独立试听页并更新历史比较页导航。发布复用 v21 生产快照，逐文件确认原 2,243 个生产文件不变。用户已授权的试听页发布流程继续，不修改游戏音效或数据。
