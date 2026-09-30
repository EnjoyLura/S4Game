/**
 * 波次管理（§3.3 清场驱动：当前波全部生成且全部消灭 → 立即下一波，无间歇）
 */
import { LevelDef, MOBS, MobDef } from '../config/Mobs';
import { MonsterManager } from './Monster';
import { bus, EVT } from '../core/EventBus';

interface DueSpawn { mob: string; t: number; }

export class WaveManager {
  private idx = 0;
  private queue: DueSpawn[] = [];
  private elapsed = 0;
  /** 全部波清完 */
  finished = false;

  constructor(private level: LevelDef, private mgr: MonsterManager) {}

  get waveNum(): number { return Math.min(this.idx + 1, this.level.waves.length); }
  get total(): number { return this.level.waves.length; }
  get currentSurge(): boolean { return this.level.waves[Math.min(this.idx, this.total - 1)].surge === true; }

  start(): void {
    this.buildQueue();
    bus.emit(EVT.WAVE_CHANGED, this.waveNum, this.total, this.currentSurge);
  }

  private buildQueue(): void {
    this.queue = [];
    this.elapsed = 0;
    const wave = this.level.waves[Math.min(this.idx, this.total - 1)];
    for (const g of wave.groups) {
      for (let i = 0; i < g.count; i++) {
        this.queue.push({ mob: g.mob, t: (g.delay || 0) + i * g.interval });
      }
    }
    this.queue.sort((a, b) => a.t - b.t);
  }

  tick(dt: number): void {
    if (this.finished) return;
    this.elapsed += dt;
    while (this.queue.length > 0 && this.queue[0].t <= this.elapsed) {
      const s = this.queue.shift() as DueSpawn;
      const def = MOBS[s.mob];
      if (def) this.mgr.spawn(def as MobDef);
    }
    if (this.queue.length === 0 && this.mgr.aliveCount === 0) {
      // 清场驱动：本波全部生成且全部消灭 → 立即下一波
      this.idx++;
      if (this.idx >= this.total) {
        this.finished = true;
        bus.emit(EVT.ALL_WAVES_CLEARED);
      } else {
        this.buildQueue();
        bus.emit(EVT.WAVE_CHANGED, this.waveNum, this.total, this.currentSurge);
      }
    }
  }

  /** GM：跳过本波（清空生成队列并全杀场上怪，恢复模拟后由清场驱动进下一波） */
  gmSkip(): void {
    this.queue.length = 0;
    for (const m of this.mgr.list) if (!m.dead) m.takeDamage(1e12, false, 'gm');
  }
}
