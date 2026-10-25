/** New hero attacks use the existing battle clock, damage path and pooled projectiles. */
import { Graphics, Node } from 'cc';
import { HeroBase } from './Hero';
import { Monster, MonsterManager } from './Monster';
import { ProjectileManager, ProjSpec } from './Projectile';
import { DamageService } from './DamageService';
import { LineDefense } from './LineDefense';
import { HeroStats } from '../config/Cards';
import { CANNON, SIPHON, cannonSkillCfg, cannonUltCfg, siphonSkillCfg, siphonUltCfg } from '../config/NewHeroConfig';
import { HERO_Y, LINE_Y, LO } from '../config/GameConfig';
import { artSprite } from '../ui/Ux';
import { CA, N } from '../ui/UIKit';
import { Sfx } from '../core/Sfx';
import { CannonBlastVFX, SiphonBeamVFX } from './NewHeroVFX';

function visual(parent: Node, node: Node, x: number, hero: string): Node {
  node.layer = parent.layer; node.setParent(parent); node.setPosition(x, HERO_Y, 0);
  const shadow = N('heroContactShadow', node).addComponent(Graphics);
  shadow.fillColor = CA('#221A16', .3); shadow.ellipse(0, -74, 29, 8); shadow.fill();
  const foot = hero === 'cannon' ? 1395 : 1445, height = 180;
  return artSprite(node, 0, -76 + height * (foot / 1536 - .5), 120, height,
    'new_heroes_v105/' + hero + '_battle', { sliced: false });
}
function point(m: Monster, seconds: number): { x: number; y: number } {
  const moving = m.state === 'move' && !m.immobilized;
  const dy = moving ? m.def.speed * (m.slowT > 0 ? 1 - m.slowAmp : 1) * seconds : 0;
  return { x: Math.max(-330, Math.min(330, m.x)),
    y: Math.max(LINE_Y + 24, Math.min(LO.half - LO.notchTop - 136, m.y - dy)) };
}
function cluster(mgr: MonsterManager, x: number, range: number, radius: number): Monster | null {
  const candidates = mgr.list.filter(m => !m.dead && m.y < LO.half - LO.notchTop - 136
    && m.y >= LINE_Y && (m.x - x) ** 2 + (m.y - HERO_Y) ** 2 <= range * range);
  let best: Monster | null = null, score = -1;
  for (const m of candidates) {
    let count = 0;
    for (const o of candidates) if ((o.x - m.x) ** 2 + (o.y - m.y) ** 2 <= radius * radius) count++;
    if (count > score || count === score && m.y < (best?.y ?? Infinity)) { best = m; score = count; }
  }
  return best;
}
interface Shell {
  delay: number; x: number; y: number; damage: number; radius: number;
  skill: boolean; ult: boolean; echo: boolean; extra: boolean; detonate?: boolean;
  launchX?: number;
}

export class CannonHero extends HeroBase {
  readonly id = 'cannon'; readonly name = '布洛克·铜铸';
  readonly chargeMax = CANNON.energy; readonly skillMax = CANNON.cooldown;
  private shells: Shell[] = [];
  private blastFX: CannonBlastVFX | null = null;
  private loadingCycle = 0;
  private flyingUlt = 0;

  protected buildVisual(parent: Node): void { this.staticArt = visual(parent, this.node, this.x, 'cannon'); }
  protected shoot(target: Monster): void {
    if (this.shells.length >= 48) return;
    const p = point(target, Math.hypot(target.x - this.x, target.y - HERO_Y - 60) / 760);
    this.shells.push({ delay: 0, ...p, damage: this.effAtk * this.stats.normalMul, radius: CANNON.blast,
      skill: false, ult: false, echo: false, extra: false });
  }
  protected castSkill(mgr: MonsterManager): void {
    const cfg = cannonSkillCfg(this.stats.skillLv), radius = CANNON.skillBlast * cfg.radiusMul * this.stats.skillRangeMul;
    const target = cluster(mgr, this.x, this.stats.skillRange, radius);
    if (!target || this.shells.length >= 48) return;
    this.skillCd = this.skillCdTotal;
    const flight = Math.hypot(target.x - this.x, target.y - HERO_Y - 60) / 760;
    this.shells.push({ delay: 0, ...point(target, flight), damage: this.abilityDamage(cfg.mul), radius,
      skill: true, ult: false, echo: false, extra: false });
  }
  get ultimateRemaining(): number {
    return Math.max(this.ultimateT, this.flyingUlt || this.shells.some(s => s.ult) ? .01 : 0);
  }
  castUlt(mgr: MonsterManager): boolean {
    const alive = mgr.list.filter(m => !m.dead && m.y <= LO.half - LO.notchTop - 136 && m.y >= LINE_Y);
    if (!this.ultReady || !alive.length) return false;
    const cfg = cannonUltCfg(this.stats.ultLv), count = cfg.shots + (this.stats.cannonUltShots || 0);
    this.charge = 0;
    this.beginUltimate(Math.max(4.5, .6 + count * .26 + 1));
    // Cover separate groups before repeating a landing in the same group.
    const ordered = alive.slice().sort((a, b) => a.y - b.y);
    const targets: Monster[] = [];
    while (ordered.length) {
      const target = ordered.shift()!; targets.push(target);
      for (let k = ordered.length - 1; k >= 0; k--)
        if ((ordered[k].x - target.x) ** 2 + (ordered[k].y - target.y) ** 2 < cfg.radius ** 2) ordered.splice(k, 1);
    }
    for (let i = 0; i < count; i++) this.shells.push({ delay: .6 + i * .26,
      ...point(targets[i % targets.length], .8 + i * .26), damage: this.abilityDamage(cfg.mul, true),
      radius: cfg.radius * this.stats.skillRangeMul, skill: false, ult: true, echo: false, extra: true,
      launchX: Math.max(-350, Math.min(350, targets[i % targets.length].x + (i % 2 ? 120 : -120))) });
    Sfx.cast(this.id, true);
    return true;
  }
  protected updateQueues(dt: number, mgr: MonsterManager, projs: ProjectileManager): void {
    this.blastFX?.tick(dt);
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const shot = this.shells[i]; shot.delay -= dt;
      if (shot.delay > 0) continue;
      if (shot.detonate) { this.detonate(shot, mgr); this.shells.splice(i, 1); continue; }
      if (!projs.hasCapacity) continue;
      const sx = shot.ult ? shot.launchX ?? shot.x : this.x, sy = shot.ult ? LO.half + 40 : HERO_Y + 60;
      const dx = shot.x - sx, dy = shot.y - sy, len = Math.hypot(dx, dy) || 1;
      let landing = 0;
      const critical = Math.random() < this.stats.critRate;
      const spec: ProjSpec = { x: sx, y: sy, dirX: dx / len, dirY: dy / len, speed: shot.ult ? 1350 : 760,
        dmg: shot.damage * (critical ? this.stats.critMul : 1), crit: critical, color: '#D5A641', heroId: this.id,
        size: shot.skill || shot.ult ? 13 : 10, explodeR: shot.radius, explodeMul: .7,
        ability: shot.skill, ult: shot.ult, groundTarget: { x: shot.x, y: shot.y }, resCut: this.stats.defIgnore,
        onGroundImpact: () => {
          if (!this.node.isValid) return;
          if (landing) this.blastFX?.landed(landing);
          if (shot.ult) { this.flyingUlt = Math.max(0, this.flyingUlt - 1); this.ultimateBeat(shot.x, shot.y, .7, true); }
          this.blast(shot, shot.ult ? 'ult' : shot.skill ? 'skill' : 'normal');
          if (shot.skill) for (const m of mgr.list) {
            if (m.dead || (m.x - shot.x) ** 2 + (m.y - shot.y) ** 2 > shot.radius ** 2) continue;
            m.applyResistanceShred('physical', CANNON.shred, cannonSkillCfg(this.stats.skillLv).shredSeconds);
            if (this.stats.cannonKnockback) m.applyKnockback(this.stats.cannonKnockback);
          }
          if (!shot.skill && !shot.ult && !shot.echo && this.stats.cannonEcho && this.shells.length < 48)
            this.shells.push({ ...shot, delay: .35, damage: shot.damage * this.stats.cannonEcho,
              echo: true, extra: true, detonate: true });
          Sfx.impact(this.id, true);
        } };
      if (!projs.fire(spec)) continue;
      if (shot.ult) { this.flyingUlt++; landing = this.effects().target(shot.x, shot.y, len / spec.speed); }
      else {
        this.animateAttack(shot.skill, dx, dy);
        if (!shot.extra) Sfx.cast(this.id);
      }
      this.shells.splice(i, 1);
      if (!shot.skill && !shot.ult && !shot.extra && this.stats.cannonLoader && ++this.loadingCycle >= 4) {
        this.loadingCycle = 0;
        this.shells.push({ ...shot, damage: shot.damage * .6, delay: .18, extra: true });
      }
    }
  }
  private detonate(shot: Shell, mgr: MonsterManager): void {
    for (const m of mgr.list) {
      if (m.dead || (m.x - shot.x) ** 2 + (m.y - shot.y) ** 2 > shot.radius ** 2) continue;
      m.takeDamage(shot.damage, false, this.id, false, this.stats.defIgnore);
      this.lastDmg?.add(this.id, m.lastDamageTaken);
    }
    this.blast(shot, 'echo');
    Sfx.impact(this.id, true);
  }
  private blast(shot: Shell, kind: 'normal' | 'skill' | 'ult' | 'echo'): void {
    this.effects().burst(shot.x, shot.y, shot.radius, kind);
  }
  private effects(): CannonBlastVFX { return this.blastFX ||= new CannonBlastVFX(this.node.parent!.parent!); }
  renderEffects(): void { this.blastFX?.render(); }
  warmEffects(): void { this.effects(); }
}

interface Beam { mob: Monster; life: number; kind: 'twin' | 'skill' | 'ult'; }
export class SiphonHero extends HeroBase {
  readonly id = 'siphon'; readonly name = '薇拉·绯契';
  readonly chargeMax = SIPHON.energy; readonly skillMax = SIPHON.cooldown;
  private primary: Monster | null = null;
  private primaryLife = 0;
  private ramp = 0;
  private heldSeconds = 0;
  private skillSeconds = 0;
  private harvestSeconds = 0;
  private harvestDelay = 0;
  private beams: Beam[] = [];
  private beamFX: SiphonBeamVFX | null = null;
  constructor(parent: Node, x: number, stats: HeroStats, private line: LineDefense) { super(parent, x, stats); }

  protected buildVisual(parent: Node): void { this.staticArt = visual(parent, this.node, this.x, 'siphon'); }
  warmEffects(): void { this.beamFX ||= new SiphonBeamVFX(this.node.parent!.parent!); }
  protected attackInterval(): number { return SIPHON.tick; }
  private valid(m: Monster | null, life: number, mgr: MonsterManager): m is Monster {
    return !!m && m.lifeId === life && !m.dead && m.node.isValid && m.node.activeInHierarchy && mgr.list.includes(m);
  }
  protected selectNormalTarget(mgr: MonsterManager): Monster | null {
    if (this.valid(this.primary, this.primaryLife, mgr)) return this.primary;
    if (this.primary) {
      this.ramp *= this.stats.siphonInheritance || 0;
      this.heldSeconds = 0;
    }
    this.primary = mgr.pickTarget(this.x, HERO_Y, this.stats.range);
    this.primaryLife = this.primary?.lifeId || 0;
    return this.primary;
  }
  protected shoot(target: Monster, _mgr: MonsterManager, _projs: ProjectileManager, dmg?: DamageService): void {
    const service = dmg || this.lastDmg;
    if (!service) return;
    const harvesting = this.harvestSeconds > 0 && this.harvestDelay <= 0;
    const base = this.effAtk * this.stats.aspd * this.stats.normalMul * SIPHON.tick;
    const take = (m: Monster, amount: number): number => {
      if (m.dead) return 0;
      const critical = Math.random() < this.stats.critRate;
      m.takeDamage(amount * (critical ? this.stats.critMul : 1), critical, this.id, false, this.stats.defIgnore);
      const dealt = m.lastDamageTaken;
      service.add(this.id, dealt);
      if (dealt > 0) this.beamFX?.hit(m.x, m.y + m.def.radius * .45, m.lifeId, harvesting);
      return dealt;
    };
    let actual = take(target, base * (1 + this.ramp) * (harvesting ? siphonUltCfg(this.stats.ultLv).primaryMul : 1));
    for (const b of this.beams) {
      if (b.mob.lifeId !== b.life || b.mob.dead) continue;
      const amount = b.kind === 'twin' ? base * (this.stats.siphonTwin || 0)
        : b.kind === 'skill' ? this.abilityDamage(siphonSkillCfg(this.stats.skillLv).mul) * SIPHON.tick
          : this.abilityDamage(siphonUltCfg(this.stats.ultLv).mul, true) * SIPHON.tick;
      actual += take(b.mob, amount);
    }
    const fraction = harvesting ? SIPHON.ultimateHealFraction : SIPHON.healFraction;
    const cap = harvesting ? SIPHON.ultimateHealCapPerSecond : SIPHON.healCapPerSecond;
    const healed = this.line.healAmount(Math.min(actual * fraction, this.line.maxHp * cap * SIPHON.tick));
    if (healed > 0) this.beamFX?.healed();
    this.animateAttack(false, target.x - this.x, target.y - HERO_Y - 60);
  }
  protected castSkill(mgr: MonsterManager): void {
    if (!this.selectNormalTarget(mgr)) return;
    this.skillCd = this.skillCdTotal;
    this.skillSeconds = siphonSkillCfg(this.stats.skillLv).duration;
    Sfx.cast(this.id);
  }
  get ultShowDuration(): number { return siphonUltCfg(this.stats.ultLv).duration + .6; }
  castUlt(mgr: MonsterManager): boolean {
    if (!this.ultReady || !this.selectNormalTarget(mgr)) return false;
    this.charge = 0;
    this.harvestDelay = .6;
    this.harvestSeconds = siphonUltCfg(this.stats.ultLv).duration;
    this.beginUltimate();
    Sfx.cast(this.id, true);
    return true;
  }
  protected updateQueues(dt: number, mgr: MonsterManager): void {
    const primary = this.selectNormalTarget(mgr);
    if (primary && !this.beamFX) this.beamFX = new SiphonBeamVFX(this.node.parent!.parent!);
    this.beamFX?.tick(dt);
    this.skillSeconds = Math.max(0, this.skillSeconds - dt);
    const delay = this.harvestDelay;
    this.harvestDelay = Math.max(0, delay - dt);
    this.harvestSeconds = Math.max(0, this.harvestSeconds - Math.max(0, dt - delay));
    if (primary) {
      this.heldSeconds += dt;
      this.ramp = Math.min(SIPHON.rampMax, this.ramp + SIPHON.rampPerSecond * dt);
      if (this.stats.siphonShred && this.heldSeconds >= 3) primary.applyResistanceShred('magic', this.stats.siphonShred, .35);
    }
    const counts = { twin: this.stats.siphonTwin ? 1 : 0,
      skill: this.skillSeconds > 0 ? siphonSkillCfg(this.stats.skillLv).branches + (this.stats.siphonBranches || 0) : 0,
      ult: this.harvestSeconds > 0 && this.harvestDelay <= 0 ? siphonUltCfg(this.stats.ultLv).branches + (this.stats.siphonBranches || 0) : 0 };
    const next: Beam[] = [];
    let nearby: Monster[] | null = null;
    for (const kind of ['ult', 'skill', 'twin'] as const) {
      const count = counts[kind];
      if (!primary || !count) continue;
      // Each channel owns its targets. Casting cannot evict an existing normal beam.
      // Different channels may hit the same enemy; each channel never repeats one target.
      const used = new Set<Monster>([primary]);
      const keep = this.beams.filter(b => b.kind === kind && this.valid(b.mob, b.life, mgr) && !used.has(b.mob)).slice(0, count);
      for (const b of keep) { next.push(b); used.add(b.mob); }
      if (keep.length >= count) continue;
      // Sort once only when a connection needs replacement, never for full stable channels.
      if (!nearby) nearby = mgr.list.filter(m => !m.dead).sort((a, b) => (a.x - primary.x) ** 2 + (a.y - primary.y) ** 2
        - (b.x - primary.x) ** 2 - (b.y - primary.y) ** 2);
      for (const m of nearby) {
        if (keep.length >= count) break;
        const radius = (kind === 'ult' ? 520 : 300) * this.stats.skillRangeMul;
        if (m.dead || used.has(m) || (m.x - primary.x) ** 2 + (m.y - primary.y) ** 2 > radius ** 2) continue;
        const b: Beam = { mob: m, life: m.lifeId, kind }; keep.push(b); next.push(b); used.add(m);
      }
    }
    this.beams = next;
  }
  renderEffects(): void {
    const fx = this.beamFX;
    if (!fx) return;
    // Raised palm center in the 120x180 sprite, mirrored with the whole character.
    fx.begin(this.x + 43.4 * (this.staticArt?.scale.x ?? 1), HERO_Y + 51,
      this.harvestSeconds > 0 && this.harvestDelay <= 0);
    const primary = this.primary;
    if (!primary || primary.dead || primary.lifeId !== this.primaryLife) { fx.end(); return; }
    fx.beam(primary.x, primary.y + primary.def.radius * .45, 1 + this.ramp * .4, .6);
    const drawn = new Set<Monster>([primary]);
    for (const b of this.beams) if (b.mob.lifeId === b.life && !drawn.has(b.mob)) {
      if (!b.mob.dead) fx.beam(b.mob.x, b.mob.y + b.mob.def.radius * .45, b.kind === 'ult' ? .85 : .65, b.life % 17);
      drawn.add(b.mob);
    }
    fx.end();
  }
}
