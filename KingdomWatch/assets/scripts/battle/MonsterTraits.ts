/** Shared, bounded enemy roles; all clocks follow battle simulation time. */
import { Color, Graphics, Node } from 'cc';
import { LO } from '../config/GameConfig';
import { ENEMY_HEALING } from '../config/ChapterContent';
import { damageKindFor, DamageKind } from '../config/Mobs';
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
  private armorDamage = 0;
  private armorBroken = false;
  private armorCueT = 0;
  private wardDamage = 0;
  private wardBroken = false;
  private wardCueT = 0;
  private pendingHeal = 0;
  private cancelledRush = -1;
  private chargeArmed = false;
  private rushCueT = 0;
  private cue: Graphics | null = null;
  private tint = new Color();
  constructor(private owner: Monster) {}

  reset(): void {
    this.age = this.summonClock = this.summoned = this.regenClock = this.pendingStrike = 0;
    this.revived = this.phase = false;
    this.armorDamage = this.armorCueT = this.wardDamage = this.wardCueT = this.pendingHeal = this.rushCueT = 0;
    this.armorBroken = this.wardBroken = this.chargeArmed = false;
    this.cancelledRush = -1;
    this.hide();
  }
  get enraged(): boolean { return this.phase; }
  get physicalResistance(): number { return this.armorBroken ? 0 : this.owner.def.physRes || 0; }
  get magicResistance(): number { return this.wardBroken ? 0 : this.owner.def.magicRes || 0; }
  get defenseInfo(): { physical: number; magic: number; armorBroken: boolean; wardBroken: boolean } {
    return {
      physical: 1 - this.incomingDamage(1 - this.physicalResistance, 'archer'),
      magic: 1 - this.incomingDamage(1 - this.magicResistance, 'pyro'),
      armorBroken: this.armorBroken, wardBroken: this.wardBroken,
    };
  }
  get activeStates(): string[] {
    const states: string[] = [];
    if (this.pendingHeal > 0) states.push('治疗读条 ' + this.pendingHeal.toFixed(1) + '秒');
    if (this.pendingStrike > 0) states.push('攻击蓄力 ' + this.pendingStrike.toFixed(1) + '秒');
    if (this.preparingRush) states.push('冲锋蓄势');
    else if (this.charging) states.push('冲锋中');
    if (this.guarding) states.push('防御姿态');
    if (this.phase) states.push('狂暴');
    return states;
  }
  recordHit(raw: number, kind: DamageKind): void {
    const magic = kind === 'magic';
    if (kind === 'true' || raw <= 0 || (magic ? this.magicResistance : this.physicalResistance) <= 0) return;
    if (magic) this.wardDamage += raw;
    else this.armorDamage += raw;
    const damage = magic ? this.wardDamage : this.armorDamage;
    const threshold = magic ? this.owner.def.wardBreakRatio ?? .3 : this.owner.def.armorBreakRatio ?? .3;
    if (damage >= this.owner.maxHp * threshold) {
      if (magic) this.wardBroken = true;
      else this.armorBroken = true;
      this.owner.applyVuln(.15, 3);
      this.owner.feedback(magic ? 'wardBreak' : 'armorBreak');
    } else if ((magic ? this.wardCueT : this.armorCueT) <= 0) {
      if (magic) this.wardCueT = .16;
      else this.armorCueT = .16;
      this.owner.feedback(magic ? 'wardHit' : 'armorHit');
    }
  }
  private get rushPhase(): number {
    const rush = this.owner.def.rush;
    if (!rush || this.owner.state !== 'move' || this.age < rush.period ||
      Math.floor(this.age / rush.period) === this.cancelledRush) return -1;
    return this.age % rush.period;
  }
  private get preparingRush(): boolean {
    return this.rushPhase >= 0 && this.rushPhase < (this.owner.def.rush?.windup ?? .55);
  }
  private get charging(): boolean {
    const rush = this.owner.def.rush, phase = this.rushPhase;
    const windup = rush?.windup ?? .55;
    return !!rush && phase >= windup && phase < windup + rush.duration;
  }
  onReachLine(): void { this.chargeArmed = this.charging; }
  private get guarding(): boolean {
    const g = this.owner.def.guard;
    if (this.armorBroken && this.owner.def.physRes || this.wardBroken && this.owner.def.magicRes) return false;
    return !!g && this.age >= g.period && this.age % g.period < g.duration;
  }
  speedMultiplier(): number {
    if (this.pendingHeal > 0) return 0;
    const speed = this.preparingRush ? .4 : this.charging ? this.owner.def.rush!.multiplier : 1;
    return speed * (this.phase ? this.owner.def.phase?.speedMul || 1 : 1);
  }
  damageMultiplier(): number {
    const charge = this.chargeArmed ? this.owner.def.rush?.impactMul || 1 : 1;
    this.chargeArmed = false;
    return charge * (this.phase ? this.owner.def.phase?.attackMul || 1 : 1);
  }
  incomingDamage(amount: number, killer: string): number {
    if (killer === 'gm' || !this.guarding) return amount;
    const kind = damageKindFor(killer), d = this.owner.def;
    // An armored guard defends against physical damage; a ward guards against magic.
    // Breaking that defense also removes its periodic guard until this enemy dies.
    if (d.physRes && (kind !== 'physical' || this.armorBroken)) return amount;
    if (d.magicRes && (kind !== 'magic' || this.wardBroken)) return amount;
    return amount * (1 - d.guard!.reduction);
  }
  private interruptControl(): void {
    let interrupted = this.pendingHeal > 0 || this.pendingStrike > 0;
    if (this.pendingHeal > 0) {
      this.pendingHeal = 0;
      this.owner.healT = this.owner.def.atkInterval;
    }
    if (this.preparingRush || this.charging) {
      this.cancelledRush = Math.floor(this.age / this.owner.def.rush!.period);
      interrupted = true;
    }
    this.pendingStrike = 0;
    this.chargeArmed = false;
    if (interrupted) this.owner.feedback('interrupt');
  }
  private tickHealing(dt: number, manager: MonsterManager): void {
    const o = this.owner, spec = o.def.healing || ENEMY_HEALING;
    o.healT = Math.max(0, o.healT - dt);
    if (this.pendingHeal > 0) {
      this.pendingHeal = Math.max(0, this.pendingHeal - dt);
      if (this.pendingHeal === 0 && manager.healAround(o, spec)) o.animateHeal();
    } else if (o.healT <= 0) {
      if (manager.hasHealingTarget(o, spec.radius)) {
        this.pendingHeal = Math.max(.2, spec.windup);
        o.healT = o.def.atkInterval;
        o.animateHeal();
      } else o.healT = .5; // A healthy group is checked twice a second, never every frame.
    }
  }

  tick(dt: number, motionDt: number, line: DefenseLine, manager: MonsterManager): void {
    const o = this.owner, d = o.def;
    if (o.dead) return;
    this.armorCueT = Math.max(0, this.armorCueT - dt);
    this.wardCueT = Math.max(0, this.wardCueT - dt);
    if (motionDt < dt) this.interruptControl();
    this.age += motionDt;
    if (d.phase && o.hp <= o.maxHp * d.phase.threshold) this.phase = true;
    // A control effect cancels the telegraph; it cannot land a queued hit after interruption.
    if (motionDt === dt && this.pendingStrike > 0) {
      this.pendingStrike = Math.max(0, this.pendingStrike - motionDt);
      if (this.pendingStrike === 0) o.strike(line, manager);
    }
    this.rushCueT = Math.max(0, this.rushCueT - dt);
    if (this.charging && motionDt > 0 && this.rushCueT <= 0) {
      this.rushCueT = .2; o.feedback('rush');
    }
    if (motionDt > 0 && o.y < LO.half - d.radius) {
      if (d.regen) {
        this.regenClock += motionDt;
        if (this.regenClock >= 1) {
          const seconds = Math.floor(this.regenClock); this.regenClock -= seconds;
          if (o.hp < o.maxHp) o.heal(Math.min(o.maxHp - o.hp, o.maxHp * d.regen * seconds));
        }
      }
      if (d.kind === 'heal' && motionDt === dt) this.tickHealing(motionDt, manager);
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
    this.pendingStrike = this.pendingHeal = 0;
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
    const armor = this.physicalResistance > 0, ward = this.magicResistance > 0, healer = o.def.kind === 'heal';
    const preparing = this.preparingRush, charging = this.charging;
    if (!armor && !ward && !this.armorBroken && !this.wardBroken && !healer && !preparing && !charging && !this.guarding && this.pendingStrike <= 0) { this.hide(); return; }
    if (!this.cue) {
      const n = new Node('enemyTelegraph'); n.layer = o.node.layer; n.setParent(o.node);
      this.cue = n.addComponent(Graphics);
    }
    const g = this.cue; g.node.active = true; g.clear();
    const top = o.headTop + 6, dx = o.isBoss ? -o.def.radius * 1.4 - 13 : healer ? -11 : 0;
    if (this.armorBroken) {
      // Two separated shield halves and a jagged crack remain visible until death.
      this.tint.set(239, 198, 135, 255); g.strokeColor = this.tint; g.lineWidth = 2.3;
      g.moveTo(dx - 2, top + 15); g.lineTo(dx - 9, top + 15); g.lineTo(dx - 8, top + 6);
      g.lineTo(dx - 3, top + 1); g.lineTo(dx - 5, top + 7); g.lineTo(dx - 1, top + 10); g.stroke();
      g.moveTo(dx + 3, top + 13); g.lineTo(dx + 10, top + 13); g.lineTo(dx + 9, top + 4);
      g.lineTo(dx + 4, top - 1); g.lineTo(dx + 2, top + 5); g.lineTo(dx + 6, top + 8); g.stroke();
    } else if (armor) {
      this.tint.set(186, 210, 224, 255); g.strokeColor = this.tint; g.lineWidth = 2;
      g.moveTo(dx - 7, top + 14); g.lineTo(dx + 7, top + 14); g.lineTo(dx + 6, top + 4);
      g.lineTo(dx, top); g.lineTo(dx - 6, top + 4); g.close(); g.stroke();
      g.moveTo(dx, top + 12); g.lineTo(dx, top + 4); g.stroke();
    } else if (this.wardBroken) {
      this.tint.set(185, 153, 214, 255); g.strokeColor = this.tint; g.lineWidth = 2.3;
      g.moveTo(dx - 2, top + 16); g.lineTo(dx - 9, top + 8); g.lineTo(dx - 3, top + 1); g.stroke();
      g.moveTo(dx + 4, top + 14); g.lineTo(dx + 10, top + 7); g.lineTo(dx + 4, top - 1); g.stroke();
    } else if (ward) {
      this.tint.set(202, 159, 255, 255); g.strokeColor = this.tint; g.lineWidth = 2.4;
      g.moveTo(dx, top + 16); g.lineTo(dx + 7, top + 8); g.lineTo(dx, top);
      g.lineTo(dx - 7, top + 8); g.close(); g.stroke();
      g.moveTo(dx - 3, top + 8); g.lineTo(dx + 3, top + 8); g.stroke();
    }
    if (healer) {
      const x = armor || ward || this.armorBroken || this.wardBroken ? 11 : 0;
      this.tint.set(136, 230, 127, 255); g.strokeColor = this.tint; g.lineWidth = 3;
      g.moveTo(x - 6, top + 8); g.lineTo(x + 6, top + 8); g.moveTo(x, top + 2); g.lineTo(x, top + 14); g.stroke();
    } else if (preparing || charging) {
      this.tint.set(255, 177, 70, 255); g.strokeColor = this.tint; g.lineWidth = 3;
      for (let i = 0; i < 2; i++) {
        const y = top + 15 - i * 8;
        g.moveTo(-6, y); g.lineTo(0, y - 5); g.lineTo(6, y); g.stroke();
      }
      if (preparing) {
        g.lineWidth = 2; g.moveTo(-o.def.radius, -3); g.lineTo(0, -18); g.lineTo(o.def.radius, -3); g.stroke();
      }
    }
    if (this.pendingHeal > 0) {
      const spec = o.def.healing || ENEMY_HEALING;
      const progress = 1 - this.pendingHeal / Math.max(.2, spec.windup);
      this.tint.set(136, 230, 127, 230); g.strokeColor = this.tint; g.lineWidth = 3;
      for (let i = 0; i <= Math.ceil(progress * 24); i++) {
        const a = -Math.PI / 2 + Math.min(progress, i / 24) * Math.PI * 2;
        const x = Math.cos(a) * o.def.radius * 1.2, y = -o.def.radius * .65 + Math.sin(a) * o.def.radius * .4;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    if (this.guarding) {
      this.tint.set(112, 209, 238, 220); g.strokeColor = this.tint; g.lineWidth = 3;
      g.ellipse(0, -o.def.radius * .65, o.def.radius * 1.15, o.def.radius * .4); g.stroke();
    }
    if (this.pendingStrike > 0) {
      const width = o.isBoss ? 84 : 52, y = o.def.radius * 3.2 + (o.isBoss ? 24 : 6);
      const progress = 1 - this.pendingStrike / Math.max(.01, o.def.windup || 1);
      this.tint.set(48, 31, 24, 230); g.fillColor = this.tint; g.rect(-width / 2, y, width, 7); g.fill();
      this.tint.set(255, 158, 53, 255); g.fillColor = this.tint; g.rect(-width / 2, y, width * progress, 7); g.fill();
    }
  }
}
