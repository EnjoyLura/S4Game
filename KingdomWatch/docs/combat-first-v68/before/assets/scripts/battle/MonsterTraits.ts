/** Chapter enemies share bounded, simulation-time mechanics. Original goblins stay unchanged. */
import { Color, Graphics, Node } from 'cc';
import { LO } from '../config/GameConfig';
import type { Monster, MonsterManager } from './Monster';

type DefenseLine = { takeDamage: (damage: number) => void };

export class MonsterTraits {
  private age = 0;
  private summonClock = 0;
  private summoned = 0;
  private regenClock = 0;
  private pendingStrike = 0;
  private revived = false;
  private phase = false;
  private cue: Graphics | null = null;
  constructor(private owner: Monster) {}

  reset(): void {
    this.age = this.summonClock = this.summoned = this.regenClock = this.pendingStrike = 0;
    this.revived = this.phase = false;
    this.hide();
  }
  get enraged(): boolean { return this.phase; }
  private get guarding(): boolean {
    const g = this.owner.def.guard;
    return !!g && this.age >= g.period && this.age % g.period < g.duration;
  }
  speedMultiplier(): number {
    const rush = this.owner.def.rush;
    const charging = rush && this.age >= rush.period && this.age % rush.period < rush.duration;
    return (charging ? rush!.multiplier : 1) * (this.phase ? this.owner.def.phase?.speedMul || 1 : 1);
  }
  damageMultiplier(): number { return this.phase ? this.owner.def.phase?.attackMul || 1 : 1; }
  incomingDamage(amount: number, killer: string): number {
    return killer !== 'gm' && this.guarding ? amount * (1 - this.owner.def.guard!.reduction) : amount;
  }

  tick(dt: number, motionDt: number, line: DefenseLine, manager: MonsterManager): void {
    const o = this.owner, d = o.def;
    if (!d.homeChapter || o.dead) return;
    this.age += motionDt;
    if (d.phase && o.hp <= o.maxHp * d.phase.threshold) this.phase = true;
    // A control effect cancels the telegraph; it cannot land a queued hit after interruption.
    if (motionDt < dt) this.pendingStrike = 0;
    else if (this.pendingStrike > 0) {
      this.pendingStrike = Math.max(0, this.pendingStrike - motionDt);
      if (this.pendingStrike === 0) o.strike(line, manager);
    }
    if (motionDt > 0 && o.y < LO.half - d.radius) {
      if (d.regen) {
        this.regenClock += motionDt;
        if (this.regenClock >= 1) {
          const seconds = Math.floor(this.regenClock); this.regenClock -= seconds;
          if (o.hp < o.maxHp) o.heal(Math.min(o.maxHp - o.hp, o.maxHp * d.regen * seconds));
        }
      }
      if (d.kind === 'heal') {
        o.healT -= motionDt;
        if (o.healT <= 0) { o.healT += d.atkInterval; manager.healAround(o, 180, d.healAmount || 40); }
      }
      if (d.summon && this.summoned < d.summon.limit) {
        this.summonClock += motionDt;
        if (this.summonClock >= d.summon.every) {
          const made = manager.spawnOffspring(o, d.summon.id, Math.min(d.summon.count, d.summon.limit - this.summoned));
          this.summoned += made;
          // Retry a full battlefield slowly, never accumulate a burst of deferred summons.
          this.summonClock = made ? 0 : Math.max(0, d.summon.every - 1);
        }
      }
    }
    this.drawCue();
  }
  attack(line: DefenseLine, manager: MonsterManager): void {
    const windup = this.owner.def.windup || 0;
    if (windup > 0) { if (this.pendingStrike <= 0) this.pendingStrike = windup; }
    else this.owner.strike(line, manager);
  }
  onLethal(killer: string): boolean {
    const fraction = this.owner.def.revive || 0;
    if (killer === 'gm' || !fraction || this.revived) return false;
    this.revived = true;
    this.owner.hp = Math.max(1, Math.round(this.owner.maxHp * fraction));
    this.pendingStrike = 0;
    return true;
  }
  onDie(killer: string, manager: MonsterManager | null): void {
    const split = this.owner.def.split;
    if (killer !== 'gm' && split && manager) manager.spawnOffspring(this.owner, split.id, split.count);
    this.hide();
  }
  private hide(): void { if (this.cue) this.cue.node.active = false; }
  private drawCue(): void {
    const o = this.owner;
    if (!this.guarding && this.pendingStrike <= 0) { this.hide(); return; }
    if (!this.cue) {
      const n = new Node('enemyTelegraph'); n.layer = o.node.layer; n.setParent(o.node);
      this.cue = n.addComponent(Graphics);
    }
    const g = this.cue; g.node.active = true; g.clear();
    if (this.guarding) {
      g.strokeColor = new Color(112, 209, 238, 220); g.lineWidth = 3;
      g.ellipse(0, -o.def.radius * .65, o.def.radius * 1.15, o.def.radius * .4); g.stroke();
    }
    if (this.pendingStrike > 0) {
      const width = o.isBoss ? 84 : 52, y = o.def.radius * 3.2 + (o.isBoss ? 24 : 6);
      const progress = 1 - this.pendingStrike / Math.max(.01, o.def.windup || 1);
      g.fillColor = new Color(48, 31, 24, 230); g.rect(-width / 2, y, width, 7); g.fill();
      g.fillColor = new Color(255, 158, 53, 255); g.rect(-width / 2, y, width * progress, 7); g.fill();
    }
  }
}
