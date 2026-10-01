/**
 * 流程标记：单场景双模式（主城 MainUI / 战斗 BattleDirector）经 loadScene('Main') 重建切换。
 * 存放在模块级（内存），场景重建后由 Boot 读取。
 */
export type FlowMode = 'main' | 'battle';

export const flow = {
  mode: 'main' as FlowMode,
  /** 进入战斗的关卡 ID（当前仅 1-1；多关卡后由关卡页写入） */
  levelId: '1-1',
  /** 主城最后停留的底部页签（0商店 1英雄 2关卡 3升级 4基地） */
  mainTab: 2,
};
