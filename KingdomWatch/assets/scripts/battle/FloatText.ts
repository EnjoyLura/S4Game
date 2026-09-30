/**
 * 伤害/金币飘字（池化）：暴击金色大字（弹跳缩放+随机偏转+横向漂移弧线）、普通白色小字。
 * 高频限流：全屏怪群伤时池化复用 + 上限丢弃，杜绝 GC 与渲染尖峰。
 */
import { Color, Label, Layers, Node, UIOpacity, tween, Vec3 } from 'cc';
import { Pool } from '../core/ObjectPool';

const MAX_ACTIVE = 36;

function col(hex: string, cache: Map<string, Color>): Color {
  let c = cache.get(hex);
  if (!c) { c = new Color(); Color.fromHEX(c, hex); cache.set(hex, c); }
  return c;
}

interface FText { node: Node; label: Label; to: Vec3; to2: Vec3; }

export class FloatText {
  private pool: Pool<FText>;
  private active = 0;
  private colorCache = new Map<string, Color>();

  constructor(private parent: Node) {
    this.pool = new Pool<FText>(() => {
      const n = new Node('ft');
      n.layer = Layers.Enum.UI_2D;
      n.setParent(this.parent);
      const l = n.addComponent(Label);
      l.string = '';
      l.fontSize = 18;
      l.lineHeight = 22;
      return { node: n, label: l, to: new Vec3(), to2: new Vec3() };
    }, t => {
      // 回池即隐藏（否则默认文字 "label" 会叠在屏幕中心）
      t.node.active = false;
      t.node.setPosition(0, 0, 0);
      t.node.angle = 0;
    });
    // 预热，避免开局首波伤害的创建尖峰
    const warm: FText[] = [];
    for (let i = 0; i < 16; i++) warm.push(this.pool.get());
    for (const t of warm) this.pool.put(t);
  }

  spawn(x: number, y: number, text: string, color: string, big = false): void {
    if (this.active >= MAX_ACTIVE) return;
    const ft = this.pool.get();
    this.active++;
    ft.node.active = true;
    ft.label.string = text;
    ft.label.fontSize = big ? 44 : 26;
    ft.label.isBold = true;
    ft.label.lineHeight = ft.label.fontSize * 1.2;
    ft.label.color = col(color, this.colorCache);
    const sy = y + (Math.random() * 12 - 6);                 // 起点微散，减少重叠
    const drift = (Math.random() * 2 - 1) * (big ? 30 : 12); // 横向漂移弧线
    const h = big ? 104 : 60;
    ft.node.setPosition(x, sy, 0);
    ft.node.angle = big ? Math.random() * 10 - 5 : 0;        // 暴击随机微偏转
    ft.node.setScale(0.3, 0.3, 1);
    const op = ft.node.getComponent(UIOpacity) || ft.node.addComponent(UIOpacity);
    op.opacity = 255;
    // 两段轨迹：快速弹出（backOut）→ 弧线上飘渐停（sineOut）
    ft.to.set(x + drift * 0.45, sy + h * 0.42, 0);
    ft.to2.set(x + drift, sy + h, 0);
    tween(ft.node)
      .to(0.14, { position: ft.to, scale: new Vec3(big ? 1.3 : 1, big ? 1.3 : 1, 1) }, { easing: 'backOut' })
      .to(big ? 0.62 : 0.5, { position: ft.to2 }, { easing: 'sineOut' })
      .call(() => { this.active--; this.pool.put(ft); })
      .start();
    tween(op).delay(big ? 0.3 : 0.22).to(big ? 0.5 : 0.42, { opacity: 0 }).start();
  }
}
