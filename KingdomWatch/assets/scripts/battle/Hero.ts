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

interface PendingShot { t: number; target: Monster | null; dirX: number; dirY: number; }
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
    // 弓箭手占位立绘：绿色兜帽弓手（王国保卫战取向色）
    g.fillColor = hexc('#4E7A32');
    g.strokeColor = hexc(PAL.ink);
    g.lineWidth = 3;
    g.roundRect(-22, -55, 44, 95, 16);       // 身体
    g.fill(); g.stroke();
    g.fillColor = hexc('#5E8F3C');
    g.circle(0, 52, 20);                      // 头
    g.fill(); g.stroke();
    g.strokeColor = hexc(PAL.parch);          // 弓
    g.lineWidth = 4;
    g.arc(30, 10, 34, -Math.PI * 0.42, Math.PI * 0.42, false);
    g.stroke();
    g.lineWidth = 1.5;
    g.moveTo(30 + 34 * Math.cos(-Math.PI * 0.42), 10 + 34 * Math.sin(-Math.PI * 0.42));
    g.lineTo(30 + 34 * Math.cos(Math.PI * 0.42), 10 + 34 * Math.sin(Math.PI * 0.42));
    g.stroke();
    this.node.setPosition(this.hx, HERO_Y, 0);
    this.node.setParent(parent);
  }

  get x(): number { return this.hx; }
  get effAtk(): number { return this.stats.atk * this.stats.atkMul; }
  get chargePct(): number { return this.charge / this.chargeMax; }
  get ultReady(): boolean { return this.charge >= this.chargeMax; }
  get skillPct(): number { return 1 - this.skillCd / this.skillMax; }

  tick(dt: number, mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): void {
    // 连射串行子弹
    for (let i = this.serialQueue.length - 1; i >= 0; i--) {
      const q = this.serialQueue[i];
      q.t -= dt;
      if (q.t <= 0) {
        this.serialQueue.splice(i, 1);
        if (q.target && !q.target.dead) {
          this.fireMain(projs, dmg, q.target);
        } else {
          projs.fire(this.spec(projs, dmg, { x: this.x, y: HERO_Y + 60, dirX: q.dirX, dirY: q.dirY }));
        }
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
    x: number; y: number; target?: Monster | null; dirX?: number; dirY?: number; small?: boolean; dmgMul?: number;
  }): ProjSpec {
    const crit = Math.random() < this.stats.critRate;
    const atk = this.effAtk * (base.dmgMul ?? 1) * (crit ? this.stats.critMul : 1);
    return {
      x: base.x, y: base.y,
      target: base.target ?? null,
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

  private fireMain(projs: ProjectileManager, dmg: DamageService, target: Monster, dirX?: number, dirY?: number): void {
    projs.fire(this.spec(projs, dmg, {
      x: this.x, y: HERO_Y + 60,
      target: dirX === undefined ? target : null,
      dirX, dirY,
    }));
  }

  private shoot(target: Monster, mgr: MonsterManager, projs: ProjectileManager, dmg: DamageService): void {
    void mgr;
    // 主弹（追踪）
    this.fireMain(projs, dmg, target);
    // 连射：同一直线串行追加（延迟成串）
    const dx = target.x - this.x, dy = target.y - (HERO_Y + 60);
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    for (let i = 1; i <= this.stats.serial; i++) {
      this.serialQueue.push({ t: i * 0.12, target, dirX: dx / l, dirY: dy / l });
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
    // 光束演出
    const beam = new Node('beam');
    beam.layer = Layers.Enum.UI_2D;
    beam.setParent(this.node.parent!);
    beam.setPosition(this.x, HERO_Y + (SPAWN_Y - LINE_Y) / 2, 0);
    const g = beam.addComponent(Graphics);
    const span = SPAWN_Y - LINE_Y;
    g.fillColor = hexc(PAL.gold);
    g.roundRect(-14, -span / 2 - 60, 28, span + 120, 10);
    g.fill();
    const op = beam.addComponent(UIOpacity);
    op.opacity = 200;
    tween(op).to(0.28, { opacity: 0 }).call(() => beam.destroy()).start();
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
