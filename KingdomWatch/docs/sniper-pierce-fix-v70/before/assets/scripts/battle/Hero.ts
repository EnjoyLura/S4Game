/**
 * 英雄单元（§3.7：普攻自动/技能自动CD/大招手动击杀充能）
 * HeroBase：站位/普攻循环/技能自动CD/击杀+呼吸回能充能；子类实现立绘/普攻/技能/大招
 * - ArcherHero 艾拉·风羽：强化箭矢(12s，6次普攻金色贯穿) / 扇形箭雨(两排×8箭全贯穿)
 * - SniperHero 凯尔·鹰眼：穿颅射击(14s，4秒窗口锁定离防线最近连续6狙×2/发·无目标等待) / 猎杀时刻(×5.5必暴·无视物抗单发)
 * - PyroHero 焰·辉：烈焰爆裂(10s，密集处 3 火球爆炸+灼烧) / 陨石天降(5 颗随机轰击+落点灼烧)
 * - VoltHero 沃尔·雷霆：连锁闪电(9s，最多 5 目标跳跃+感电) / 天雷灭世(15 道落雷+眩晕 1s)
 * 强化卡实时改写 stats（连射/齐射/分裂/爆炸/处决/残血词条）；穿戴词条（攻击/攻速/范围/暴击/充能效率/技能伤害）上场生效
 */
import { Color, Graphics, Layers, Node, UIOpacity, tween, Vec3 } from 'cc';
import { HeroStats, abilityDamage, archerEmpCfg, archerUltCfg, sniperSkCfg, sniperUltCfg, voltSkCfg, voltUltCfg, pyroSkCfg, pyroUltCfg, moraSkCfg, moraUltCfg } from '../config/Cards';
import { pyroBlastRadius, pyroBurnMultiplier, pyroBurnDuration, pyroCraterDuration, pyroMeteorCount, pyroMeteorDamage } from '../config/Cards';
import { voltShockDuration, voltShockAmp, voltShockedMultiplier, voltStrikeCount, voltStrikeTime } from '../config/Cards';
import { MORA_ULT_HITS, moraSlowRatio, moraSlowDuration, moraFreezeChance, moraNormalFreezeDuration, moraFieldRadius, moraFieldFreeze, moraColdMultiplier, moraUltimateHitDamage } from '../config/Cards';
import { ARCHER_CHARGE_MAX, SNIPER_CHARGE_MAX, PYRO_CHARGE_MAX, VOLT_CHARGE_MAX, MORA_CHARGE_MAX, ULT_REGEN_SECONDS, SPAWN_Y, HERO_Y, PAL, LO, LINE_Y } from '../config/GameConfig';
import { Monster, MonsterManager } from './Monster';
import { ProjectileManager, ProjSpec } from './Projectile';
import { DamageService } from './DamageService';
import { bus, EVT } from '../core/EventBus';
import { Sfx } from '../core/Sfx';
import { BattleSprite } from './BattleSprite';
import { HeroBattleMotion } from './HeroBattleMotion';
import { ArcherIdleAnimation } from './ArcherIdleAnimation';
import { SniperIdleAnimation } from './SniperIdleAnimation';
import { VoltIdleAnimation } from './VoltIdleAnimation';
import { PyroIdleAnimation } from './PyroIdleAnimation';
import { MoraIdleAnimation } from './MoraIdleAnimation';
import { drawSniperUltimateLock } from './SniperUltimateVFX';
import { ULT_TIMING, ARCHER_ULT_ROW_GAP, ARCHER_ULT_ROUND_GAP, METEOR_ULT_GAP, FROST_ULT_HIT_GAP } from './UltimateTiming';

function hexc(h: string): Color { const c = new Color(); Color.fromHEX(c, h); return c; }

interface PendingShot { t: number; target: Monster | null; dirX: number; dirY: number; emp?: boolean; }
interface PendingVolley { t: number; row: 0 | 1 | 2; first?: boolean; last?: boolean; }

export abstract class HeroBase {
  abstract readonly id: string;
  abstract readonly name: string;
  node = new Node('hero');
  stats: HeroStats;
  charge = 0;
  abstract readonly chargeMax: number;
  skillCd = 0;
  abstract readonly skillMax: number;
  /** Simulation-clock regeneration is independent of which hero lands the final blow. */
  private atkT = 0;
  private hx: number;
  private art: BattleSprite | null = null;
  private motion: HeroBattleMotion | null = null;
  private idleArcher: ArcherIdleAnimation | null = null;
  private idleSniper: SniperIdleAnimation | null = null;
  private idleVolt: VoltIdleAnimation | null = null;
  private idlePyro: PyroIdleAnimation | null = null;
  private idleMora: MoraIdleAnimation | null = null;
  private poseTarget: Monster | null = null;
  private attackPoseT = 0;
  // Read the instance field directly in overrides: Cocos loose super-getter lowering binds to the prototype.
  protected ultimateT = 0;
  private ultimateWindupT = 0;

  constructor(parent: Node, x: number, stats: HeroStats) {
    this.hx = x;
    this.stats = stats;
    this.buildVisual(parent);
  }

  protected abstract buildVisual(parent: Node): void;

  protected attachBattleArt(id: string): void {
    const shadow = new Node('heroContactShadow');
    shadow.layer = Layers.Enum.UI_2D;
    shadow.setParent(this.node);
    const sg = shadow.addComponent(Graphics);
    sg.fillColor = new Color(30, 24, 16, 75);
    sg.ellipse(0, -74, 30, 8); sg.fill();
    if (id === 'archer') {
      this.idleArcher = new ArcherIdleAnimation(this.node, () => {
        const fallback = this.node.getComponent(Graphics);
        if (fallback) fallback.enabled = false;
      });
      return;
    }
    if (id === 'sniper') {
      this.idleSniper = new SniperIdleAnimation(this.node, () => {
        const fallback = this.node.getComponent(Graphics);
        if (fallback) fallback.enabled = false;
      });
      return;
    }
    if (id === 'volt') {
      this.idleVolt = new VoltIdleAnimation(this.node, () => {
        const fallback = this.node.getComponent(Graphics);
        if (fallback) fallback.enabled = false;
      });
      return;
    }
    if (id === 'pyro') {
      this.idlePyro = new PyroIdleAnimation(this.node, () => {
        const fallback = this.node.getComponent(Graphics);
        if (fallback) fallback.enabled = false;
      });
      return;
    }
    if (id === 'mora') {
      this.idleMora = new MoraIdleAnimation(this.node, () => {
        const fallback = this.node.getComponent(Graphics);
        if (fallback) fallback.enabled = false;
      });
      return;
    }
    this.art = new BattleSprite(this.node, 'battle_heroes_v2', () => {
      const fallback = this.node.getComponent(Graphics);
      if (fallback) fallback.enabled = false;
      this.motion?.tick(0, 0, 0); // Apply the UV bounds even if paused before the first battle tick.
    });
    // Same painted height and foot origin, with 12 source pixels of transparent margin.
    this.art.node.setPosition(0, -76 - 12 * 146 / 336, 0);
    this.art.show(id + '_combat', 146 * 360 / 336);
    this.motion = new HeroBattleMotion(this.art, id);
  }

  /** Animate only the artwork; firing/collision coordinates remain fixed. */
  animateAttack(heavy = false, dx?: number, dy?: number): void {
    this.attackPoseT = Math.max(this.attackPoseT, heavy ? .4 : .18);
    if (dx !== undefined && dy !== undefined) this.faceAttack(dx, dy);
    else if (this.poseTarget && !this.poseTarget.dead) {
      this.faceAttack(this.poseTarget.x - this.x, this.poseTarget.y - HERO_Y - 60);
    }
    if (this.idleArcher) {
      // Generic skill/buff cues do not fire the bow; only actual arrow rows pass a direction.
      if (dx !== undefined && dy !== undefined) {
        this.idleArcher.release(1 / (this.stats.aspd * (heavy ? 1.3 : 1)));
      }
      return;
    }
    if (this.idleSniper) {
      // Generic skill/lock cues do not shoot; only actual bolt callbacks pass a direction.
      if (dx !== undefined && dy !== undefined) this.idleSniper.release(1 / this.stats.aspd);
      return;
    }
    if (this.idleVolt) {
      if (dx !== undefined && dy !== undefined) this.idleVolt.release(this.attackInterval());
      return;
    }
    if (this.idlePyro) {
      if (dx !== undefined && dy !== undefined) this.idlePyro.release(this.attackInterval());
      return;
    }
    if (this.idleMora) {
      if (dx !== undefined && dy !== undefined) this.idleMora.release(this.attackInterval());
      return;
    }
    this.motion?.release(heavy);
  }

  /** Mirror the art about its foot pivot; UI, shadow and simulation origins stay fixed. */
  private faceAttack(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const length = Math.hypot(dx, dy);
    if (!length || Math.abs(dx / length) < .06) return;
    const art = this.idleArcher?.node || this.idleSniper?.node || this.idleVolt?.node || this.idlePyro?.node || this.idleMora?.node || this.art?.node;
    // Complete video characters face left by default; remaining sprites face right.
    const rightScale = this.idleArcher || this.idleSniper || this.idleVolt || this.idlePyro || this.idleMora ? -1 : 1;
    art?.setScale(dx > 0 ? rightScale : -rightScale, 1, 1);
  }

  /** Idle presentation during the entry countdown; no combat timers are advanced. */
  tickIdle(dt: number): void { this.idleArcher?.tick(dt); this.idleSniper?.tick(dt); this.idleVolt?.tick(dt); this.idlePyro?.tick(dt); this.idleMora?.tick(dt); }

  private tickPose(dt: number, mgr?: MonsterManager): void {
    this.attackPoseT = Math.max(0, this.attackPoseT - dt);
    if (mgr) this.poseTarget = mgr.pickTarget(this.x, HERO_Y, this.stats.range);
    if (this.poseTarget?.dead) this.poseTarget = null;
    const target = this.poseTarget;
    const hasTargetInRange = !!target;
    const idle = !hasTargetInRange && !Number.isFinite(this.queuedShotDelay())
      && this.attackPoseT <= 0 && !this.motion?.attacking && !this.idleArcher?.attacking
      && !this.idleSniper?.attacking && !this.idleVolt?.attacking && !this.idlePyro?.attacking && !this.idleMora?.attacking;
    if (target && this.attackPoseT <= 0 && !this.idleArcher?.attacking && !this.idleSniper?.attacking && !this.idleVolt?.attacking && !this.idlePyro?.attacking && !this.idleMora?.attacking) {
      this.faceAttack(target.x - this.x, target.y - HERO_Y - 60);
    }
    // Read the base interval: Archer.attackInterval consumes its empowerment flag.
    const leadTime = Math.min(.16, (1 / this.stats.aspd) * .28);
    const delay = Math.min(this.atkT > 0 ? this.atkT : Infinity, this.queuedShotDelay());
    const prepare = target && delay < leadTime ? 1 - Math.max(0, delay) / leadTime : 0;
    if (this.idleArcher) { this.idleArcher.tick(dt, idle, prepare); return; }
    if (this.idleSniper) { this.idleSniper.tick(dt, idle, prepare); return; }
    if (this.idleVolt) { this.idleVolt.tick(dt, idle, prepare); return; }
    if (this.idlePyro) { this.idlePyro.tick(dt, idle, prepare); return; }
    if (this.idleMora) { this.idleMora.tick(dt, idle, prepare); return; }
    // Facing now comes from whole-art mirroring, not upper-body leaning.
    this.motion?.tick(dt, prepare, 0, idle);
  }

  get x(): number { return this.hx; }
  get effAtk(): number { return this.stats.atk * this.stats.atkMul; }
  /** 两项独立基础值：攻击力 × 小额系数 + 技能伤害 × 当前技能倍率。 */
  abilityDamage(skillMultiplier: number, ultimate = false, attackMultiplier?: number): number {
    return abilityDamage(this.stats, skillMultiplier, ultimate, attackMultiplier);
  }
  get chargeGoal(): number { return this.chargeMax * (this.stats.chargeMul || 1); }
  get skillUnlocked(): boolean { return this.stats.skillUnlocked === true; }
  get ultUnlocked(): boolean { return this.stats.ultUnlocked === true; }
  get chargePct(): number { return this.ultUnlocked ? this.charge / this.chargeGoal : 0; }
  get ultReady(): boolean { return this.ultUnlocked && this.charge >= this.chargeGoal && this.ultimateRemaining <= 0; }
  /** 大招演出时长（三选一挂起窗口，演出完再弹卡）；逐英雄覆盖 */
  get ultShowDuration(): number { return ULT_TIMING[this.id].duration; }
  get ultimateRemaining(): number { return this.ultimateT; }
  protected beginUltimate(duration = this.ultShowDuration): void {
    this.ultimateT = duration;
    const windup = ULT_TIMING[this.id].windup;
    this.ultimateWindupT = windup;
    bus.emit(EVT.ULTIMATE_BEGIN, { hero: this.id, x: this.x, y: HERO_Y + 60, windup, duration });
    Sfx.prepareUltimate(this.id, windup);
  }
  protected ultimateBeat(x: number, y: number, energy = .5, contact = false): void {
    bus.emit(EVT.ULTIMATE_BEAT, { hero: this.id, x, y, energy, contact });
  }
  get skillPct(): number { return this.skillUnlocked ? 1 - this.skillCd / this.skillCdTotal : 0; }
  /** 技能完整冷却（含冷却缩减卡；与施放时写入 skillCd 的算法一致） */
  get skillCdTotal(): number { return Math.max(2, this.skillMax - (this.stats.skillCdFlat || 0)); }

  /** 伤害统计服务（tick 每帧刷新；直伤型技能/大招用于计入统计） */
  protected lastDmg: DamageService | null = null;
  tick(dt: number, mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): void {
    this.lastDmg = dmg;
    this.ultimateWindupT = Math.max(0, this.ultimateWindupT - dt);
    if (this.ultimateT > 0) {
      this.ultimateT = Math.max(0, this.ultimateT - dt);
      if (this.ultimateT === 0 && this.ultReady) {
        bus.emit(EVT.CHARGE_CHANGED, this.chargePct, true); Sfx.play('ready');
      }
    }
    this.tickPose(dt, mgr);
    this.updateQueues(dt, mgr, projs);
    // 普攻
    this.atkT -= dt;
    if (this.atkT <= 0 && this.ultimateWindupT <= 0) {
      const t = mgr.pickTarget(this.x, HERO_Y, this.stats.range);
      if (t) {
        this.poseTarget = t;
        this.animateAttack();
        this.shoot(t, mgr, projs);
        this.atkT = this.attackInterval();
      } else {
        this.atkT = 0;
      }
    }
    // 技能（自动：CD 好 + 技能范围内有怪）
    if (this.skillUnlocked) {
      this.skillCd -= dt;
      if (this.skillCd <= 0 && this.ultimateWindupT <= 0 && mgr.anyInRange(this.x, HERO_Y, this.stats.skillRange)) {
        this.animateAttack(true);
        this.castSkill(mgr, projs, dmg);
      }
    }
    if (this.ultUnlocked && !this.ultReady)
      this.chargeKill(this.chargeMax * dt / (ULT_REGEN_SECONDS[this.id] || 90));
  }

  /** 子类队列推进（连射/技能连狙等） */
  protected updateQueues(_dt: number, _mgr: MonsterManager, _projs: ProjectileManager): void { void _dt; void _mgr; void _projs; }
  protected queuedShotDelay(): number { return Infinity; }

  /** 本次普攻后的攻击间隔（弓箭手强化窗口攻速 +30% 时覆写） */
  protected attackInterval(): number { return 1 / this.stats.aspd; }

  protected abstract shoot(target: Monster, mgr: MonsterManager, projs: ProjectileManager): void;
  protected abstract castSkill(mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): void;
  /** 大招（手动，充能满可放；全场无目标时不消耗充能） */
  abstract castUlt(mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): boolean;

  /** Accept natural or shared kill energy, including the ready transition notification. */
  chargeKill(v: number): void {
    if (!this.ultUnlocked || this.charge >= this.chargeGoal) return;
    const was = this.ultReady;
    this.charge = Math.min(this.chargeGoal, this.charge + v);
    bus.emit(EVT.CHARGE_CHANGED, this.chargePct, this.ultReady);
    if (!was && this.ultReady) Sfx.play('ready');
  }

  /**
   * 预判拦截瞄准：按目标当前速度解拦截方程，瞄准"子弹到达时目标将所在的位置"。
   * 目标匀速直线下行 v（停位/攻击态 v=0），子弹速度 s，相对位移 (dx,dy)：
   *   (v²-s²)t² - 2·dy·v·t + (dx²+dy²) = 0，s>v 时判别式恒 ≥0 必有解。
   * 理论不可拦截（disc<0）或无正根时退化为瞄准当前位置。
   */
  protected lead(target: Monster, bulletSpeed: number): { dirX: number; dirY: number } {
    const px = this.x, py = HERO_Y + 60;
    const moving = target.state === 'move' && !target.immobilized;
    const v = moving ? target.def.speed * (target.slowT > 0 ? 1 - target.slowAmp : 1) : 0;
    const dx = target.x - px, dy = target.y - py;
    const a = v * v - bulletSpeed * bulletSpeed;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let t = dist / bulletSpeed;
    if (v > 0 && a < -1e-6) {
      const disc = dy * dy * v * v - a * (dx * dx + dy * dy);
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        const t1 = (dy * v - sq) / a, t2 = (dy * v + sq) / a;
        const hit = t1 > 0 && t2 > 0 ? Math.min(t1, t2) : (t1 > 0 ? t1 : t2);
        if (hit > 0) t = hit;
      }
    }
    const ldx = target.x - px, ldy = target.y - v * t - py;
    const l = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
    return { dirX: ldx / l, dirY: ldy / l };
  }

  /** 命中词条透传（处决标记/猎手本能：弹道命中时按目标结算） */
  protected targetBonuses(): PickUp<ProjSpec, 'executeBonus' | 'lowHpBonus'> {
    const b: { executeBonus?: number; lowHpBonus?: number } = {};
    if (this.stats.executeBonus) b.executeBonus = this.stats.executeBonus;
    if (this.stats.lowHpBonus) b.lowHpBonus = this.stats.lowHpBonus;
    return b;
  }
}

type PickUp<T, K extends keyof T> = { [P in K]?: T[P] };

/* ============================================================
 * 弓箭手 · 艾拉·风羽（线稿 hero_aila_battle 100×120）
 * ============================================================ */
export class ArcherHero extends HeroBase {
  readonly id = 'archer';
  readonly name = '艾拉·风羽';
  readonly chargeMax = ARCHER_CHARGE_MAX;
  readonly skillMax = 12;
  /** 技能·强化箭矢：剩余强化普攻次数（>0 且窗口未过期时出弓即金色贯穿箭） */
  empowerLeft = 0;
  /** 强化窗口剩余秒数（技能15级里程碑 +2s；到时未射完的强化次数作废） */
  empowerT = 0;
  private lastEmp = false;
  private serialQueue: PendingShot[] = [];
  private volleyQueue: PendingVolley[] = [];

  protected queuedShotDelay(): number {
    return Math.min(Infinity, ...this.serialQueue.map(shot => shot.t), ...this.volleyQueue.map(row => row.t));
  }

  protected buildVisual(parent: Node): void {
    const g = this.node.addComponent(Graphics);
    // 背影弓手立于防线工事前，头顶被普攻/技能图标锚定
    const ink = hexc(PAL.ink);
    g.strokeColor = ink;
    g.lineWidth = 3;
    // 披风下摆（上窄下宽的梯形，風感）
    g.fillColor = hexc('#3E5F2A');
    g.moveTo(-20, 34); g.lineTo(20, 34); g.lineTo(30, -76); g.lineTo(-30, -76);
    g.close(); g.fill(); g.stroke();
    // 躯干
    g.fillColor = hexc('#4E7A32');
    g.roundRect(-22, -34, 44, 66, 14);
    g.fill(); g.stroke();
    // 金色腰带 + 搭扣
    g.fillColor = hexc(PAL.gold2);
    g.roundRect(-22, -22, 44, 7, 3);
    g.fill();
    g.fillColor = hexc(PAL.gold);
    g.circle(0, -18, 4);
    g.fill();
    // 肩甲
    g.fillColor = hexc('#5E8F3C');
    g.circle(-22, 24, 9); g.fill(); g.stroke();
    g.circle(22, 24, 9); g.fill(); g.stroke();
    // 头 + 兜帽
    g.fillColor = hexc('#E8C39A');
    g.circle(0, 26, 14); g.fill(); g.stroke();
    g.fillColor = hexc('#4E7A32');
    g.arc(0, 24, 16, -0.25, Math.PI + 0.25, false);
    g.close(); g.fill(); g.stroke();
    // 箭袋（背上左侧）+ 箭羽
    g.fillColor = hexc('#7A4B22');
    g.moveTo(-30, -12); g.lineTo(-19, -8); g.lineTo(-25, 20); g.lineTo(-36, 16);
    g.close(); g.fill(); g.stroke();
    g.fillColor = hexc(PAL.gold);
    g.circle(-30, -14, 3.5); g.fill();
    g.circle(-24, -17, 3.5); g.fill();
    // 长弓（右侧竖持，弓弦朝后）
    g.strokeColor = hexc(PAL.parch);
    g.lineWidth = 4.5;
    g.arc(28, -4, 30, -1.2, 1.2, false);
    g.stroke();
    g.strokeColor = hexc('#FFFFFFCC');
    g.lineWidth = 1.5;
    g.moveTo(28 + 30 * Math.cos(1.2), -4 + 30 * Math.sin(1.2));
    g.lineTo(28 + 30 * Math.cos(-1.2), -4 + 30 * Math.sin(-1.2));
    g.stroke();
    // 靴（下沿没入工事）
    g.fillColor = hexc('#2A2118');
    g.roundRect(-19, -78, 15, 16, 4); g.fill(); g.stroke();
    g.roundRect(4, -78, 15, 16, 4); g.fill(); g.stroke();
    this.node.setPosition(this.x, HERO_Y, 0);
    this.node.setParent(parent);
    this.attachBattleArt('archer');
  }

  /** 强化箭矢窗口内攻速 +30%（贯穿爽感） */
  protected attackInterval(): number {
    const e = this.lastEmp;
    this.lastEmp = false;
    return 1 / (this.stats.aspd * (e ? 1.3 : 1));
  }

  private spec(base: {
    x: number; y: number; dirX?: number; dirY?: number; small?: boolean; dmgMul?: number; emp?: boolean;
  }): ProjSpec {
    const emp = base.emp === true;
    const crit = Math.random() < this.stats.critRate;
    const atk = (emp ? this.abilityDamage(archerEmpCfg(this.stats.skillLv).mult)
      : this.effAtk * (this.stats.normalMul || 1)) * (base.dmgMul ?? 1) * (crit ? this.stats.critMul : 1);
    return {
      x: base.x, y: base.y,
      dirX: base.dirX, dirY: base.dirY,
      speed: base.small ? 720 : 960,   // 弹速与普攻一致（强化箭不再加速，用户调整）
      dmg: atk, crit,
      color: emp ? PAL.gold : PAL.parch,   // 暴击不改箭色（用户反馈），只由伤害飘字体现
      heroId: this.id,
      size: base.small ? 5 : emp ? 10 : 7,
      small: base.small,
      pierce: emp ? 999 : this.stats.pierce,
      resCut: this.stats.defIgnore || 0,   // 英雄突破：无视防御比例（全部箭矢）
      spark: emp,
      explodeR: this.stats.explodeR > 0 && !base.small ? this.stats.explodeR : 0,
      explodeMul: this.stats.explodeMul,
      split: this.stats.split,
      slowRatio: this.stats.slowOnHit || 0,
      slowDur: this.stats.slowDur || 2,
      burnDps: this.stats.burnOnHit ? this.effAtk * this.stats.burnOnHit : 0,
      ability: emp,          // 技能弹种标记：击杀弹 60% 词条（普攻击杀不弹）
      ...this.targetBonuses(),
    };
  }

  /** 出弓瞬间按拦截预判锁定方向，之后直线飞行（用户确认：不追踪不拐弯）；emp=金色强化贯穿箭 */
  private fireDir(projs: ProjectileManager, dirX: number, dirY: number, emp = false): void {
    projs.fire(this.spec({ x: this.x, y: HERO_Y + 60, dirX, dirY, emp }));
  }

  protected shoot(target: Monster, _mgr: MonsterManager, projs: ProjectileManager): void {
    void _mgr;
    // 强化箭矢窗口：本次普攻（含连射/齐射子弹道）全部为金色贯穿箭，按次扣减
    const win = this.empowerLeft > 0;
    if (win) this.empowerLeft--;
    this.lastEmp = win;   // 攻速加成只随强化窗口（突破箭不加攻速）
    // 英雄突破：概率射出强化普攻箭——外观/数值与金色强化箭完全一致（用户确认），不占窗口次数
    const emp = win || Math.random() < (this.stats.pierceChance || 0);
    const bs = 960;   // 与 spec 弹速一致（强化箭同普攻弹速，用户调整）
    // 首排弹幕：预判拦截点直线射出（列 = 1+齐射层）
    const lead = this.lead(target, bs);
    this.fireRow(projs, lead.dirX, lead.dirY, emp);
    // 连射：后续排延迟成排再射；每排出弓瞬间若目标存活则按当时状态重新预判（出弓后仍直线），目标已亡则沿锁定方向
    for (let i = 1; i <= this.stats.serial; i++) {
      this.serialQueue.push({ t: i * 0.12, target, dirX: lead.dirX, dirY: lead.dirY, emp });
    }
  }

  /** 一排弹幕（列 = 1+齐射层）：主箭严格沿瞄准线（与普攻同款拦截预判，恒有一箭锁主目标），
   *  附加列在主箭两侧交替展开（+7°,-7°,+14°…直线随缘）（齐射×连射 = 列×排网格）。
   *  旧版整组以瞄准线为中心对称摊开——偶数列（1/3 层）时没有任何箭在瞄准线上，5° 偏移在
   *  400~900px 交战距离即脱靶 35~79px（怪碰撞半径仅 22~34px），齐射后反而一直打不中主目标 */
  private fireRow(projs: ProjectileManager, dirX: number, dirY: number, emp: boolean): void {
    this.animateAttack(emp, dirX, dirY);
    Sfx.shoot(this.id);
    const cols = 1 + this.stats.fan;
    const baseAng = Math.atan2(dirY, dirX);
    // One air-pressure release per row, rather than stacking an effect for every fan arrow.
    projs.normalRelease(this.id, this.x, HERO_Y + 60, dirX, dirY, emp);
    for (let c = 0; c < cols; c++) {
      const side = c === 0 ? 0 : Math.ceil(c / 2) * (c % 2 === 1 ? 1 : -1);   // c=0 主箭 0°；其余 +7/-7/+14/-14/+21…
      const ang = baseAng + side * 7 * Math.PI / 180;
      this.fireDir(projs, Math.cos(ang), Math.sin(ang), emp);
    }
  }

  /** 出手弓弦闪光：箭矢出弓点的一瞬星芒（约 90ms，主芒顺瞄准方向 + 侧芒 + 亮芯），金箭配金光 */
  private bowFlash(projs: ProjectileManager, dx: number, dy: number, emp: boolean): void {
    if (projs.arrowRelease(this.x, HERO_Y + 60, dx, dy, emp)) return;
    const flash = new Node('bowFlash');
    flash.layer = Layers.Enum.UI_2D;
    flash.setParent(this.node.parent!);
    flash.setPosition(this.x + dx * 36, HERO_Y + 60 + dy * 36, 0);
    const g = flash.addComponent(Graphics);
    g.strokeColor = hexc(emp ? PAL.gold : '#FFF3D6');
    g.lineWidth = 2.5;
    g.moveTo(dx * 3, dy * 3); g.lineTo(dx * 15, dy * 15); g.stroke();
    g.strokeColor = hexc(emp ? '#FFE9A8' : PAL.parch);
    g.lineWidth = 2;
    for (const sd of [-1, 1]) {
      const px = -dy * sd, py = dx * sd;
      g.moveTo(px * 2.5, py * 2.5); g.lineTo(px * 8 + dx * 4, py * 8 + dy * 4); g.stroke();
    }
    g.fillColor = hexc('#FFFFFF');
    g.circle(0, 0, 2.6);
    g.fill();
    const pop = flash.addComponent(UIOpacity);
    flash.setScale(0.7, 0.7, 1);
    tween(flash).to(0.09, { scale: new Vec3(1.5, 1.5, 1) }).start();
    tween(pop).to(0.09, { opacity: 0 }).call(() => flash.destroy()).start();
  }

  protected updateQueues(dt: number, mgr: MonsterManager, projs: ProjectileManager): void {
    // 强化窗口倒计时：到时未用完的强化次数作废（窗口时长可被技能15级里程碑延长）
    if (this.empowerT > 0) {
      this.empowerT -= dt;
      if (this.empowerT <= 0) this.empowerLeft = 0;
    }
    // 连射串行子弹：出弓瞬间按当时状态重新预判方向，出弓后直线飞行（不追踪不拐弯）
    for (let i = this.serialQueue.length - 1; i >= 0; i--) {
      const q = this.serialQueue[i];
      q.t -= dt;
      if (q.t <= 0) {
        this.serialQueue.splice(i, 1);
        if (q.target && !q.target.dead) {
          const ld = this.lead(q.target, 960);
          this.fireRow(projs, ld.dirX, ld.dirY, q.emp === true);
        } else {
          this.fireRow(projs, q.dirX, q.dirY, q.emp === true);
        }
      }
    }
    // 大招：贯穿扇形箭雨轮次（两排，第二排延迟错半步）
    for (let i = this.volleyQueue.length - 1; i >= 0; i--) {
      const v = this.volleyQueue[i];
      v.t -= dt;
      if (v.t <= 0) {
        this.volleyQueue.splice(i, 1);
        this.fireFanRow(projs, v.row, !!v.first, !!v.last);
      }
    }
    void mgr;
  }

  /** 技能·强化箭矢（自动）：窗口内接下来 N 次普攻变为金色贯穿箭（倍率/次数/时长随技能等级成长） */
  protected castSkill(_mgr: MonsterManager, _projs: ProjectileManager, _dmg: DamageService): void {
    void _mgr; void _projs; void _dmg;
    const c = archerEmpCfg(this.stats.skillLv);
    this.skillCd = this.skillCdTotal;   // 含冷却缩减（技能5级里程碑 -1s、冷却缩减卡）
    this.empowerLeft = c.arrows;
    this.empowerT = c.dur;
    // 演出：英雄身上金色环脉冲扩散，标记"箭矢已强化"
    const pulse = new Node('empPulse');
    pulse.layer = Layers.Enum.UI_2D;
    pulse.setParent(this.node.parent!);
    pulse.setPosition(this.x, HERO_Y + 20, 0);
    const pg = pulse.addComponent(Graphics);
    pg.strokeColor = hexc(PAL.gold);
    pg.lineWidth = 2.5;
    pg.circle(0, 0, 34);
    pg.stroke();
    const pop = pulse.addComponent(UIOpacity);
    tween(pulse).to(0.22, { scale: new Vec3(1.55, 1.55, 1) }).start();
    tween(pop).to(0.22, { opacity: 0 }).call(() => pulse.destroy()).start();
  }

  /** 蓄风后逐排推进；多轮卡仍追加原有轮次，排/轮间隔由统一时序控制。 */
  castUlt(_mgr: MonsterManager, projs: ProjectileManager, _dmg: DamageService): boolean {
    if (!this.ultReady || !_mgr.list.some(m => !m.dead)) return false;
    this.charge = 0;
    this.beginUltimate();
    const rounds = Math.max(1, Math.round(this.stats.ultRounds || 1));
    const rows = archerUltCfg(this.stats.ultLv).rows;   // 大招10级里程碑：2排 → 3排
    for (let r = 0; r < rounds; r++) {
      for (let w = 0; w < rows; w++) this.volleyQueue.push({
        t: ULT_TIMING.archer.windup + r * ARCHER_ULT_ROUND_GAP + w * ARCHER_ULT_ROW_GAP,
        row: w as 0 | 1 | 2, first: r === 0 && w === 0, last: r === rounds - 1 && w === rows - 1 });
    }
    bus.emit(EVT.CHARGE_CHANGED, 0, false);
    void projs; void _dmg;
    return true;
  }

  get ultimateRemaining(): number { return Math.max(this.ultimateT, this.volleyQueue.length ? .01 : 0); }
  get ultShowDuration(): number {
    return ULT_TIMING.archer.duration + (Math.max(1, this.stats.ultRounds || 1) - 1) * ARCHER_ULT_ROUND_GAP
      + (archerUltCfg(this.stats.ultLv).rows - 2) * ARCHER_ULT_ROW_GAP;
  }
  /** 原扇形角度、箭数及弹速保持；每排实发才触发风压与音效。 */
  private fireFanRow(projs: ProjectileManager, row: 0 | 1 | 2, first: boolean, last: boolean): void {
    this.animateAttack(true, 0, 1);
    this.bowFlash(projs, 0, 1, true);
    if (first) Sfx.cast(this.id, true); else Sfx.shoot(this.id);
    this.ultimateBeat(this.x, HERO_Y + 60, last ? .8 : .55);
    const uc = archerUltCfg(this.stats.ultLv);
    const n = uc.arrows;
    const spread = 60 * Math.PI / 180;
    const off = row === 0 ? 0 : row === 1 ? 0.5 : 0.25;
    const speed = row === 0 ? 560 : row === 1 ? 480 : 520;
    for (let k = 0; k < n; k++) {
      const a = -spread / 2 + (spread * (k + off)) / n;   // 相对竖直方向的偏角
      projs.fire({
        x: this.x, y: HERO_Y + 60,
        dirX: Math.sin(a), dirY: Math.cos(a),
        speed,
        dmg: this.abilityDamage(uc.coeff, true), crit: Math.random() < this.stats.critRate,
        color: PAL.gold, heroId: this.id, size: 9, ttl: 3.6, pierce: 999, spark: true,
        ability: true, ult: true,
      });
    }
  }
}

/* ============================================================
 * 狙击游侠 · 凯尔·鹰眼（线稿 hero_kyle_battle 100×120，深蓝）
 * ============================================================ */
export class SniperHero extends HeroBase {
  readonly id = 'sniper';
  readonly name = '凯尔·鹰眼';
  readonly chargeMax = SNIPER_CHARGE_MAX;
  readonly skillMax = 14;
  /** 技能·穿颅射击连狙队列：剩余发数、下发出膛倒计时、总索敌窗口（无目标等待不取消） */
  private volley: { t: number; left: number; ttl: number } | null = null;
  /** 大招·猎杀时刻：1.1s 锁定演出（瞄准线实时追踪 + 收缩准星）→ 贯穿弹 */
  private ultLock: { t: number; target: Monster; targets: Monster[]; node: Node; g: Graphics } | null = null;

  protected buildVisual(parent: Node): void {
    const g = this.node.addComponent(Graphics);
    // 背影狙击游侠：深蓝斗篷 + 重弩（线稿 hero_kyle_battle 100×120）
    const ink = hexc(PAL.ink);
    g.strokeColor = ink;
    g.lineWidth = 3;
    // 斗篷下摆
    g.fillColor = hexc('#24344F');
    g.moveTo(-20, 34); g.lineTo(20, 34); g.lineTo(30, -76); g.lineTo(-30, -76);
    g.close(); g.fill(); g.stroke();
    // 躯干（胸甲）
    g.fillColor = hexc('#31486B');
    g.roundRect(-22, -34, 44, 66, 14);
    g.fill(); g.stroke();
    // 腰带 + 搭扣
    g.fillColor = hexc('#8A6A2F');
    g.roundRect(-22, -22, 44, 7, 3);
    g.fill();
    g.fillColor = hexc(PAL.gold);
    g.circle(0, -18, 4);
    g.fill();
    // 肩甲
    g.fillColor = hexc('#3E5A85');
    g.circle(-22, 24, 9); g.fill(); g.stroke();
    g.circle(22, 24, 9); g.fill(); g.stroke();
    // 头 + 猎帽（宽檐）
    g.fillColor = hexc('#E8C39A');
    g.circle(0, 26, 14); g.fill(); g.stroke();
    g.fillColor = hexc('#24344F');
    g.roundRect(-20, 32, 40, 5, 2.5); g.fill(); g.stroke();
    g.arc(0, 30, 15, 0, Math.PI, false);
    g.close(); g.fill(); g.stroke();
    // 箭矢弹匣包（背上左侧）
    g.fillColor = hexc('#4A3A22');
    g.moveTo(-30, -12); g.lineTo(-19, -8); g.lineTo(-25, 20); g.lineTo(-36, 16);
    g.close(); g.fill(); g.stroke();
    // 重弩（右侧竖持）：弩臂 + 瞄准镜 + 弦
    g.strokeColor = hexc('#5A4326');
    g.lineWidth = 6;
    g.arc(28, -4, 26, -1.15, 1.15, false);
    g.stroke();
    g.strokeColor = hexc('#7A5A34');
    g.lineWidth = 4;
    g.moveTo(28, -30); g.lineTo(28, 22);
    g.stroke();
    g.strokeColor = hexc(PAL.blue);
    g.lineWidth = 2.5;
    g.circle(28, -4, 6);
    g.stroke();
    g.strokeColor = hexc('#FFFFFFCC');
    g.lineWidth = 1.5;
    g.moveTo(28 + 26 * Math.cos(1.15), -4 + 26 * Math.sin(1.15));
    g.lineTo(28 + 26 * Math.cos(-1.15), -4 + 26 * Math.sin(-1.15));
    g.stroke();
    // 靴（下沿没入工事）
    g.fillColor = hexc('#1A2230');
    g.roundRect(-19, -78, 15, 16, 4); g.fill(); g.stroke();
    g.roundRect(4, -78, 15, 16, 4); g.fill(); g.stroke();
    this.node.setPosition(this.x, HERO_Y, 0);
    this.node.setParent(parent);
    this.attachBattleArt('sniper');
  }

  /** 普攻：慢速高伤重弩箭（拦截预判直线，不追踪） */
  protected shoot(target: Monster, _mgr: MonsterManager, projs: ProjectileManager): void {
    void _mgr;
    const lead = this.lead(target, 1140);   // 普攻弹速 ×1.5（用户调整）
    this.animateAttack(false, lead.dirX, lead.dirY);
    projs.fire(this.boltSpec(lead.dirX, lead.dirY));
    projs.normalRelease(this.id, this.x, HERO_Y + 60, lead.dirX, lead.dirY);
    Sfx.shoot(this.id);
  }

  private boltSpec(dirX: number, dirY: number): ProjSpec {
    const crit = Math.random() < this.stats.critRate;
    return {
      x: this.x, y: HERO_Y + 60,
      dirX, dirY, speed: 1140,   // 与 lead 预判一致（×1.5）
      dmg: this.effAtk * (this.stats.normalMul || 1) * (crit ? this.stats.critMul : 1), crit,
      fullHpBonus: this.stats.fullHpBonus || 0,   // 技能15级：对满血目标+25%
      color: '#7FB3FF', heroId: this.id, size: 8,
      pierce: this.stats.pierce,
      slowRatio: this.stats.slowOnHit || 0,
      slowDur: this.stats.slowDur || 2,
      burnDps: this.stats.burnOnHit ? this.effAtk * this.stats.burnOnHit : 0,
      ...this.targetBonuses(),
    };
  }

  private autoT = -1;   // 突破自动大招计时（-1=未初始化；仅 stats.ultAutoCd>0 时生效）
  get ultimateRemaining(): number { return Math.max(this.ultimateT, this.ultLock ? .01 : 0); }

  protected queuedShotDelay(): number {
    if (this.ultLock) return Math.max(0, this.ultLock.t);
    if (this.volley) return Math.max(0, this.volley.t);
    return Infinity;
  }

  protected updateQueues(dt: number, mgr: MonsterManager, projs: ProjectileManager): void {
    // 90 级突破：每 25s 自动释放一次大招（无需充能也不消耗充能——用户定稿）；无目标待命，出现即放
    if (this.ultUnlocked && this.stats.ultAutoCd > 0) {
      if (this.autoT < 0) this.autoT = this.stats.ultAutoCd;
      // Presentation can defer a due cast, but never lengthens the 25s cooldown itself.
      this.autoT = Math.max(0, this.autoT - dt);
      if (this.autoT <= 0 && !this.ultLock && this.ultimateRemaining <= 0) {
        const tgt = mgr.highestHp();
        if (tgt) { this.autoT = this.stats.ultAutoCd; this.beginUltLock(tgt, mgr); }
      }
    }
    // 技能连狙：4 秒窗口内每 0.28s 重新锁定「离防线最近」目标（用户调整：不再选血量最高）；
    // 窗口内暂无目标只等待不取消（如击杀后 0.3s 新怪入圈仍可继续索敌）
    if (this.volley) {
      this.volley.ttl -= dt;
      if (this.volley.ttl <= 0) { this.volley = null; }
      else {
        this.volley.t -= dt;
        while (this.volley && this.volley.t <= 0) {
          const tgt = mgr.nearestToLineInRange(this.x, HERO_Y, this.stats.skillRange);
          if (!tgt) { this.volley.t += 0.1; break; }   // 0.1s 后重试
          this.snipeShot(tgt, projs, sniperSkCfg(this.stats.skillLv).mul, false);   // 技能升级：每发倍率成长
          this.volley.left--;
          if (this.volley.left <= 0) { this.volley = null; break; }
          this.volley.t += 0.28;
        }
      }
    }
    // 大招锁定演出：瞄准线实时追踪 + 准星收缩，1.1s 后发射贯穿弹
    if (this.ultLock) {
      const L = this.ultLock;
      L.t -= dt;
      if (L.target.dead) {
        // 锁定目标死亡：转火全场血量最高；全场清空则收线（充能已消耗）
        const nt = mgr.highestHp();
        if (!nt) { this.endUltLock(); return; }
        L.target = nt;
      }
      const p = Math.max(0, Math.min(1, 1 - L.t / ULT_TIMING.sniper.windup));   // 锁定进度 0→1
      this.drawUltLock(mgr, p);
      if (L.t <= 0) {
        this.fireUltBolt(projs, L.targets);
        this.endUltLock();
      }
    }
  }

  private endUltLock(): void {
    if (this.ultLock) { this.ultLock.node.destroy(); this.ultLock = null; }
  }

  /** Preserve the primary lock; extra lines use the same highest-HP rule as the actual bolts. */
  private drawUltLock(mgr: MonsterManager, progress: number): void {
    const L = this.ultLock;
    if (!L) return;
    const targets = L.targets, count = 1 + Math.max(0, Math.round((this.stats.ultBolts || 1) - 1));
    targets.length = 0; targets.push(L.target);
    // Keep a tiny ranked list rather than allocating/sorting the whole crowd every frame.
    if (count > 1) for (const m of mgr.list) {
      if (m.dead || m === L.target) continue;
      let at = 1;
      while (at < targets.length && targets[at].hp >= m.hp) at++;
      if (at >= count) continue;
      targets.splice(at, 0, m);
      if (targets.length > count) targets.pop();
    }
    L.g.clear();
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      drawSniperUltimateLock(L.g, this.x, HERO_Y + 60, target.x, target.y, progress, i === 0);
    }
  }

  /** 锁定完成：发射贯穿弹（×5.5 必暴、无视物抗、无限贯穿），拦截预判锁定方向；
   *  额外枪线卡：其余血量最高的目标各补一发 */
  private fireUltBolt(projs: ProjectileManager, targets: readonly Monster[]): void {
    const locked = targets[0];
    if (!locked) return;
    const direction = this.lead(locked, 1100);
    this.animateAttack(true, direction.dirX, direction.dirY);
    const uc = sniperUltCfg(this.stats.ultLv);   // 大招升级：倍率成长/弹体判定+20%/猎杀标记
    const fire1 = (t: Monster): void => {
      const lead = this.lead(t, 1100);
      projs.fire({
        x: this.x, y: HERO_Y + 60,
        dirX: lead.dirX, dirY: lead.dirY, speed: 1100,
        dmg: this.abilityDamage(uc.boltMul, true), crit: true,
        color: '#509DFF', heroId: this.id, size: 12 * uc.rMul,
        ttl: 4, pierce: 999, spark: true,
        ignoreRes: true,
        ult: true, ability: true,   // 大招弹：击杀弹 KAPOW!（60%）
        markAmp: Math.max(uc.markAmp, this.stats.ultMarkAmp || 0) || undefined, markDur: uc.markDur,
        markIcon: (this.stats.ultMarkAmp || 0) > 0,
        ...this.targetBonuses(),
      });
    };
    // Fire at exactly the targets shown in the final lock frame, without selecting again.
    for (const target of targets) fire1(target);
    Sfx.cast(this.id, true);
    this.ultimateBeat(this.x, HERO_Y + 60, .65);
  }

  /** 瞬击一发：重弩箭真弹道（命中才结算伤害），独立暴击 */
  private snipeShot(target: Monster, projs: ProjectileManager, mul: number, ignoreRes: boolean): void {
    const crit = Math.random() < this.stats.critRate;
    const dmgVal = this.abilityDamage(mul) * (crit ? this.stats.critMul : 1);
    const speed = 1800;
    const lead = this.lead(target, speed);   // 拦截预判：伤害在弩箭命中时才结算（用户确认）
    this.animateAttack(true, lead.dirX, lead.dirY);
    projs.fire({
      x: this.x, y: HERO_Y + 60,
      dirX: lead.dirX, dirY: lead.dirY, speed,
      dmg: dmgVal, crit, color: '#7FB3FF', heroId: this.id, size: 8,
      ignoreRes,
      pierce: this.stats.skillPierce || 0,
      ability: true,   // 技能弹：击杀弹 60% 词条（skillKillSnipe）
      ...this.targetBonuses(),
    });
    Sfx.shoot(this.id);
  }

  /** 技能·穿颅射击（自动，14s CD）：4 秒窗口内锁定「离防线最近」目标连续 6 狙，每发 200% 攻击；无目标等待不取消 */
  protected castSkill(_mgr: MonsterManager, _projs: ProjectileManager, _dmg: DamageService): void {
    void _mgr; void _projs; void _dmg;
    this.skillCd = this.skillCdTotal;   // 冷却缩减卡
    const sc = sniperSkCfg(this.stats.skillLv);
    this.volley = { t: 0, left: Math.max(1, Math.round(this.stats.skillShots || 6)), ttl: sc.window };   // 发数全折在 stats.skillShots（技能10级+2 与多目标锁定卡共用，面板同源）
    // 演出：英雄身上红色环脉冲扩散（与瞬击弹道线同主题）
    const pulse = new Node('snipePulse');
    pulse.layer = Layers.Enum.UI_2D;
    pulse.setParent(this.node.parent!);
    pulse.setPosition(this.x, HERO_Y + 20, 0);
    const pg = pulse.addComponent(Graphics);
    pg.strokeColor = hexc(PAL.red);
    pg.lineWidth = 2.5;
    pg.circle(0, 0, 34);
    pg.stroke();
    const pop = pulse.addComponent(UIOpacity);
    tween(pulse).to(0.22, { scale: new Vec3(1.55, 1.55, 1) }).start();
    tween(pop).to(0.22, { opacity: 0 }).call(() => pulse.destroy()).start();
  }

  /** 大招·猎杀时刻（手动）：锁定全场血量最高目标 1.1s（瞄准线+收缩准星）→ 发射 ×5.5 必暴贯穿弹（无视物抗） */
  castUlt(mgr: MonsterManager, _projs: ProjectileManager, _dmg: DamageService): boolean {
    if (!this.ultReady || this.ultLock) return false;   // 锁定中防重入（自动/手动不叠加）
    const tgt = mgr.highestHp();
    if (!tgt) return false;   // 全场无目标：不消耗充能
    this.charge = 0;
    bus.emit(EVT.CHARGE_CHANGED, 0, false);
    this.beginUltLock(tgt, mgr);
    void _projs; void _dmg;
    return true;
  }

  /** 进入大招锁定演出（手动充能释放与 90 级突破自动释放共用） */
  private beginUltLock(tgt: Monster, mgr: MonsterManager): void {
    const lockNode = new Node('ultLock');
    lockNode.layer = Layers.Enum.UI_2D;
    lockNode.setParent(this.node.parent!);
    lockNode.setPosition(0, 0, 0);
    const g = lockNode.addComponent(Graphics);
    this.beginUltimate();
    this.ultLock = { t: ULT_TIMING.sniper.windup, target: tgt, targets: [], node: lockNode, g };
    this.drawUltLock(mgr, 0);
  }
}

/* ============================================================
 * 火焰法师 · 焰·辉（§4 #2：技能流·AOE/橙红；线稿 hero_bohu_battle 100×120）
 * ============================================================ */
/* 大招陨石调参：真实爆炸半径、坑半径与寿命、坑内易伤强度 */
const METEOR_BLAST_R = 140;
const METEOR_SPEED = 800;
const CRATER_R = 88 * 1.3 * 1.2;
const CRATER_VULN = 0.25;
export class PyroHero extends HeroBase {
  readonly id = 'pyro';
  readonly name = '焰·辉';
  readonly chargeMax = PYRO_CHARGE_MAX;
  readonly skillMax = 10;
  /** Fixed ground points; the projectile's actual arrival removes the warning and creates the crater. */
  private meteorQueue: { t: number; x: number; y: number; fired?: boolean; first?: boolean; last?: boolean;
    fallElapsed?: number; fallSeconds?: number }[] = [];
  /** Fixed landing shadows grow darker as the real meteor approaches; no target rings. */
  private warnT = 0;
  private warnNode: Node | null = null;
  private warnG: Graphics | null = null;
  private warnTint = hexc('#201A17');
  /** 陨石坑：命中后持续灼烧与易伤，基础4秒，余火绵延每层再延长1秒。 */
  private craters: { x: number; y: number; t: number }[] = [];
  private craterNode: Node | null = null;
  private craterG: Graphics | null = null;

  protected buildVisual(parent: Node): void {
    const g = this.node.addComponent(Graphics);
    // 背影火焰法师：橙红法袍 + 辉焰法杖（线稿 hero_bohu_battle 100×120）
    const ink = hexc(PAL.ink);
    g.strokeColor = ink;
    g.lineWidth = 3;
    // 法袍下摆（上窄下宽，火光渐变靠两段色块）
    g.fillColor = hexc('#B44A20');
    g.moveTo(-20, 34); g.lineTo(20, 34); g.lineTo(30, -76); g.lineTo(-30, -76);
    g.close(); g.fill(); g.stroke();
    // 躯干（法袍上身）
    g.fillColor = hexc('#D4662A');
    g.roundRect(-22, -34, 44, 66, 14);
    g.fill(); g.stroke();
    // 金色腰带 + 搭扣
    g.fillColor = hexc(PAL.gold2);
    g.roundRect(-22, -22, 44, 7, 3);
    g.fill();
    g.fillColor = hexc(PAL.gold);
    g.circle(0, -18, 4);
    g.fill();
    // 肩披
    g.fillColor = hexc('#E8813A');
    g.circle(-22, 24, 9); g.fill(); g.stroke();
    g.circle(22, 24, 9); g.fill(); g.stroke();
    // 头 + 兜帽（尖顶法师帽）
    g.fillColor = hexc('#E8C39A');
    g.circle(0, 26, 14); g.fill(); g.stroke();
    g.fillColor = hexc('#B44A20');
    g.moveTo(-17, 30); g.lineTo(17, 30); g.lineTo(4, 52); g.lineTo(-4, 52);
    g.close(); g.fill(); g.stroke();
    g.fillColor = hexc(PAL.gold);
    g.circle(0, 52, 3.5); g.fill();
    // 法杖（右侧斜持，顶端火焰宝珠）
    g.strokeColor = hexc('#7A4B22');
    g.lineWidth = 5;
    g.moveTo(26, -70); g.lineTo(36, 18);
    g.stroke();
    g.fillColor = hexc(PAL.orange);
    g.circle(38, 26, 9); g.fill(); g.stroke();
    g.fillColor = hexc(PAL.gold);
    g.circle(38, 26, 4.5); g.fill();
    // 靴（下沿没入工事）
    g.fillColor = hexc('#2A2118');
    g.roundRect(-19, -78, 15, 16, 4); g.fill(); g.stroke();
    g.roundRect(4, -78, 15, 16, 4); g.fill(); g.stroke();
    this.node.setPosition(this.x, HERO_Y, 0);
    this.node.setParent(parent);
    this.attachBattleArt('pyro');
  }

  /** 火球弹种统一构造：橙红大弹 + 溅射 + 灼烧（灼烧走余烬倍率） */
  private spec(base: {
    x: number; y: number; dirX: number; dirY: number; dmg: number;
    explodeR: number; burnDps: number; speed: number; size: number;
    ability?: boolean; ult?: boolean; stun?: number; explodeMul?: number;
  }): ProjSpec {
    const crit = Math.random() < this.stats.critRate;
    return {
      x: base.x, y: base.y, dirX: base.dirX, dirY: base.dirY,
      speed: base.speed,
      dmg: base.dmg * (base.ability || base.ult ? 1 : this.stats.normalMul || 1) * (crit ? this.stats.critMul : 1), crit,
      color: PAL.orange, heroId: this.id, size: base.size,
      explodeR: base.explodeR, explodeMul: base.explodeMul ?? this.stats.explodeMul,
      slowRatio: this.stats.slowOnHit || 0,
      slowDur: this.stats.slowDur || 2,
      burnDps: base.burnDps * pyroBurnMultiplier(this.stats),
      burnDur: pyroBurnDuration(this.stats),
      burnBurst: this.effAtk * (this.stats.pyroBurnBurst || 0),
      burnSplash: !!(base.ability || base.ult || this.stats.pyroSplashBurn),
      spark: true, ability: base.ability, ult: base.ult, stun: base.stun,
      burnedBonus: this.stats.burnedBonus || undefined,
      ...this.targetBonuses(),
    };
  }

  /** 普攻火球：基础半径60、40%溅射；爆裂范围和烈焰附着同时覆盖溅射目标。 */
  protected shoot(target: Monster, _mgr: MonsterManager, projs: ProjectileManager): void {
    void _mgr;
    const bs = 700;
    const lead = this.lead(target, bs);
    this.animateAttack(false, lead.dirX, lead.dirY);
    projs.fire(this.spec({
      x: this.x, y: HERO_Y + 60, dirX: lead.dirX, dirY: lead.dirY,
      dmg: this.effAtk, explodeR: pyroBlastRadius(this.stats, Math.max(60, this.stats.explodeR)),
      burnDps: this.stats.burnOnHit ? this.effAtk * this.stats.burnOnHit : 0,
      speed: bs, size: 9,
    }));
    projs.normalRelease(this.id, this.x, HERO_Y + 60, lead.dirX, lead.dirY);
    Sfx.shoot(this.id);
  }

  /** 技能·烈焰爆裂（自动，10s CD）：锁定技能范围内最密集簇，齐射 3 颗爆裂火球（1.6×攻击、大爆炸 + 灼烧 3s） */
  protected castSkill(mgr: MonsterManager, projs: ProjectileManager, _dmg: DamageService): void {
    void _dmg;
    this.skillCd = this.skillCdTotal;   // 冷却缩减卡
    const R = this.stats.skillRange;
    const cands = mgr.list.filter(m => !m.dead && Math.hypot(m.x - this.x, m.y - HERO_Y) <= R);
    if (!cands.length) return;
    // 密集簇：邻域 130 内同伴最多者为中心
    let best = cands[0], bestN = -1;
    for (const m of cands) {
      let n = 0;
      for (const o of cands) if (Math.hypot(o.x - m.x, o.y - m.y) <= 130) n++;
      if (n > bestN) { bestN = n; best = m; }
    }
    const pc = pyroSkCfg(this.stats.skillLv);
    const shots = Math.max(1, Math.round(this.stats.skillShots || 3));
    const dmg = this.abilityDamage(pc.mul);
    const boomR = pyroBlastRadius(this.stats, 110 * (this.stats.skillRangeMul || 1));
    this.animateAttack(true, best.x - this.x, best.y - (HERO_Y + 60));
    for (let k = 0; k < shots; k++) {
      const ox = best.x + (Math.random() * 2 - 1) * 70;
      const oy = best.y + (Math.random() * 2 - 1) * 70;
      const dx = ox - this.x, dy = oy - (HERO_Y + 60);
      const l = Math.hypot(dx, dy) || 1;
      projs.fire(this.spec({
        x: this.x, y: HERO_Y + 60, dirX: dx / l, dirY: dy / l,
        dmg, explodeR: boomR, explodeMul: pc.boomMul, burnDps: this.abilityDamage(0.2, false, 0.04),
        speed: 820, size: 11, ability: true,
      }));
    }
    Sfx.cast(this.id);
  }

  private drawMeteorWarnings(): void {
    if (this.meteorQueue.length) {
      if (!this.warnNode) {
        this.warnNode = new Node('ultWarn');
        this.warnNode.layer = Layers.Enum.UI_2D;
        this.warnNode.setParent(this.node.parent!.parent?.getChildByName('GroundFxLayer') || this.node.parent!);
        this.warnNode.setPosition(0, 0, 0);
        this.warnG = this.warnNode.addComponent(Graphics);
      }
      const g = this.warnG!;
      g.clear();
      for (const q of this.meteorQueue) {
        if (!q.fired && q.t > .35) continue;
        const approach = q.fired ? Math.min(1, (q.fallElapsed || 0) / Math.max(.01, q.fallSeconds || 1)) : 0;
        const p = approach * approach * (3 - 2 * approach);
        const radius = pyroBlastRadius(this.stats, METEOR_BLAST_R) * (.35 + .43 * p);
        // Concentric low-alpha ellipses form a soft, grounded shadow, not an outlined AOE indicator.
        for (let band = 6; band >= 0; band--) {
          const r = radius * (.49 + band * .085);
          this.warnTint.a = Math.round((5 + (6 - band) * 1.7) * (.45 + p * .75));
          g.fillColor = this.warnTint;
          g.ellipse(q.x, q.y, r, r * .62); g.fill();
        }
      }
    } else if (this.warnNode) {
      this.warnNode.active = false;
      this.warnNode.destroy();
      this.warnNode = null; this.warnG = null;
    }
  }

  protected updateQueues(dt: number, mgr: MonsterManager, projs: ProjectileManager): void {
    this.warnT += dt;
    const uc = pyroUltCfg(this.stats.ultLv);
    const crR = CRATER_R * uc.craterMul;
    for (let i = this.meteorQueue.length - 1; i >= 0; i--) {
      const q = this.meteorQueue[i];
      if (q.fired) { q.fallElapsed = (q.fallElapsed || 0) + dt; continue; }
      q.t -= dt;
      if (q.t <= 0 && projs.hasCapacity) {
        // 出生点必须在弹道顶界（LO.half+120）之下，否则首帧即被越界回收（上次"只有预警没有陨石"的根因）
        const top = SPAWN_Y + 50;
        const spec = this.spec({
          x: q.x, y: top, dirX: 0, dirY: -1,
          dmg: pyroMeteorDamage(this.stats),
          explodeR: pyroBlastRadius(this.stats, METEOR_BLAST_R), burnDps: this.abilityDamage(0.3, true, 0.06),
          speed: METEOR_SPEED, size: 16, ability: true, ult: true,
          stun: this.stats.ultStun || 0,
        });
        spec.groundTarget = { x: q.x, y: q.y };
        spec.onGroundImpact = () => {
          if (!this.node.isValid) return;
          const index = this.meteorQueue.indexOf(q);
          if (index < 0) return;
          this.meteorQueue.splice(index, 1);
          this.ultimateBeat(q.x, q.y, q.last ? 1 : q.first ? .85 : .35, true);
          this.craters.push({ x: q.x, y: q.y, t: pyroCraterDuration(this.stats) });
          this.drawMeteorWarnings();
          projs.fireCraters(this.craters, CRATER_R * pyroUltCfg(this.stats.ultLv).craterMul, this.warnT);
        };
        // If the projectile budget is full, keep the real warning and retry, never create a phantom crater.
        q.fired = projs.fire(spec);
        if (q.fired) {
          q.fallElapsed = 0; q.fallSeconds = Math.max(.01, (top - q.y) / METEOR_SPEED);
          this.animateAttack(true, q.x - this.x, q.y - HERO_Y - 60);
        }
      }
    }
    this.drawMeteorWarnings();
    // 陨石坑：坑内怪持续挂灼烧 + 易伤（出坑残留 0.6s），寿命尽即熄灭
    if (this.craters.length) {
      for (let i = this.craters.length - 1; i >= 0; i--) {
        const c = this.craters[i];
        c.t -= dt;
        if (c.t <= 0) { this.craters.splice(i, 1); continue; }
        for (const m of mgr.list) {
          if (m.dead || Math.hypot(m.x - c.x, m.y - c.y) > crR) continue;
          m.applyBurn(this.abilityDamage(0.3, true, 0.06) * pyroBurnMultiplier(this.stats),
            pyroBurnDuration(this.stats, .55), this.effAtk * (this.stats.pyroBurnBurst || 0));
          m.applyVuln(this.stats.pitVuln || CRATER_VULN, 0.6);
        }
      }
      if (!projs.fireCraters(this.craters, crR, this.warnT)) {
      if (!this.craterNode) {
        this.craterNode = new Node('ultCrater');
        this.craterNode.layer = Layers.Enum.UI_2D;
        this.craterNode.setParent(this.node.parent!);
        // 焦土贴地：插到怪层之下（背景 artClip 之上），硬编码序号会被背景图盖住
        const kids = this.node.parent!.children;
        const mobIdx = kids.findIndex(c => c.name === 'MobLayer');
        this.craterNode.setSiblingIndex(mobIdx === -1 ? 0 : mobIdx);
        this.craterNode.setPosition(0, 0, 0);
        this.craterG = this.craterNode.addComponent(Graphics);
      }
      const g = this.craterG!;
      const oc = (h: string, a: number): Color => { const c = hexc(h); c.a = a; return c; };
      g.clear();
      for (let i = 0; i < this.craters.length; i++) {
        const c = this.craters[i];
        const fade = Math.min(1, c.t / 0.8);   // 末 0.8s 渐灭
        const glow = 0.55 + Math.sin(this.warnT * 5 + i * 2.1) * 0.2;
        // 焦黑坑底（两层）
        g.fillColor = oc('#1C120C', 150 * fade);
        g.circle(c.x, c.y, crR); g.fill();
        g.fillColor = oc('#33200F', 110 * fade);
        g.circle(c.x, c.y, crR * 0.8); g.fill();
        // 熔岩池 + 白热岩芯（呼吸脉动）
        const pulse = 1 + Math.sin(this.warnT * 6 + i) * 0.06;
        g.fillColor = oc('#C2401F', (150 + 40 * glow) * fade);
        g.circle(c.x, c.y, crR * 0.42 * pulse); g.fill();
        g.fillColor = oc('#FF7A2E', (170 + 50 * glow) * fade);
        g.circle(c.x, c.y, crR * 0.22 * pulse); g.fill();
        g.fillColor = oc('#FFD24A', (120 + 70 * glow) * fade);
        g.circle(c.x, c.y, crR * 0.1 * pulse); g.fill();
        // 熔岩缘（外圈粗 + 内圈亮）
        g.strokeColor = oc('#E86A28', 215 * fade); g.lineWidth = 4.5;
        g.circle(c.x, c.y, crR * pulse); g.stroke();
        g.strokeColor = oc('#FFC24A', 160 * fade); g.lineWidth = 2;
        g.circle(c.x, c.y, crR * 0.86 * pulse); g.stroke();
        // 坑内岩浆斑 + 余烬闪点
        for (let k = 0; k < 3; k++) {
          const ang = i * 2.4 + k * 2.1;
          const rr = crR * 0.5;
          g.fillColor = oc('#D9481F', (200 * glow + 40) * fade);
          g.circle(c.x + Math.cos(ang) * rr, c.y + Math.sin(ang) * rr * 0.7, 12 + (k % 2) * 5);
          g.fill();
          const ea = ang + 1.1;
          g.fillColor = oc('#FFE08A', (140 + 90 * Math.sin(this.warnT * 11 + k * 2 + i)) * fade);
          g.circle(c.x + Math.cos(ea) * rr * 0.8, c.y + Math.sin(ea) * rr * 0.6, 2.2);
          g.fill();
        }
      }
      } else this.craterG?.clear();
    } else {
      projs.fireCraters(this.craters, crR, this.warnT);
      if (this.craterNode) {
        this.craterNode.destroy();
        this.craterNode = null; this.craterG = null;
      }
    }
  }

  /** 大招演出时长：从施放到最后一颗陨石落地（排队间隔 + 弹道飞行）；三选一再等 2s 缓冲由导演统一加 */
  get ultimateRemaining(): number { return Math.max(this.ultimateT, this.meteorQueue.length ? .01 : 0); }
  get ultShowDuration(): number {
    const meteors = pyroMeteorCount(this.stats);
    if (!this.meteorQueue.length) return Math.max(ULT_TIMING.pyro.duration,
      ULT_TIMING.pyro.windup + (meteors - 1) * METEOR_ULT_GAP + (SPAWN_Y + 50 - LINE_Y) / METEOR_SPEED + .8);
    return Math.max(ULT_TIMING.pyro.duration, this.meteorQueue.reduce((last, q) => Math.max(last,
      (q.fired ? 0 : Math.max(0, q.t)) + (SPAWN_Y + 50 - q.y) / METEOR_SPEED), 0) + .8);
  }

  /** 大招·陨石天降：优先覆盖不同怪群，预告后固定落点，不在空中追踪或提前碰撞；
   *  每颗命中留燃烧陨石坑（持续灼烧 + 易伤25%），陨石增援增加真实落点与演出时长。 */
  castUlt(mgr: MonsterManager, _projs: ProjectileManager, _dmg: DamageService): boolean {
    if (!this.ultReady) return false;
    const alive = mgr.list.filter(m => !m.dead);
    if (!alive.length) return false;   // 全场无目标：不消耗充能
    const uc = pyroUltCfg(this.stats.ultLv);
    const drops = this.planMeteorDrops(alive, pyroMeteorCount(this.stats), CRATER_R * uc.craterMul);
    this.charge = 0;
    bus.emit(EVT.CHARGE_CHANGED, 0, false);
    drops.forEach((q, i) => this.meteorQueue.push({ ...q, first: i === 0, last: i === drops.length - 1 }));
    this.beginUltimate();
    this.drawMeteorWarnings();
    void _projs; void _dmg;
    return true;
  }

  private projectedMeteorY(m: Monster, seconds: number): number {
    if (m.state !== 'move') return m.y;
    const hold = Math.max(m.freezeT, m.stunT), moving = Math.max(0, seconds - hold);
    const slowed = Math.min(moving, Math.max(0, m.slowT - hold));
    const distance = m.def.speed * (moving - slowed * m.slowAmp);
    const stop = LINE_Y + (m.def.kind === 'ranged' ? m.def.atkRange || 0 : m.def.radius * .5);
    return Math.max(stop, m.y - distance);
  }

  /** Greedy new coverage, then spacing; repeat a lone boss only when there is no new group to cover. */
  private planMeteorDrops(alive: readonly Monster[], count: number, craterRadius: number): { t: number; x: number; y: number }[] {
    const drops: { t: number; x: number; y: number }[] = [], covered = new Uint8Array(alive.length);
    const blastRadius = pyroBlastRadius(this.stats, METEOR_BLAST_R);
    const top = SPAWN_Y + 50, r2 = blastRadius ** 2;
    const spacing = Math.max(craterRadius * 1.6, blastRadius * 1.05);
    type Choice = { x: number; y: number; score: number; fresh: number };
    for (let k = 0; k < count; k++) {
      const delay = ULT_TIMING.pyro.windup + k * METEOR_ULT_GAP;
      const predicted = alive.map(m => {
        let y = m.y;
        // Account for both the stagger and the different fall distance to each target.
        for (let n = 0; n < 3; n++) y = this.projectedMeteorY(m, delay + (top - y) / METEOR_SPEED);
        return { x: m.x, y };
      });
      const choices: { strict: Choice | null; strictFresh: Choice | null; soft: Choice | null }
        = { strict: null, strictFresh: null, soft: null };
      const consider = (rawX: number, rawY: number): void => {
        const x = Math.max(-330, Math.min(330, rawX));
        const y = Math.max(LINE_Y + 12, Math.min(LO.half - 24, rawY));
        let fresh = 0, value = 0, nearest = Infinity;
        for (let j = 0; j < predicted.length; j++) {
          const d2 = (predicted[j].x - x) ** 2 + (predicted[j].y - y) ** 2;
          if (d2 > r2) continue;
          if (!covered[j]) fresh++;
          value += (.65 + .35 * (1 - d2 / r2)) / (1 + covered[j] * 2.5);
        }
        if (!value) return;
        const reserve = (point: { x: number; y: number }): void => {
          nearest = Math.min(nearest, Math.hypot(point.x - x, point.y - y));
        };
        drops.forEach(reserve); this.meteorQueue.forEach(reserve);
        const arrival = delay + (top - y) / METEOR_SPEED;
        for (const pit of this.craters) if (pit.t > arrival) reserve(pit);
        const separation = Math.min(1, nearest / spacing);
        const score = fresh * 100 + value;
        if (nearest >= spacing) {
          if (!choices.strict || score > choices.strict.score) choices.strict = { x, y, score, fresh };
          if (fresh && (!choices.strictFresh || score > choices.strictFresh.score)) choices.strictFresh = { x, y, score, fresh };
        }
        const softScore = fresh * 100 + value * (.1 + .9 * separation * separation) + separation * .1;
        if (!choices.soft || softScore > choices.soft.score) choices.soft = { x, y, score: softScore, fresh };
      };
      for (const point of predicted) {
        consider(point.x, point.y);
        for (let j = 0; j < 8; j++) {
          const angle = j * Math.PI / 4 + k * .31, offset = blastRadius * .65;
          consider(point.x + Math.cos(angle) * offset, point.y + Math.sin(angle) * offset);
        }
      }
      const { strictFresh, strict, soft } = choices;
      const chosen: Choice = strictFresh || (soft?.fresh ? soft : strict || soft)
        || { x: predicted[0].x, y: Math.max(LINE_Y + 12, predicted[0].y), score: 0, fresh: 0 };
      drops.push({ t: delay, x: chosen.x, y: chosen.y });
      for (let j = 0; j < predicted.length; j++) {
        if ((predicted[j].x - chosen.x) ** 2 + (predicted[j].y - chosen.y) ** 2 <= r2) covered[j]++;
      }
    }
    return drops;
  }
}

/* ============================================================
 * 雷电法师 · 沃尔·雷霆（§4 #3：技能流·连锁/紫；线稿 hero_bolt_battle 100×120）
 * ============================================================ */
export class VoltHero extends HeroBase {
  readonly id = 'volt';
  readonly name = '沃尔·雷霆';
  readonly chargeMax = VOLT_CHARGE_MAX;
  readonly skillMax = 9;
  /** 大招·天雷灭世：排队落下的雷击（目标引用，落雷时已亡则转随机存活目标） */
  private strikeQueue: { t: number; target: Monster | null; index: number }[] = [];
  get ultimateRemaining(): number { return Math.max(this.ultimateT, this.strikeQueue.length ? .01 : 0); }
  get ultShowDuration(): number {
    // Cocos loose super-getter lowering reads HeroBase.prototype, losing the instance id.
    return ULT_TIMING.volt.duration + Math.max(0, Math.ceil((voltStrikeCount(this.stats) - 15) / 5)) * 1.2;
  }

  protected buildVisual(parent: Node): void {
    const g = this.node.addComponent(Graphics);
    // 背影雷电法师：紫袍 + 电弧法杖（线稿 hero_bolt_battle 100×120）
    const ink = hexc(PAL.ink);
    g.strokeColor = ink;
    g.lineWidth = 3;
    // 法袍下摆
    g.fillColor = hexc('#5B3A8C');
    g.moveTo(-20, 34); g.lineTo(20, 34); g.lineTo(30, -76); g.lineTo(-30, -76);
    g.close(); g.fill(); g.stroke();
    // 躯干（法袍上身）
    g.fillColor = hexc('#6F4AA8');
    g.roundRect(-22, -34, 44, 66, 14);
    g.fill(); g.stroke();
    // 金色腰带 + 搭扣
    g.fillColor = hexc(PAL.gold2);
    g.roundRect(-22, -22, 44, 7, 3);
    g.fill();
    g.fillColor = hexc(PAL.gold);
    g.circle(0, -18, 4);
    g.fill();
    // 肩披
    g.fillColor = hexc('#8460C4');
    g.circle(-22, 24, 9); g.fill(); g.stroke();
    g.circle(22, 24, 9); g.fill(); g.stroke();
    // 头 + 兜帽（尖顶法师帽）
    g.fillColor = hexc('#E8C39A');
    g.circle(0, 26, 14); g.fill(); g.stroke();
    g.fillColor = hexc('#5B3A8C');
    g.moveTo(-17, 30); g.lineTo(17, 30); g.lineTo(4, 52); g.lineTo(-4, 52);
    g.close(); g.fill(); g.stroke();
    g.fillColor = hexc(PAL.gold);
    g.circle(0, 52, 3.5); g.fill();
    // 法杖（右侧斜持，顶端电光宝珠）
    g.strokeColor = hexc('#7A4B22');
    g.lineWidth = 5;
    g.moveTo(26, -70); g.lineTo(36, 18);
    g.stroke();
    g.fillColor = hexc('#B96BFF');
    g.circle(38, 26, 9); g.fill(); g.stroke();
    g.fillColor = hexc('#FFFFFF');
    g.circle(38, 26, 4); g.fill();
    // 靴（下沿没入工事）
    g.fillColor = hexc('#2A2118');
    g.roundRect(-19, -78, 15, 16, 4); g.fill(); g.stroke();
    g.roundRect(4, -78, 15, 16, 4); g.fill(); g.stroke();
    this.node.setPosition(this.x, HERO_Y, 0);
    this.node.setParent(parent);
    this.attachBattleArt('volt');
  }

  /** 闪电弹种统一构造：紫色细弹 + 感电词条 */
  private spec(base: {
    x: number; y: number; dirX: number; dirY: number; dmg: number;
    speed: number; size: number; ability?: boolean; ult?: boolean; stun?: number;
  }): ProjSpec {
    const crit = Math.random() < this.stats.critRate;
    return {
      x: base.x, y: base.y, dirX: base.dirX, dirY: base.dirY,
      speed: base.speed,
      dmg: base.dmg * (this.stats.normalMul || 1) * (crit ? this.stats.critMul : 1), crit,
      color: '#B96BFF', heroId: this.id, size: base.size,
      slowRatio: this.stats.slowOnHit || 0,
      slowDur: this.stats.slowDur || 2,
      burnDps: this.stats.burnOnHit ? this.effAtk * this.stats.burnOnHit : 0,
      spark: true, ability: base.ability, ult: base.ult, stun: base.stun,
      shockAmp: voltShockAmp(this.stats), shockDur: voltShockDuration(this.stats),
      shockedBonus: voltShockedMultiplier(this.stats, true) - 1 || undefined,
      ...this.targetBonuses(),
    };
  }

  /** 普攻·闪电弹：快速单体 */
  protected shoot(target: Monster, mgr: MonsterManager, projs: ProjectileManager): void {
    const bs = 900;
    const lead = this.lead(target, bs);
    this.animateAttack(false, lead.dirX, lead.dirY);
    projs.fire(this.spec({
      x: this.x, y: HERO_Y + 60, dirX: lead.dirX, dirY: lead.dirY,
      dmg: this.effAtk, speed: bs, size: 6,
    }));
    projs.normalRelease(this.id, this.x, HERO_Y + 60, lead.dirX, lead.dirY);
    Sfx.shoot(this.id);
    // 70级突破：普攻 15% 概率顺带释放连锁闪电（不占用也不刷新技能冷却）
    if (this.skillUnlocked && this.stats.skillProc && Math.random() < this.stats.skillProc) this.castChain(mgr, projs, this.lastDmg || undefined);
  }

  /** 技能·连锁闪电：即时结算各跳；演出共用池化雷电层与战斗时钟。 */
  protected castSkill(mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): void {
    this.skillCd = this.skillCdTotal;   // 冷却缩减卡
    this.castChain(mgr, projs, dmg);
  }

  /** 连锁闪电本体（普攻概率施法复用）：从技能范围最近目标起跳，最多 skillShots 目标间跳跃 */
  private castChain(mgr: MonsterManager, projs: ProjectileManager, dmg?: DamageService): void {
    const R = this.stats.skillRange;
    const alive = mgr.list.filter(m => !m.dead && Math.hypot(m.x - this.x, m.y - HERO_Y) <= R);
    if (!alive.length) return;
    alive.sort((a, b) => Math.hypot(a.x - this.x, a.y - HERO_Y) - Math.hypot(b.x - this.x, b.y - HERO_Y));
    const jumps = Math.max(1, Math.round(this.stats.skillShots || 5));
    const hop = 260 * (this.stats.skillRangeMul || 1);
    const sc = voltSkCfg(this.stats.skillLv);
    const hitDmg = this.abilityDamage(sc.mul);
    const struck = new Set<Monster>();
    let fromX = this.x, fromY = HERO_Y + 60;
    let cur = alive[0];
    this.animateAttack(true, cur.x - this.x, cur.y - (HERO_Y + 60));
    projs.voltCast(this.x, HERO_Y + 60);
    Sfx.cast(this.id);
    for (let k = 0; k < jumps && cur; k++) {
      struck.add(cur);
      // 直接结算伤害（连锁无弹道，即时跳）
      const crit = Math.random() < this.stats.critRate;
      const dmgK = hitDmg * (1 + sc.chainInc * k) * (crit ? this.stats.critMul : 1)
        * (cur.shockT > 0 ? voltShockedMultiplier(this.stats) : 1);
      cur.takeDamage(dmgK, crit, this.id);
      if (dmg) dmg.add(this.id, cur.lastDamageTaken);
      const sa = voltShockAmp(this.stats);
      if (sa && !cur.dead) cur.applyShock(sa, voltShockDuration(this.stats));
      projs.voltChain(fromX, fromY, cur.x, cur.y, k);
      fromX = cur.x; fromY = cur.y;
      // 下一跳：距当前最近且未被打过的（无则终止）
      let next: Monster | null = null, nd = Infinity;
      for (const o of mgr.list) {
        if (o.dead || struck.has(o)) continue;
        const d = Math.hypot(o.x - fromX, o.y - fromY);
        if (d < nd && d <= hop) { nd = d; next = o; }
      }
      cur = next;
    }
  }

  protected updateQueues(dt: number, mgr: MonsterManager, projs: ProjectileManager): void {
    // 大招落雷：到点对目标位置直击（AOE 90 + 眩晕）；目标已亡则转随机存活目标
    for (let i = this.strikeQueue.length - 1; i >= 0; i--) {
      const q = this.strikeQueue[i];
      q.t -= dt;
      if (q.t <= 0) {
        this.strikeQueue.splice(i, 1);
        let t = q.target && !q.target.dead ? q.target : null;
        if (!t) {
          const alive = mgr.list.filter(m => !m.dead);
          if (!alive.length) continue;
          t = alive[(Math.random() * alive.length) | 0];
        }
        this.animateAttack(true, t.x - this.x, t.y - (HERO_Y + 60));
        const count = voltStrikeCount(this.stats);
        this.thunderStrike(t, mgr, projs, q.index >= count - 5 ? 1.16 : 1);
        this.ultimateBeat(t.x, t.depthY, q.index === count - 1 ? 1 : q.index === 0 ? .85 : .3, true);
      }
    }
  }

  protected queuedShotDelay(): number {
    return Math.min(Infinity, ...this.strikeQueue.map(strike => strike.t));
  }

  /** 单道天雷：从屏外竖劈到目标点，90 半径 AOE + 眩晕（无视物抗的雷击走普通结算） */
  private thunderStrike(t: Monster, mgr: MonsterManager, projs: ProjectileManager, power = 1): void {
    const uc = voltUltCfg(this.stats.ultLv);
    const dmgVal = this.abilityDamage(uc.boltMul, true);
    projs.voltThunder(t.x, t.y, SPAWN_Y + 140, t.depthY, 90 * uc.rMul, power);
    Sfx.ultimateImpact(this.id);
    bus.emit(EVT.HIT_STOP);
    for (const o of mgr.mobsInRadius(t.x, t.y, 90 * uc.rMul)) {   // 5级：落雷范围+20%
      if (o.dead) continue;
      const amount = dmgVal * (o.shockT > 0 ? voltShockedMultiplier(this.stats) : 1);
      o.takeDamage(amount, false, this.id, false, 0, -Math.PI / 2, true);
      if (this.lastDmg) this.lastDmg.add(this.id, o.lastDamageTaken);
      if (!o.dead) {
        if (this.stats.ultStun) o.stunT = Math.max(o.stunT, this.stats.ultStun);
        const sa2 = voltShockAmp(this.stats, true); // 大招10级与卡牌感电取高
        if (sa2) o.applyShock(sa2, voltShockDuration(this.stats));
      }
    }
    void t;
  }

  /** 大招·天雷灭世：基础15道，雷暴增援最多25道；每道真实范围伤害+当前眩晕时长。 */
  castUlt(mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): boolean {
    if (!this.ultReady) return false;
    const alive = mgr.list.filter(m => !m.dead);
    if (!alive.length) return false;   // 全场无目标：不消耗充能
    this.charge = 0;
    this.beginUltimate();
    bus.emit(EVT.CHARGE_CHANGED, 0, false);
    this.lastDmg = dmg;   // 天雷直伤计入伤害统计（施放时刷新引用）
    const count = voltStrikeCount(this.stats);
    for (let k = 0; k < count; k++) {
      const t = alive[k % alive.length];
      this.strikeQueue.push({ t: voltStrikeTime(k), target: t, index: k });
    }
    void projs;
    return true;
  }
}

/* ============================================================
 * 冰霜法师 · 莫拉·寒霜（冰蓝法袍；线稿 hero_frost_battle 100×120）
 * ============================================================ */
export class FrostHero extends HeroBase {
  readonly id = 'mora';
  readonly name = '莫拉·寒霜';
  readonly chargeMax = MORA_CHARGE_MAX;
  readonly skillMax = 10;
  private ultimateBurstT = -1;
  private ultimateHitsLeft = 0;

  protected buildVisual(parent: Node): void {
    const g = this.node.addComponent(Graphics);
    // 背影冰霜法师：冰蓝法袍 + 霜晶法杖（线稿 hero_frost_battle 100×120）
    const ink = hexc(PAL.ink);
    g.strokeColor = ink;
    g.lineWidth = 3;
    // 法袍下摆
    g.fillColor = hexc('#3E6E9E');
    g.moveTo(-20, 34); g.lineTo(20, 34); g.lineTo(30, -76); g.lineTo(-30, -76);
    g.close(); g.fill(); g.stroke();
    // 躯干（法袍上身）
    g.fillColor = hexc('#4E86B8');
    g.roundRect(-22, -34, 44, 66, 14);
    g.fill(); g.stroke();
    // 银色腰带 + 霜晶搭扣
    g.fillColor = hexc('#9FB6C9');
    g.roundRect(-22, -22, 44, 7, 3);
    g.fill();
    g.fillColor = hexc('#D9F3FF');
    g.circle(0, -18, 4);
    g.fill();
    // 肩披
    g.fillColor = hexc('#6FA3CF');
    g.circle(-22, 24, 9); g.fill(); g.stroke();
    g.circle(22, 24, 9); g.fill(); g.stroke();
    // 头 + 兜帽（尖顶法师帽 + 霜晶顶珠）
    g.fillColor = hexc('#EAD9C8');
    g.circle(0, 26, 14); g.fill(); g.stroke();
    g.fillColor = hexc('#3E6E9E');
    g.moveTo(-17, 30); g.lineTo(17, 30); g.lineTo(4, 52); g.lineTo(-4, 52);
    g.close(); g.fill(); g.stroke();
    g.fillColor = hexc('#D9F3FF');
    g.circle(0, 52, 3.5); g.fill();
    // 法杖（右侧斜持，顶端霜晶宝珠）
    g.strokeColor = hexc('#5A4632');
    g.lineWidth = 5;
    g.moveTo(26, -70); g.lineTo(36, 18);
    g.stroke();
    g.fillColor = hexc('#7FD8FF');
    g.circle(38, 26, 9); g.fill(); g.stroke();
    g.fillColor = hexc('#FFFFFF');
    g.circle(38, 26, 4); g.fill();
    // 靴（下沿没入工事）
    g.fillColor = hexc('#2A2118');
    g.roundRect(-19, -78, 15, 16, 4); g.fill(); g.stroke();
    g.roundRect(4, -78, 15, 16, 4); g.fill(); g.stroke();
    this.node.setPosition(this.x, HERO_Y, 0);
    this.node.setParent(parent);
    this.attachBattleArt('mora');
  }

  /** 冰棱弹种统一构造：冰蓝细弹 + 减速词条 */
  private spec(base: {
    x: number; y: number; dirX: number; dirY: number; dmg: number;
    speed: number; size: number;
  }): ProjSpec {
    const crit = Math.random() < this.stats.critRate;
    return {
      x: base.x, y: base.y, dirX: base.dirX, dirY: base.dirY,
      speed: base.speed,
      dmg: base.dmg * (this.stats.normalMul || 1) * (crit ? this.stats.critMul : 1), crit,
      color: '#7FD8FF', heroId: this.id, size: base.size,
      slowRatio: moraSlowRatio(this.stats, this.stats.slowOnHit || 0),
      slowDur: moraSlowDuration(this.stats, this.stats.slowDur || 2),
      spark: true,
      slowedBonus: this.stats.slowedBonus || undefined,
      coldBonus: this.stats.moraColdBonus || undefined,
      freezeChance: moraFreezeChance(this.stats),
      freezeDuration: moraNormalFreezeDuration(this.stats),
      teamVuln: this.stats.moraTeamVuln || 0,
      ...this.targetBonuses(),
    };
  }

  /** 普攻·冰棱：单体减速，速冻之心/70级突破在实际命中时判定0.6秒冰冻。 */
  protected shoot(target: Monster, _mgr: MonsterManager, projs: ProjectileManager): void {
    void _mgr;
    const bs = 850;
    const lead = this.lead(target, bs);
    this.animateAttack(false, lead.dirX, lead.dirY);
    projs.fire(this.spec({
      x: this.x, y: HERO_Y + 60, dirX: lead.dirX, dirY: lead.dirY,
      dmg: this.effAtk, speed: bs, size: 6,
    }));
    projs.normalRelease(this.id, this.x, HERO_Y + 60, lead.dirX, lead.dirY);
    Sfx.shoot(this.id);
    // 冰冻统一由弹体实际命中时判定；速冻之心无需70级突破即可启用。
  }

  /** 冰霜领域：按实际半径选密集区；冰封延长只加冰封，寒冬延续只加解冻后减速。 */
  private castFrostField(mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): void {
    const mc = moraSkCfg(this.stats.skillLv);
    const NR = moraFieldRadius(this.stats);
    const center = mgr.densestArea(this.x, HERO_Y, this.stats.skillRange, NR);
    if (!center) return;
    this.animateAttack(true, center.x - this.x, center.y - (HERO_Y + 60));
    const hitDmg = this.abilityDamage(mc.mul);
    const freeze = moraFieldFreeze(this.stats);
    // Snapshot the cast position: killing the central target cannot move the remaining field.
    projs.frostDomain(center.x, center.y, NR, freeze);
    for (const m of mgr.mobsInRadius(center.x, center.y, NR)) {
      if (m.dead) continue;
      const crit = Math.random() < this.stats.critRate;
      const amount = hitDmg * (m.slowT > 0 || m.freezeT > 0 ? moraColdMultiplier(this.stats) : 1)
        * (crit ? this.stats.critMul : 1);
      m.takeDamage(amount, crit, this.id);
      dmg.add(this.id, m.lastDamageTaken);
      // Boss still receives the existing area damage, but has no freeze or post-thaw status.
      m.applyFreeze(freeze, moraSlowRatio(this.stats, .5), moraSlowDuration(this.stats, 2));
      if (this.stats.moraTeamVuln) m.applyVuln(this.stats.moraTeamVuln, 3);
    }
    Sfx.cast(this.id);
  }

  /** 技能·冰霜领域（自动，沿用技能冷却与升级数值） */
  protected castSkill(mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): void {
    this.skillCd = this.skillCdTotal;   // 冷却缩减卡
    this.castFrostField(mgr, projs, dmg);
  }

  /** Three real contacts during one continuous storm; no threefold art/audio restart. */
  protected updateQueues(dt: number, mgr: MonsterManager, projs: ProjectileManager): void {
    if (this.ultimateBurstT < 0) return;
    this.ultimateBurstT -= dt;
    while (this.ultimateBurstT <= 0 && this.ultimateHitsLeft > 0) {
      // Resample living enemies at each contact, including those entering during the storm.
      const alive = mgr.list.filter(m => !m.dead);
      projs.frostUltimateBurst(alive.map(m => ({ x: m.x, y: m.depthY, radius: m.def.radius })));
      if (alive[0]) this.animateAttack(true, alive[0].x - this.x, alive[0].y - HERO_Y - 60);
      const uc = moraUltCfg(this.stats.ultLv), base = moraUltimateHitDamage(this.stats);
      const slow = moraSlowRatio(this.stats, uc.slowMul);
      const slowDuration = moraSlowDuration(this.stats, uc.slowDur + (this.stats.ultSlowDur || 0));
      for (const m of alive) {
        const amount = base * (m.slowT > 0 || m.freezeT > 0 ? moraColdMultiplier(this.stats) : 1);
        m.takeDamage(amount, false, this.id, false, 0, -Math.PI / 2, true);
        this.lastDmg?.add(this.id, m.lastDamageTaken);
        if (m.dead) continue;
        // Repeated freezes refresh instead of adding time. Bosses retain slow without freeze.
        if (this.stats.moraTeamVuln) m.applyVuln(this.stats.moraTeamVuln, 3);
        const frozen = this.stats.moraUltFreeze && m.applyFreeze(this.stats.moraUltFreeze, slow, slowDuration);
        if (!frozen) m.applySlow(slow, slowDuration);
      }
      if (alive.length) { this.ultimateBeat(this.x, HERO_Y + 60, .8); bus.emit(EVT.HIT_STOP); }
      this.ultimateHitsLeft--;
      if (!this.ultimateHitsLeft) { this.ultimateBurstT = -1; break; }
      this.ultimateBurstT += FROST_ULT_HIT_GAP;
    }
  }
  protected queuedShotDelay(): number { return this.ultimateBurstT >= 0 ? this.ultimateBurstT : Infinity; }
  castUlt(mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): boolean {
    if (!this.ultReady) return false;
    const alive = mgr.list.filter(m => !m.dead);
    if (!alive.length) return false;
    this.charge = 0; this.lastDmg = dmg;
    this.beginUltimate();
    this.ultimateHitsLeft = MORA_ULT_HITS;
    this.ultimateBurstT = ULT_TIMING.mora.windup;
    bus.emit(EVT.CHARGE_CHANGED, 0, false);
    projs.frostUltimate(alive.map(m => ({ x: m.x, y: m.depthY, radius: m.def.radius })));
    return true;
  }
}
