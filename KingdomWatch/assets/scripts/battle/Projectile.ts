import { drawScytheBlade,SCYTHE_EFFECT } from './ScytheVFX';
import { scytheBladeEntry } from './ScythePlans';
import { drawMagicArrow,MAGIC_BOW_EFFECT } from './MagicBowVFX';
import { drawLanceFlight,LANCE_EFFECT } from './ThunderLanceVFX';
import { LanceFlightPlan,lanceFlightPose } from './ThunderLancePlans';
/**
 * 弹道（§3.5：可见追踪弹、目标死亡切换目标；子弹道直线随缘命中；对象池强制）
 * 追踪主弹命中前锁定目标；直线弹（齐射/分裂/大招箭/敌方石块）带 ttl 与碰撞去重
 * 性能：弹道为池化数据；箭矢/火球/冰棱使用固定 Sprite 渲染池，其余弹体由单 Graphics 重绘。
 */
import { Color, Graphics, Layers, Node, UIOpacity, tween, Vec3 } from 'cc';
import { Monster, MonsterManager } from './Monster';
import { DamageService } from './DamageService';
import { Particles } from './Particles';
import { ImpactFX } from './ImpactFX';
import { Sfx } from '../core/Sfx';
import { bus, EVT } from '../core/EventBus';
import { LINE_Y, LO, PAL, MAX_PROJS } from '../config/GameConfig';
import { FrostUltTarget } from './FrostUltimateVFX';
import { BasicProjectileFlightVFX } from './BasicProjectileFlightVFX';
import { drawCannonMissile } from './NewHeroVFX';
import { acceptsTarget, attackLayer, TargetLayer } from '../config/Targeting';
import { drawWindBlade, drawShuriken, WIND_NINJA_FX_EFFECT } from './WindNinjaVFX';
import { HeroFxShader } from './HeroFxShader';
import { sweptBladeEntry } from './WindNinjaGeometry';
import { drawFlyingSword, drawHeavenSword, drawMagicBlade, drawRiftShard, SPACE_SWORD_EFFECT } from './SpaceSwordVFX';
import { drawSwordFlight, SWORD_ABILITY_EFFECT, SWORD_FLIGHT_CAP } from './SwordAbilityVFX';

export interface ProjSpec {
  visual?: 'wind' | 'shuriken' | 'rift' | 'sword' | 'heavenSword' | 'spaceBlade' | 'lance' | 'greatLance' | 'magicArrow' | 'scytheBlade';
  /** Exact ballistic position, tangent and landing pose share the same launch snapshot. */
  lanceFlight?: LanceFlightPlan & {seed:number};
  /** Only deliberately homing attacks opt in; existing arrows and bullets stay straight. */
  homingTarget?: Monster;
  homingLifeId?: number;
  /** Specialised blast art, with ordinary direct/splash damage still owned by hitMob. */
  onBlastImpact?: (mob: Monster) => void;
  /** Optional transverse contact span; ordinary projectiles retain their circular sweep. */
  lineHalfLength?: number;
  lineForwardOffset?: number;
  /** Actual direct contact only, never a miss or splash. */
  onContact?: (mob: Monster) => void;
  /** Finite straight return segment: sweep to endpoint, then recycle without a second hit pass. */
  endPoint?: Readonly<{x:number;y:number}>;
  /** Recall starts inside its marked victim; resolve that body's t=0 contact before overlapping neighbours. */
  initialContactLifeId?: number;
  /** Shared by acquisition, sweep, splash and secondary shots. Undefined is resolved once at release. */
  targetLayer?: TargetLayer;
  x: number; y: number;
  /** 直线弹方向（会归一化）；发射后方向锁定（用户确认：子弹不追踪不换目标） */
  dirX?: number; dirY?: number;
  speed: number;
  dmg: number;
  crit: boolean;
  color: string;
  heroId: string;
  size?: number;
  ttl?: number;
  /** 命中后穿透余量（转直线继续飞） */
  pierce?: number;
  /** Damage retained after each pierced target; omitted on ordinary piercing shots. */
  pierceDamage?: number;
  /** One straight return to the launch point, with one contact per target on each leg. */
  returnDamage?: number;
  knockback?: number;
  /** One nearby secondary hit; it never launches another arc or a skill. */
  arcDamage?: number;
  explodeR?: number;
  explodeMul?: number;
  /** 最终命中时分裂出 n 支小弹 */
  split?: number;
  /** 子弹道（不再分裂） */
  small?: boolean;
  /** 敌方石块：落到防线造成伤害 */
  enemy?: boolean;
  /** 命中词条 */
  slowRatio?: number;
  slowDur?: number;
  burnDps?: number;
  burnDur?: number;
  burnBurst?: number;
  burnHealCut?: number;
  teamVuln?: number;
  /** 火法灼烧覆盖爆炸内目标；其他英雄默认仍只处理直接命中。 */
  burnSplash?: boolean;
  /** 命中眩晕 s（震慑：陨石落点眩晕） */
  stun?: number;
  /** 雷系感电：命中后目标受伤 +shockAmp 持续 shockDur s */
  shockAmp?: number;
  shockDur?: number;
  /** 无视物抗（狙击大招等） */
  ignoreRes?: boolean;
  /** 无视防御比例（英雄突破，0~1；与 ignoreRes 叠加时以 ignoreRes 优先） */
  resCut?: number;
  /** 目标词条（命中时按目标结算）：对精英/BOSS 加成 / 对残血<30% 加成 / 对满血加成（狙技能升级） */
  executeBonus?: number;
  lowHpBonus?: number;
  fullHpBonus?: number;
  shockedBonus?: number;   // 对感电中目标伤害加成（雷普攻15级）
  burnedBonus?: number;   // 对灼烧中目标伤害加成（火普攻15级）
  slowedBonus?: number;   // 对减速中目标伤害加成（冰普攻15级）
  coldBonus?: number;     // 碎冰卡：冰法自身对减速或冰封目标的独立增伤
  freezeChance?: number; // 冰棱实际命中时判定，发射/落空不触发
  freezeDuration?: number;
  /** 猎杀标记（狙大招10级）：命中后目标受伤 +markAmp 持续 markDur s */
  markAmp?: number;
  markDur?: number;
  /** 死亡准星卡：仅在存活目标头顶显示蓝色准星。 */
  markIcon?: boolean;
  /** 强化/贯穿金箭：命中迸溅金色粒子 + 加长拖尾 */
  spark?: boolean;
  /** 大招弹（猎杀时刻等）：击杀弹大招专属词条 KAPOW! */
  ult?: boolean;
  /** 技能/大招弹（强化箭矢/箭雨/连狙窗口等）：击杀弹 60% 词条；普攻击杀不弹（用户确认） */
  ability?: boolean;
  /** 生成即免疫碰撞的目标（分裂小弹的来源怪：分裂箭不打目标本体，用户确认） */
  exclude?: Monster;
  /** Snapshot exclusion survives deferred secondary firing and monster-node reuse. */
  excludeLifeId?: number;
  /** Fixed impact point bypasses flight collisions; targetLayer still governs the eventual explosion. */
  groundTarget?: Readonly<{ x: number; y: number }>;
  /** Airburst body position and terrain projection are separate. */
  groundProjectionY?: number;
  /** A specialised blast resolver may own damage while retaining this flight/landing event. */
  onGroundDamage?: () => void;
  onGroundImpact?: () => void;
}

interface Active {
  spec: ProjSpec;
  vx: number; vy: number;
  pierceLeft: number;
  hit: Set<number>;
  ttl: number;
  age: number;
  trail: number[];
  trailMax: number;
  fxSeed: number;
  ultContact: boolean;
  damageScale: number;
  returning: boolean;
  legLeft: number;
  returnDistance: number;
  hitExhausted: boolean;
  windShader: boolean;
  swordShader: boolean;
  lanceShader: boolean;
  magicBowShader: boolean;
  scytheShader: boolean;
  spaceShader: boolean;
}

const colorCache = new Map<string, Color>();
function hexc(h: string): Color {
  let c = colorCache.get(h);
  if (!c) { c = new Color(); Color.fromHEX(c, h); colorCache.set(h, c); }
  return c;
}
// 尾迹渐隐上色专用（避免每段新建 Color）
const scratch = new Color();
// 插箭残留渐隐专用（Graphics 的 fillColor/strokeColor 赋值即拷贝，可复用同一实例）
const tinted = new Color();
function cola(h: string, mul: number): Color {
  tinted.set(hexc(h));
  tinted.a = Math.round(255 * Math.min(1, Math.max(0, mul)));
  return tinted;
}

export class ProjectileManager {
  /** Reused sweep records, bounded by the 60 living-enemy limit. */
  private contacts = Array.from({ length: 60 }, () => ({ mob: null as Monster | null, t: 0 }));
  private active: Active[] = [];
  private free: Active[] = [];
  private g!: Graphics;
  private dirty = false;
  private basicFlight: BasicProjectileFlightVFX;
  private windFlight: HeroFxShader | null = null;
  private scytheFlight: HeroFxShader | null = null;
  private magicBowFlight: HeroFxShader | null = null;
  private lanceFlight: HeroFxShader | null = null;
  private swordFlight: HeroFxShader | null = null;
  private spaceFlight: HeroFxShader | null = null;
  private flightSerial = 0;

  /** field 为专用弹道图层节点（英雄之上、飘字之下）；parts 为迸溅粒子层 */
  constructor(private field: Node, private mgr: MonsterManager, private dmg: DamageService, private parts?: Particles, private impacts?: ImpactFX) {
    field.layer = Layers.Enum.UI_2D;
    this.g = field.addComponent(Graphics);
    this.basicFlight = new BasicProjectileFlightVFX(field);
  }

  /** Only squads with wind create the cosmetic pool, before the preparation countdown ends. */
  warmWindFlight(): void {
    if (!this.windFlight) this.windFlight = new HeroFxShader(this.field, 'windCrescentFlight', MAX_PROJS, 'plasma',
      { effect: WIND_NINJA_FX_EFFECT, technique: 0 });
  }

  warmScytheFlight():void{this.scytheFlight ||=new HeroFxShader(this.field,'scytheBladeFlight',40,'plasma',{effect:SCYTHE_EFFECT,technique:0});}
  warmMagicBowFlight():void{this.magicBowFlight ||=new HeroFxShader(this.field,'magicArrowFlight',32,'plasma',{effect:MAGIC_BOW_EFFECT,technique:0});}
  warmLanceFlight():void{this.lanceFlight ||=new HeroFxShader(this.field,'goldenLanceFlight',32,'plasma',{effect:LANCE_EFFECT,technique:0});}
  warmSwordFlight(): void {
    this.swordFlight ||= new HeroFxShader(this.field, 'jadeSwordFlight', SWORD_FLIGHT_CAP, 'plasma',
      { effect: SWORD_ABILITY_EFFECT, technique: 1 });
  }
  warmSpaceFlight():void{
    this.spaceFlight ||= new HeroFxShader(this.field,'riftCrystalFlight',24,'plasma',{effect:SPACE_SWORD_EFFECT,technique:0});
  }

  get ultimateInFlight(): boolean { return this.active.some(a => !!a.spec.ult); }
  get hasCapacity(): boolean { return this.active.length < MAX_PROJS; }

  fire(spec: ProjSpec): boolean {
    if (this.active.length >= MAX_PROJS) return false;
    const a = this.free.pop() || this.makeActive();
    a.spec = spec;
    spec.targetLayer ??= attackLayer(spec.heroId, spec.ult ? 'ult' : spec.ability ? 'skill' : 'atk');
    a.hit.clear();
    if (spec.exclude) a.hit.add(spec.exclude.lifeId);
    if (spec.excludeLifeId) a.hit.add(spec.excludeLifeId);
    a.pierceLeft = spec.pierce || 0;
    a.ttl = spec.ttl ?? 3.2;
    a.age = 0; a.ultContact = false;
    a.windShader = spec.visual === 'wind' && !!this.windFlight?.ready;
    a.scytheShader = spec.visual==='scytheBlade' && !!this.scytheFlight?.ready;
    a.magicBowShader = spec.visual==='magicArrow' && !!this.magicBowFlight?.ready;
    a.lanceShader = (spec.visual==='lance'||spec.visual==='greatLance') && !!this.lanceFlight?.ready;
    a.swordShader = (spec.visual === 'sword' || spec.visual === 'heavenSword') && !!this.swordFlight?.ready;
    a.spaceShader = spec.visual === 'rift' && !!this.spaceFlight?.ready;
    a.damageScale = 1; a.returning = false; a.legLeft = a.returnDistance = 0; a.hitExhausted = false;
    a.fxSeed = (++this.flightSerial * .61803398875) % 1;
    a.trail.length = 0;
    a.trailMax = spec.enemy ? 0 : spec.spark || spec.heroId === 'cannon' && spec.ult ? 9
      : spec.heroId === 'archer' ? 7
      : spec.heroId === 'sniper' && !spec.small ? 6 : 3;
    const dx = spec.dirX ?? 0, dy = spec.dirY ?? -1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    a.vx = dx / len * spec.speed;
    a.vy = dy / len * spec.speed;
    if (spec.returnDamage && !spec.enemy) {
      const ux = a.vx / spec.speed, uy = a.vy / spec.speed;
      const exitX = ux > 0 ? (430 - spec.x) / ux : ux < 0 ? (-430 - spec.x) / ux : Infinity;
      const exitY = uy > 0 ? (LO.half + 120 - spec.y) / uy : uy < 0 ? (-720 - spec.y) / uy : Infinity;
      a.legLeft = a.returnDistance = Math.max(.01, Math.min(exitX, exitY, spec.speed * a.ttl));
    }
    this.active.push(a);
    this.dirty = true;
    if (spec.heroId === 'sniper' && spec.ult) this.impacts?.sniperUltimateRelease(spec.x, spec.y, a.vx, a.vy);
    return true;
  }

  private makeActive(): Active {
    return { spec: null as unknown as ProjSpec, vx: 0, vy: 0, pierceLeft: 0, hit: new Set<number>(), ttl: 0, age: 0, trail: [], trailMax: 0, fxSeed: 0, ultContact: false,
      damageScale: 1, returning: false, legLeft: 0, returnDistance: 0, hitExhausted: false, windShader: false, swordShader: false, lanceShader: false, magicBowShader: false, scytheShader: false, spaceShader: false };
  }

  /** 敌方远程石块：直线落向防线，触线即结算 */
  fireStone(x: number, y: number, dmg: number): void {
    this.fire({ x, y, dirX: 0, dirY: -1, speed: 300, dmg, crit: false, color: '#B2A48B', heroId: 'enemy', size: 9, enemy: true, ttl: 6 });
  }

  /** 命中点迸溅（狙击等瞬射击打演出用，不产生伤害） */
  sparkAt(x: number, y: number, color: string, n = 6): void {
    if (this.parts) this.parts.burst(x, y, color, n);
  }

  /** 每排出弓一次；与弹道共用战斗时钟，暂停/倍速不脱节。未加载时保留原出手闪光。 */
  arrowRelease(x: number, y: number, dx: number, dy: number, heavy: boolean): boolean {
    return this.impacts?.arrowRelease(x, y, dx, dy, heavy) || false;
  }

  /** One release per actual basic attack/arrow row, including empowered basic arrows. */
  normalRelease(hero: string, x: number, y: number, dx: number, dy: number, empowered = false): void {
    this.impacts?.normalRelease(hero, x, y, dx, dy, empowered);
  }

  fireCraters(areas: readonly { x: number; y: number; t: number; life?: number; radius?: number }[], radius: number, clock: number): boolean {
    return this.impacts?.fireCraters(areas, radius, clock) || false;
  }

  frostDomain(x: number, y: number, radius: number, duration: number): void {
    this.impacts?.frostDomain(x, y, radius, duration);
  }

  frostGround(areas: readonly { x: number; y: number; radius: number; t: number; life: number }[]): void {
    this.impacts?.frostGround(areas);
  }

  frostUltimate(targets: readonly FrostUltTarget[]): void { this.impacts?.frostUlt(targets); }
  frostUltimateBurst(targets: readonly FrostUltTarget[]): void { this.impacts?.frostUltBurst(targets); }

  voltChain(x: number, y: number, x1: number, y1: number, jump: number): void {
    this.impacts?.voltChain(x, y, x1, y1, jump);
  }
  voltThunder(x: number, y: number, top: number, footY: number, radius: number, power = 1): void {
    this.impacts?.voltThunder(x, y, top, footY, radius, power);
  }
  voltCast(x: number, y: number): void { this.impacts?.voltCast(x, y); }

  /** 瞬击伤害直接记账（狙击 hitscan 不经弹道命中结算） */
  addDamage(heroId: string, v: number): void {
    this.dmg.add(heroId, v);
  }

  tick(dt: number, line: { takeDamage: (d: number) => void }, renderNow = true): void {
    this.frame++; // Retain the original substep phase even when intermediate geometry is deferred.
    if (this.active.length) this.dirty = true;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      const sp = a.spec;
      a.ttl -= dt;
      a.age += dt;
      let done = false;

      if (sp.groundTarget) {
        if(sp.lanceFlight){
          const pose=lanceFlightPose(sp.lanceFlight,a.age);sp.x=pose.x;sp.y=pose.y;a.vx=pose.vx;a.vy=pose.vy;
          if(pose.arrived){
            if(sp.onGroundDamage)sp.onGroundDamage();else this.hitGround(a);
            sp.onGroundImpact?.();this.recycle(i,a);
          }
          continue;
        }
        const point = sp.groundTarget, distance = Math.hypot(point.x - sp.x, point.y - sp.y);
        if (distance <= sp.speed * dt) {
          sp.x = point.x; sp.y = point.y;
          if (sp.onGroundDamage) sp.onGroundDamage(); else this.hitGround(a);
          sp.onGroundImpact?.();
          this.recycle(i, a);
        } else {
          // A committed ground strike cannot be intercepted or expire at an unrelated screen bound.
          sp.x += a.vx * dt; sp.y += a.vy * dt;
          if (a.trailMax > 0) {
            a.trail.push(sp.x, sp.y);
            while (a.trail.length > a.trailMax * 2) {
              a.trail.copyWithin(0, 2); a.trail.length -= 2;
            }
          }
        }
        continue;
      }

      if (sp.returnDamage && !sp.enemy) {
        if (this.advanceReturning(a, dt)) this.recycle(i, a);
        continue;
      }

      if(sp.homingTarget){
        let target=sp.homingTarget;
        if(target.lifeId!==sp.homingLifeId||target.dead||!target.node.isValid||this.mgr.list.indexOf(target)<0){
          const next=this.mgr.nearest(sp.x,sp.y,1100,sp.targetLayer);
          if(next){target=next;sp.homingTarget=next;sp.homingLifeId=next.lifeId;}
        }
        if(target.lifeId===sp.homingLifeId&&!target.dead&&target.node.isValid&&this.mgr.list.indexOf(target)>=0){
          const dx=target.x-sp.x,dy=target.hitY-sp.y,len=Math.hypot(dx,dy);
          if(len>1e-7){a.vx=dx/len*sp.speed;a.vy=dy/len*sp.speed;}
        }else{sp.homingTarget=undefined;sp.homingLifeId=undefined;}
      }
      const startX = sp.x, startY = sp.y;
      let stepX = a.vx * dt, stepY = a.vy * dt, arrived = false;
      if (sp.endPoint) {
        const left=Math.hypot(sp.endPoint.x-startX,sp.endPoint.y-startY);
        if(left<=sp.speed*dt){stepX=sp.endPoint.x-startX;stepY=sp.endPoint.y-startY;arrived=true;}
      }
      if (!sp.enemy && !a.hitExhausted) {
        done = this.hitSweep(a, startX, startY, stepX, stepY);
        if (done && sp.endPoint) { a.hitExhausted=true; done=false; }
      }

      if (!done) {
        sp.x = startX + stepX;
        sp.y = startY + stepY;
        if (a.trailMax > 0) {
          a.trail.push(sp.x, sp.y);
          while (a.trail.length > a.trailMax * 2) {
            a.trail.copyWithin(0, 2); a.trail.length -= 2;
          }
        }
        if (arrived) done = true;
        else if (sp.enemy && sp.y <= LINE_Y + 12) {
          line.takeDamage(sp.dmg);
          done = true;
        // 顶界必须盖过 SPAWN_Y(LO.half+60)：大招箭雨从可视区上方出生，越界即回收会让大招整轮哑火
        } else if (a.ttl <= 0 || sp.y > LO.half + 120 + (sp.visual==='scytheBlade'?(sp.lineHalfLength||0)*.3:0) || sp.y < -720 || sp.x < -430 || sp.x > 430) {
          done = true;
        }
      }
      if (done) this.recycle(i, a);
    }
    if (renderNow && this.dirty) { this.render(); this.dirty = false; }
  }

  private advanceReturning(a: Active, dt: number): boolean {
    const sp = a.spec;
    let remaining = dt;
    // At most one turn. Clip both segments so neither fast frames nor the map edge lose contacts.
    for (let leg = 0; leg < 2; leg++) {
      const travel = Math.min(a.legLeft, sp.speed * remaining);
      const sx = a.vx / sp.speed * travel, sy = a.vy / sp.speed * travel;
      const x = sp.x, y = sp.y;
      if (this.hitSweep(a, x, y, sx, sy)) return true;
      sp.x = x + sx; sp.y = y + sy;
      a.legLeft = Math.max(0, a.legLeft - travel);
      remaining = Math.max(0, remaining - travel / sp.speed);
      if (a.trailMax > 0) {
        a.trail.push(sp.x, sp.y);
        while (a.trail.length > a.trailMax * 2) {
          a.trail.copyWithin(0, 2); a.trail.length -= 2;
        }
      }
      if (a.legLeft > 1e-6) return false;
      if (a.returning) return true;
      a.returning = true;
      a.vx = -a.vx; a.vy = -a.vy;
      a.legLeft = a.returnDistance;
      a.damageScale *= sp.returnDamage!;
      a.pierceLeft = sp.pierce || 0;
      a.hit.clear();
      if (remaining <= 0) return false;
    }
    return false;
  }

  /** Exact segment/circle entries, in travel order. A piercing shot can hit several enemies in one step. */
  private hitSweep(a: Active, x: number, y: number, sx: number, sy: number): boolean {
    const sp = a.spec, length2 = sx * sx + sy * sy;
    const halfLength = Math.max(0, sp.lineHalfLength || 0);
    const speed = halfLength > 0 ? Math.hypot(a.vx, a.vy) || 1 : 1;
    const ux = a.vx / speed, uy = a.vy / speed;
    const offset = halfLength > 0 ? sp.lineForwardOffset || 0 : 0;
    const bx = x + ux * offset, by = y + uy * offset;
    const halfX = Math.abs(uy) * halfLength, halfY = Math.abs(ux) * halfLength;
    const curveBack = sp.visual === 'scytheBlade' ? halfLength * .3 : 0;
    const minX = Math.min(bx, bx + sx) - halfX - Math.max(0,ux*curveBack), maxX = Math.max(bx, bx + sx) + halfX + Math.max(0,-ux*curveBack);
    const minY = Math.min(by, by + sy) - halfY - Math.max(0,uy*curveBack), maxY = Math.max(by, by + sy) + halfY + Math.max(0,-uy*curveBack);
    const padding = (sp.size || 7) * .5;
    let count = 0;
    for (const m of this.mgr.list) {
      if (!acceptsTarget(m, sp.targetLayer)) continue;
      const mx = m.x, my = m.hitY, radius = m.def.radius + padding;
      // Conservative broad phase only. Exact circle entry, ties and per-contact feedback stay below.
      const bound = radius + 1e-6;
      if (mx < minX - bound || mx > maxX + bound || my < minY - bound || my > maxY + bound) continue;
      if (a.hit.has(m.lifeId)) continue;
      const dx = x - mx, dy = y - my;
      const c = dx * dx + dy * dy - radius * radius;
      let t = 0;
      if (halfLength > 0) {
        const entry = sp.visual === 'scytheBlade' ? scytheBladeEntry : sweptBladeEntry;
        t = entry((mx - bx) * ux + (my - by) * uy,
          -(mx - bx) * uy + (my - by) * ux, sx * ux + sy * uy, halfLength, radius);
        if (!Number.isFinite(t)) continue;
      } else if (c > 0) {
        if (length2 <= 1e-8) continue;
        const b = dx * sx + dy * sy, discriminant = b * b - length2 * c;
        if (b >= 0 || discriminant < 0) continue;
        t = (-b - Math.sqrt(discriminant)) / length2;
        if (t < 0 || t > 1) continue;
      }
      if (count >= this.contacts.length) break;
      let index = count++;
      while (index > 0 && (this.contacts[index - 1].t > t ||
        t===0 && this.contacts[index-1].t===0 && m.lifeId===sp.initialContactLifeId &&
        this.contacts[index-1].mob?.lifeId!==sp.initialContactLifeId)) {
        this.contacts[index].mob = this.contacts[index - 1].mob;
        this.contacts[index].t = this.contacts[index - 1].t;
        index--;
      }
      this.contacts[index].mob = m; this.contacts[index].t = t;
    }
    for (let i = 0; i < count; i++) {
      const contact = this.contacts[i], m = contact.mob!;
      if (m.dead || a.hit.has(m.lifeId)) continue;
      sp.x = x + sx * contact.t; sp.y = y + sy * contact.t;
      a.hit.add(m.lifeId);
      this.hitMob(a, m); // Every contact retains the ordinary damage, sound, flash and on-hit path.
      if (a.pierceLeft <= 0) return true;
      a.pierceLeft--;
      if (sp.pierceDamage !== undefined) a.damageScale *= sp.pierceDamage;
    }
    return false;
  }

  /** 渲染帧计数（电球等动态弹体的伪随机相位种子） */
  private frame = 0;
  /** Draw once for the visible frame; simulation and every hit still advance per substep. */
  private render(): void {
    const g = this.g;
    g.clear();
    this.basicFlight.beginFrame();
    this.windFlight?.begin();
    this.scytheFlight?.begin();
    this.magicBowFlight?.begin();
    this.lanceFlight?.begin();
    this.swordFlight?.begin();
    this.spaceFlight?.begin();
    this.impacts?.beginProjectileFrame();
    for (let i = 0; i < this.active.length; i++) {
      const a = this.active[i];
      const s = a.spec;
      const size = s.size || (s.enemy ? 9 : 7);
      const arrow = s.heroId === 'archer' && !s.enemy;
      const bolt = s.heroId === 'sniper' && !s.small && !s.enemy;
      const orb = s.heroId === 'volt' && !s.small && !s.enemy;
      const fire = s.heroId === 'pyro' && !s.enemy;
      const shard = s.heroId === 'mora' && !s.small && !s.enemy;
      if(s.visual==='scytheBlade'){drawScytheBlade(a.scytheShader?this.scytheFlight:null,g,s.x,s.y,Math.atan2(a.vy,a.vx),s.lineHalfLength||43,a.age,a.fxSeed);continue;}
      if(s.visual==='magicArrow'){drawMagicArrow(a.magicBowShader?this.magicBowFlight:null,g,s.x,s.y,Math.atan2(a.vy,a.vx),size,a.age,a.fxSeed);continue;}
      if(s.visual==='lance'||s.visual==='greatLance'){
        const angle=s.lanceFlight?lanceFlightPose(s.lanceFlight,a.age).angle:Math.atan2(a.vy,a.vx);
        drawLanceFlight(a.lanceShader?this.lanceFlight:null,g,s.x,s.y,angle,size,a.age,s.lanceFlight?.seed??a.fxSeed);continue;
      }
      if(s.visual==='spaceBlade'){drawMagicBlade(g,s.x,s.y,Math.atan2(a.vy,a.vx),s.lineHalfLength||423,a.age,s.color);continue;}
      if(s.visual==='sword'||s.visual==='heavenSword'){
        const angle=Math.atan2(a.vy,a.vx),giant=s.visual==='heavenSword';
        if(!a.swordShader||!drawSwordFlight(this.swordFlight,s.x,s.y,angle,size,a.age,a.fxSeed,giant)){
          if(giant)drawHeavenSword(g,s.x,s.y,angle,size,a.age);else drawFlyingSword(g,s.x,s.y,angle,size,a.age);
        }continue;
      }
      if(s.visual==='rift'){
        const drawn=a.spaceShader&&this.spaceFlight?.draw(s.x,s.y,size*14,size*7,Math.atan2(a.vy,a.vx)*180/Math.PI,a.age,a.fxSeed,1,3,size*3.6,0);
        if(!drawn)drawRiftShard(g,s.x,s.y,Math.atan2(a.vy,a.vx),size,a.age);continue;
      }
      if (s.visual === 'wind') {
        const rendered = a.windShader && this.windFlight?.draw(s.x,s.y,size*10,size*10,
          Math.atan2(a.vy,a.vx)*180/Math.PI,a.age,a.fxSeed,1,3,size*3);
        if (!rendered) drawWindBlade(g,s.x,s.y,a.vx,a.vy,size,a.age);
        continue;
      }
      if (s.visual === 'shuriken') { drawShuriken(g,s.x,s.y,a.vx,a.vy,size,a.age); continue; }
      if (s.heroId === 'cannon' && s.ult && !s.enemy) {
        drawCannonMissile(g, s.x, s.y, a.vx, a.vy, size, a.age, a.fxSeed, a.trail);
        continue;
      }
      if (orb && this.impacts?.voltProjectile(s.x, s.y, a.vx, a.vy, size, a.age, a.fxSeed)) continue;
      const basic = !s.enemy && !s.ult && !s.small
        && (!s.ability || (s.heroId === 'archer' && !!s.spark));
      const decorated = basic && this.basicFlight.projectile(s.heroId, s.x, s.y, a.vx, a.vy, size, a.age, a.fxSeed);
      const ultimateWake = bolt && !!s.ult && this.impacts?.sniperUltimateProjectile(s.x, s.y, a.vx, a.vy, a.age, a.fxSeed);
      if (fire && this.impacts?.fireProjectile(s.x, s.y, a.vx, a.vy, size)) continue;
      if (arrow && this.impacts?.arrowProjectile(s.x, s.y, a.vx, a.vy, size, a.age, !!s.spark || !!s.ult)) continue;
      if (s.heroId === 'mora' && !s.enemy && this.impacts?.iceProjectile(s.x, s.y, a.vx, a.vy, size, a.age)) continue;
      // 尾迹先画（垫在弹体之下）：锥形渐隐条带 + 亮芯
      if (!decorated && !ultimateWake && a.trailMax > 0) this.drawTrail(g, s, a, size, arrow);
      if (arrow) this.drawArrow(g, s, a, size);
      else if (s.heroId === 'cannon' && s.small && !s.enemy) {
        const len=Math.max(1,Math.hypot(a.vx,a.vy)),dx=a.vx/len,dy=a.vy/len;
        g.fillColor=hexc('#D9C38D');g.strokeColor=hexc('#4C463B');g.lineWidth=1.2;
        g.moveTo(s.x+dx*size*1.8,s.y+dy*size*1.8);
        g.lineTo(s.x-dy*size*.6,s.y+dx*size*.6);
        g.lineTo(s.x-dx*size,s.y-dy*size);
        g.lineTo(s.x+dy*size*.6,s.y-dx*size*.6);g.close();g.fill();g.stroke();
      }
      else if (s.heroId === 'cannon' && !s.enemy) {
        // Brass casing and a bright rim read as a heavy shell, using the shared batch.
        g.fillColor = hexc('#3E4650'); g.strokeColor = hexc('#F5CE75'); g.lineWidth = 2.4;
        g.circle(s.x, s.y, size); g.fill(); g.stroke();
        g.fillColor = hexc('#D5A641'); g.circle(s.x - size * .25, s.y + size * .25, size * .48); g.fill();
      }
      else if (bolt) this.drawBolt(g, s, a, size);
      else if (orb) this.drawOrb(g, s, size, i);
      else if (fire) this.drawFireball(g, s, a, size, i);
      else if (shard) this.drawShard(g, s, a, size, i);
      else {
        g.fillColor = hexc(s.color);
        g.strokeColor = hexc(PAL.ink);
        g.lineWidth = 1.5;
        g.circle(s.x, s.y, size);
        g.fill();
        g.stroke();
      }
    }
    this.impacts?.endProjectileFrame();
    this.windFlight?.end();
    this.scytheFlight?.end();
    this.magicBowFlight?.end();
    this.lanceFlight?.end();
    this.swordFlight?.end();
    this.spaceFlight?.end();
  }

  /** 锥形渐隐尾迹：越旧越窄越淡的软边条带（逐段四边形），叠一条更实的亮芯线；箭矢从箭尾接出避免盖住箭体 */
  private drawTrail(g: Graphics, s: ProjSpec, a: Active, size: number, arrow: boolean): void {
    const tr = a.trail;
    const n = tr.length >> 1;
    if (n < 2) return;
    const base = hexc(s.color);
    let qx = tr[0], qy = tr[1];
    if (arrow) {
      const l = Math.sqrt(a.vx * a.vx + a.vy * a.vy) || 1;
      qx = s.x - a.vx / l * size * 2.3; qy = s.y - a.vy / l * size * 2.3;   // 最新段接到箭尾，条带与箭体首尾相接
    }
    for (let k = 1; k < n; k++) {
      const nx = k + 1 < n ? tr[k * 2] : qx;
      const ny = k + 1 < n ? tr[k * 2 + 1] : qy;
      const f = k / (n - 1);
      scratch.set(base);
      scratch.a = Math.floor((arrow ? 120 : 110) * f);
      g.fillColor = scratch;
      const w = size * (arrow ? 1.35 : 1.0) * f * 0.5;
      const ang = Math.atan2(ny - qy, nx - qx);
      const ox = -Math.sin(ang) * w, oy = Math.cos(ang) * w;
      g.moveTo(qx + ox, qy + oy);
      g.lineTo(nx + ox, ny + oy);
      g.lineTo(nx - ox, ny - oy);
      g.lineTo(qx - ox, qy - oy);
      g.close();
      g.fill();
      // 亮芯：中心细线，让尾迹读起来是“速度”而非“雾”
      scratch.a = Math.floor((arrow ? 210 : 150) * f);
      g.strokeColor = scratch;
      g.lineWidth = Math.max(1, size * (arrow ? 0.6 : 0.85) * f);
      g.moveTo(qx, qy);
      g.lineTo(nx, ny);
      g.stroke();
      qx = nx; qy = ny;
    }
  }

  /** 弓箭手弹体：木杆双线 + 钢头三角 + 尾羽，朝向即飞行方向；强化金箭换金色系 */
  private drawArrow(g: Graphics, s: ProjSpec, a: Active, size: number): void {
    const len = Math.sqrt(a.vx * a.vx + a.vy * a.vy) || 1;
    this.drawArrowAt(g, s.x, s.y, a.vx / len, a.vy / len, size, s.spark === true, 1);
  }

  /** 雷法普攻弹体：混沌电球——紫晕 + 墨边紫球 + 呼吸白芯 + 随机乱窜电弧 + 环带闪点（逐帧抖动） */
  private drawOrb(g: Graphics, s: ProjSpec, size: number, idx: number): void {
    const seed = this.frame * 7.13 + idx * 31.7;
    const rnd = (n: number): number => { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); };
    // 外晕（混沌能场）
    g.fillColor = cola(s.color, 0.24);
    g.circle(s.x, s.y, size * 1.55);
    g.fill();
    // 主体：深紫球 + 墨描边
    g.fillColor = hexc(s.color);
    g.strokeColor = hexc(PAL.ink);
    g.lineWidth = 1.5;
    g.circle(s.x, s.y, size);
    g.fill();
    g.stroke();
    // 白芯（呼吸：0.4~0.6 半径随相位脉动）
    const core = size * (0.42 + 0.14 * rnd(Math.floor(seed * 0.7)));
    g.fillColor = cola('#F2E7FF', 0.92);
    g.circle(s.x, s.y, core);
    g.fill();
    // 混沌电弧：3 条从球缘向外的锯齿闪线，方向逐帧乱跳
    for (let k = 0; k < 3; k++) {
      const ang = rnd(seed + k * 3.7) * Math.PI * 2;
      const r0 = size * 0.7, r1 = size * (1.1 + rnd(seed + k * 9.1) * 0.55);
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const px = -dy, py = dx;
      const jitter = (rnd(seed + k * 5.3) * 2 - 1) * size * 0.5;
      g.strokeColor = cola('#E7CBFF', 0.86);
      g.lineWidth = 1.6;
      g.moveTo(s.x + dx * r0, s.y + dy * r0);
      g.lineTo(s.x + dx * (r0 + r1) * 0.5 + px * jitter, s.y + dy * (r0 + r1) * 0.5 + py * jitter);
      g.lineTo(s.x + dx * r1, s.y + dy * r1);
      g.stroke();
    }
    // 环带闪点：4 颗随机方位小亮点（半径/亮度逐帧变化）
    for (let k = 0; k < 4; k++) {
      const ang = rnd(seed * 1.3 + k * 11.1) * Math.PI * 2;
      const rr = size * (1.15 + rnd(seed + k * 7.7) * 0.7);
      g.fillColor = cola(k % 2 ? '#FFFFFF' : '#D9A8FF', 0.35 + rnd(seed + k) * 0.5);
      g.circle(s.x + Math.cos(ang) * rr, s.y + Math.sin(ang) * rr, 1 + rnd(seed + k * 2.2) * 1.4);
      g.fill();
    }
  }

  /** 焰法弹体：混着熔岩的火球——橙焰外壳 + 翻滚的暗红熔岩斑块 + 亮黄焰芯（斑块绕弹心公转，伪装自旋） */
  private drawFireball(g: Graphics, s: ProjSpec, a: Active, size: number, idx: number): void {
    const seed = this.frame * 5.31 + idx * 17.3;
    const rnd = (n: number): number => { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); };
    const l = Math.sqrt(a.vx * a.vx + a.vy * a.vy) || 1;
    const fx = a.vx / l, fy = a.vy / l;   // 飞行方向：焰芯偏向前缘
    // 外焰晕
    g.fillColor = cola(s.color, 0.22);
    g.circle(s.x, s.y, size * 1.5);
    g.fill();
    // 焰壳主体（深橙红）+ 墨描边
    g.fillColor = hexc('#D4561E');
    g.strokeColor = hexc(PAL.ink);
    g.lineWidth = 1.5;
    g.circle(s.x, s.y, size);
    g.fill();
    g.stroke();
    // 熔岩斑块：3 块暗红岩浆绕弹心慢公转（半径 0.45R，相位逐帧推进）
    for (let k = 0; k < 3; k++) {
      const ang = seed * 0.9 + k * 2.1 + rnd(seed + k * 4.4) * 0.8;
      const rr = size * 0.42;
      g.fillColor = cola('#A83318', 0.85);
      g.circle(s.x + Math.cos(ang) * rr * 0.55, s.y + Math.sin(ang) * rr * 0.55, size * (0.24 + rnd(seed + k * 2.9) * 0.1));
      g.fill();
    }
    // 亮黄焰芯（前缘偏置 + 呼吸）
    g.fillColor = cola('#FFD24A', 0.95);
    g.circle(s.x + fx * size * 0.22, s.y + fy * size * 0.22, size * (0.42 + 0.1 * rnd(Math.floor(seed * 0.8))));
    g.fill();
    // 前缘高光点
    g.fillColor = cola('#FFF3C4', 0.85);
    g.circle(s.x + fx * size * 0.5, s.y + fy * size * 0.5, size * 0.16);
    g.fill();
  }

  /** 冰法弹体：六棱冰晶——前尖后平的拉长晶体 + 霜晕 + 晶面高光 + 亮白芯 + 双侧冰屑闪点（逐帧微闪） */
  private drawShard(g: Graphics, s: ProjSpec, a: Active, size: number, idx: number): void {
    const seed = this.frame * 6.17 + idx * 23.9;
    const rnd = (n: number): number => { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); };
    const l = Math.sqrt(a.vx * a.vx + a.vy * a.vy) || 1;
    const dx = a.vx / l, dy = a.vy / l, px = -dy, py = dx;
    const L = size * 3.1;   // 晶体长轴（前尖后截平）
    const tipX = s.x + dx * L * 0.55, tipY = s.y + dy * L * 0.55;
    const tailX = s.x - dx * L * 0.45, tailY = s.y - dy * L * 0.45;
    const w = size * 0.78;
    // 霜晕（寒气外溢）
    g.fillColor = cola(s.color, 0.20);
    g.circle(s.x, s.y, size * 1.6);
    g.fill();
    // 晶体主体：拉长菱形，冰蓝 + 墨描边
    g.fillColor = hexc(s.color);
    g.strokeColor = hexc(PAL.ink);
    g.lineWidth = 1.5;
    g.moveTo(tipX, tipY);
    g.lineTo(s.x + px * w, s.y + py * w);
    g.lineTo(tailX + px * w * 0.55, tailY + py * w * 0.55);
    g.lineTo(tailX - px * w * 0.55, tailY - py * w * 0.55);
    g.lineTo(s.x - px * w, s.y - py * w);
    g.close(); g.fill(); g.stroke();
    // 上半晶面高光：前尖到中部的浅色三角（读出棱面转折）
    g.fillColor = cola('#E8FAFF', 0.5);
    g.moveTo(tipX, tipY);
    g.lineTo(s.x + px * w * 0.9, s.y + py * w * 0.9);
    g.lineTo(s.x - dx * L * 0.05, s.y - dy * L * 0.05);
    g.close(); g.fill();
    // 亮白芯（近前缘，呼吸闪烁）
    g.fillColor = cola('#FFFFFF', 0.72 + rnd(Math.floor(seed)) * 0.26);
    g.circle(s.x + dx * L * 0.18, s.y + dy * L * 0.18, size * (0.2 + rnd(Math.floor(seed * 0.6)) * 0.1));
    g.fill();
    // 双侧冰屑：垂直于飞行方向的两侧小闪点（相位逐帧跳）
    for (let k = 0; k < 2; k++) {
      const t2 = rnd(seed + k * 7.7);
      g.fillColor = cola(k === 0 ? '#FFFFFF' : '#BFE9FF', 0.32 + t2 * 0.5);
      g.circle(s.x + px * w * 1.25 * (k === 0 ? 1 : -1) + dx * L * (t2 - 0.3) * 0.4,
               s.y + py * w * 1.25 * (k === 0 ? 1 : -1) + dy * L * (t2 - 0.3) * 0.4,
               0.9 + rnd(seed + k * 3.3) * 1.3);
      g.fill();
    }
  }

  /** 狙击弹体：重型弩箭——粗短弹杆 + 宽钢弹头 + 尾翼 + 尾珠；大招弹（必暴贯穿）换亮钢蓝 */
  private drawBolt(g: Graphics, s: ProjSpec, a: Active, size: number): void {
    const len = Math.sqrt(a.vx * a.vx + a.vy * a.vy) || 1;
    const ult = s.ult === true;
    const dx = a.vx / len, dy = a.vy / len;
    const px = -dy, py = dx;
    const L = size * 3.6;
    const tipX = s.x + dx * L * 0.5, tipY = s.y + dy * L * 0.5;
    const tailX = s.x - dx * L * 0.5, tailY = s.y - dy * L * 0.5;
    const headL = L * 0.3;
    const shaftX = tipX - dx * headL, shaftY = tipY - dy * headL;
    // 弹杆：墨色底杆 + 钢蓝高光
    g.strokeColor = hexc(PAL.ink);
    g.lineWidth = size * 0.7;
    g.moveTo(tailX, tailY); g.lineTo(shaftX, shaftY); g.stroke();
    g.strokeColor = hexc(ult ? '#9FCBFF' : '#7FB3FF');
    g.lineWidth = size * 0.36;
    g.moveTo(tailX, tailY); g.lineTo(shaftX, shaftY); g.stroke();
    // 重弹头：宽钢三角 + 细墨描边
    const hw = size * (ult ? 1.0 : 0.9);
    g.fillColor = hexc(ult ? '#EAF6FF' : '#CFE3FF');
    g.strokeColor = hexc(PAL.ink);
    g.lineWidth = 1.5;
    g.moveTo(tipX, tipY);
    g.lineTo(shaftX + px * hw, shaftY + py * hw);
    g.lineTo(shaftX - px * hw, shaftY - py * hw);
    g.close();
    g.fill();
    g.stroke();
    // 尾翼：两片短翼（蓝灰）+ 尾珠配重
    const fl = L * 0.22, fw = size * 0.7;
    g.strokeColor = hexc('#5E7EA8');
    g.lineWidth = Math.max(2, size * 0.34);
    g.moveTo(tailX, tailY); g.lineTo(tailX - dx * fl + px * fw, tailY - dy * fl + py * fw); g.stroke();
    g.moveTo(tailX, tailY); g.lineTo(tailX - dx * fl - px * fw, tailY - dy * fl - py * fw); g.stroke();
    g.fillColor = hexc(ult ? '#EAF6FF' : '#7FB3FF');
    g.circle(tailX, tailY, size * 0.22);
    g.fill();
  }

  /** 箭矢绘制核心（飞行弹与插箭残留共用；mul 为整体透明系数） */
  private drawArrowAt(g: Graphics, x: number, y: number, dx: number, dy: number, size: number, spark: boolean, mul: number): void {
    const px = -dy, py = dx;
    const L = size * 4.6;
    const tipX = x + dx * L * 0.5, tipY = y + dy * L * 0.5;
    const tailX = x - dx * L * 0.5, tailY = y - dy * L * 0.5;
    const shaftX = tipX - dx * L * 0.26, shaftY = tipY - dy * L * 0.26;
    // 箭杆：墨色底杆 + 亮面高光（木杆质感）
    g.strokeColor = cola(PAL.ink, mul);
    g.lineWidth = size * 0.78;
    g.moveTo(tailX, tailY); g.lineTo(shaftX, shaftY); g.stroke();
    g.strokeColor = cola(spark ? PAL.gold : '#B98A4E', mul);
    g.lineWidth = size * 0.44;
    g.moveTo(tailX, tailY); g.lineTo(shaftX, shaftY); g.stroke();
    // 箭头：三角 + 细墨描边
    const hw = size * 0.85;
    g.fillColor = cola(spark ? '#FFE9A8' : '#D8D3C4', mul);
    g.strokeColor = cola(PAL.ink, mul);
    g.lineWidth = 1.5;
    g.moveTo(tipX, tipY);
    g.lineTo(shaftX + px * hw, shaftY + py * hw);
    g.lineTo(shaftX - px * hw, shaftY - py * hw);
    g.close();
    g.fill();
    g.stroke();
    // 尾羽：两片斜羽（砖红羽，在浅色尾迹与土色地面上都跳得出；金箭配米白羽）
    const fl = L * 0.24, fw = size * 0.8;
    g.strokeColor = cola(spark ? '#FFF6DC' : '#C9563F', mul);
    g.lineWidth = Math.max(2, size * 0.38);
    g.moveTo(tailX, tailY); g.lineTo(tailX - dx * fl + px * fw, tailY - dy * fl + py * fw); g.stroke();
    g.moveTo(tailX, tailY); g.lineTo(tailX - dx * fl - px * fw, tailY - dy * fl - py * fw); g.stroke();
  }

  private hitMob(a: Active, m: Monster): void {
    const sp = a.spec;
    if (sp.enemy) return;
    // 目标词条在命中时结算：处决标记（精英/BOSS）+ 猎手本能（残血<30%）
    const final = this.damageFor(sp, m, a.damageScale);
    const angle = Math.atan2(a.vy, a.vx);
    const heavy = !!sp.ult || sp.heroId === 'sniper' && !!sp.ability || sp.heroId === 'pyro' && !!sp.explodeR;
    const contactLife = m.lifeId;
    m.takeDamage(final, sp.crit, sp.heroId, sp.ignoreRes === true, sp.resCut || 0, angle, heavy);
    if (m.lifeId === contactLife) sp.onContact?.(m);
    if (sp.markAmp) m.applyHunterMark(sp.markAmp, sp.markDur || 5, !!sp.markIcon);
    if (sp.heroId === 'sniper' && sp.ult) {
      this.impacts?.sniperUltimateHit(m.x, m.hitY, angle);
      if (!a.ultContact) {
        a.ultContact = true;
        bus.emit(EVT.ULTIMATE_BEAT, { hero: sp.heroId, x: sp.x, y: sp.y, energy: 1, contact: true });
      }
    }
    this.dmg.add(sp.heroId, m.lastDamageTaken);
    if (this.parts) {
      this.parts.burst(m.x, m.hitY, sp.color, heavy ? 5 : sp.spark ? 3 : 2, heavy ? 230 : 160, angle);
    }
    // Reserve the short time accent for heavy hits and elite finishes.
    if (heavy || sp.crit && sp.heroId === 'sniper' || m.dead && m.def.elite) bus.emit(EVT.HIT_STOP);
    if (m.dead) {
      this.killPop(sp, m.x, m.hitY + m.def.radius);
    }
    if (sp.explodeR && sp.explodeR > 0) {
      for (const o of this.mgr.mobsInRadius(m.x, m.hitY, sp.explodeR, sp.targetLayer)) {
        if (o === m || o.dead) continue;
        o.takeDamage(sp.dmg * a.damageScale * (sp.explodeMul || 0.4), false, sp.heroId, false, 0,
          Math.atan2(o.hitY - m.hitY, o.x - m.x));
        this.dmg.add(sp.heroId, o.lastDamageTaken);
        if (!o.dead && sp.burnSplash && sp.burnDps) o.applyBurn(sp.burnDps, sp.burnDur ?? 3, sp.burnBurst || 0, sp.burnHealCut || 0, sp.heroId);
        if (o.dead) this.killPop(sp, o.x, o.hitY + o.def.radius);
      }
      if (sp.onBlastImpact) sp.onBlastImpact(m);
      else if (this.impacts) this.impacts.blast(m.x, m.hitY, sp.heroId, sp.explodeR, m.y);
      else this.boomFx(m.x, m.hitY, sp.explodeR);
    }
    if (sp.arcDamage) this.hitArc(a, m);
    // Explosions still resolve when the directly struck enemy dies.
    if (m.dead) return;
    if (sp.knockback) m.applyKnockback(sp.knockback);
    if (sp.slowRatio) m.applySlow(sp.slowRatio, sp.slowDur ?? 2);
    if (sp.freezeChance && Math.random() < sp.freezeChance) m.applyFreeze(sp.freezeDuration || .6);
    if (sp.burnDps) m.applyBurn(sp.burnDps, sp.burnDur ?? 3, sp.burnBurst || 0, sp.burnHealCut || 0, sp.heroId);
    if (sp.teamVuln) m.applyVuln(sp.teamVuln, 3);
    if (sp.stun) m.stunT = Math.max(m.stunT, sp.stun);
    if (sp.shockAmp) m.applyShock(sp.shockAmp, sp.shockDur ?? 3);
    // 分裂箭：与原弹同造型/同弹速/同词条（仅伤害减半、不再连锁分裂），
    // 只索敌目标前方（箭矢飞行方向的延伸，y 更大）的怪，绝不往回（防线方向）索敌（用户确认：往前索敌）
    if (sp.split && sp.split > 0 && !sp.small) {
      const fronts = this.mgr.list.filter(o => acceptsTarget(o, sp.targetLayer) && o !== m && o.hitY > m.hitY);
      for (let k = 0; k < sp.split; k++) {
        const tgt = fronts.length > 0 ? fronts[(Math.random() * fronts.length) | 0] : null;
        let dx = 0, dy = 1;   // 前方无人：沿弹道方向继续向前直射（随缘）
        if (tgt) {
          dx = tgt.x - m.x;
          dy = tgt.hitY - m.hitY;
          const ft = Math.sqrt(dx * dx + dy * dy) / sp.speed;   // 估算飞行时间
          dy -= tgt.def.speed * ft;                             // 预判：目标继续向防线行进（y 减小）
        }
        const l = Math.sqrt(dx * dx + dy * dy) || 1;
        this.fire({
          ...sp,
          x: m.x, y: m.hitY,
          dirX: dx / l, dirY: dy / l,
          dmg: sp.dmg * 0.5, crit: false,
          split: 0, small: true, exclude: m, knockback: 0, arcDamage: 0, returnDamage: 0,
          ttl: Math.min(sp.ttl ?? 3.2, 0.8),   // 射空时在近处消散，不无限前飞
        });
      }
    }
  }

  private hitArc(a: Active, primary: Monster): void {
    const sp = a.spec;
    let target: Monster | null = null, nearest = 220 * 220;
    for (const m of this.mgr.list) {
      if (!acceptsTarget(m, sp.targetLayer) || m === primary) continue;
      const d2 = (m.x - primary.x) ** 2 + (m.hitY - primary.hitY) ** 2;
      if (d2 <= nearest) { target = m; nearest = d2; }
    }
    if (!target) return;
    this.impacts?.voltChain(primary.x, primary.hitY, target.x, target.hitY, 0);
    target.takeDamage(this.damageFor(sp, target, a.damageScale * sp.arcDamage!), sp.crit, sp.heroId,
      sp.ignoreRes === true, sp.resCut || 0, Math.atan2(target.hitY - primary.hitY, target.x - primary.x));
    this.dmg.add(sp.heroId, target.lastDamageTaken);
    if (!target.dead && sp.shockAmp) target.applyShock(sp.shockAmp, sp.shockDur ?? 3);
  }

  private damageFor(sp: ProjSpec, m: Monster, scale = 1): number {
    let amount = sp.dmg * scale;
    if (sp.executeBonus && (m.def.elite || m.isBoss)) amount *= 1 + sp.executeBonus;
    if (sp.lowHpBonus && m.hp < m.maxHp * .3) amount *= 1 + sp.lowHpBonus;
    if (sp.fullHpBonus && m.hp >= m.maxHp) amount *= 1 + sp.fullHpBonus;
    if (sp.shockedBonus && m.shockT > 0) amount *= 1 + sp.shockedBonus;
    if (sp.burnedBonus && m.burnT > 0) amount *= 1 + sp.burnedBonus;
    if (sp.slowedBonus && m.slowT > 0) amount *= 1 + sp.slowedBonus;
    if (sp.coldBonus && (m.slowT > 0 || m.freezeT > 0)) amount *= 1 + sp.coldBonus;
    return amount;
  }

  /** One landing event owns the blast, damage, sound and crater callback, including empty ground. */
  private hitGround(a: Active): void {
    const sp = a.spec, radius = sp.explodeR || 0, r2 = radius * radius;
    let primary: Monster | null = null, nearest = Infinity;
    for (const m of this.mgr.list) {
      if (!acceptsTarget(m, sp.targetLayer)) continue;
      const d2 = (m.x - sp.x) ** 2 + (m.hitY - sp.y) ** 2;
      if (d2 <= r2 && d2 < nearest) { primary = m; nearest = d2; }
    }
    for (const m of this.mgr.list) {
      if (!acceptsTarget(m, sp.targetLayer) || (m.x - sp.x) ** 2 + (m.hitY - sp.y) ** 2 > r2) continue;
      // Preserve one full-strength central hit and the existing splash multiplier for neighbours.
      const direct = m === primary, amount = direct ? this.damageFor(sp, m) : sp.dmg * (sp.explodeMul || .4);
      const angle = Math.atan2(m.hitY - sp.y, m.x - sp.x);
      m.takeDamage(amount, direct && sp.crit, sp.heroId, direct && sp.ignoreRes === true, direct ? sp.resCut || 0 : 0, angle, direct);
      this.dmg.add(sp.heroId, m.lastDamageTaken);
      if (!m.dead && sp.burnDps && (direct || sp.burnSplash)) m.applyBurn(sp.burnDps, sp.burnDur ?? 3, sp.burnBurst || 0, sp.burnHealCut || 0, sp.heroId);
      if (direct && !m.dead) {
        if (sp.stun) m.stunT = Math.max(m.stunT, sp.stun);
        if (sp.slowRatio) m.applySlow(sp.slowRatio, sp.slowDur ?? 2);
      }
    }
    // Cannon's landing callback owns its layered explosion. Keep normal damage/hit-stop above/below.
    if (sp.heroId !== 'cannon' || !sp.onGroundImpact) {
      if (this.impacts) this.impacts.blast(sp.x, sp.y, sp.heroId, radius, sp.groundProjectionY ?? sp.y);
      else this.boomFx(sp.x, sp.y, radius);
      this.parts?.burst(sp.x, sp.y, sp.color, 7, 230, Math.PI / 2);
    }
    if (sp.heroId === 'pyro' && sp.ult) Sfx.ultimateImpact(sp.heroId);
    if (primary) bus.emit(EVT.HIT_STOP);
  }

  /** 击杀词条：只有技能/大招弹的击杀才弹（60% 概率在 ComicPop 掷骰）；
   *  词：大招 KAPOW! > 箭系 OOF!/SHUNT!（金）、连狙 AACK!（蓝）；普攻击杀/普通暴击不弹（用户确认） */
  private killPop(sp: ProjSpec, x: number, y: number): void {
    if (!sp.ability && !sp.ult) return;
    if (sp.heroId !== 'archer' && sp.heroId !== 'sniper') return;
    const kind = sp.ult ? 'ultKill' : sp.heroId === 'archer' ? 'skillKillArrow' : 'skillKillSnipe';
    bus.emit(EVT.COMIC_POP, x, y, kind);
  }

  private boomFx(x: number, y: number, r: number): void {
    const n = new Node('boom');
    n.layer = Layers.Enum.UI_2D;
    n.setParent(this.g.node.parent!);
    n.setPosition(x, y, 0);
    const g = n.addComponent(Graphics);
    g.strokeColor = hexc(PAL.orange);
    g.lineWidth = 3;
    g.circle(0, 0, r);
    g.stroke();
    n.setScale(0.4, 0.4, 1);
    tween(n)
      .to(0.16, { scale: new Vec3(1, 1, 1) })
      .call(() => {
        const op = n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
        tween(op).to(0.12, { opacity: 0 }).call(() => n.destroy()).start();
      })
      .start();
  }

  /** O(1) 交换移除（倒序遍历，与末位交换安全） */
  private recycle(i: number, a: Active): void {
    this.active[i] = this.active[this.active.length - 1];
    this.active.pop();
    a.spec = null as unknown as ProjSpec;
    this.free.push(a);
  }
}
