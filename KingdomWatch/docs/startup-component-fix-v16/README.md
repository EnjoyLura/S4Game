# 启动组件注册修复 v16

用户在 v15 发布后报告启动即显示 `Error 3615` 和 `Cannot set properties of null (setting '_sealed')`。

本地 Cocos Creator 3.8.8 引擎 `EngineErrorMap.md:1378` 明确说明：每份脚本最多一个 Component。`cocos/core/data/class.ts:165–172` 在同一 RF 脚本上下文发现第二个 Component 后报 3615 并返回 null，后续 `class.ts:301` 对 `cls._sealed` 赋值，形成截图中的第二个错误。

v15 的 `PositiveFeedback.ts` 同时声明了 `PositiveFeedback` 和 `ConstructionPulse` 两个注册组件。这是本轮新增代码引入的启动回归，构建和普通类型检查无法发现这条运行时注册限制。

修复将 `ConstructionPulse` 连同原工厂函数原样移到独立的 `ConstructionPulse.ts`，分配独立 Cocos UUID，基地页只更新导入路径。成长反馈、主城光环、领奖/购买/招募演出、八条新音效和全部数值、事务、存档保持。

使用 TypeScript AST 读取全部 115 份脚本，修复前文件明确含两个注册组件，修复后没有同类冲突。额外核对生产包中两个组件处于不同的 Cocos RF 注册区间，其他原脚本散列保持。检查记录见 `component-audit.json`、`bundle-inspection.json`。

沿用用户验证要求：仅源码与引擎代码复核、静态 AST/类型检查、生产构建和产物检查，不执行游戏、测试、浏览器或音频试听，不将发布视为实机验收。原九项类型诊断保持，本轮文件无新增诊断。

已发布：[正式游戏](https://kingdom-watch.pages.dev/?v=startup-component-fix-v16-1792215028) · [部署快照](https://9ca4e00e.kingdom-watch.pages.dev)。构建 16333ms；待用户实机确认。
