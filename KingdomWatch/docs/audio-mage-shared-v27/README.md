# 法师统一施法与大招落地 v27

用户要求三位法师的普攻、技能施法共用同一音效，大招分别为轻微雷声、陨石撞地、冰晶落地破碎。v26 法师音色已被用户否定；v24 弓箭手与重弩手继续保留。v27 使用四条新制录音编辑，共 232,142 字节。

|用途|样本|长度|来源与编辑|
|---|---|---|---|
|火/雷/冰普攻及技能|mage_cast|0.24秒|Mechanical Wave 气流挥动的一个片段；同一速度、音色，无随机变调|
|雷法大招|thunder_soft|1.15秒|Soundopolis / David Fienup 自然雷鸣；选第一段起伏，较低电平，低通与柔和尾部|
|火法大招|meteor_land|0.64秒|Coll Anderson 爆炸主体 + Mechanical Wave 较轻的碎石层|
|冰法大招|ice_shatter|0.60秒|Eiravaein Works 冰块撞混凝土、碎裂与散落的真实录音，原速|

## 接入

六个普攻/技能入口解析到同一个 mageCast：0.18秒共用冷却、单一样本、不随机变调。三类旧法师重击均复用既有 hit_common；旧元素录音不再进入预载与播放。三大招保留独立素材，雷鸣1.15秒限频，冰晶0.55秒，陨石0.38秒；遵循原8声部预算和重要音效优先规则。

火法在 Projectile.hitGround 实际碰地后播放，移除 Hero 出手时的大招声；雷法在 thunderStrike 实际落雷处播放，移除第一击重复施法声；冰法在 FrostUltimateVFX 的真实计划接地节拍播放，移除伤害结算时重复的大招声。所有时间仍沿用既有战斗/VFX 时钟，未新增音效计时器、伤害、范围或技能数值改动。

补齐 contact 组暂停清理，避免普通受击在暂停后残留短尾。弓/弩11条文件和配置、固定第一条点击、原普通受击、关门与音乐保持。

## 素材与记录

采用 Sonniss GameAudioGDC 2015 免费录音，许可 [GameAudioGDC EULA v2.0](https://sonniss.com/gdc-bundle-license/)。新下载原始 ZIP 成员核对长度与 CRC；全部来源散列和片段配方在 sources.json、manifest.json。另保留深雷鸣备选录音但未用于成品。许可官方页面由网页工具读取；直接 curl 保存页面被403拒绝，不将其记录为成功保存。

Python/FFmpeg 用于编辑已有录音，不合成振荡器音调、不加入乐器或电流层，不提取《王国保卫战》音源。源录音及制作文件留在本地；公开试听为项目画面同步视频。

## 静态检查

- 与当前 v26 工作区逐文件比较：573项旧音频/元数据完整保留；其他旧脚本除六份音效相关脚本无变动。
- 战斗源码去除声音调用差异后保持相同；原10项 TypeScript 诊断保持，无新增。
- 四条成品的来源、散列、零首尾、无削波和元数据核对。
- 18秒四组同步分镜用于用户试听，不是游戏录像；编码使用实际配置电平。

遵守项目要求，未运行测试、游戏、浏览器、交互模拟或音频播放。波形、素材标签及构建结果不能代替听感验收，不声称已达到《王国保卫战》的音质。用户需要人工试听评价。

## 可复现流程

`prepare.py snapshot/fetch/analyze/render` → TypeScript 前后诊断 → `review_assets.py source` → `preview.py` → `tools/build-web.ps1` → `review_assets.py build` → `prepare.py stage` → `publish.ps1`。

已发布：[正式游戏](https://kingdom-watch.pages.dev/?v=audio-mage-shared-v27-1792245362) · [四种声音试听](https://kingdom-watch.pages.dev/previews/audio-mage-shared-v27/) · [部署快照](https://5db6a12f.kingdom-watch.pages.dev)。

Creator3.8.8 production/MD5退出36，构建15965ms，DPR与缓存准备完成。Wrangler上传32个文件、2533个已有文件，合计2565；780个历史试听文件散列保持。四条新生产资源路径/UUID/散列正确，五个AAC分镜解码无削波。正式入口与试听静态HTML均200，入口 index.30800.js?v=1792245362、试听 AUDIO V27 已核对；没有执行游戏。详见 deployment-stage.json、source-inspection.json、bundle-inspection.json。
