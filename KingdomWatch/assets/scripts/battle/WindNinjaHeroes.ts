/** Wind/ninja simulation uses the existing battle clock and ordinary damage/projectile paths.
 * Integration: instantiate these classes in the hero factory; preload new_heroes_v120/{id}_battle.
 * ProjSpec.endPoint must preserve the visual flight after its contact budget is exhausted.
 * Recall's optional initialContactLifeId orders coincident t=0 sweep entries, without a synthetic hit.
 */
import { Graphics, Node } from 'cc';
import { HeroBase } from './Hero';
import { Monster, MonsterManager } from './Monster';
import { ProjectileManager, ProjSpec } from './Projectile';
import { DamageService } from './DamageService';
import { HeroStats } from '../config/Cards';
import { WIND, NINJA, windSkillCfg, windUltCfg, ninjaSkillCfg, ninjaUltCfg } from '../config/WindNinjaConfig';
import { DESIGN_W, HERO_Y, LINE_Y, LO, MAX_PROJS } from '../config/GameConfig';
import { AttackSlot, TargetLayer } from '../config/Targeting';
import { Sfx } from '../core/Sfx';
import { ULT_TIMING } from './UltimateTiming';
import { artSprite } from '../ui/Ux';
import { CA, N } from '../ui/UIKit';
import { WindNinjaVFX, WindNinjaAreaView } from './WindNinjaVFX';
import { bodyDownSpeed, densestBodyArea, finiteReturnPath, interceptDirection, FieldPoint } from './WindNinjaGeometry';
import { stableWindTarget, moveWindField } from './WindFieldMotion';

const EPS = 1e-7, AREA_CAP = 8, SEEK_INTERVAL = .25;
const BOSS_WIND_SLOW = .25;
/** Temporary intersection keeps the new module compatible while the parent extends ProjSpec. */
type RecallProjectile = ProjSpec & { initialContactLifeId?: number };
interface Area extends WindNinjaAreaView {
  delay: number; tickIn: number; interval: number; mul: number; pull: number;
  seekIn: number; destination: FieldPoint;velocity:FieldPoint;
}
interface NormalRow { delay: number; }

function visual(parent: Node, node: Node, x: number, id: 'wind' | 'ninja'): Node {
  node.layer = parent.layer; node.setParent(parent); node.setPosition(x, HERO_Y, 0);
  const shadow = N('heroContactShadow', node).addComponent(Graphics);
  shadow.fillColor = CA('#243633', .28); shadow.ellipse(0, -74, 27, 7); shadow.fill();
  // Final aliases are 512x768; the shared source foot is y=744, including the alpha gutter.
  return artSprite(node, 0, -76 + 180 * (744 / 768 - .5), 120, 180,
    'new_heroes_v120/' + id + '_battle', { sliced: false });
}
/** Membership is already established by loops traversing mgr.list. */
function liveNode(m: Monster): boolean {
  return !m.dead && m.node.isValid && m.node.activeInHierarchy;
}
/** Persisted references also need their original life and current manager membership. */
function valid(m: Monster, lifeId: number, mgr: MonsterManager): boolean {
  return m.lifeId === lifeId && liveNode(m) && mgr.list.indexOf(m) >= 0;
}
function inRange(m: Monster, x: number, range: number): boolean {
  return (m.x - x) ** 2 + (m.hitY - HERO_Y) ** 2 <= range * range;
}
function cluster(mgr: MonsterManager, x: number, y: number, range: number, radius: number, minY = LINE_Y + 8): FieldPoint | null {
  return densestBodyArea(mgr.list, x, y, range, radius, {
    left: -DESIGN_W / 2 + 12, right: DESIGN_W / 2 - 12,
    bottom: Math.max(LINE_Y + 8, minY), top: LO.half - LO.notchTop - 136,
  });
}

/** Shared numerical cards are read directly from HeroStats; no hero-specific cards are introduced. */
abstract class WindNinjaHeroBase extends HeroBase {
  protected clock = 0;
  private facing = -1;
  protected areas: Area[] = [];
  protected manager: MonsterManager | null = null;
  private rows: NormalRow[] = [];
  private fx: WindNinjaVFX | null = null;

  constructor(parent: Node, x: number, stats: HeroStats) {
    super(parent, x, stats);
    this.node.once(Node.EventType.NODE_DESTROYED, () => {
      this.rows.length = this.areas.length = 0; this.fx?.destroy(); this.fx = null;
      this.manager = null; this.disposeAttachments();
    });
  }
  targetLayer(_slot: AttackSlot): TargetLayer { return 'all'; }
  protected faceAttack(dx: number, dy: number): void {
    const length = Math.hypot(dx, dy);
    if (!Number.isFinite(length) || length <= EPS || Math.abs(dx / length) < .06) return;
    this.facing = dx > 0 ? 1 : -1;
    // Both full-figure source paintings face left, including the raised throwing hand.
    this.staticArt?.setScale(this.facing > 0 ? -1 : 1, 1, 1);
  }
  protected disposeAttachments(): void {}
  protected drawAttachments(_fx: WindNinjaVFX): void {}
  protected effects(): WindNinjaVFX {
    return this.fx ||= new WindNinjaVFX(this.node.parent!.parent || this.node.parent!, this.id === 'wind');
  }
  warmEffects(): void { this.effects(); }
  renderEffects(): void {
    if (!this.node.isValid || !this.fx) return;
    this.fx.begin();
    for (const area of this.areas) if (area.delay <= EPS) this.fx.area(area);
    this.drawAttachments(this.fx); this.fx.end();
  }
  protected hand(target: Monster): FieldPoint {
    return this.handAt(target.x,target.hitY);
  }
  protected handAt(x: number,y: number): FieldPoint {
    this.faceAttack(x - this.x, y - HERO_Y - 60);
    return { x: this.x + this.facing * 35, y: HERO_Y + 90 };
  }
  protected normalSpec(x: number, y: number, dx: number, dy: number): ProjSpec {
    const critical = Math.random() < this.stats.critRate;
    const wind = this.id === 'wind';
    return { x, y, dirX: dx, dirY: dy, targetLayer: 'all', heroId: this.id,
      visual: wind ? 'wind' : 'shuriken', speed: wind ? WIND.bladeSpeed : NINJA.speed,
      lineHalfLength: wind ? WIND.bladeHalfLength : undefined,
      lineForwardOffset: wind ? WIND.bladeForwardOffset : undefined,
      size: wind ? 10 : 7, ttl: 3.2, crit: critical,
      dmg: this.effAtk * (this.stats.normalMul || 1) * (critical ? this.stats.critMul : 1),
      color: wind ? '#76DBBD' : '#BFE9EE', resCut: this.stats.defIgnore || 0,
      pierce: (wind ? WIND.bladePierce : 0) + (this.stats.pierce || 0)
        + (Math.random() < (this.stats.pierceChance || 0) ? 1 : 0),
      pierceDamage: wind ? WIND.bladeFalloff : undefined,
      split: this.stats.split || 0, explodeR: this.stats.explodeR || 0, explodeMul: this.stats.explodeMul,
      slowRatio: this.stats.slowOnHit || 0, slowDur: this.stats.slowDur || 2,
      burnDps: this.stats.burnOnHit ? this.effAtk * this.stats.burnOnHit * (this.stats.burnMul || 1) : 0,
      burnDur: 3, shockAmp: this.stats.shockOnHit || 0, shockDur: 3,
      ...this.targetBonuses() };
  }
  protected abstract releaseNormal(target: Monster, mgr: MonsterManager, projs: ProjectileManager, angle: number): boolean;
  protected shoot(target: Monster, mgr: MonsterManager, projs: ProjectileManager): void {
    this.releaseRow(target, mgr, projs);
    const count = Math.min(MAX_PROJS - this.rows.length, Math.max(0, Math.floor(this.stats.serial || 0)));
    for (let i = 1; i <= count; i++) this.rows.push({ delay: i * .12 });
  }
  private releaseRow(target: Monster, mgr: MonsterManager, projs: ProjectileManager): void {
    const columns = Math.min(MAX_PROJS, 1 + Math.max(0, Math.floor(this.stats.fan || 0)));
    let launched = false;
    for (let c = 0; c < columns; c++) {
      if (!projs.hasCapacity) break;
      // A new fast row reselects through the ninja's reservation-aware target policy.
      const t = c === 0 && valid(target, target.lifeId, mgr) ? target : this.selectNormalTarget(mgr);
      if (!t) break;
      const side = c === 0 ? 0 : Math.ceil(c / 2) * (c % 2 ? 1 : -1);
      if (this.releaseNormal(t, mgr, projs, side * 7 * Math.PI / 180)) launched = true;
    }
    if (launched) Sfx.shoot(this.id); // One release per successful fan/serial row, including partial rows.
  }
  protected queuedShotDelay(): number {
    let delay = Infinity;
    for (const row of this.rows) delay = Math.min(delay, row.delay);
    return delay;
  }
  protected updateQueues(dt: number, mgr: MonsterManager, projs: ProjectileManager): void {
    this.manager = mgr; this.clock += dt; this.fx?.tick(dt);
    for (let i = 0; i < this.rows.length;) {
      const row = this.rows[i]; row.delay -= dt;
      if (row.delay > EPS) { i++; continue; }
      if (!projs.hasCapacity) { row.delay = 0; i++; continue; }
      this.rows.splice(i, 1);
      const target = this.selectNormalTarget(mgr);
      if (target) this.releaseRow(target, mgr, projs);
    }
    for (let i = this.areas.length - 1; i >= 0; i--) {
      const area = this.areas[i]; this.advanceArea(area, dt, mgr);
      if (area.age >= area.duration - EPS) this.areas.splice(i, 1);
    }
  }
  protected addArea(kind: Area['kind'], point: FieldPoint, radius: number, duration: number,
    interval: number, mul: number, pull: number, delay = 0): void {
    this.areas.push({ kind, x: point.x, y: point.y, radius, duration, age: 0,
      delay, interval, tickIn: interval, mul, pull, seekIn: 0, destination: { ...point },velocity:{x:0,y:0} });
    this.effects();
  }
  private advanceArea(a: Area, dt: number, mgr: MonsterManager): void {
    let remaining = Math.max(0, dt);
    if (a.delay > 0) {
      const wait = Math.min(remaining, a.delay); a.delay -= wait; remaining -= wait;
    }
    // Divide at damage and steering boundaries: large simulation steps retain every scheduled tick.
    while (remaining > EPS && a.age < a.duration - EPS) {
      if (a.kind === 'tornado' && a.seekIn <= EPS) {
        const point = cluster(mgr, a.x, a.y, Infinity, a.radius, a.y);
        a.destination = stableWindTarget(mgr.list,a,a.destination,
          point || { x: a.x, y: Math.max(a.y, LO.half - LO.notchTop - 136) },a.radius);
        a.seekIn = SEEK_INTERVAL;
      }
      const step = Math.min(remaining, a.duration - a.age, a.tickIn,
        a.kind === 'tornado' ? a.seekIn : Infinity);
      if (a.kind === 'tornado') {
        moveWindField(a,a.velocity,a.destination,WIND.tornadoSpeed,step); a.seekIn -= step;
      }
      if (a.pull > 0) for (const m of mgr.list) {
        if (!liveNode(m) || (m.x - a.x) ** 2 + (m.hitY - a.y) ** 2 > a.radius ** 2) continue;
        if (m.isBoss) m.applySlow(BOSS_WIND_SLOW, Math.max(.18, step * 2));
        else m.pullToward(a.x, a.y, a.pull * step, a.kind === 'tornado'); // No tornado-induced movement toward the keep.
      }
      a.age += step; a.tickIn -= step; remaining -= step;
      if (a.tickIn <= EPS) {
        this.damageArea(a, mgr); a.tickIn = a.interval;
      }
    }
  }
  private damageArea(a: Area, mgr: MonsterManager): void {
    const ultimate = a.kind !== 'eye', amount = this.abilityDamage(a.mul, ultimate);
    let hit = false;
    for (const m of mgr.list) {
      const life = m.lifeId;
      if (!liveNode(m) || (m.x - a.x) ** 2 + (m.hitY - a.y) ** 2 > a.radius ** 2) continue;
      const critical = Math.random() < this.stats.critRate;
      let damage = amount * (critical ? this.stats.critMul : 1);
      if (m.def.elite || m.isBoss) damage *= 1 + (this.stats.executeBonus || 0);
      if (m.hp < m.maxHp * .3) damage *= 1 + (this.stats.lowHpBonus || 0);
      m.takeDamage(damage, critical, this.id, false, this.stats.defIgnore || 0,
        Math.atan2(m.hitY - a.y, m.x - a.x), ultimate);
      if (m.lifeId !== life) continue; // A synchronous death listener may recycle the node.
      this.lastDmg?.add(this.id, m.lastDamageTaken); hit ||= m.lastDamageTaken > 0;
      if (!m.dead && ultimate && this.stats.ultStun > 0) m.applyStun(this.stats.ultStun);
    }
    if (ultimate && hit) this.ultimateBeat(a.x, a.y, .35, true);
  }
}

export class WindHero extends WindNinjaHeroBase {
  readonly id = 'wind'; readonly name = '赛兰·逐风';
  readonly chargeMax = WIND.energy; readonly skillMax = WIND.cooldown;
  protected buildVisual(parent: Node): void { this.staticArt = visual(parent, this.node, this.x, 'wind'); }
  protected releaseNormal(target: Monster, _mgr: MonsterManager, projs: ProjectileManager, offset: number): boolean {
    const hand = this.hand(target);
    const aim = interceptDirection(hand.x, hand.y, target.x, target.hitY, bodyDownSpeed(target), WIND.bladeSpeed);
    const angle = Math.atan2(aim.dirY, aim.dirX) + offset;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    if (!projs.fire(this.normalSpec(hand.x, hand.y, dx, dy))) return false;
    this.animateAttack(false, target.x - this.x, target.hitY - HERO_Y - 60);
    this.effects().release(hand.x, hand.y, dx, dy, 'wind'); return true;
  }
  protected canAutoSkill(mgr: MonsterManager): boolean {
    const cfg = windSkillCfg(this.stats.skillLv);
    return this.areas.length < AREA_CAP && !!cluster(mgr, this.x, HERO_Y, this.stats.skillRange,
      cfg.radius * this.stats.skillRangeMul);
  }
  protected castSkill(mgr: MonsterManager): void {
    if (this.areas.length >= AREA_CAP) return;
    const cfg = windSkillCfg(this.stats.skillLv), radius = cfg.radius * this.stats.skillRangeMul;
    const point = cluster(mgr, this.x, HERO_Y, this.stats.skillRange, radius);
    if (!point) return;
    this.beginSkillCooldown();
    this.addArea('eye', point, radius, cfg.duration, WIND.eyeTick, cfg.mul, cfg.pull);
    Sfx.cast(this.id);
  }
  get ultShowDuration(): number { return ULT_TIMING.wind.windup + windUltCfg(this.stats.ultLv).duration; }
  castUlt(mgr: MonsterManager, _projs: ProjectileManager, dmg: DamageService): boolean {
    if (!this.ultReady || this.areas.length >= AREA_CAP) return false;
    const cfg = windUltCfg(this.stats.ultLv), radius = cfg.radius * this.stats.skillRangeMul;
    const point = cluster(mgr, this.x, HERO_Y, Infinity, radius);
    if (!point) return false;
    this.lastDmg = dmg; this.charge = 0; this.beginUltimate(this.ultShowDuration);
    this.addArea('tornado', point, radius, cfg.duration, WIND.tornadoTick, cfg.mul, WIND.tornadoPull,
      ULT_TIMING.wind.windup);
    Sfx.cast(this.id, true);
    return true;
  }
}

/** Original flight segment is retained for future return/path cards, without enabling any such card. */
interface AttachedShuriken {
  mob: Monster; lifeId: number; launchX: number; launchY: number; hitX: number; hitY: number;
  dirX: number; dirY: number; offsetX: number; offsetY: number; phase: number;
}
interface Reservation { mob: Monster; lifeId: number; until: number; }
interface Recall { mark: AttachedShuriken; mul: number; speed: number; pierce: number; }

export class NinjaHero extends WindNinjaHeroBase {
  readonly id = 'ninja'; readonly name = '胧·影刃';
  readonly chargeMax = NINJA.energy; readonly skillMax = NINJA.cooldown;
  private marks = new Map<number, AttachedShuriken>();
  private recalls: Recall[] = [];
  private queuedLives = new Set<number>();
  private inFlight = new Set<Reservation>();
  private generation = 0;

  get attachedCount(): number { return this.marks.size; }
  get pendingRecallCount(): number { return this.recalls.length; }
  protected buildVisual(parent: Node): void { this.staticArt = visual(parent, this.node, this.x, 'ninja'); }
  protected disposeAttachments(): void {
    this.generation++; this.marks.clear(); this.recalls.length = 0; this.queuedLives.clear(); this.inFlight.clear();
  }
  private prune(mgr: MonsterManager): void {
    for (const [life, mark] of this.marks) if (!valid(mark.mob, life, mgr)) this.marks.delete(life);
    for (let i = this.recalls.length - 1; i >= 0; i--) {
      const mark = this.recalls[i].mark;
      if (!valid(mark.mob, mark.lifeId, mgr)) {
        this.queuedLives.delete(mark.lifeId); this.recalls.splice(i, 1);
      }
    }
    for (const flight of this.inFlight)
      if (flight.until <= this.clock || !valid(flight.mob, flight.lifeId, mgr)) this.inFlight.delete(flight);
  }
  protected selectNormalTarget(mgr: MonsterManager): Monster | null {
    this.prune(mgr);
    let best: Monster | null = null;
    for (const m of mgr.list) {
      if (!liveNode(m) || !inRange(m, this.x, this.stats.range)
        || this.marks.has(m.lifeId) || this.queuedLives.has(m.lifeId)) continue;
      let reserved = false;
      for (const flight of this.inFlight) if (flight.lifeId === m.lifeId) { reserved = true; break; }
      if (reserved) continue;
      if (!best || m.y < best.y || m.y === best.y && m.hp < best.hp) best = m;
    }
    return best || mgr.pickTarget(this.x, HERO_Y, this.stats.range, 'all');
  }
  protected releaseNormal(target: Monster, mgr: MonsterManager, projs: ProjectileManager, offset: number): boolean {
    const hand = this.hand(target);
    const aim = interceptDirection(hand.x, hand.y, target.x, target.hitY, bodyDownSpeed(target), NINJA.speed);
    const angle = Math.atan2(aim.dirY, aim.dirX) + offset;
    const dx = Math.cos(angle), dy = Math.sin(angle), spec = this.normalSpec(hand.x, hand.y, dx, dy);
    const flight: Reservation = { mob: target, lifeId: target.lifeId,
      until: this.clock + Math.min(spec.ttl!, aim.flightTime + .15) };
    const generation = this.generation;
    spec.onContact = mob => {
      // This callback only attaches metal. ProjectileManager already applied and counted the original hit.
      this.inFlight.delete(flight);
      if (!this.node.isValid || generation !== this.generation || !valid(mob, mob.lifeId, mgr)) return;
      this.prune(mgr);
      if (this.marks.has(mob.lifeId) || this.queuedLives.has(mob.lifeId)
        || this.marks.size + this.recalls.length >= NINJA.markCap) return;
      const phase = (mob.lifeId * .61803398875 % 1) * Math.PI * 2;
      this.marks.set(mob.lifeId, { mob, lifeId: mob.lifeId, launchX: hand.x, launchY: hand.y,
        hitX: mob.x, hitY: mob.hitY, dirX: dx, dirY: dy,
        offsetX: Math.cos(phase) * Math.min(10, mob.def.radius * .3),
        offsetY: mob.def.radius * .25 + Math.sin(phase) * 5, phase });
    };
    if (!projs.fire(spec)) return false;
    this.inFlight.add(flight);
    // The generic projectile pool is capped at MAX_PROJS; expired edge exits cannot grow reservations forever.
    if (this.inFlight.size > MAX_PROJS) this.inFlight.delete(this.inFlight.values().next().value!);
    this.animateAttack(false, target.x - this.x, target.hitY - HERO_Y - 60);
    this.effects().release(hand.x, hand.y, dx, dy, 'shuriken'); return true;
  }
  protected canAutoSkill(mgr: MonsterManager): boolean {
    this.prune(mgr);
    for (const mark of this.marks.values()) if (inRange(mark.mob, this.x, this.stats.skillRange)) return true;
    return false;
  }
  protected castSkill(mgr: MonsterManager): void {
    this.prune(mgr);
    const cfg = ninjaSkillCfg(this.stats.skillLv);
    let queued = 0;
    for (const [life, mark] of this.marks) {
      if (!inRange(mark.mob, this.x, this.stats.skillRange)) continue;
      // Transfer atomically to the bounded queue. A full projectile pool cannot consume/drop the return.
      this.recalls.push({ mark, mul: cfg.mul, speed: cfg.speed, pierce: cfg.pierce });
      this.queuedLives.add(life); this.marks.delete(life); queued++;
    }
    if (queued > 0) {
      this.beginSkillCooldown();
      Sfx.cast(this.id); // Committing the recall batch is one cast; pool-full retries stay silent.
    }
  }
  protected updateQueues(dt: number, mgr: MonsterManager, projs: ProjectileManager): void {
    // Already committed returns receive freed slots before serial normal rows can refill the pool.
    this.prune(mgr); this.releaseRecalls(mgr, projs);
    super.updateQueues(dt, mgr, projs); this.prune(mgr);
  }
  private releaseRecalls(mgr: MonsterManager, projs: ProjectileManager): void {
    for (let i = 0; i < this.recalls.length;) {
      if (!projs.hasCapacity) break;
      const recall = this.recalls[i], mark = recall.mark, source = mark.mob;
      if (!valid(source, mark.lifeId, mgr)) {
        this.queuedLives.delete(mark.lifeId); this.recalls.splice(i, 1); continue;
      }
      const x = source.x + mark.offsetX, y = source.hitY + mark.offsetY;
      const path = finiteReturnPath(x, y, mark.launchX, mark.launchY, recall.speed);
      const critical = Math.random() < this.stats.critRate;
      const spec: RecallProjectile = { x, y, ...path, speed: recall.speed,
        dmg: this.abilityDamage(recall.mul) * (critical ? this.stats.critMul : 1), crit: critical,
        heroId: this.id, targetLayer: 'all', visual: 'shuriken', color: '#BFE9EE', size: 7,
        ability: true, pierce: recall.pierce, resCut: this.stats.defIgnore || 0,
        initialContactLifeId: mark.lifeId, ...this.targetBonuses() };
      // No manual source hit and no onContact re-mark: t=0 source contact belongs to the ordinary swept hit set.
      if (!projs.fire(spec)) break;
      this.queuedLives.delete(mark.lifeId); this.recalls.splice(i, 1);
      this.effects().release(x, y, path.dirX, path.dirY, 'shuriken');
    }
  }
  protected drawAttachments(fx: WindNinjaVFX): void {
    if (!this.manager) return;
    this.prune(this.manager);
    for (const mark of this.marks.values()) fx.mark(mark.mob.x + mark.offsetX, mark.mob.hitY + mark.offsetY, mark.phase);
    // Pending returns remain attached until the projectile pool accepts their actual release.
    for (const recall of this.recalls) {
      const mark = recall.mark;
      fx.mark(mark.mob.x + mark.offsetX, mark.mob.hitY + mark.offsetY, mark.phase, true);
    }
  }
  get ultShowDuration(): number { return ULT_TIMING.ninja.windup + ninjaUltCfg(this.stats.ultLv).duration; }
  castUlt(mgr: MonsterManager, _projs: ProjectileManager, dmg: DamageService): boolean {
    if (!this.ultReady || this.areas.length >= AREA_CAP) return false;
    const cfg = ninjaUltCfg(this.stats.ultLv), radius = cfg.radius * this.stats.skillRangeMul;
    const point = cluster(mgr, this.x, HERO_Y, Infinity, radius);
    if (!point) return false;
    this.lastDmg = dmg; this.charge = 0; this.beginUltimate(this.ultShowDuration);
    this.addArea('spiral', point, radius, cfg.duration, NINJA.ultTick, cfg.mul, 0, ULT_TIMING.ninja.windup);
    const hand=this.handAt(point.x,point.y);
    this.effects().spiralLaunch(hand.x,hand.y,point.x,point.y,ULT_TIMING.ninja.windup);
    Sfx.cast(this.id, true);
    return true;
  }
}
