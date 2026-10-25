/**
 * 波次管理（用户调整·向僵尸开炮式持续刷怪）：本波出怪队列放完即开下一波（不等击杀）；
 * 末波出怪完毕且全场清空才算通关。数量/血量/伤害逐波阶梯增长（WAVE_RAMP）。
 */
import { EnemyFormation, LevelDef, MOBS, MobDef, WAVE_RAMP } from '../config/Mobs';
import { MonsterManager } from './Monster';
import { bus, EVT, WaveThreat } from '../core/EventBus';

interface DueSpawn { mob: string; t: number; actual?: { hp: number; dmg: number }; formation?: EnemyFormation; }

export class WaveManager {
  private idx = 0;
  private queue: DueSpawn[] = [];
  private elapsed = 0;
  private threat: WaveThreat | null = null;
  private threatAt = 0;
  private announced = false;
  /** 全部波出完且全场清空 */
  finished = false;

  constructor(private level: LevelDef, private mgr: MonsterManager) {}

  get waveNum(): number { return Math.min(this.idx + 1, this.level.waves.length); }
  get total(): number { return this.level.waves.length; }
  get currentSurge(): boolean { return this.level.waves[Math.min(this.idx, this.total - 1)].surge === true; }
  get hasThreat(): boolean { return !!this.threat; }
  /** Emission completion is independent of enemies still alive from this or previous waves. */
  get spawnQueueEmpty(): boolean { return this.queue.length === 0; }

  start(): void {
    this.buildQueue();
    bus.emit(EVT.WAVE_CHANGED, this.waveNum, this.total, this.currentSurge);
  }

  private buildQueue(): void {
    this.queue = [];
    this.elapsed = 0;
    // 阶梯增长：第 idx 波（0 起）数量/血量/伤害放大（血量另乘全怪基础倍率 MOB_HP_MUL，在 MonsterManager.spawn 生效）
    const wave = this.level.waves[Math.min(this.idx, this.total - 1)];
    const special = wave.groups.filter(g => MOBS[g.mob]?.boss || MOBS[g.mob]?.elite);
    const boss = special.some(g => MOBS[g.mob].boss);
    const featured = special.filter(g => !boss || MOBS[g.mob].boss);
    this.threat = featured.length ? { wave: this.waveNum, boss,
      names: Array.from(new Set(featured.map(g => MOBS[g.mob].name))) } : null;
    this.threatAt = featured.length ? Math.max(0, Math.min(...featured.map(g => g.delay || 0)) - .8) : 0;
    this.announced = false;
    this.mgr.rampHp = this.level.fixedWaves ? 1 : 1 + WAVE_RAMP.hp * this.idx;
    this.mgr.rampDmg = this.level.fixedWaves ? 1 : 1 + WAVE_RAMP.dmg * this.idx;
    const cntMul = this.level.fixedWaves ? 1 : 1 + WAVE_RAMP.cnt * this.idx;
    for (const g of wave.groups) {
      // Bosses are authored individuals, never multiplied into a crowd by the wave ramp.
      const n = Math.max(1, MOBS[g.mob]?.boss ? g.count : Math.round(g.count * cntMul));
      for (let i = 0; i < n; i++) {
        this.queue.push({ mob: g.mob, t: (g.delay || 0) + i * g.interval, actual: g.actual });
      }
    }
    this.queue.sort((a, b) => a.t - b.t);
    if (wave.formation === 'escort') this.buildEscorts();
    else if (wave.formation === 'crossfire') this.buildCrossfire();
  }

  private buildEscorts(): void {
    const used = new Set<DueSpawn>();
    let pair = 0;
    for (const support of this.queue.filter(s => MOBS[s.mob]?.kind === 'heal')) {
      if (pair >= 2) break;
      const front = this.queue.filter(s => !used.has(s) && MOBS[s.mob]?.kind === 'melee' &&
        (MOBS[s.mob].elite || MOBS[s.mob].boss) && s.t <= support.t - 5 && s.t >= support.t - 16)
        .sort((a, b) => Math.abs(support.t - a.t - 8) - Math.abs(support.t - b.t - 8))[0];
      if (!front) continue;
      const lane = MOBS[front.mob].boss ? 0 : (pair % 2 ? 165 : -165) * (this.idx % 2 ? 1 : -1);
      const id = this.level.id + ':' + this.idx + ':' + pair;
      front.formation = { id, lane, role: 'front' };
      support.formation = { id, lane, role: 'support', gap: 140 };
      used.add(front); pair++;
    }
  }

  private buildCrossfire(): void {
    const ranged = this.queue.filter(s => MOBS[s.mob]?.kind === 'ranged');
    if (!ranged.length) return;
    const side = this.idx % 2 ? 1 : -1, first = ranged[0].t;
    for (const s of ranged) s.formation = { lane: -side * 165 };
    let rider = 0;
    for (const s of this.queue) if (MOBS[s.mob]?.rush) {
      s.t = Math.max(s.t, first + 6 + rider++ * 3);
      s.formation = { lane: side * 165 };
    }
    this.queue.sort((a, b) => a.t - b.t);
  }

  tick(dt: number): void {
    if (this.finished) return;
    this.elapsed += dt;
    if (this.threat && !this.announced && this.elapsed >= this.threatAt) {
      this.announced = true;
      bus.emit(EVT.WAVE_THREAT, this.threat);
    }
    while (this.queue.length > 0 && this.queue[0].t <= this.elapsed) {
      const s = this.queue[0];
      const def = MOBS[s.mob];
      // A full living-enemy pool defers this entry; never consume a failed spawn.
      if (def && !this.mgr.spawn(def as MobDef, s.actual, s.formation)) break;
      this.queue.shift();
    }
    if (this.queue.length > 0) return;
    // 出怪队列已空：非末波立即开下一波（不等击杀）；末波等全场清空再结算
    if (this.idx < this.total - 1) {
      this.idx++;
      this.buildQueue();
      bus.emit(EVT.WAVE_CHANGED, this.waveNum, this.total, this.currentSurge);
    } else this.checkCleared();
  }

  /** Also check after damage steps so the final kill cannot open a queued upgrade first. */
  checkCleared(): void {
    if (this.finished || this.queue.length > 0 || this.idx < this.total - 1 || this.mgr.aliveCount > 0) return;
    this.finished = true;
    bus.emit(EVT.ALL_WAVES_CLEARED);
  }

  /** GM：跳过本波（清空生成队列并全杀场上怪；非末波下帧进下一波，末波直接结算） */
  gmSkip(): void {
    this.queue.length = 0;
    for (const m of this.mgr.list) if (!m.dead) m.takeDamage(1e12, false, 'gm');
  }
}
