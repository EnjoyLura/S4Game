# 重弩手攻击去枪焰与烟尘试做

使用用户明确认可动作的 `C:/Users/user/Downloads/video.mp4`，原始文件完整保留在 `source.mp4`。不重新生成攻击视频，不删帧、不倒放，56 帧／24 fps／约 2.333333 秒原时序全部保留。

内置 imagegen 对第 7、8、9 帧的弩头局部去枪焰、补回被亮光遮住的细节；只采用原画布 `(100,290)-(300,393)` 的武器机构补片，手臂、身体、头部和披风使用原视频。背景特效在限定区域内按连通人物墨线轮廓单独排除，保护头发、弩弦、手肘与披风，处理结果为完整 RGBA 源帧。

- 清理后视频：`attack-cleaned.mp4`，原画布 768×1344、原音轨、原帧率。
- 同步对照视频与 GIF：`comparison.mp4`／`comparison.gif`。
- 完整序列帧：`rgba-frames` 为原画布，`frames` 为固定 512×512 图集单元。
- 已打包资源 `sniper_attack_clean_v1`：56 张正向帧，一次固定缩放匹配当前重弩待机基准 467.1111、显示高度 153、脚底 `(256,496)`。
- 原始动作已获用户认可；本次局部修复与清理效果尚未获用户认可，不能推定效果验收。
- 本轮为独立对照预览，正式游戏攻击引用没有更换。发布以最新已发布游戏目录为基础，只添加预览；未启动 Cocos 重建游戏，也未运行浏览器、游戏、测试或线上验收。

制作脚本：`../sniper-attack-user-v1/prepare_repair.py`、`../sniper-attack-user-v1/clean_video.py`、`build_comparison.py`；具体像素范围和来源见 `processing.json`、`../sniper-attack-user-v1/weapon-repair-layout.json`。

Imagegen 提示词：局部去除三帧武器补片中的枪焰、火星和光晕，参考相邻干净帧恢复银色弩臂、墨线与弩弦，保留各自的发射姿势、轮廓、位置、比例及所有未受影响人物细节；纯红背景，禁止新增任何特效。生成图保存为 `../sniper-attack-user-v1/weapon-repair-generated.png`。

已发布：[同步对照预览](https://kingdom-watch.pages.dev/previews/sniper-attack-clean-v1/?v=1791952850)。清理后本地视频 `attack-cleaned.mp4`，使用内置 imagegen 的提示词保存在 `../sniper-attack-user-v1/weapon-repair-prompt.txt`。

更新：用户要求正式应用，本版已接入并构建发布：[正式游戏](https://kingdom-watch.pages.dev/?v=sniper-attack-clean-live-v1-1791953086)。详见 `../sniper-attack-clean-live-v1/release.json`；上方仅预览、未替换游戏的说明为前一阶段历史状态。
