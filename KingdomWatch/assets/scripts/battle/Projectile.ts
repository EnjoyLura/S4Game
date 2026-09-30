/**
 * 弹道（§3.5：可见追踪弹、目标死亡切换目标；子弹道直线随缘命中；对象池强制）
 * 追踪主弹命中前锁定目标；直线弹（齐射/分裂/大招箭/敌方石块）带 ttl 与碰撞去重
 * 性能：弹体为纯数据对象（无 Node），全部弹道由单个 Graphics 图层每帧一次重绘（1 draw call）
 */
import { Color, Graphics, Layers, Node, UIOpacity, tween, Vec3 } from 'cc';
import { Monster, MonsterManager } from './Monster';
import { DamageService } from './DamageService';
import { LINE_Y, PAL, MAX_PROJS } from '../config/GameConfig';

export interface ProjSpec {
  x: number; y: number;
  /** 追踪目标（设了且非敌方则追踪） */
  target?: Monster | null;
  /** 直线弹方向（会归一化） */
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
  burnDps?: number;
}

interface Active {
  spec: ProjSpec;
  vx: number; vy: number;
  pierceLeft: number;
  hit: Set<Monster>;
  ttl: number;
  homing: boolean;
}

const colorCache = new Map<string, Color>();
function hexc(h: string): Color {
  let c = colorCache.get(h);
  if (!c) { c = new Color(); Color.fromHEX(c, h); colorCache.set(h, c); }
  return c;
}

export class ProjectileManager {
  private active: Active[] = [];
  private free: Active[] = [];
  private g!: Graphics;
  private dirty = false;

  /** field 为专用弹道图层节点（英雄之上、飘字之下） */
  constructor(field: Node, private mgr: MonsterManager, private dmg: DamageService) {
    field.layer = Layers.Enum.UI_2D;
    this.g = field.addComponent(Graphics);
  }

  fire(spec: ProjSpec): void {
    if (this.active.length >= MAX_PROJS) return;
    const a = this.free.pop() || this.makeActive();
    a.spec = spec;
    a.homing = !!spec.target && !spec.enemy;
    a.hit.clear();
    a.pierceLeft = spec.pierce || 0;
    a.ttl = spec.ttl ?? (a.homing ? 6 : 1.6);
    let dx = spec.dirX ?? 0, dy = spec.dirY ?? 1;
    if (a.homing && spec.target) {
      dx = spec.target.x - spec.x; dy = spec.target.y - spec.y;
    }
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    a.vx = dx / len * spec.speed;
    a.vy = dy / len * spec.speed;
    this.active.push(a);
    this.dirty = true;
  }

  private makeActive(): Active {
    return { spec: null as unknown as ProjSpec, vx: 0, vy: 0, pierceLeft: 0, hit: new Set<Monster>(), ttl: 0, homing: false };
  }

  /** 敌方远程石块：直线落向防线，触线即结算 */
  fireStone(x: number, y: number, dmg: number): void {
    this.fire({ x, y, dirX: 0, dirY: -1, speed: 300, dmg, crit: false, color: '#B2A48B', heroId: 'enemy', size: 9, enemy: true, ttl: 6 });
  }

  tick(dt: number, line: { takeDamage: (d: number) => void }): void {
    this.dirty = true;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      const sp = a.spec;
      a.ttl -= dt;
      let done = false;

      if (a.homing) {
        const t = sp.target as Monster;
        if (!t || t.dead) {
          const nt = this.mgr.nearest(sp.x, sp.y, 520);
          if (nt) sp.target = nt;
          else a.homing = false;
        }
        if (a.homing && sp.target) {
          const tg = sp.target as Monster;
          const dx = tg.x - sp.x;
          const dy = tg.y - sp.y;
          const l = Math.sqrt(dx * dx + dy * dy) || 1;
          a.vx = dx / l * sp.speed;
          a.vy = dy / l * sp.speed;
          if (l <= tg.def.radius + 8) {
            this.hitMob(a, tg);
            if (a.pierceLeft > 0) { a.pierceLeft--; a.homing = false; }
            else done = true;
          }
        }
      }

      if (!done && !a.homing) {
        // 扫掠补偿：按本帧位移的一半扩大判定半径，防高速弹穿过薄目标
        const sweep = (Math.abs(a.vx) + Math.abs(a.vy)) * dt * 0.5;
        for (const m of this.mgr.list) {
          if (m.dead || a.hit.has(m)) continue;
          const dx = m.x - sp.x, dy = m.y - sp.y;
          const rr = m.def.radius + (sp.size || 7) * 0.5 + sweep;
          if (dx * dx + dy * dy <= rr * rr) {
            a.hit.add(m);
            this.hitMob(a, m);
            if (a.pierceLeft > 0) a.pierceLeft--;
            else { done = true; }
            break;
          }
        }
      }

      if (!done) {
        sp.x += a.vx * dt;
        sp.y += a.vy * dt;
        if (sp.enemy && sp.y <= LINE_Y + 12) {
          line.takeDamage(sp.dmg);
          done = true;
        } else if (a.ttl <= 0 || sp.y > 780 || sp.y < -720 || sp.x < -430 || sp.x > 430) {
          done = true;
        }
      }
      if (done) this.recycle(i, a);
    }
    if (this.dirty) { this.render(); this.dirty = false; }
  }

  /** 全部弹道一次重绘：单 Graphics 单 draw call（原每弹一 Node 一 Graphics） */
  private render(): void {
    const g = this.g;
    g.clear();
    for (let i = 0; i < this.active.length; i++) {
      const a = this.active[i];
      const s = a.spec;
      const size = s.size || (s.enemy ? 9 : 7);
      const spd = s.speed || 1;
      g.fillColor = hexc(s.color);
      g.strokeColor = hexc(PAL.ink);
      g.lineWidth = 1.5;
      g.circle(s.x, s.y, size);
      g.fill();
      g.stroke();
      // 运动方向尾迹
      g.strokeColor = hexc(s.color);
      g.lineWidth = 2;
      g.moveTo(s.x, s.y);
      g.lineTo(s.x - a.vx / spd * size * 2.2, s.y - a.vy / spd * size * 2.2);
      g.stroke();
    }
  }

  private hitMob(a: Active, m: Monster): void {
    const sp = a.spec;
    if (sp.enemy) return;
    const hpBefore = m.hp;
    m.takeDamage(sp.dmg, sp.crit, sp.heroId);
    this.dmg.add(sp.heroId, Math.min(sp.dmg, hpBefore));
    if (m.dead) return;
    if (sp.slowRatio) m.applySlow(sp.slowRatio, 2);
    if (sp.burnDps) m.applyBurn(sp.burnDps, 3);
    if (sp.explodeR && sp.explodeR > 0) {
      for (const o of this.mgr.mobsInRadius(m.x, m.y, sp.explodeR)) {
        if (o === m || o.dead) continue;
        const ob = o.hp;
        o.takeDamage(sp.dmg * (sp.explodeMul || 0.4), false, sp.heroId);
        this.dmg.add(sp.heroId, Math.min(sp.dmg * (sp.explodeMul || 0.4), ob));
      }
      this.boomFx(m.x, m.y, sp.explodeR);
    }
    if (sp.split && sp.split > 0 && !sp.small) {
      for (let k = 0; k < sp.split; k++) {
        this.fire({
          x: m.x, y: m.y,
          dirX: Math.random() * 1.6 - 0.8, dirY: 1,
          speed: 360, dmg: sp.dmg * 0.5, crit: false, color: sp.color,
          heroId: sp.heroId, size: 5, ttl: 1.1, small: true,
        });
      }
    }
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
