/**
 * 怪物（§3.4 行为：松散虫群下行 + 正弦游动 + 自动分离；近战贴线攻击 / 远程停位投掷 / 萨满周期治疗）
 * 受击闪红 + 0.1s 硬直（§3.0）；仅 BOSS 显示血条（M0 1-1 无 BOSS，钩子保留）
 */
import { Color, Graphics, Label, Layers, Node, Tween, UIOpacity, tween } from 'cc';
import { MobDef } from '../config/Mobs';
import { LINE_Y, PAL, SPAWN_Y } from '../config/GameConfig';
import { bus, EVT } from '../core/EventBus';

export type MonsterHitCtx = {
  floatParent: Node;
  dmgNumber: (x: number, y: number, text: string, color: string, big?: boolean) => void;
};

export class Monster {
  node = new Node('mob');
  def!: MobDef;
  hp = 0;
  maxHp = 0;
  state: 'move' | 'hold' | 'attack' = 'move';
  dead = false;
  baseX = 0;
  life = 0;
  atkT = 0;
  healT = 0;
  slowT = 0;
  burnT = 0;
  burnTick = 0;
  burnDps = 0;
  /** 0.1s 受击硬直 */
  stunT = 0;
  /** 冲撞/投掷前摇演出剩余时间（手动衰减，避免逐次创建 tween） */
  lungeT = 0;

  private g!: Graphics;
  private ctx!: MonsterHitCtx;
  private holdY = 0;
  private mgrRef: MonsterManager | null = null;
  /** 受击闪红蒙层（只闪红不变形，用户确认；透明度 tick 手动衰减，零 tween） */
  private flashNode: Node | null = null;
  private flashOp: UIOpacity | null = null;
  private flashT = 0;

  init(def: MobDef, parent: Node, x: number, ctx: MonsterHitCtx, mgr?: MonsterManager): void {
    this.def = def;
    this.ctx = ctx;
    this.mgrRef = mgr || null;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.state = 'move';
    this.dead = false;
    this.life = Math.random() * 10;
    this.atkT = def.atkInterval;
    this.healT = def.atkInterval;
    this.slowT = this.burnT = this.burnTick = this.burnDps = this.stunT = this.lungeT = this.flashT = 0;
    this.baseX = x;
    this.node.removeFromParent();
    this.node.setPosition(x, SPAWN_Y + 40 + Math.random() * 60, 0);
    this.node.setScale(1, 1, 1);
    const op = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
    Tween.stopAllByTarget(op); // 复用池化对象时掐断上一世的消亡渐隐
    op.opacity = 255;
    this.node.layer = Layers.Enum.UI_2D;
    this.node.setParent(parent);
    this.draw();
  }

  private draw(): void {
    if (!this.g) {
      this.g = this.node.addComponent(Graphics);
    }
    const g = this.g;
    const r = this.def.radius;
    g.clear();
    g.fillColor = this.hex(this.def.color);
    g.strokeColor = this.hex(PAL.ink);
    g.lineWidth = 3;
    g.roundRect(-r, -r * 0.9, r * 2, r * 1.8, r * 0.45);
    g.fill();
    g.stroke();
    // 眼睛
    g.fillColor = Color.WHITE;
    g.circle(-r * 0.35, r * 0.15, r * 0.14);
    g.fill();
    g.circle(r * 0.35, r * 0.15, r * 0.14);
    g.fill();
    // 类型标记：远程=石丸 / 治疗=十字 / 精英=金框
    if (this.def.kind === 'ranged') {
      g.fillColor = this.hex('#B2A48B');
      g.circle(0, -r * 0.35, r * 0.22);
      g.fill();
    } else if (this.def.kind === 'heal') {
      g.strokeColor = Color.WHITE;
      g.lineWidth = 3;
      g.moveTo(-r * 0.3, -r * 0.5);
      g.lineTo(r * 0.3, -r * 0.5);
      g.moveTo(0, -r * 0.75);
      g.lineTo(0, -r * 0.25);
      g.stroke();
    }
    if (this.def.elite) {
      g.strokeColor = this.hex(PAL.gold);
      g.lineWidth = 4;
      g.roundRect(-r - 4, -r * 0.9 - 4, r * 2 + 8, r * 1.8 + 8, r * 0.5);
      g.stroke();
    }
    // 受击闪红蒙层：随体型重绘（半径随怪种复用变化），受击时显示、tick 手动淡出
    if (!this.flashNode) {
      this.flashNode = new Node('mobFlash');
      this.flashNode.layer = Layers.Enum.UI_2D;
      this.flashNode.setParent(this.node);
      this.flashOp = this.flashNode.addComponent(UIOpacity);
    }
    const fg = this.flashNode.getComponent(Graphics) || this.flashNode.addComponent(Graphics);
    fg.clear();
    const fc = this.hex('#E5484D');
    fc.a = 150;
    fg.fillColor = fc;
    fg.roundRect(-r, -r * 0.9, r * 2, r * 1.8, r * 0.45);
    fg.fill();
    this.flashNode.active = false;
  }

  private hex(h: string): Color {
    const c = new Color();
    Color.fromHEX(c, h);
    return c;
  }

  get x(): number { return this.node.position.x; }
  get y(): number { return this.node.position.y; }

  /** 单帧推进；返回是否死亡（死亡由 manager 清理） */
  tick(dt: number, line: { takeDamage: (d: number) => void }, mgr: MonsterManager): void {
    if (this.dead) return;
    this.life += dt;
    // 受击闪红淡出（零 tween，受击高峰期零分配）
    if (this.flashT > 0 && this.flashOp) {
      this.flashT -= dt;
      this.flashOp.opacity = Math.max(0, Math.floor(255 * this.flashT / 0.12));
      if (this.flashT <= 0 && this.flashNode) this.flashNode.active = false;
    }
    if (this.stunT > 0) { this.stunT -= dt; return; }
    if (this.slowT > 0) this.slowT -= dt;
    // 点燃 DoT：每 0.5s 聚合一条（§3.11）
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.burnTick += dt;
      if (this.burnTick >= 0.5) {
        this.burnTick -= 0.5;
        this.takeDamage(this.burnDps * 0.5, false, 'burn');
      }
      if (this.dead) return;
    }

    const mul = this.slowT > 0 ? 0.8 : 1;
    if (this.state === 'move') {
      // 直线行进（用户确认：不蛇形）；横向松散由出生 x 与分离逻辑保证
      this.node.setPosition(this.baseX, this.node.position.y - this.def.speed * mul * dt, 0);
      const reach = this.def.kind === 'ranged' ? (this.def.atkRange || 0) : this.def.radius * 0.5;
      if (this.node.position.y - LINE_Y <= reach) {
        this.holdY = this.node.position.y;
        this.state = this.def.kind === 'melee' ? 'attack' : 'hold';
        this.atkT = Math.min(this.atkT, 0.4);
      }
    }
    if (this.state === 'attack' || this.state === 'hold') {
      this.atkT -= dt;
      if (this.atkT <= 0) {
        this.atkT = this.def.atkInterval;
        if (this.def.kind === 'heal') {
          mgr.healAround(this, 160, this.def.healAmount || 40);
        } else {
          line.takeDamage(this.def.dmg);
          this.lunge();
        }
      }
      // 冲撞/投掷前摇（手动正弦脉冲，代替逐次 tween）
      if (this.lungeT > 0) {
        this.lungeT = Math.max(0, this.lungeT - dt);
        const pr = 1 - this.lungeT / 0.2;
        this.node.setPosition(this.node.position.x, this.holdY - Math.sin(pr * Math.PI) * 10, 0);
      }
    }
  }

  private lunge(): void {
    this.lungeT = 0.2;
  }

  /** 受击；crit 用于飘字样式；ignoreRes=无视物抗（狙击大招等）；返回是否击杀 */
  takeDamage(amount: number, crit: boolean, killerId: string, ignoreRes = false): boolean {
    if (this.dead) return false;
    if (this.def.physRes && !ignoreRes) amount *= 1 - this.def.physRes;
    this.hp -= amount;
    this.stunT = Math.max(this.stunT, 0.1);
    this.ctx.dmgNumber(this.x + (Math.random() * 24 - 12), this.y + this.def.radius,
      String(Math.round(amount)), crit ? '#FFD75E' : '#FFFFFF', crit);
    this.flash();
    if (this.hp <= 0) {
      this.die(killerId);
      return true;
    }
    return false;
  }

  private flash(): void {
    // 只闪红不变形（用户确认）；淡出由 tick 手动衰减（零 tween，受击高峰零分配）
    this.flashT = 0.12;
    if (this.flashNode && this.flashOp) {
      this.flashNode.active = true;
      this.flashOp.opacity = 255;
    }
  }

  private die(killerId: string): void {
    this.dead = true;
    bus.emit(EVT.MOB_KILLED, this.def, killerId);
    const op = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
    tween(op)
      .to(0.18, { opacity: 60 })
      .call(() => { if (this.mgrRef) this.mgrRef.recycleMob(this); })
      .start();
  }

  applySlow(ratio: number, dur: number): void {
    this.slowT = Math.max(this.slowT, dur);
  }
  applyBurn(dps: number, dur: number): void {
    this.burnDps = dps;
    this.burnT = Math.max(this.burnT, dur);
  }
  heal(v: number): void {
    if (this.dead) return;
    this.hp = Math.min(this.maxHp, this.hp + v);
    this.ctx.dmgNumber(this.x, this.y + this.def.radius, '+' + Math.round(v), '#7FB841');
  }
}

export class MonsterManager {
  list: Monster[] = [];
  /** 击杀统计（金币累计在 director） */
  killGold = 0;
  /** 怪物对象池：复用 Node/Graphics，杜绝刷怪波次的组件创建尖峰 */
  private pool: Monster[] = [];
  private sepN = 0;

  constructor(private field: Node, private ctx: MonsterHitCtx) {}

  spawn(def: MobDef): boolean {
    if (this.list.length >= 60) return false; // §12.4 同屏上限
    const m = this.pool.pop() || new Monster();
    m.init(def, this.field, Math.random() * 660 - 330, this.ctx, this);
    this.list.push(m);
    return true;
  }

  /** 死亡渐隐结束后回池（节点不移除出场景树，只摘下挂载） */
  recycleMob(m: Monster): void {
    m.node.removeFromParent();
    this.pool.push(m);
  }

  get aliveCount(): number {
    let n = 0;
    for (const m of this.list) if (!m.dead) n++;
    return n;
  }

  /** 索敌：范围内最靠下（最接近防线）优先，距离相同取血少（§3.0） */
  pickTarget(hx: number, hy: number, range: number): Monster | null {
    let best: Monster | null = null;
    const r2 = range * range;
    for (const m of this.list) {
      if (m.dead) continue;
      const dx = m.x - hx, dy = m.y - hy;
      if (dx * dx + dy * dy > r2) continue;
      if (!best || m.y < best.y || (m.y === best.y && m.hp < best.hp)) best = m;
    }
    return best;
  }

  anyInRange(hx: number, hy: number, range: number): boolean {
    const r2 = range * range;
    for (const m of this.list) {
      if (m.dead) continue;
      const dx = m.x - hx, dy = m.y - hy;
      if (dx * dx + dy * dy <= r2) return true;
    }
    return false;
  }

  /** 全场最近存活怪（追踪弹目标死亡后切换） */
  nearest(x: number, y: number, maxDist = 900): Monster | null {
    let best: Monster | null = null;
    let bd = maxDist * maxDist;
    for (const m of this.list) {
      if (m.dead) continue;
      const dx = m.x - x, dy = m.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = m; }
    }
    return best;
  }

  /** 全场血量最高存活怪（狙击大招锁定目标） */
  highestHp(): Monster | null {
    let best: Monster | null = null;
    for (const m of this.list) {
      if (m.dead) continue;
      if (!best || m.hp > best.hp) best = m;
    }
    return best;
  }

  /** 范围内血量最高存活怪（狙击技能·穿颅射击锁定目标） */
  highestHpInRange(hx: number, hy: number, range: number): Monster | null {
    let best: Monster | null = null;
    const r2 = range * range;
    for (const m of this.list) {
      if (m.dead) continue;
      const dx = m.x - hx, dy = m.y - hy;
      if (dx * dx + dy * dy > r2) continue;
      if (!best || m.hp > best.hp) best = m;
    }
    return best;
  }

  mobsInRadius(x: number, y: number, r: number): Monster[] {
    const out: Monster[] = [];
    const r2 = r * r;
    for (const m of this.list) {
      if (m.dead) continue;
      const dx = m.x - x, dy = m.y - y;
      if (dx * dx + dy * dy <= r2) out.push(m);
    }
    return out;
  }

  healAround(src: Monster, r: number, amt: number): void {
    for (const m of this.mobsInRadius(src.x, src.y, r)) m.heal(amt);
  }

  tick(dt: number, line: { takeDamage: (d: number) => void }): void {
    for (const m of this.list) m.tick(dt, line, this);
    // 自动分离（简单排斥半径，§3.1）：隔帧执行减半开销，视觉无感
    if ((this.sepN++ & 1) === 0) {
      for (let i = 0; i < this.list.length; i++) {
        const a = this.list[i];
        if (a.dead || a.state === 'attack') continue;
        for (let j = i + 1; j < this.list.length; j++) {
          const b = this.list[j];
          if (b.dead || b.state === 'attack') continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const min = a.def.radius + b.def.radius;
          const d2 = dx * dx + dy * dy;
          if (d2 > 0.01 && d2 < min * min) {
            const d = Math.sqrt(d2);
            const push = (min - d) * 0.5;
            const nx = dx / d, ny = dy / d;
            this.nudge(a, -nx * push, -ny * push);
            this.nudge(b, nx * push, ny * push);
          }
        }
      }
    }
    // 就地压缩清除死亡（替代 filter，零每帧数组分配）
    let w = 0;
    for (let i = 0; i < this.list.length; i++) {
      if (!this.list[i].dead) this.list[w++] = this.list[i];
    }
    this.list.length = w;
  }

  private nudge(m: Monster, dx: number, dy: number): void {
    const p = m.node.position;
    let nx = Math.max(-355, Math.min(355, p.x + dx));
    let ny = Math.min(SPAWN_Y, p.y + dy);
    if (m.state === 'hold') ny = p.y; // 停位怪不上下挤
    m.node.setPosition(nx, ny, 0);
    if (m.state === 'move') m.baseX = nx;
  }
}

/** 占位：血条仅 BOSS 显示（M0 预留钩子） */
export function drawMobHpBar(m: Monster, g: Graphics): void {
  const w = m.def.radius * 2;
  g.clear();
  g.fillColor = new Color(0, 0, 0, 140);
  g.roundRect(-w / 2, m.def.radius + 6, w, 6, 3);
  g.fill();
  g.fillColor = new Color(229, 72, 77, 255);
  g.roundRect(-w / 2, m.def.radius + 6, w * Math.max(0, m.hp / m.maxHp), 6, 3);
  g.fill();
}
