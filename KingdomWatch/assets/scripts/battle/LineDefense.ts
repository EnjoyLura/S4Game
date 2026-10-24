/**
 * 防线（§3.0/§3.11）：耐久 + 盾值胶囊（盾值唯一来源=基地城墙，伤害先扣盾再扣耐久）
 * 受击抖动；耐久<30% 红光呼吸；值变化由 HUD 每帧轮询
 */
import { Color, Graphics, Node, Vec3 } from 'cc';
import { LINE_Y, LO, PAL } from '../config/GameConfig';
import { bus, EVT } from '../core/EventBus';
import { artSprite } from '../ui/Ux';
import { Sfx } from '../core/Sfx';

function hexc(h: string): Color { const c = new Color(); Color.fromHEX(c, h); return c; }

export class LineDefense {
  hp: number;
  maxHp: number;
  shield = 0;
  invulnT = 0;
  regenPct = 0;
  node = new Node('line');

  private flashT = 0;
  private shakeT = 0;
  private basePos: Vec3 = new Vec3();
  private battleFinished = false;

  constructor(parent: Node, hp: number, shield = 0) {
    this.maxHp = hp;
    this.hp = hp;
    this.shield = Math.max(0, shield);
    this.buildVisual(parent);
    this.basePos = this.node.position.clone();
  }

  private buildVisual(parent: Node): void {
    // 程序画稿垫底（木栅+沙包，失败兜底）；defense_wall 美术加载成功后整替（用户城墙图已抠空天空）
    const prog = new Node('prog');
    const g = prog.addComponent(Graphics);
    // 防线工事：木栅 + 沙包（王国保卫战取向）；贴屏幕底部（initLayout 重算 LO）
    const top = LINE_Y;
    const bot = -(LO.half - LO.safeBottom);
    g.fillColor = hexc(PAL.wood);
    g.strokeColor = hexc(PAL.ink);
    g.lineWidth = 3;
    g.roundRect(-375, bot, 750, top - bot, 0);
    g.fill();
    g.stroke();
    g.fillColor = hexc(PAL.wood2);
    for (let i = 0; i < 10; i++) {
      g.roundRect(-355 + i * 74, top - 36, 62, 30, 10);
      g.fill();
      g.stroke();
    }
    // 盾徽已去除（用户调整：防线中间黄点）
    prog.setParent(this.node);
    // 城墙美术：原图 2016×864 等比（750 宽 → 321 高）；底边埋过屏幕物理底缘（含手势条区），
    // 避免手机上墙底露出背景条（用户反馈：防线底部露背景）；渲染序 line < 怪 < 弹道，怪从墙前经过
    const h = 750 * 864 / 2016;
    const yBot = -(LO.half + 90);
    artSprite(this.node, 0, yBot + h / 2, 750, h, 'defense_wall', { sliced: false, hideOnLoad: [prog] });
    this.node.setParent(parent);
  }

  /** 怪物/石块攻线伤害入口 */
  takeDamage(d: number): void {
    if (this.battleFinished || this.invulnT > 0 || d <= 0) return;
    if (this.shield > 0) {
      const s = Math.min(this.shield, d);
      this.shield -= s;
      d -= s;
    }
    if (d > 0) this.hp = Math.max(0, this.hp - d);
    bus.emit(EVT.LINE_DAMAGED, this.hp, this.maxHp, this.shield);
    Sfx.play('wall');
    this.shake();
    if (this.hp <= 0) bus.emit(EVT.LINE_BROKEN);
  }

  private shake(): void {
    // 手动衰减震屏：群怪齐攻时逐次建 tween 会互相叠加抖动并制造 GC 压力
    if (this.shakeT <= 0) this.shakeT = 0.21;
  }

  healPct(p: number): void {
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * p);
  }

  /** Lifesteal cannot revive a fallen or settled defense, or exceed its actual missing HP. */
  healAmount(amount: number): number {
    if (this.battleFinished || this.hp <= 0 || !Number.isFinite(amount) || amount <= 0) return 0;
    const restored = Math.min(amount, this.maxHp - this.hp);
    this.hp += restored;
    return restored;
  }

  addShield(v: number): void {
    this.shield = Math.min(this.maxHp, this.shield + v);
  }

  /** 城墙加固卡：上限乘算成长 */
  addMaxMul(m: number): void {
    this.maxHp = Math.round(this.maxHp * m);
  }

  /** 复活：耐久 +30%，短暂无敌缓冲（待定项默认） */
  revive(): void {
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.3);
    this.invulnT = 2;
  }

  get ratio(): number { return this.maxHp > 0 ? this.hp / this.maxHp : 0; }
  get lowRatio(): boolean { return this.ratio < 0.3; }

  /** Freeze the cleared result while the battlefield finishes its presentation. */
  finishBattle(): void { this.battleFinished = true; }

  tick(dt: number): void {
    if (this.invulnT > 0) this.invulnT -= dt;
    if (!this.battleFinished && this.regenPct > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.regenPct * dt);
    }
    if (this.flashT > 0) this.flashT -= dt;
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      const k = this.shakeT / 0.21;
      this.node.setPosition(this.basePos.x + Math.sin(k * Math.PI * 3) * 6 * k, this.basePos.y, 0);
      if (this.shakeT <= 0) this.node.setPosition(this.basePos.x, this.basePos.y, 0);
    }
  }
}
