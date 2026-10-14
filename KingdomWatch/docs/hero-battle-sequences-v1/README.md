# 五英雄战斗形象与序列帧 v1

状态：**素材审查版本，尚未替换线上战斗图集**。按用户此前的素材合成预览与人工验收约定，先确认外观和动作，再接入游戏。

## 查看

- [交互预览](review.html)：待机／攻击切换、暂停、逐帧和播放速度。
- [五英雄合成动图](all-heroes-preview.gif)：上行为待机，下行为攻击与回位。
- [游戏原尺寸合成动图](battle-composite-preview.gif)：采用现有地面和城墙资源，英雄准备姿态总高度 146 设计单位；前半段为弓手＋三法师，后半段为凯尔＋三法师。没有启动真实战斗。
- [头像外观对照](identity-comparison.jpg)：采用当前已认可头像，核对发色、兜帽、服装和武器。
- 单人：[艾拉](archer-preview.gif)、[凯尔](sniper-preview.gif)、[焰辉](pyro-preview.gif)、[沃尔](volt-preview.gif)、[莫拉](mora-preview.gif)。
- 全帧接触表：[艾拉](archer-contact.jpg)、[凯尔](sniper-contact.jpg)、[焰辉](pyro-contact.jpg)、[沃尔](volt-contact.jpg)、[莫拉](mora-contact.jpg)。

## 外观约束与生成方式

人物原画使用 **内置 imagegen**，没有切换图片 CLI 或其他模型。每人一张真实透明 PNG，参考对应头像、英雄页已认可立绘及艾拉新战斗形象的统一视角。sources/<hero>-ready.png 是原始生成图；五张都已复制保存到本项目。

| 英雄 | 保留的头像身份 | 动作 |
| --- | --- | --- |
| 艾拉 · 风羽 | 棕发男性精灵、绿斗篷、长弓、白羽箭筒 | 轻呼吸衣摆；抬弓、拉弦、释放、回位 |
| 凯尔 · 鹰眼 | 银发蓝兜帽、深蓝衣服、皮革与银甲、木钢机械弩 | 安静持弩；抬弩、后坐、回位 |
| 焰 · 辉 | 橙发、红兜帽金边、橙色晶石法杖 | 轻呼吸衣摆；蓄势、抬杖前送、回位 |
| 沃尔 · 雷霆 | 白发白胡须、紫兜帽金边、紫晶法杖 | 克制待机；沉稳抬杖、释放、回位 |
| 莫拉 · 寒霜 | 白长发、冰蓝兜帽与晶石发扣、白蓝袍、冰晶杖 | 轻呼吸发梢；抬杖施法、回位 |

人物统一为战场后侧三分之四视角，清晰深色轮廓、大块面漫画阴影，避免恢复原战斗人物的写实皮革、毛领与不对应头像的发型。

连续动作视频只使用本地 art_video_gen.py 的 **lens-minimax-h3-768p**。不使用 Seedance，没有自动升级模型。请求 2 秒，实际返回均为 56 帧、24fps、768×1344，共约 2.333 秒。

## 最终提示词集合

原画：[艾拉](prompts/archer-image.txt)、[凯尔](prompts/sniper-image.txt)、[焰辉](prompts/pyro-image.txt)、[沃尔](prompts/volt-image.txt)、[莫拉](prompts/mora-image.txt)。

最终视频提示词：

| 英雄 | 待机 | 攻击 |
| --- | --- | --- |
| 艾拉 | [提示词](prompts/archer-idle-v2.txt) | [提示词](prompts/archer-attack-v2.txt) |
| 凯尔 | [提示词](prompts/sniper-idle-v3.txt) | [提示词](prompts/sniper-attack-v3.txt) |
| 焰辉 | [提示词](prompts/pyro-idle-v2.txt) | [提示词](prompts/pyro-attack-v2.txt) |
| 沃尔 | [提示词](prompts/volt-idle-v2.txt) | [提示词](prompts/volt-attack-v2.txt) |
| 莫拉 | [提示词](prompts/mora-idle-v2.txt) | [提示词](prompts/mora-attack-v2.txt) |

前一批视频保存在 videos/，用于追溯画幅裁切和动作幅度问题；**不要集成这批素材**。最终源视频在 videos-v2/，凯尔选用其中 *-v3.mp4 两段。任务记录保存在 video-jobs*.json 和生成日志中，密钥始终保留在仓库外，没有写入素材或日志。

## 抽帧与图集

每英雄 frames/<hero>/ 内含 24 格待机、24 格攻击、PNG 图集和 .frames.json。全部来自视频真实帧，不使用一次 AI 生图的多格画面拼动作。凯尔待机源视频仍出现错误开火和弩变形，最终仅取已核对正常的第 40–55 格，并用这段衣摆运动往返形成待机循环；其余四人选择源视频中回到相近初态的连续周期。

两套动作共同计算**一个联合裁切框、一套缩放和一个地面原点**，不逐帧重新居中、追踪或缩放。格子 256×256，图集 8 列×6 行，2048×1536；每人的地面锚点为 (128,251)。元数据包含取帧索引、显示高度、逐套时长、循环次序和释放帧，可供后续引擎接入。

人物主体用边缘洪水填充抠黑底，保护内部深色轮廓、衣服与靴子；少量模型残留的晶石光晕单独按光效透明度处理，避免出现黑斑。输出为直通 RGBA，使用正常 alpha 混合，不能用 ADD 混合整个人物。预览不使用两帧交叉淡化，以免手臂和武器重影。

攻击预览压缩到艾拉 0.72s、凯尔 0.76s、焰辉 0.80s、沃尔／莫拉 0.84s，保留蓄势、释放与恢复。接入时释放帧需与原有普攻弹道回调对齐，不能只启动动画而提前发射子弹；高攻速与连射还要避免硬切重启整段动作。

## 重现

在项目既有 Python（Pillow、NumPy、imageio 已安装）中运行：

~~~powershell
python docs/hero-battle-sequences-v1/inspect_videos.py videos-v2
python docs/hero-battle-sequences-v1/build_sequences.py
python docs/hero-battle-sequences-v1/build_identity_preview.py
python docs/hero-battle-sequences-v1/make_review_page.py
~~~

以上仅处理已下载素材，不会产生新的生成费用。launch_videos*.ps1 是历史提交记录，**不要为重新打包执行它们**，重复运行会提交付费视频任务。

人工审查重点：头像是否一眼对应、待机是否过大／过小、攻击是否自然、武器是否变形、画面实际大小下是否可读。通过后再替换 HeroBattleMotion 的旧 UV 动作与旧战斗图集；血条和暂停修复、技能解锁逻辑及战斗数值继续保留。
