# 源码及本地产物审阅

- Cocos Creator 3.8.8 web-mobile 构建成功，退出码 36，9741ms；DPR 修补完成。已有 Ux/UIKit 循环依赖与 CLI 参数默认值提示仍在，没有新增构建失败。
- 本地 `assets/main/index.js` 中 `BaseModalSession` 只创建一次遮罩，内部用 `refreshUI` 等待美术与绘制交接；图鉴前进、详情关闭返回、领奖后返回均复用会话。
- 主城成功回调为 `session.markDirty(); keepModal(ctx, session)`，没有销毁遮罩；资源栏只刷新余额，关闭有变动的会话时才在遮罩后刷新基地。
- 新 `BossWarning` 只含中央旗帜、徽章、文字和 8 个短期局部火星；没有全屏暗层、屏幕边缘着色、输入拦截或战斗暂停。暂停/三选一隐藏，结算清理，总线 on/off 成对。
- `WaveManager` 按现有 `elite`/`boss` 读取，不修改 MobDef、数量或刷怪时刻；每波 `announced` 限一次。编译后去重仍是 `Array.from(new Set(...))`，没有 loose spread 将 Set 误变单元素数组的问题。
- 资源清单包含 `ux/boss_warning_v1/banner` 与 `crest` 的 ImageAsset/Texture/SpriteFrame；完整原图、透明通道与元数据入库，无中途换图逻辑。
- 编译后的入场参数明确为 CLOSE_SECONDS=.24、OPEN_SECONDS=.32、MIN_HOLD=2；仍须 ready 后开门。
- 未执行测试、模拟、游戏、浏览器或线上验收。以上结论仅来自源码、生成图片、构建日志及构建包文本审阅；动画节奏、声音与运行时白闪修复结果待用户人工确认。
