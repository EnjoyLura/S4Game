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

/** 战斗事件名 */
export const EVT = {
  MOB_KILLED: 'mob_killed',        // (mobDef, killerHeroId)
  LINE_DAMAGED: 'line_damaged',    // (hp, maxHp, shield)
  LINE_BROKEN: 'line_broken',
  XP_CHANGED: 'xp_changed',        // (pct, level)
  LEVEL_UP: 'level_up',            // (level)
  WAVE_CHANGED: 'wave_changed',    // (cur, total, surge)
  CHARGE_CHANGED: 'charge_changed',// (pct, ready)
  ALL_WAVES_CLEARED: 'all_waves_cleared',
} as const;
