/**
 * 漫画拟声弹字（参考《王国保卫战》词条机制）：
 * 与伤害类型/击杀/暴击/技能事件绑定的结构化反馈，不是随机装饰。
 * 三档触发频率分层——必出（处决/暴击/技能施放）/ 概率（近战/石弹命中防线）/ 大招专属，
 * 主题色与伤害来源挂钩（弓=金、狙=蓝、怪=红、石=土），既热闹又不泛滥。
 * 池化 + 上限丢弃（高频限流同 FloatText）；漫画 punch-in 弹出 + 悬停 + 收缩淡出。
 */
import { Color, Label, Layers, Node, UIOpacity, tween, Vec3 } from 'cc';
import { Pool } from '../core/ObjectPool';
import { PAL } from '../config/GameConfig';

/** 词条表：kind → 词组/主题色/字号/触发概率（1=必出） */
export const POP_DEFS: Record<string, { words: string[]; color: string; size: number; chance: number }> = {
  killArrow:  { words: ['OOF!', 'SHUNT!'], color: PAL.gold,  size: 30, chance: 1 },    // 处决·箭系击杀（祖传两词随机）
  killSnipe:  { words: ['AACK!'],          color: '#7FB3FF', size: 30, chance: 1 },    // 处决·枪械类专属
  killUlt:    { words: ['KAPOW!'],         color: '#BFE3FF', size: 38, chance: 1 },    // 处决·大招专属
  crit:       { words: ['爆!'],            color: PAL.orange, size: 40, chance: 1 },   // 暴击·必出（覆盖处决词）
  meleeHit:   { words: ['POW!', 'SOK!'],   color: PAL.red,   size: 26, chance: 0.3 },  // 伤害·近战概率词
  stoneHit:   { words: ['咚!'],            color: '#B2A48B', size: 24, chance: 0.35 }, // 伤害·石弹概率词
  castArcher: { words: ['咻!'],            color: PAL.gold,  size: 28, chance: 1 },    // 技能·强化箭矢施放
  castRain:   { words: ['唰唰唰!'],        color: PAL.gold,  size: 28, chance: 1 },    // 技能·扇形箭雨施放
  castSnipe:  { words: ['砰!'],            color: '#7FB3FF', size: 28, chance: 1 },    // 技能·穿颅射击施放
  castHunt:   { words: ['锁定!'],          color: '#BFE3FF', size: 28, chance: 1 },    // 技能·猎杀时刻锁定
};

const MAX_ACTIVE = 12;
const OUTLINE = '#241C12';

interface Pop { node: Node; label: Label; out: Vec3; }

export class ComicPop {
  private pool: Pool<Pop>;
  private active = 0;
  private colorCache = new Map<string, Color>();

  constructor(private parent: Node) {
    this.pool = new Pool<Pop>(() => {
      const n = new Node('pop');
      n.layer = Layers.Enum.UI_2D;
      n.setParent(this.parent);
      const l = n.addComponent(Label);
      l.string = '';
      l.isBold = true;
      l.enableOutline = true;
      l.outlineColor = this.col(OUTLINE);
      l.outlineWidth = 3.5;
      return { node: n, label: l, out: new Vec3() };
    }, t => {
      t.node.active = false;
      t.node.setPosition(0, 0, 0);
      t.node.angle = 0;
    });
    const warm: Pop[] = [];
    for (let i = 0; i < 8; i++) warm.push(this.pool.get());
    for (const p of warm) this.pool.put(p);
  }

  /** 在事件点弹出词条（x,y 为事件坐标；头顶再上浮 46px 由这里统一加） */
  pop(x: number, y: number, kind: string): void {
    const def = POP_DEFS[kind];
    if (!def || this.active >= MAX_ACTIVE) return;
    if (Math.random() > def.chance) return;
    const word = def.words[(Math.random() * def.words.length) | 0];
    const p = this.pool.get();
    this.active++;
    p.node.active = true;
    p.label.string = word;
    p.label.fontSize = def.size;
    p.label.lineHeight = def.size * 1.1;
    p.label.color = this.col(def.color);
    const sy = y + 46;
    p.node.setPosition(x + (Math.random() * 28 - 14), sy, 0);
    p.node.angle = Math.random() * 12 - 6;                     // 美漫字微偏转
    p.node.setScale(0.2, 0.2, 1);
    const op = p.node.getComponent(UIOpacity) || p.node.addComponent(UIOpacity);
    op.opacity = 255;
    p.out.set(p.node.position.x, sy + 14, 0);
    // punch-in 弹出（backOut 过冲）→ 悬停 → 收缩淡出
    tween(p.node)
      .to(0.13, { scale: new Vec3(1.15, 1.15, 1) }, { easing: 'backOut' })
      .to(0.08, { scale: new Vec3(1, 1, 1) })
      .delay(0.14)
      .to(0.15, { scale: new Vec3(0.45, 0.45, 1), position: p.out })
      .call(() => { this.active--; this.pool.put(p); })
      .start();
    tween(op).delay(0.3).to(0.18, { opacity: 0 }).start();
  }

  private col(hex: string): Color {
    let c = this.colorCache.get(hex);
    if (!c) { c = new Color(); Color.fromHEX(c, hex); this.colorCache.set(hex, c); }
    return c;
  }
}
