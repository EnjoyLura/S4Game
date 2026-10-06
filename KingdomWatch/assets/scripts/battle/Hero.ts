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
import { HeroStats } from '../config/Cards';
import { ARCHER_CHARGE_MAX, SNIPER_CHARGE_MAX, PYRO_CHARGE_MAX, VOLT_CHARGE_MAX, SPAWN_Y, HERO_Y, PAL } from '../config/GameConfig';
import { Monster, MonsterManager } from './Monster';
import { ProjectileManager, ProjSpec } from './Projectile';
import { DamageService } from './DamageService';
import { bus, EVT } from '../core/EventBus';
import { Sfx } from '../core/Sfx';

function hexc(h: string): Color { const c = new Color(); Color.fromHEX(c, h); return c; }

interface PendingShot { t: number; target: Monster | null; dirX: number; dirY: number; emp?: boolean; }
interface PendingVolley { t: number; row: 0 | 1; }

export abstract class HeroBase {
  abstract readonly id: string;
  abstract readonly name: string;
  node = new Node('hero');
  stats: HeroStats;
  charge = 0;
  abstract readonly chargeMax: number;
  skillCd = 0;
  abstract readonly skillMax: number;
  /** 大招呼吸回能计时（每 3s +1，用户确认的少量自然回能） */
  private regenT = 3;
  private atkT = 0;
  private hx: number;

  constructor(parent: Node, x: number, stats: HeroStats) {
    this.hx = x;
    this.stats = stats;
    this.buildVisual(parent);
  }

  protected abstract buildVisual(parent: Node): void;

  get x(): number { return this.hx; }
  get effAtk(): number { return this.stats.atk * this.stats.atkMul; }
  /** 技能/大招伤害基数（用户确认：技能和大招计算攻击力+技能伤害，普攻只算攻击力） */
  get skillAtk(): number { return this.effAtk + (this.stats.skillDmgFlat || 0); }
  get chargeGoal(): number { return this.chargeMax * (this.stats.chargeMul || 1); }
  get chargePct(): number { return this.charge / this.chargeGoal; }
  get ultReady(): boolean { return this.charge >= this.chargeGoal; }
  get skillPct(): number { return 1 - this.skillCd / this.skillCdTotal; }
  /** 技能完整冷却（含冷却缩减卡；与施放时写入 skillCd 的算法一致） */
  get skillCdTotal(): number { return Math.max(2, this.skillMax - (this.stats.skillCdFlat || 0)); }

  /** 伤害统计服务（tick 每帧刷新；直伤型技能/大招用于计入统计） */
  protected lastDmg: DamageService | null = null;
  tick(dt: number, mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): void {
    this.lastDmg = dmg;
    this.updateQueues(dt, mgr, projs);
    // 普攻
    this.atkT -= dt;
    if (this.atkT <= 0) {
      const t = mgr.pickTarget(this.x, HERO_Y, this.stats.range);
      if (t) {
        this.shoot(t, mgr, projs);
        this.atkT = this.attackInterval();
      } else {
        this.atkT = 0;
      }
    }
    // 技能（自动：CD 好 + 技能范围内有怪）
    this.skillCd -= dt;
    if (this.skillCd <= 0 && mgr.anyInRange(this.x, HERO_Y, this.stats.skillRange)) {
      this.castSkill(mgr, projs, dmg);
    }
    // 大招呼吸回能：每 3 秒少量充能（不与击杀充能冲突；满后停止）
    this.regenT -= dt;
    if (this.regenT <= 0) {
      this.regenT += 3;
      if (!this.ultReady) this.chargeKill(1);
    }
  }

  /** 子类队列推进（连射/技能连狙等） */
  protected updateQueues(_dt: number, _mgr: MonsterManager, _projs: ProjectileManager): void { void _dt; void _mgr; void _projs; }

  /** 本次普攻后的攻击间隔（弓箭手强化窗口攻速 +30% 时覆写） */
  protected attackInterval(): number { return 1 / this.stats.aspd; }

  protected abstract shoot(target: Monster, mgr: MonsterManager, projs: ProjectileManager): void;
  protected abstract castSkill(mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): void;
  /** 大招（手动，充能满可放；全场无目标时不消耗充能） */
  abstract castUlt(mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): boolean;

  /** 击杀充能（§3.7：击杀者获得怪物配置充能值） */
  chargeKill(v: number): void {
    if (this.ultReady) return;
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
    const moving = target.state === 'move';
    const v = moving ? target.def.speed * (target.slowT > 0 ? 0.8 : 1) : 0;
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
  /** 技能·强化箭矢：剩余强化普攻次数（>0 时出弓即金色贯穿箭） */
  empowerLeft = 0;
  private readonly empowerMax = 6;
  private lastEmp = false;
  private serialQueue: PendingShot[] = [];
  private volleyQueue: PendingVolley[] = [];

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
    const atk = this.effAtk * (base.dmgMul ?? 1) * (emp ? 1.5 : 1) * (crit ? this.stats.critMul : 1);
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
    Sfx.play('shoot');
    // 连射：后续排延迟成排再射；每排出弓瞬间若目标存活则按当时状态重新预判（出弓后仍直线），目标已亡则沿锁定方向
    for (let i = 1; i <= this.stats.serial; i++) {
      this.serialQueue.push({ t: i * 0.12, target, dirX: lead.dirX, dirY: lead.dirY, emp });
    }
  }

  /** 一排弹幕（列 = 1+齐射层）：以瞄准线为中心扇形并列展开，直线随缘（齐射×连射 = 列×排网格） */
  private fireRow(projs: ProjectileManager, dirX: number, dirY: number, emp: boolean): void {
    const cols = 1 + this.stats.fan;
    const baseAng = Math.atan2(dirY, dirX);
    this.bowFlash(Math.cos(baseAng), Math.sin(baseAng), emp);   // 每排出弓一次弓弦闪光（连射排有节奏感）
    for (let c = 0; c < cols; c++) {
      const ang = baseAng + (c - (cols - 1) / 2) * 10 * Math.PI / 180;
      this.fireDir(projs, Math.cos(ang), Math.sin(ang), emp);
    }
  }

  /** 出手弓弦闪光：箭矢出弓点的一瞬星芒（约 90ms，主芒顺瞄准方向 + 侧芒 + 亮芯），金箭配金光 */
  private bowFlash(dx: number, dy: number, emp: boolean): void {
    const flash = new Node('bowFlash');
    flash.layer = Layers.Enum.UI_2D;
    flash.setParent(this.node.parent!);
    flash.setPosition(this.x, HERO_Y + 60, 0);
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
        this.fireFanRow(projs, v.row);
      }
    }
    void mgr;
  }

  /** 技能·强化箭矢（自动，12s CD）：接下来 6 次普攻变为金色贯穿箭（伤害 ×1.5、无限穿透、弹速 540） */
  protected castSkill(_mgr: MonsterManager, _projs: ProjectileManager, _dmg: DamageService): void {
    void _mgr; void _projs; void _dmg;
    this.skillCd = this.skillMax;
    this.empowerLeft = this.empowerMax;
    // 演出：英雄身上金色环脉冲扩散，标记"箭矢已强化"
    const pulse = new Node('empPulse');
    pulse.layer = Layers.Enum.UI_2D;
    pulse.setParent(this.node.parent!);
    pulse.setPosition(this.x, HERO_Y + 20, 0);
    const pg = pulse.addComponent(Graphics);
    pg.strokeColor = hexc(PAL.gold);
    pg.lineWidth = 5;
    pg.circle(0, 0, 34);
    pg.stroke();
    const pop = pulse.addComponent(UIOpacity);
    tween(pulse).to(0.38, { scale: new Vec3(2.1, 2.1, 1) }).start();
    tween(pop).to(0.38, { opacity: 0 }).call(() => pulse.destroy()).start();
  }

  /** 大招·扇形箭雨（手动，击杀充能）：两排 × 8 箭扇形射出，全部无限贯穿；多轮箭雨卡追加轮次（间隔 0.8s） */
  castUlt(_mgr: MonsterManager, projs: ProjectileManager, _dmg: DamageService): boolean {
    if (!this.ultReady) return false;
    this.charge = 0;
    const rounds = Math.max(1, Math.round(this.stats.ultRounds || 1));
    for (let r = 0; r < rounds; r++) this.volleyQueue.push({ t: r * 0.8, row: 0 }, { t: r * 0.8 + 0.35, row: 1 });
    bus.emit(EVT.CHARGE_CHANGED, 0, false);
    Sfx.play('ult');
    void _dmg;
    return true;
  }

  /** 一排扇形箭：以竖直方向为中心 ±30° 均分；第二排错半步补缝、弹速略慢形成两波 */
  private fireFanRow(projs: ProjectileManager, row: 0 | 1): void {
    const n = 8;
    const spread = 60 * Math.PI / 180;
    const off = row === 0 ? 0 : 0.5;
    const speed = row === 0 ? 560 : 480;
    for (let k = 0; k < n; k++) {
      const a = -spread / 2 + (spread * (k + off)) / n;   // 相对竖直方向的偏角
      projs.fire({
        x: this.x, y: HERO_Y + 60,
        dirX: Math.sin(a), dirY: Math.cos(a),
        speed,
        dmg: this.skillAtk * 0.65, crit: Math.random() < this.stats.critRate,
        color: PAL.gold, heroId: this.id, size: 9, ttl: 3.6, pierce: 999, spark: true,
        ability: true,   // 大招箭雨击杀弹 60% 词条
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
  /** 大招·猎杀时刻：0.5s 锁定演出（瞄准线实时追踪 + 收缩准星）→ 贯穿弹 */
  private ultLock: { t: number; target: Monster; node: Node; g: Graphics } | null = null;

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
  }

  /** 普攻：慢速高伤重弩箭（拦截预判直线，不追踪） */
  protected shoot(target: Monster, _mgr: MonsterManager, projs: ProjectileManager): void {
    void _mgr;
    const lead = this.lead(target, 1140);   // 普攻弹速 ×1.5（用户调整）
    projs.fire(this.boltSpec(lead.dirX, lead.dirY));
    projs.sparkAt(this.x, HERO_Y + 70, '#BFE3FF', 3);   // 枪口粒子闪光（与大招枪口同款）
    Sfx.play('shoot');
  }

  private boltSpec(dirX: number, dirY: number): ProjSpec {
    const crit = Math.random() < this.stats.critRate;
    return {
      x: this.x, y: HERO_Y + 60,
      dirX, dirY, speed: 1140,   // 与 lead 预判一致（×1.5）
      dmg: this.effAtk * (crit ? this.stats.critMul : 1), crit,
      color: '#7FB3FF', heroId: this.id, size: 8,
      pierce: this.stats.pierce,
      slowRatio: this.stats.slowOnHit || 0,
      slowDur: this.stats.slowDur || 2,
      burnDps: this.stats.burnOnHit ? this.effAtk * this.stats.burnOnHit : 0,
      ...this.targetBonuses(),
    };
  }

  private autoT = -1;   // 突破自动大招计时（-1=未初始化；仅 stats.ultAutoCd>0 时生效）

  protected updateQueues(dt: number, mgr: MonsterManager, projs: ProjectileManager): void {
    // 90 级突破：每 25s 自动释放一次大招（无需充能也不消耗充能——用户定稿）；无目标待命，出现即放
    if (this.stats.ultAutoCd > 0) {
      if (this.autoT < 0) this.autoT = this.stats.ultAutoCd;
      if (!this.ultLock) {
        this.autoT -= dt;
        if (this.autoT <= 0) {
          const tgt = mgr.highestHp();
          if (tgt) { this.autoT = this.stats.ultAutoCd; this.beginUltLock(tgt); }
        }
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
          this.snipeShot(tgt, projs, 2, false);
          this.volley.left--;
          if (this.volley.left <= 0) { this.volley = null; break; }
          this.volley.t += 0.28;
        }
      }
    }
    // 大招锁定演出：瞄准线实时追踪 + 准星收缩，0.5s 后发射贯穿弹
    if (this.ultLock) {
      const L = this.ultLock;
      L.t -= dt;
      if (L.target.dead) {
        // 锁定目标死亡：转火全场血量最高；全场清空则收线（充能已消耗）
        const nt = mgr.highestHp();
        if (!nt) { this.endUltLock(); return; }
        L.target = nt;
      }
      const p = Math.max(0, Math.min(1, 1 - L.t / 0.5));   // 锁定进度 0→1
      const g = L.g;
      g.clear();
      // 瞄准线：枪口 → 目标当前位置，随进度增粗（猎杀时刻主题红）
      g.strokeColor = hexc(PAL.red);
      g.lineWidth = 1 + 3 * p;
      g.moveTo(this.x, HERO_Y + 60);
      g.lineTo(L.target.x, L.target.y);
      g.stroke();
      // 收缩准星：圈 + 四向刻度，临发射瞬间闪白
      const r = 40 - 26 * p;
      g.strokeColor = hexc(p > 0.85 ? '#FFFFFF' : '#FF8A8D');
      g.lineWidth = 2.5;
      g.circle(L.target.x, L.target.y, r);
      g.stroke();
      g.moveTo(L.target.x - r - 8, L.target.y); g.lineTo(L.target.x - r + 4, L.target.y);
      g.moveTo(L.target.x + r - 4, L.target.y); g.lineTo(L.target.x + r + 8, L.target.y);
      g.moveTo(L.target.x, L.target.y - r - 8); g.lineTo(L.target.x, L.target.y - r + 4);
      g.moveTo(L.target.x, L.target.y + r - 4); g.lineTo(L.target.x, L.target.y + r + 8);
      g.stroke();
      if (L.t <= 0) {
        this.fireUltBolt(projs, mgr, L.target);
        this.endUltLock();
      }
    }
  }

  private endUltLock(): void {
    if (this.ultLock) { this.ultLock.node.destroy(); this.ultLock = null; }
  }

  /** 锁定完成：发射贯穿弹（×5.5 必暴、无视物抗、无限贯穿），拦截预判锁定方向；
   *  额外枪线卡：其余血量最高的目标各补一发 */
  private fireUltBolt(projs: ProjectileManager, mgr: MonsterManager, locked: Monster): void {
    const fire1 = (t: Monster): void => {
      const lead = this.lead(t, 1100);
      projs.fire({
        x: this.x, y: HERO_Y + 60,
        dirX: lead.dirX, dirY: lead.dirY, speed: 1100,
        dmg: this.skillAtk * 5.5, crit: true,
        color: '#9FCBFF', heroId: this.id, size: 12,
        ttl: 4, pierce: 999, spark: true,
        ignoreRes: true,
        ult: true, ability: true,   // 大招弹：击杀弹 KAPOW!（60%）
      });
      projs.sparkAt(t.x, t.y, '#BFE3FF', 5);
    };
    fire1(locked);
    const extra = Math.max(0, Math.round((this.stats.ultBolts || 1) - 1));
    if (extra > 0) {
      const others = mgr.list.filter(m => !m.dead && m !== locked).sort((a, b) => b.hp - a.hp).slice(0, extra);
      for (const t of others) fire1(t);
    }
    projs.sparkAt(this.x, HERO_Y + 70, '#BFE3FF', 8);
    Sfx.play('snipe');
  }

  /** 瞬击一发：重弩箭真弹道（命中才结算伤害），独立暴击 */
  private snipeShot(target: Monster, projs: ProjectileManager, mul: number, ignoreRes: boolean): void {
    const crit = Math.random() < this.stats.critRate;
    const dmgVal = this.skillAtk * mul * (crit ? this.stats.critMul : 1);
    const speed = 1800;
    const lead = this.lead(target, speed);   // 拦截预判：伤害在弩箭命中时才结算（用户确认）
    projs.fire({
      x: this.x, y: HERO_Y + 60,
      dirX: lead.dirX, dirY: lead.dirY, speed,
      dmg: dmgVal, crit, color: '#7FB3FF', heroId: this.id, size: 8,
      ignoreRes,
      ability: true,   // 技能弹：击杀弹 60% 词条（skillKillSnipe）
    });
    Sfx.play('shoot');
  }

  /** 技能·穿颅射击（自动，14s CD）：4 秒窗口内锁定「离防线最近」目标连续 6 狙，每发 200% 攻击；无目标等待不取消 */
  protected castSkill(_mgr: MonsterManager, _projs: ProjectileManager, _dmg: DamageService): void {
    void _mgr; void _projs; void _dmg;
    this.skillCd = this.skillCdTotal;   // 冷却缩减卡
    this.volley = { t: 0, left: Math.max(1, Math.round(this.stats.skillShots || 6)), ttl: 4 };   // 多目标锁定卡加发数
    // 演出：英雄身上红色环脉冲扩散（与瞬击弹道线同主题）
    const pulse = new Node('snipePulse');
    pulse.layer = Layers.Enum.UI_2D;
    pulse.setParent(this.node.parent!);
    pulse.setPosition(this.x, HERO_Y + 20, 0);
    const pg = pulse.addComponent(Graphics);
    pg.strokeColor = hexc(PAL.red);
    pg.lineWidth = 5;
    pg.circle(0, 0, 34);
    pg.stroke();
    const pop = pulse.addComponent(UIOpacity);
    tween(pulse).to(0.38, { scale: new Vec3(2.1, 2.1, 1) }).start();
    tween(pop).to(0.38, { opacity: 0 }).call(() => pulse.destroy()).start();
  }

  /** 大招·猎杀时刻（手动）：锁定全场血量最高目标 0.5s（瞄准线+收缩准星）→ 发射 ×5.5 必暴贯穿弹（无视物抗） */
  castUlt(mgr: MonsterManager, _projs: ProjectileManager, _dmg: DamageService): boolean {
    if (!this.ultReady || this.ultLock) return false;   // 锁定中防重入（自动/手动不叠加）
    const tgt = mgr.highestHp();
    if (!tgt) return false;   // 全场无目标：不消耗充能
    this.charge = 0;
    bus.emit(EVT.CHARGE_CHANGED, 0, false);
    this.beginUltLock(tgt);
    void _projs; void _dmg;
    return true;
  }

  /** 进入大招锁定演出（手动充能释放与 90 级突破自动释放共用） */
  private beginUltLock(tgt: Monster): void {
    const lockNode = new Node('ultLock');
    lockNode.layer = Layers.Enum.UI_2D;
    lockNode.setParent(this.node.parent!);
    lockNode.setPosition(0, 0, 0);
    const g = lockNode.addComponent(Graphics);
    this.ultLock = { t: 0.5, target: tgt, node: lockNode, g };
  }
}

/* ============================================================
 * 火焰法师 · 焰·辉（§4 #2：技能流·AOE/橙红；线稿 hero_bohu_battle 100×120）
 * ============================================================ */
/* 大招陨石调参：索敌/轰炸区半径、坑半径与寿命、坑内易伤强度 */
const ULT_ZONE_R = 130;
const CRATER_R = 88;
const CRATER_LIFE = 4;
const CRATER_VULN = 0.25;
export class PyroHero extends HeroBase {
  readonly id = 'pyro';
  readonly name = '焰·辉';
  readonly chargeMax = PYRO_CHARGE_MAX;
  readonly skillMax = 10;
  /** 大招·陨石天降：排队落下的陨石（固定范围梅花落点；fired 后 t 转为剩余坠落秒数，预警圈钉到命中，命中即生成陨石坑） */
  private meteorQueue: { t: number; x: number; y: number; fired?: boolean }[] = [];
  /** 落点预警圈：脉冲相位 + 绘图节点（惰性创建，队列清空即销毁） */
  private warnT = 0;
  private warnNode: Node | null = null;
  private warnG: Graphics | null = null;
  /** 陨石坑：命中后的地面灼烧区（持续灼烧 + 易伤），寿命 CRATER_LIFE 秒 */
  private craters: { x: number; y: number; t: number }[] = [];
  private craterNode: Node | null = null;
  private craterG: Graphics | null = null;
  /** 士气高涨：大招后攻速加成剩余时间 */
  private hasteT = 0;

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
  }

  /** 士气高涨窗口攻速 +40% */
  protected attackInterval(): number {
    return 1 / (this.stats.aspd * (this.hasteT > 0 ? 1.4 : 1));
  }

  /** 火球弹种统一构造：橙红大弹 + 溅射 + 灼烧（灼烧走余烬倍率） */
  private spec(base: {
    x: number; y: number; dirX: number; dirY: number; dmg: number;
    explodeR: number; burnDps: number; speed: number; size: number;
    ability?: boolean; ult?: boolean; stun?: number;
  }): ProjSpec {
    const crit = Math.random() < this.stats.critRate;
    return {
      x: base.x, y: base.y, dirX: base.dirX, dirY: base.dirY,
      speed: base.speed,
      dmg: base.dmg * (crit ? this.stats.critMul : 1), crit,
      color: PAL.orange, heroId: this.id, size: base.size,
      explodeR: base.explodeR, explodeMul: this.stats.explodeMul,
      slowRatio: this.stats.slowOnHit || 0,
      slowDur: this.stats.slowDur || 2,
      burnDps: base.burnDps * (this.stats.burnMul || 1),
      spark: true, ability: base.ability, ult: base.ult, stun: base.stun,
      ...this.targetBonuses(),
    };
  }

  /** 普攻·火球：小溅射（自带 60 半径 40% 溅射；法术范围卡不放大普攻溅射） */
  protected shoot(target: Monster, _mgr: MonsterManager, projs: ProjectileManager): void {
    void _mgr;
    const bs = 700;
    const lead = this.lead(target, bs);
    projs.fire(this.spec({
      x: this.x, y: HERO_Y + 60, dirX: lead.dirX, dirY: lead.dirY,
      dmg: this.effAtk, explodeR: Math.max(60, this.stats.explodeR),
      burnDps: this.stats.burnOnHit ? this.effAtk * this.stats.burnOnHit : 0,
      speed: bs, size: 9,
    }));
    Sfx.play('shoot');
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
    const shots = Math.max(1, Math.round(this.stats.skillShots || 3));
    const dmg = this.skillAtk * 1.6 * (this.stats.skillMul || 1);
    const boomR = 110 * (this.stats.skillRangeMul || 1);
    for (let k = 0; k < shots; k++) {
      const ox = best.x + (Math.random() * 2 - 1) * 70;
      const oy = best.y + (Math.random() * 2 - 1) * 70;
      const dx = ox - this.x, dy = oy - (HERO_Y + 60);
      const l = Math.hypot(dx, dy) || 1;
      projs.fire(this.spec({
        x: this.x, y: HERO_Y + 60, dirX: dx / l, dirY: dy / l,
        dmg, explodeR: boomR, burnDps: this.skillAtk * 0.2,
        speed: 820, size: 11, ability: true,
      }));
    }
    Sfx.play('skill');
  }

  protected updateQueues(dt: number, mgr: MonsterManager, projs: ProjectileManager): void {
    // 大招陨石：落点先出脉冲预警圈，到点从屏外坠落，命中后留燃烧陨石坑
    this.warnT += dt;
    if (this.meteorQueue.length) {
      if (!this.warnNode) {
        this.warnNode = new Node('ultWarn');
        this.warnNode.layer = Layers.Enum.UI_2D;
        this.warnNode.setParent(this.node.parent!);
        this.warnNode.setPosition(0, 0, 0);
        this.warnG = this.warnNode.addComponent(Graphics);
      }
      const g = this.warnG!;
      const oc = (a: number): Color => { const c = hexc(PAL.orange); c.a = a; return c; };
      g.clear();
      for (const q of this.meteorQueue) {
        const pulse = 46 + Math.sin(this.warnT * 9) * 7;
        g.fillColor = oc(38);
        g.circle(q.x, q.y, pulse); g.fill();
        g.strokeColor = oc(185); g.lineWidth = 3.5;
        g.circle(q.x, q.y, pulse); g.stroke();
        g.strokeColor = oc(215); g.lineWidth = 2.5;
        g.circle(q.x, q.y, 9 + Math.sin(this.warnT * 9 + 1.6) * 3); g.stroke();
      }
    } else if (this.warnNode) {
      this.warnNode.destroy();
      this.warnNode = null; this.warnG = null;
    }
    for (let i = this.meteorQueue.length - 1; i >= 0; i--) {
      const q = this.meteorQueue[i];
      q.t -= dt;
      if (!q.fired && q.t <= 0) {
        // 出生点必须在弹道顶界（LO.half+120）之下，否则首帧即被越界回收（上次"只有预警没有陨石"的根因）
        const top = SPAWN_Y + 50;
        q.fired = true;
        q.t = (top - q.y) / 800;   // 预警圈持续到命中
        projs.fire(this.spec({
          x: q.x, y: top, dirX: 0, dirY: -1,
          dmg: this.skillAtk * 3.5 * (this.stats.ultDmgMul || 1),
          explodeR: 140, burnDps: this.skillAtk * 0.3,
          speed: 800, size: 16, ability: true, ult: true,
          stun: this.stats.ultStun || 0,
        }));
      } else if (q.fired && q.t <= 0) {
        this.craters.push({ x: q.x, y: q.y, t: CRATER_LIFE });
        this.meteorQueue.splice(i, 1);
      }
    }
    // 陨石坑：坑内怪持续挂灼烧 + 易伤（出坑残留 0.6s），寿命尽即熄灭
    if (this.craters.length) {
      for (let i = this.craters.length - 1; i >= 0; i--) {
        const c = this.craters[i];
        c.t -= dt;
        if (c.t <= 0) { this.craters.splice(i, 1); continue; }
        for (const m of mgr.list) {
          if (m.dead || Math.hypot(m.x - c.x, m.y - c.y) > CRATER_R) continue;
          m.burnT = Math.max(m.burnT, 0.55);
          m.burnDps = Math.max(m.burnDps, this.skillAtk * 0.3);
          m.applyVuln(CRATER_VULN, 0.6);
        }
      }
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
        g.circle(c.x, c.y, CRATER_R); g.fill();
        g.fillColor = oc('#33200F', 110 * fade);
        g.circle(c.x, c.y, CRATER_R * 0.8); g.fill();
        // 熔岩池 + 白热岩芯（呼吸脉动）
        const pulse = 1 + Math.sin(this.warnT * 6 + i) * 0.06;
        g.fillColor = oc('#C2401F', (150 + 40 * glow) * fade);
        g.circle(c.x, c.y, CRATER_R * 0.42 * pulse); g.fill();
        g.fillColor = oc('#FF7A2E', (170 + 50 * glow) * fade);
        g.circle(c.x, c.y, CRATER_R * 0.22 * pulse); g.fill();
        g.fillColor = oc('#FFD24A', (120 + 70 * glow) * fade);
        g.circle(c.x, c.y, CRATER_R * 0.1 * pulse); g.fill();
        // 熔岩缘（外圈粗 + 内圈亮）
        g.strokeColor = oc('#E86A28', 215 * fade); g.lineWidth = 4.5;
        g.circle(c.x, c.y, CRATER_R * pulse); g.stroke();
        g.strokeColor = oc('#FFC24A', 160 * fade); g.lineWidth = 2;
        g.circle(c.x, c.y, CRATER_R * 0.86 * pulse); g.stroke();
        // 坑内岩浆斑 + 余烬闪点
        for (let k = 0; k < 3; k++) {
          const ang = i * 2.4 + k * 2.1;
          const rr = CRATER_R * 0.5;
          g.fillColor = oc('#D9481F', (200 * glow + 40) * fade);
          g.circle(c.x + Math.cos(ang) * rr, c.y + Math.sin(ang) * rr * 0.7, 12 + (k % 2) * 5);
          g.fill();
          const ea = ang + 1.1;
          g.fillColor = oc('#FFE08A', (140 + 90 * Math.sin(this.warnT * 11 + k * 2 + i)) * fade);
          g.circle(c.x + Math.cos(ea) * rr * 0.8, c.y + Math.sin(ea) * rr * 0.6, 2.2);
          g.fill();
        }
      }
    } else if (this.craterNode) {
      this.craterNode.destroy();
      this.craterNode = null; this.craterG = null;
    }
    if (this.hasteT > 0) this.hasteT -= dt;
  }

  /** 大招·陨石天降（手动，击杀充能）：锁定陨石范围内怪物最密集处为固定轰炸区，梅花五点砸下 5 颗陨石；
   *  每颗命中留燃烧陨石坑（持续灼烧 + 易伤 25%）；士气高涨卡给攻速爆发 */
  castUlt(mgr: MonsterManager, _projs: ProjectileManager, _dmg: DamageService): boolean {
    if (!this.ultReady) return false;
    const alive = mgr.list.filter(m => !m.dead);
    if (!alive.length) return false;   // 全场无目标：不消耗充能
    // 索敌：陨石范围内同伴最多者为区中心（密集优先），中心钳制在场内
    let cx = alive[0].x, cyy = alive[0].y, best = -1;
    for (const m of alive) {
      let n = 0;
      for (const o of alive) if (Math.hypot(o.x - m.x, o.y - m.y) <= ULT_ZONE_R) n++;
      if (n > best) { best = n; cx = m.x; cyy = m.y; }
    }
    cx = Math.max(-330, Math.min(330, cx));
    cyy = Math.max(-640, Math.min(820, cyy));
    this.charge = 0;
    bus.emit(EVT.CHARGE_CHANGED, 0, false);
    // 固定范围梅花五点：中心 1 + 四向 0.55R，少量抖动避免完全重合
    for (let k = 0; k < 5; k++) {
      const ang = -Math.PI / 2 + k * Math.PI / 2;
      const rr = k === 0 ? 0 : ULT_ZONE_R * 0.55;
      this.meteorQueue.push({
        t: 0.5 + k * 0.32,
        x: cx + Math.cos(ang) * rr + (Math.random() * 2 - 1) * 14,
        y: cyy + Math.sin(ang) * rr + (Math.random() * 2 - 1) * 14,
      });
    }
    if (this.stats.ultHaste) this.hasteT = 5;
    Sfx.play('ult');
    void _projs; void _dmg;
    return true;
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
  private strikeQueue: { t: number; target: Monster | null }[] = [];
  /** 士气高涨：大招后攻速加成剩余时间 */
  private hasteT = 0;

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
  }

  /** 士气高涨窗口攻速 +40% */
  protected attackInterval(): number {
    return 1 / (this.stats.aspd * (this.hasteT > 0 ? 1.4 : 1));
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
      dmg: base.dmg * (crit ? this.stats.critMul : 1), crit,
      color: '#B96BFF', heroId: this.id, size: base.size,
      slowRatio: this.stats.slowOnHit || 0,
      slowDur: this.stats.slowDur || 2,
      burnDps: this.stats.burnOnHit ? this.effAtk * this.stats.burnOnHit : 0,
      spark: true, ability: base.ability, ult: base.ult, stun: base.stun,
      shockAmp: this.stats.shockOnHit, shockDur: 3,
      ...this.targetBonuses(),
    };
  }

  /** 普攻·闪电弹：快速单体 */
  protected shoot(target: Monster, _mgr: MonsterManager, projs: ProjectileManager): void {
    void _mgr;
    const bs = 900;
    const lead = this.lead(target, bs);
    projs.fire(this.spec({
      x: this.x, y: HERO_Y + 60, dirX: lead.dirX, dirY: lead.dirY,
      dmg: this.effAtk, speed: bs, size: 6,
    }));
    Sfx.play('shoot');
  }

  /** 闪电闪现特效：锯齿电弧（约 0.22s 淡出）；thick=大招加粗 */
  private zapFx(x0: number, y0: number, x1: number, y1: number, thick = 3): void {
    const bolt = new Node('zap');
    bolt.layer = Layers.Enum.UI_2D;
    bolt.setParent(this.node.parent!);
    bolt.setPosition(0, 0, 0);
    const g = bolt.addComponent(Graphics);
    g.strokeColor = hexc('#D9A8FF');
    g.lineWidth = thick;
    const segs = 5;
    g.moveTo(x0, y0);
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const mx = x0 + (x1 - x0) * t + (Math.random() * 2 - 1) * 18;
      const my = y0 + (y1 - y0) * t + (Math.random() * 2 - 1) * 18;
      g.lineTo(mx, my);
    }
    g.lineTo(x1, y1);
    g.stroke();
    g.strokeColor = hexc('#FFFFFF');
    g.lineWidth = Math.max(1.2, thick * 0.4);
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.fillColor = hexc('#FFFFFF');
    g.circle(x1, y1, thick * 1.8);
    g.fill();
    const op = bolt.addComponent(UIOpacity);
    tween(op).to(0.22, { opacity: 0 }).call(() => bolt.destroy()).start();
  }

  /** 技能·连锁闪电（自动，9s CD）：从技能范围最近目标起跳，最多 skillShots 目标间跳跃（跳距 260×范围卡），每次 1.4×攻击并感电 */
  protected castSkill(mgr: MonsterManager, _projs: ProjectileManager, dmg: DamageService): void {
    void _projs;
    this.skillCd = this.skillCdTotal;   // 冷却缩减卡
    const R = this.stats.skillRange;
    const alive = mgr.list.filter(m => !m.dead && Math.hypot(m.x - this.x, m.y - HERO_Y) <= R);
    if (!alive.length) return;
    alive.sort((a, b) => Math.hypot(a.x - this.x, a.y - HERO_Y) - Math.hypot(b.x - this.x, b.y - HERO_Y));
    const jumps = Math.max(1, Math.round(this.stats.skillShots || 5));
    const hop = 260 * (this.stats.skillRangeMul || 1);
    const hitDmg = this.skillAtk * 1.4 * (this.stats.skillMul || 1);
    const struck = new Set<Monster>();
    let fromX = this.x, fromY = HERO_Y + 60;
    let cur = alive[0];
    for (let k = 0; k < jumps && cur; k++) {
      struck.add(cur);
      // 直接结算伤害（连锁无弹道，即时跳）
      const hpBefore = cur.hp;
      const done = cur.takeDamage(hitDmg, Math.random() < this.stats.critRate, this.id);
      dmg.add(this.id, Math.min(hitDmg, hpBefore));
      if (this.stats.shockOnHit) cur.applyShock(this.stats.shockOnHit, 3);
      this.zapFx(fromX, fromY, cur.x, cur.y);
      Sfx.play('hit');
      fromX = cur.x; fromY = cur.y;
      // 下一跳：距当前最近且未被打过的（无则终止）
      let next: Monster | null = null, nd = Infinity;
      for (const o of mgr.list) {
        if (o.dead || struck.has(o)) continue;
        const d = Math.hypot(o.x - fromX, o.y - fromY);
        if (d < nd && d <= hop) { nd = d; next = o; }
      }
      cur = next;
      void done;
    }
  }

  protected updateQueues(dt: number, mgr: MonsterManager, _projs: ProjectileManager): void {
    void mgr;
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
        this.thunderStrike(t, mgr);
      }
    }
    if (this.hasteT > 0) this.hasteT -= dt;
  }

  /** 单道天雷：从屏外竖劈到目标点，90 半径 AOE + 眩晕（无视物抗的雷击走普通结算） */
  private thunderStrike(t: Monster, mgr: MonsterManager): void {
    const dmgVal = this.skillAtk * 2.2 * (this.stats.ultDmgMul || 1);
    this.zapFx(t.x, SPAWN_Y + 140, t.x, t.y, 6);
    for (const o of mgr.mobsInRadius(t.x, t.y, 90)) {
      if (o.dead) continue;
      const hpBefore = o.hp;
      o.takeDamage(dmgVal, false, this.id);
      if (this.lastDmg) this.lastDmg.add(this.id, Math.min(dmgVal, hpBefore));
      if (this.stats.ultStun) o.stunT = Math.max(o.stunT, this.stats.ultStun);
      if (this.stats.shockOnHit) o.applyShock(this.stats.shockOnHit, 3);
    }
    void t;
  }

  /** 大招·天雷灭世（手动，击杀充能）：全屏 15 道落雷（在场目标轮转，目标不足时随机补位），每道 AOE + 眩晕 1s */
  castUlt(mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): boolean {
    if (!this.ultReady) return false;
    const alive = mgr.list.filter(m => !m.dead);
    if (!alive.length) return false;   // 全场无目标：不消耗充能
    this.charge = 0;
    bus.emit(EVT.CHARGE_CHANGED, 0, false);
    this.lastDmg = dmg;   // 天雷直伤计入伤害统计（施放时刷新引用）
    for (let k = 0; k < 15; k++) {
      const t = alive[k % alive.length];
      this.strikeQueue.push({ t: 0.1 + k * 0.08, target: t });
    }
    if (this.stats.ultHaste) this.hasteT = 5;
    Sfx.play('ult');
    void projs;
    return true;
  }
}
