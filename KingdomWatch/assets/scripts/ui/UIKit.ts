/**
 * 程序化 UI 组件库（占位渲染：色块+描边+文字，视觉对齐 UX 线稿 token）
 * 后续美术资源到位后，仅需把 gpanel/gcircle 等替换为 Sprite(assetMap) —— 见 UX/wireframe.html 资源清单
 */
import { Color, Graphics, Label, Layers, Node, UITransform, UIOpacity, tween, Vec3, BlockInputEvents, Widget } from 'cc';
import { PAL } from '../config/GameConfig';

export function C(hex: string): Color {
  const c = new Color();
  Color.fromHEX(c, hex);
  return c;
}

/** 带透明度的颜色（hex + 0~1 alpha） */
export function CA(hex: string, alpha: number): Color {
  const c = C(hex);
  c.a = Math.round(255 * Math.max(0, Math.min(1, alpha)));
  return c;
}

type FillLike = string | Color;

function toColor(v: FillLike): Color {
  return typeof v === 'string' ? C(v) : v;
}

/** 线稿顶基坐标(设计px,左上) → 画布中心坐标 */
export function WX(l: number, w: number): number { return l + w / 2 - 375; }
export function WY(t: number, h: number): number { return 667 - (t + h / 2); }

export function N(name: string, parent: Node | null, x = 0, y = 0, w = 0, h = 0): Node {
  const n = new Node(name);
  n.layer = Layers.Enum.UI_2D; // 相机只渲染 UI_2D 层（§12.3），动态节点必须显式设层
  if (parent) n.setParent(parent);
  n.setPosition(x, y, 0);
  if (w > 0 || h > 0) n.addComponent(UITransform).setContentSize(w, h);
  return n;
}

export interface LabelOpts {
  size?: number; color?: string; align?: 'left' | 'center' | 'right'; bold?: boolean;
  w?: number; h?: number; lineHeight?: number;
}

export function label(parent: Node, x: number, y: number, text: string, o: LabelOpts = {}): Node {
  const n = N('lbl', parent, x, y, o.w || 0, o.h || 0);
  const l = n.addComponent(Label);
  l.string = text;
  l.fontSize = o.size || 20;
  l.lineHeight = o.lineHeight || (o.size || 20) * 1.25;
  l.color = C(o.color || '#FFFFFF');
  l.isBold = !!o.bold;
  if (o.align === 'left') l.horizontalAlign = Label.HorizontalAlign.LEFT;
  else if (o.align === 'right') l.horizontalAlign = Label.HorizontalAlign.RIGHT;
  else l.horizontalAlign = Label.HorizontalAlign.CENTER;
  l.verticalAlign = Label.VerticalAlign.CENTER;
  return n;
}

export function setText(n: Node, text: string): void {
  const l = n.getComponent(Label);
  if (l) l.string = text;
}

export function gpanel(parent: Node, x: number, y: number, w: number, h: number,
  fill: FillLike, stroke?: FillLike, strokeW = 2, radius = 12): Node {
  const n = N('panel', parent, x, y, w, h);
  const g = n.addComponent(Graphics);
  g.fillColor = toColor(fill);
  if (stroke) { g.strokeColor = toColor(stroke); g.lineWidth = strokeW; }
  g.roundRect(-w / 2, -h / 2, w, h, radius);
  g.fill();
  if (stroke) g.stroke();
  return n;
}

export function gcircle(parent: Node, x: number, y: number, r: number, fill: FillLike, stroke?: FillLike, lw = 2): Node {
  const n = N('circ', parent, x, y, r * 2, r * 2);
  const g = n.addComponent(Graphics);
  g.fillColor = toColor(fill);
  if (stroke) { g.strokeColor = toColor(stroke); g.lineWidth = lw; }
  g.circle(0, 0, r);
  g.fill();
  if (stroke) g.stroke();
  return n;
}

/** 圆环进度（大招充能/技能CD），set(pct) 重绘 */
export interface Ring { node: Node; set: (pct: number, color?: string) => void; }

export function gring(parent: Node, x: number, y: number, r: number, track: FillLike): Ring {
  const n = N('ring', parent, x, y, r * 2, r * 2);
  const g = n.addComponent(Graphics);
  const trackC = toColor(track);
  const draw = (pct: number, color: FillLike) => {
    g.clear();
    g.lineWidth = 5;
    g.strokeColor = trackC;
    g.circle(0, 0, r);
    g.stroke();
    if (pct > 0.01) {
      g.strokeColor = toColor(color);
      g.arc(0, 0, r, Math.PI / 2, Math.PI / 2 - pct * Math.PI * 2, true);
      g.stroke();
    }
  };
  draw(0, track);
  return { node: n, set: draw };
}

/** 进度条，set(pct) 重绘填充 */
export interface Bar { node: Node; set: (pct: number, color?: string) => void; }

export function gbar(parent: Node, x: number, y: number, w: number, h: number, fill: FillLike): Bar {
  const bg = gpanel(parent, x, y, w, h, CA('#14181E', 0.85), CA('#FFFFFF', 0.33), 1.5, h / 2);
  const fn = N('fill', bg, 0, 0, w, h);
  const g = fn.addComponent(Graphics);
  const base = toColor(fill);
  const draw = (pct: number, color?: FillLike) => {
    g.clear();
    const fw = Math.max(0, Math.min(1, pct)) * (w - 4);
    if (fw > 0.5) {
      g.fillColor = color ? toColor(color) : base;
      g.roundRect(-w / 2 + 2, -h / 2 + 2, fw, h - 4, (h - 4) / 2);
      g.fill();
    }
  };
  draw(1);
  return { node: bg, set: draw };
}

export function btn(parent: Node, x: number, y: number, w: number, h: number, text: string,
  color: FillLike, cb: () => void, size = 22): Node {
  const n = gpanel(parent, x, y, w, h, color, '#FFFFFF66', 2, 14);
  n.name = 'btn_' + text;
  label(n, 0, 0, text, { size, color: '#241C12', bold: true, w, h });
  n.on(Node.EventType.TOUCH_END, (e: unknown) => {
    const ev = e as { propagationStopped?: () => void; stopPropagation?: () => void };
    if (ev && typeof ev.propagationStopped === 'function') ev.propagationStopped();
    cb();
  });
  return n;
}

/** 全屏遮罩（吞点击） */
export function dimLayer(parent: Node, alpha = 0.68, red = false): Node {
  const n = N('dim', parent, 0, 0);
  const ut = n.addComponent(UITransform);
  const wd = n.addComponent(Widget);
  wd.isAlignLeft = wd.isAlignRight = wd.isAlignTop = wd.isAlignBottom = true;
  wd.left = wd.right = wd.top = wd.bottom = 0;
  ut.setContentSize(750, 1334);
  const g = n.addComponent(Graphics);
  g.fillColor = red ? new Color(80, 10, 12, Math.round(255 * alpha)) : new Color(6, 8, 12, Math.round(255 * alpha));
  g.roundRect(-375, -667, 750, 1334, 0);
  g.fill();
  n.addComponent(BlockInputEvents);
  return n;
}

export function fadeOut(node: Node, dur: number, done?: () => void): void {
  const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
  tween(op).to(dur, { opacity: 0 }).call(() => { if (done) done(); }).start();
}

export function setLayerDeep(node: Node, layer: number): void {
  node.layer = layer;
  node.children.forEach(ch => setLayerDeep(ch, layer));
}
