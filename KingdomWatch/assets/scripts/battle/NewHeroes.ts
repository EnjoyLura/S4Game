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
import { C, CA, N } from '../ui/UIKit';
import { Sfx } from '../core/Sfx';

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
}
interface Blast { x: number; y: number; radius: number; age: number; }

export class CannonHero extends HeroBase {
  readonly id = 'cannon'; readonly name = '布洛克·铜铸';
  readonly chargeMax = CANNON.energy; readonly skillMax = CANNON.cooldown;
  private shells: Shell[] = [];
  private blasts: Blast[] = [];
  private blastInk: Graphics | null = null;
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
      radius: cfg.radius * this.stats.skillRangeMul, skill: false, ult: true, echo: false, extra: true });
    Sfx.cast(this.id, true);
    return true;
  }
  protected updateQueues(dt: number, mgr: MonsterManager, projs: ProjectileManager): void {
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const shot = this.shells[i]; shot.delay -= dt;
      if (shot.delay > 0) continue;
      if (shot.detonate) { this.detonate(shot, mgr); this.shells.splice(i, 1); continue; }
      if (!projs.hasCapacity) continue;
      const sx = shot.ult ? shot.x : this.x, sy = shot.ult ? LO.half + 40 : HERO_Y + 60;
      const dx = shot.x - sx, dy = shot.y - sy, len = Math.hypot(dx, dy) || 1;
      const critical = Math.random() < this.stats.critRate;
      const spec: ProjSpec = { x: sx, y: sy, dirX: dx / len, dirY: dy / len, speed: shot.ult ? 1350 : 760,
        dmg: shot.damage * (critical ? this.stats.critMul : 1), crit: critical, color: '#D5A641', heroId: this.id,
        size: shot.skill || shot.ult ? 13 : 10, explodeR: shot.radius, explodeMul: .7,
        ability: shot.skill, ult: shot.ult, groundTarget: { x: shot.x, y: shot.y }, resCut: this.stats.defIgnore,
        onGroundImpact: () => {
          if (!this.node.isValid) return;
          if (shot.ult) { this.flyingUlt = Math.max(0, this.flyingUlt - 1); this.ultimateBeat(shot.x, shot.y, .7, true); }
          this.blasts.push({ x: shot.x, y: shot.y, radius: shot.radius, age: 0 });
          if (this.blasts.length > 16) this.blasts.shift();
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
      if (shot.ult) this.flyingUlt++;
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
    this.drawBlasts(dt);
  }
  private detonate(shot: Shell, mgr: MonsterManager): void {
    for (const m of mgr.list) {
      if (m.dead || (m.x - shot.x) ** 2 + (m.y - shot.y) ** 2 > shot.radius ** 2) continue;
      m.takeDamage(shot.damage, false, this.id, false, this.stats.defIgnore);
      this.lastDmg?.add(this.id, m.lastDamageTaken);
    }
    this.blasts.push({ x: shot.x, y: shot.y, radius: shot.radius * .85, age: 0 });
    if (this.blasts.length > 16) this.blasts.shift();
    Sfx.impact(this.id, true);
  }
  private drawBlasts(dt: number): void {
    if (!this.blasts.length && !this.blastInk) return;
    if (!this.blastInk) this.blastInk = N('cannonShockwaves', this.node.parent!.parent!.getChildByName('FxLayer')!).addComponent(Graphics);
    const g = this.blastInk; g.clear();
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i]; b.age += dt;
      if (b.age >= .36) { this.blasts.splice(i, 1); continue; }
      const p = b.age / .36;
      g.strokeColor = CA('#E9B84F', (1 - p) * .8); g.lineWidth = 5 * (1 - p) + 1;
      g.ellipse(b.x, b.y, b.radius * (.35 + .65 * p), b.radius * (.22 + .4 * p)); g.stroke();
      g.fillColor = CA('#FFE1A0', (1 - p) * .6);
      for (let k = 0; k < 7; k++) {
        const angle = k * Math.PI * 2 / 7, radius = b.radius * p;
        g.circle(b.x + Math.cos(angle) * radius, b.y + Math.sin(angle) * radius * .65, 3 * (1 - p) + 1); g.fill();
      }
    }
  }
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
  private beamInk: Graphics | null = null;
  private clock = 0;
  constructor(parent: Node, x: number, stats: HeroStats, private line: LineDefense) { super(parent, x, stats); }

  protected buildVisual(parent: Node): void { this.staticArt = visual(parent, this.node, this.x, 'siphon'); }
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
    this.line.healAmount(Math.min(actual * fraction, this.line.maxHp * cap * SIPHON.tick));
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
    this.clock += dt;
    const primary = this.selectNormalTarget(mgr);
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
    this.drawBeams(primary);
  }
  private drawBeams(primary: Monster | null): void {
    if (!this.beamInk) this.beamInk = N('lifeSiphonBeams', this.node.parent!.parent!.getChildByName('FxLayer')!).addComponent(Graphics);
    const g = this.beamInk; g.clear();
    if (!primary || primary.dead) return;
    const draw = (m: Monster, strength: number): void => {
      if (m.dead) return;
      const sx = this.x, sy = HERO_Y + 66, tx = m.x, ty = m.y + m.def.radius * .45;
      for (let layer = 0; layer < 3; layer++) {
        g.strokeColor = CA(layer === 2 ? '#FFD4E7' : '#E65C96', layer === 0 ? .13 : layer === 1 ? .7 : .9);
        g.lineWidth = (layer === 0 ? 10 : layer === 1 ? 4 : 1.2) * strength;
        g.moveTo(sx, sy);
        for (let i = 1; i <= 16; i++) {
          const t = i / 16, wave = Math.sin(t * 15 - this.clock * 6) * Math.sin(t * Math.PI) * 4;
          g.lineTo(sx + (tx - sx) * t + wave, sy + (ty - sy) * t);
        }
        g.stroke();
      }
      // Moving motes travel from victim to caster to communicate life being reclaimed.
      g.fillColor = C('#FFC2DC');
      for (let i = 0; i < 3; i++) {
        const t = 1 - (this.clock * .8 + i / 3) % 1;
        g.circle(sx + (tx - sx) * t, sy + (ty - sy) * t, 2 * strength); g.fill();
      }
    };
    draw(primary, 1 + this.ramp * .4);
    const drawn = new Set<Monster>([primary]);
    for (const b of this.beams) if (b.mob.lifeId === b.life && !drawn.has(b.mob)) {
      draw(b.mob, b.kind === 'ult' ? .85 : .65); drawn.add(b.mob);
    }
  }
}
