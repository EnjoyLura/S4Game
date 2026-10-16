/** 轻量事件总线（core/事件总线，§12.7） */
export type Handler = (...args: unknown[]) => void;

export class EventBus {
  private map: Record<string, { fn: Handler; ctx?: unknown }[]> = {};

  on(evt: string, fn: Handler, ctx?: unknown): void {
    (this.map[evt] = this.map[evt] || []).push({ fn, ctx });
  }
  off(evt: string, fn: Handler, ctx?: unknown): void {
    const arr = this.map[evt];
    if (!arr) return;
    const i = arr.findIndex((e) => e.fn === fn && e.ctx === ctx);
    if (i >= 0) arr.splice(i, 1);
  }
  emit(evt: string, ...args: unknown[]): void {
    const arr = this.map[evt];
    if (!arr) return;
    for (const { fn, ctx } of arr.slice()) fn.call(ctx, ...args);
  }
}

export const bus = new EventBus();

/** One warning per special wave, with independent elite/Boss semantics. */
export interface WaveThreat { wave: number; boss: boolean; names: string[]; }

/** 战斗事件名 */
export const EVT = {
  MOB_KILLED: 'mob_killed',        // (mobDef, killerHeroId)
  LINE_DAMAGED: 'line_damaged',    // (hp, maxHp, shield)
  LINE_BROKEN: 'line_broken',
  XP_CHANGED: 'xp_changed',        // (pct, level)
  LEVEL_UP: 'level_up',            // (level)
  WAVE_CHANGED: 'wave_changed',    // (cur, total, surge)
  WAVE_THREAT: 'wave_threat',      // (WaveThreat) shortly before the first elite/Boss spawn
  CHARGE_CHANGED: 'charge_changed',// (pct, ready)
  ALL_WAVES_CLEARED: 'all_waves_cleared',
  COMIC_POP: 'comic_pop',          // (x, y, kind) 漫画拟声词条（词表见 battle/ComicPop.ts）
  ULTIMATE_BEGIN: 'ultimate_begin', // (UltimateCue) accepted manual/automatic cast
  ULTIMATE_BEAT: 'ultimate_beat',   // (UltimateBeat) actual release/contact
  HIT_STOP: 'hit_stop',            // () 暴击/击杀微顿帧（BattleDirector 限频消费）
} as const;
