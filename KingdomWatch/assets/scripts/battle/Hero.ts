/**
 * 英雄单元（§3.7：普攻自动/技能自动CD/大招手动击杀充能）
 * M0：弓箭手艾拉·风羽 —— 索敌优先最靠下；技能=穿云箭(12s 直线穿透)；大招=箭雨风暴(3轮×12箭)
 * 强化卡实时改写 stats（连射/齐射/分裂/爆炸/词条）
 */
import { Color, Graphics, Layers, Node, UIOpacity, tween, Vec3 } from 'cc';
import { HeroStats } from '../config/Cards';
import { ARCHER_CHARGE_MAX, HERO_Y, LINE_Y, PAL, SPAWN_Y } from '../config/GameConfig';
import { Monster, MonsterManager } from './Monster';
import { ProjectileManager, ProjSpec } from './Projectile';
import { DamageService } from './DamageService';
import { bus, EVT } from '../core/EventBus';

function hexc(h: string): Color { const c = new Color(); Color.fromHEX(c, h); return c; }

interface PendingShot { t: number; dirX: number; dirY: number; }
interface PendingVolley { t: number; }

export class HeroUnit {
  readonly id = 'archer';
  readonly name = '艾拉·风羽';
  node = new Node('hero');
  stats: HeroStats;
  charge = 0;
  readonly chargeMax = ARCHER_CHARGE_MAX;
  skillCd = 0;
  readonly skillMax = 12;
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
    // 连射串行子弹（用户确认：子弹一旦发射即直线飞行，不追踪不换目标）
    for (let i = this.serialQueue.length - 1; i >= 0; i--) {
      const q = this.serialQueue[i];
      q.t -= dt;
      if (q.t <= 0) {
        this.serialQueue.splice(i, 1);
        projs.fire(this.spec(projs, dmg, { x: this.x, y: HERO_Y + 60, dirX: q.dirX, dirY: q.dirY }));
      }
    }
    // 大招箭雨轮次
    for (let i = this.volleyQueue.length - 1; i >= 0; i--) {
      const v = this.volleyQueue[i];
      v.t -= dt;
      if (v.t <= 0) {
        this.volleyQueue.splice(i, 1);
        for (let k = 0; k < 12; k++) {
          projs.fire({
            x: Math.random() * 680 - 340, y: SPAWN_Y,
            dirX: 0, dirY: -1, speed: 520,
            dmg: this.effAtk * 0.55, crit: Math.random() < this.stats.critRate,
            color: PAL.gold, heroId: this.id, size: 8, ttl: 3.2,
          });
        }
      }
    }
    // 普攻
    this.atkT -= dt;
    if (this.atkT <= 0) {
      const t = mgr.pickTarget(this.x, HERO_Y, this.stats.range);
      if (t) {
        this.shoot(t, mgr, projs, dmg);
        this.atkT = 1 / this.stats.aspd;
      } else {
        this.atkT = 0;
      }
    }
    // 技能（自动：CD 好 + 技能范围内有怪）
    this.skillCd -= dt;
    if (this.skillCd <= 0 && mgr.anyInRange(this.x, HERO_Y, this.stats.skillRange)) {
      this.castSkill(mgr, dmg);
    }
  }

  private spec(_projs: ProjectileManager, _dmg: DamageService, base: {
    x: number; y: number; dirX?: number; dirY?: number; small?: boolean; dmgMul?: number;
  }): ProjSpec {
    const crit = Math.random() < this.stats.critRate;
    const atk = this.effAtk * (base.dmgMul ?? 1) * (crit ? this.stats.critMul : 1);
    return {
      x: base.x, y: base.y,
      dirX: base.dirX, dirY: base.dirY,
      speed: base.small ? 360 : 480,
      dmg: atk, crit,
      color: crit ? PAL.orange : PAL.parch,
      heroId: this.id,
      size: base.small ? 5 : 7,
      small: base.small,
      pierce: this.stats.pierce,
      explodeR: this.stats.explodeR > 0 && !base.small ? this.stats.explodeR : 0,
      explodeMul: this.stats.explodeMul,
      split: this.stats.split,
      slowRatio: this.stats.slowOnHit || 0,
      burnDps: this.stats.burnOnHit ? this.effAtk * this.stats.burnOnHit : 0,
    };
  }

  /** 发射方向在出弓瞬间锁定，之后直线飞行（用户确认：不追踪不拐弯） */
  private fireMain(projs: ProjectileManager, dmg: DamageService, target: Monster, dirX?: number, dirY?: number): void {
    if (dirX === undefined || dirY === undefined) {
      const dx = target.x - this.x, dy = target.y - (HERO_Y + 60);
      const l = Math.sqrt(dx * dx + dy * dy) || 1;
      dirX = dx / l; dirY = dy / l;
    }
    projs.fire(this.spec(projs, dmg, { x: this.x, y: HERO_Y + 60, dirX, dirY }));
  }

  private shoot(target: Monster, mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): void {
    void mgr;
    // 主弹：朝目标当前位置直线射出
    this.fireMain(projs, dmg, target);
    // 连射：同一直线串行追加（延迟成串，方向锁定不随目标移动）
    const dx = target.x - this.x, dy = target.y - (HERO_Y + 60);
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    for (let i = 1; i <= this.stats.serial; i++) {
      this.serialQueue.push({ t: i * 0.12, dirX: dx / l, dirY: dy / l });
    }
    // 齐射：固定扇形子弹道，直线随缘
    if (this.stats.fan > 0) {
      const spread = 10;
      for (let i = 0; i < this.stats.fan; i++) {
        const off = (i - (this.stats.fan - 1) / 2) * spread * Math.PI / 180;
        const baseAng = Math.atan2(dy, dx);
        const ang = baseAng + off;
        this.fireMain(projs, dmg, target, Math.cos(ang), Math.sin(ang));
      }
    }
  }

  /** 穿云箭：直线穿透，命中路径全部敌人（12s CD，极简演出） */
  private castSkill(mgr: MonsterManager, dmg: DamageService): void {
    this.skillCd = this.skillMax;
    const d = this.effAtk * 5.2;
    for (const m of mgr.list) {
      if (m.dead) continue;
      if (m.y > HERO_Y && Math.abs(m.x - this.x) < 44) {
        const before = m.hp;
        m.takeDamage(d, false, this.id);
        dmg.add(this.id, Math.min(d, before));
      }
    }
    // 穿云箭演出：一支大箭从英雄位直射天际 + 弹道淡金色闪光带
    const span = SPAWN_Y - LINE_Y;
    const lane = new Node('skillLane');
    lane.layer = Layers.Enum.UI_2D;
    lane.setParent(this.node.parent!);
    lane.setPosition(this.x, HERO_Y + span / 2, 0);
    const lg = lane.addComponent(Graphics);
    lg.fillColor = new Color(242, 178, 62, 36);
    lg.roundRect(-44, -span / 2 - 40, 88, span + 80, 20);
    lg.fill();
    const lop = lane.addComponent(UIOpacity);
    lop.opacity = 255;
    tween(lop).to(0.3, { opacity: 0 }).call(() => lane.destroy()).start();

    const arrow = new Node('skillArrow');
    arrow.layer = Layers.Enum.UI_2D;
    arrow.setParent(this.node.parent!);
    arrow.setPosition(this.x, HERO_Y + 40, 0);
    const ag = arrow.addComponent(Graphics);
    ag.fillColor = hexc(PAL.gold);
    ag.roundRect(-5, -60, 10, 104, 5);          // 箭杆
    ag.fill();
    ag.moveTo(-12, 44); ag.lineTo(0, 78); ag.lineTo(12, 44); // 箭头
    ag.close(); ag.fill();
    ag.fillColor = hexc(PAL.parch);             // 尾羽
    ag.moveTo(-14, -60); ag.lineTo(0, -44); ag.lineTo(14, -60); ag.lineTo(9, -72); ag.lineTo(0, -60); ag.lineTo(-9, -72);
    ag.close(); ag.fill();
    const aop = arrow.addComponent(UIOpacity);
    tween(arrow)
      .to(0.14, { position: new Vec3(this.x, SPAWN_Y + 60, 0) }, { easing: 'sineIn' })
      .call(() => { tween(aop).to(0.08, { opacity: 0 }).call(() => arrow.destroy()).start(); })
      .start();
  }

  /** 击杀充能（§3.7：击杀者获得怪物配置充能值） */
  chargeKill(v: number): void {
    if (this.ultReady) return;
    this.charge = Math.min(this.chargeMax, this.charge + v);
    bus.emit(EVT.CHARGE_CHANGED, this.chargePct, this.ultReady);
  }

  /** 箭雨风暴：全屏 3 轮 × 12 箭随机落点（手动，极简演出） */
  castUlt(): boolean {
    if (!this.ultReady) return false;
    this.charge = 0;
    for (let i = 0; i < 3; i++) this.volleyQueue.push({ t: i * 0.35 });
    bus.emit(EVT.CHARGE_CHANGED, 0, false);
    return true;
  }
}
