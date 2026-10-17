/**
 * 流程标记：单场景双模式（主城 MainUI / 战斗 BattleDirector）经 loadScene('Main') 重建切换。
 * 存放在模块级（内存），场景重建后由 Boot 读取。
 */
export type FlowMode = 'main' | 'battle';

export const flow = {
  mode: 'main' as FlowMode,
  /** 进入战斗的章节关卡 ID（1-1..3-10，由关卡页写入） */
  levelId: '1-1',
  /** 关卡难度：0 普通 / 1 精英 / 2 地狱（关卡页写入，战斗读取注入出怪倍率与星级后缀键） */
  diff: 0,
  /** 主城最后停留的底部页签（0商店 1英雄 2关卡 3升级 4基地） */
  mainTab: 2,
  /** One-shot focus when leaving a battle: restore this level/difficulty without starting it. */
  levelReturn: null as { id: string; diff: number } | null,
};
