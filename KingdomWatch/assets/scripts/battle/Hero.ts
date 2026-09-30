/**
 * 英雄单元（§3.7：普攻自动/技能自动CD/大招手动击杀充能）
 * M0：弓箭手艾拉·风羽 —— 索敌优先最靠下；技能=强化箭矢(12s，接下来6次普攻变金色贯穿箭)；大招=扇形箭雨(两排×8箭全贯穿)
 * 强化卡实时改写 stats（连射/齐射/分裂/爆炸/词条）
 */
import { Color, Graphics, Layers, Node, UIOpacity, tween, Vec3 } from 'cc';
import { HeroStats } from '../config/Cards';
import { ARCHER_CHARGE_MAX, HERO_Y, PAL } from '../config/GameConfig';
import { Monster, MonsterManager } from './Monster';
import { ProjectileManager, ProjSpec } from './Projectile';
import { DamageService } from './DamageService';
import { bus, EVT } from '../core/EventBus';

function hexc(h: string): Color { const c = new Color(); Color.fromHEX(c, h); return c; }

interface PendingShot { t: number; target: Monster | null; dirX: number; dirY: number; emp?: boolean; }
interface PendingVolley { t: number; row: 0 | 1; }

export class HeroUnit {
  readonly id = 'archer';
  readonly name = '艾拉·风羽';
  node = new Node('hero');
  stats: HeroStats;
  charge = 0;
  readonly chargeMax = ARCHER_CHARGE_MAX;
  skillCd = 0;
  readonly skillMax = 12;
  /** 技能·强化箭矢：剩余强化普攻次数（>0 时出弓即金色贯穿箭） */
  empowerLeft = 0;
  private readonly empowerMax = 6;
  private atkT = 0;
  private serialQueue: PendingShot[] = [];
  private volleyQueue: PendingVolley[] = [];
  private hx: number;

  constructor(parent: Node, x: number, stats: HeroStats) {
    this.hx = x;
    this.stats = stats;
    this.buildVisual(parent);
  }

  private buildVisual(parent: Node): void {
    const g = this.node.addComponent(Graphics);
    // 弓箭手艾拉·风羽（线稿 hero_aila_battle 100×120）：背影弓手立于防线工事前，头顶被普攻/技能图标锚定
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
    this.node.setPosition(this.hx, HERO_Y, 0);
    this.node.setParent(parent);
  }

  get x(): number { return this.hx; }
  get effAtk(): number { return this.stats.atk * this.stats.atkMul; }
  get chargePct(): number { return this.charge / this.chargeMax; }
  get ultReady(): boolean { return this.charge >= this.chargeMax; }
  get skillPct(): number { return 1 - this.skillCd / this.skillMax; }

  tick(dt: number, mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): void {
    // 连射串行子弹：出弓瞬间按当时状态重新预判方向，出弓后直线飞行（不追踪不拐弯）
    for (let i = this.serialQueue.length - 1; i >= 0; i--) {
      const q = this.serialQueue[i];
      q.t -= dt;
      if (q.t <= 0) {
        this.serialQueue.splice(i, 1);
        if (q.target && !q.target.dead) {
          const ld = this.lead(q.target, q.emp ? 780 : 480);
          this.fireDir(projs, ld.dirX, ld.dirY, q.emp === true);
        } else {
          this.fireDir(projs, q.dirX, q.dirY, q.emp === true);
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
    // 普攻
    this.atkT -= dt;
    if (this.atkT <= 0) {
      const t = mgr.pickTarget(this.x, HERO_Y, this.stats.range);
      if (t) {
        const emp = this.shoot(t, mgr, projs, dmg);
        // 强化箭矢窗口内攻速 +30%（贯穿爽感）
        this.atkT = emp ? 1 / (this.stats.aspd * 1.3) : 1 / this.stats.aspd;
      } else {
        this.atkT = 0;
      }
    }
    // 技能（自动：CD 好 + 技能范围内有怪）
    this.skillCd -= dt;
    if (this.skillCd <= 0 && mgr.anyInRange(this.x, HERO_Y, this.stats.skillRange)) {
      this.castSkill();
    }
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
      speed: base.small ? 360 : emp ? 780 : 480,
      dmg: atk, crit,
      color: emp ? PAL.gold : PAL.parch,   // 暴击不改箭色（用户反馈），只由伤害飘字体现
      heroId: this.id,
      size: base.small ? 5 : emp ? 10 : 7,
      small: base.small,
      pierce: emp ? 999 : this.stats.pierce,
      explodeR: this.stats.explodeR > 0 && !base.small ? this.stats.explodeR : 0,
      explodeMul: this.stats.explodeMul,
      split: this.stats.split,
      slowRatio: this.stats.slowOnHit || 0,
      burnDps: this.stats.burnOnHit ? this.effAtk * this.stats.burnOnHit : 0,
    };
  }

  /** 出弓瞬间按拦截预判锁定方向，之后直线飞行（用户确认：不追踪不拐弯）；emp=强化贯穿箭 */
  private fireDir(projs: ProjectileManager, dirX: number, dirY: number, emp = false): void {
    projs.fire(this.spec({ x: this.x, y: HERO_Y + 60, dirX, dirY, emp }));
  }

  /**
   * 预判拦截瞄准：按目标当前速度解拦截方程，瞄准"子弹到达时目标将所在的位置"。
   * 目标匀速直线下行 v（停位/攻击态 v=0），子弹速度 s，相对位移 (dx,dy)：
   *   (v²-s²)t² - 2·dy·v·t + (dx²+dy²) = 0，s>v 时判别式恒 ≥0 必有解。
   * 理论不可拦截（disc<0）或无正根时退化为瞄准当前位置。
   */
  private lead(target: Monster, bulletSpeed: number): { dirX: number; dirY: number } {
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

  private shoot(target: Monster, mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): boolean {
    void mgr; void dmg;
    // 强化箭矢窗口：本次普攻（含连射/齐射子弹道）全部为金色贯穿箭，按次扣减
    const emp = this.empowerLeft > 0;
    if (emp) this.empowerLeft--;
    const bs = emp ? 780 : 480;
    // 主弹：预判拦截点直线射出
    const lead = this.lead(target, bs);
    this.fireDir(projs, lead.dirX, lead.dirY, emp);
    // 连射：延迟成串；每发出弓瞬间若目标存活则按当时状态重新预判（出弓后仍直线），目标已亡则沿锁定方向
    for (let i = 1; i <= this.stats.serial; i++) {
      this.serialQueue.push({ t: i * 0.12, target, dirX: lead.dirX, dirY: lead.dirY, emp });
    }
    // 齐射：以预判拦截线为中心的固定扇形子弹道，直线随缘
    if (this.stats.fan > 0) {
      const spread = 10;
      const baseAng = Math.atan2(lead.dirY, lead.dirX);
      for (let i = 0; i < this.stats.fan; i++) {
        const off = (i - (this.stats.fan - 1) / 2) * spread * Math.PI / 180;
        const ang = baseAng + off;
        this.fireDir(projs, Math.cos(ang), Math.sin(ang), emp);
      }
    }
    return emp;
  }

  /** 技能·强化箭矢（自动，12s CD）：接下来 6 次普攻变为金色贯穿箭（伤害 ×1.5、无限穿透、弹速 540） */
  private castSkill(): void {
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

  /** 击杀充能（§3.7：击杀者获得怪物配置充能值） */
  chargeKill(v: number): void {
    if (this.ultReady) return;
    this.charge = Math.min(this.chargeMax, this.charge + v);
    bus.emit(EVT.CHARGE_CHANGED, this.chargePct, this.ultReady);
  }

  /** 大招·扇形箭雨（手动，击杀充能）：两排 × 8 箭扇形射出，全部无限贯穿 */
  castUlt(): boolean {
    if (!this.ultReady) return false;
    this.charge = 0;
    this.volleyQueue.push({ t: 0, row: 0 }, { t: 0.35, row: 1 });
    bus.emit(EVT.CHARGE_CHANGED, 0, false);
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
        dmg: this.effAtk * 0.65, crit: Math.random() < this.stats.critRate,
        color: PAL.gold, heroId: this.id, size: 9, ttl: 3.6, pierce: 999,
      });
    }
  }
}
