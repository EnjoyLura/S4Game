/** Painted, bounded Graphics geometry. All age/phase values come from the battle clock. */
import { Color, Graphics, Layers, Node } from 'cc';

const TAU = Math.PI * 2;
function color(hex: string): Color { const c = new Color(); Color.fromHEX(c, hex); return c; }
const P = {
  ink: color('#234D57'), deep: color('#246C70'), teal: color('#48B8AA'), mint: color('#B5EED6'),
  light: color('#F0FFE3'), leaf: color('#799C65'), goldLeaf: color('#CED28B'),
  steelInk: color('#334855'), steel: color('#7894A3'), silver: color('#CEDFE4'), edge: color('#F3FBF7'),
  cyan: color('#67D4DA'), blue: color('#438EAA'),
};
function fill(g: Graphics, c: Color, alpha = 1): void {
  c.a = Math.round(255 * Math.max(0, Math.min(1, alpha))); g.fillColor = c;
}
function stroke(g: Graphics, c: Color, width: number, alpha = 1): void {
  c.a = Math.round(255 * Math.max(0, Math.min(1, alpha))); g.strokeColor = c; g.lineWidth = width;
}
function arc(g: Graphics, x: number, y: number, rx: number, ry: number, a: number, span: number, steps = 18): void {
  g.moveTo(x + Math.cos(a) * rx, y + Math.sin(a) * ry);
  for (let i = 1; i <= steps; i++) {
    const t = a + span * i / steps;
    g.lineTo(x + Math.cos(t) * rx, y + Math.sin(t) * ry);
  }
  g.stroke();
}
/** Tapered ribbons leave most of the battlefield visible between rolling bands. */
function ribbon(g: Graphics, x: number, y: number, rx: number, ry: number, a: number,
  span: number, width: number, c: Color, alpha: number): void {
  fill(g, c, alpha);
  for (let side = 1; side >= -1; side -= 2) for (let i = 0; i <= 18; i++) {
    const t = side > 0 ? i / 18 : 1 - i / 18, theta = a + span * t;
    const w = Math.sin(Math.PI * t) * width * .5 * side;
    const px = x + Math.cos(theta) * (rx + w), py = y + Math.sin(theta) * (ry + w);
    if (side === 1 && i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.close(); g.fill();
}
function leaf(g: Graphics, x: number, y: number, r: number, a: number, alpha: number, gold: boolean): void {
  const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  fill(g, gold ? P.goldLeaf : P.leaf, alpha);
  g.moveTo(x - dx * r, y - dy * r);
  g.bezierCurveTo(x + nx * r, y + ny * r, x + dx * r * .65 + nx * r * .4,
    y + dy * r * .65 + ny * r * .4, x + dx * r, y + dy * r);
  g.bezierCurveTo(x - nx * r * .6, y - ny * r * .6, x - dx * r * .6 - nx * r * .3,
    y - dy * r * .6 - ny * r * .3, x - dx * r, y - dy * r); g.close(); g.fill();
  stroke(g, P.light, .7, alpha * .6);
  g.moveTo(x - dx * r * .7, y - dy * r * .7); g.lineTo(x + dx * r * .7, y + dy * r * .7); g.stroke();
}

/** A broad HORIZONTAL crescent, independent of its diagonal flight direction. */
export function drawWindBlade(g: Graphics, x: number, y: number, vx: number, vy: number, size: number, age: number): void {
  const r = Math.max(3, size), w = r * 2.7, h = r * (1.02 + Math.sin(age * 19) * .04);
  const len = Math.hypot(vx, vy) || 1, dx = vx / len, dy = vy / len;
  for (let i = 2; i >= 1; i--) {
    stroke(g, P.mint, 1.4, .2 / i);
    arc(g, x - dx * r * i * 1.7, y - dy * r * i * 1.7, w * .88, h * .7, .12, Math.PI - .24, 12);
  }
  fill(g, P.deep, .85); stroke(g, P.ink, 1.1, .8);
  g.moveTo(x - w, y - h * .2);
  g.bezierCurveTo(x - w * .62, y + h * 1.6, x + w * .62, y + h * 1.6, x + w, y - h * .2);
  g.bezierCurveTo(x + w * .38, y + h * .65, x - w * .38, y + h * .65, x - w, y - h * .2);
  g.close(); g.fill(); g.stroke();
  fill(g, P.teal, .95);
  g.moveTo(x - w * .98, y - h * .16);
  g.bezierCurveTo(x - w * .5, y + h * 1.49, x + w * .5, y + h * 1.49, x + w * .98, y - h * .16);
  g.bezierCurveTo(x + w * .35, y + h * .88, x - w * .35, y + h * .88, x - w * .98, y - h * .16);
  g.close(); g.fill();
  stroke(g, P.light, Math.max(1.2, r * .16), .98);
  g.moveTo(x - w * .93, y + h * .02);
  g.bezierCurveTo(x - w * .5, y + h * 1.46, x + w * .5, y + h * 1.46, x + w * .93, y + h * .02); g.stroke();
  stroke(g, P.mint, 1, .75);
  g.moveTo(x - w * .45, y + h * .66); g.lineTo(x + w * .4, y + h * .66); g.stroke();
}

function metalStar(g: Graphics, x: number, y: number, r: number, angle: number, alpha: number, detail = false): void {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const point = (px: number, py: number, first = false): void => {
    const tx = x + (ca * px - sa * py) * r, ty = y + (sa * px + ca * py) * r;
    if (first) g.moveTo(tx, ty); else g.lineTo(tx, ty);
  };
  for (let blade = 0; blade < 4; blade++) {
    const a = blade * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    const p = (px: number, py: number, first = false): void => point(c * px - s * py, s * px + c * py, first);
    fill(g, P.steel, alpha); stroke(g, P.steelInk, Math.max(.8, r * .035), alpha);
    p(.17, -.18, true); p(.73, -.3); p(1, .1); p(.47, -.03); p(.32, .24); p(.08, .2); g.close(); g.fill(); g.stroke();
    fill(g, P.silver, alpha);
    p(.17, -.13, true); p(.72, -.24); p(.96, .08); p(.4, -.04); g.close(); g.fill();
    stroke(g, P.edge, Math.max(.7, r * .018), alpha * .95);
    p(.24, -.14, true); p(.72, -.25); p(.97, .08); g.stroke();
    stroke(g, P.cyan, Math.max(.8, r * .025), alpha * .9);
    p(.34, .16, true); p(.47, -.02); p(.8, .05); g.stroke();
    if (detail) {
      fill(g, P.steelInk, alpha * .55);
      p(.39, -.1, true); p(.48, -.13); p(.43, -.03); g.close(); g.fill();
    }
  }
  fill(g, P.steelInk, alpha); g.circle(x, y, r * .2); g.fill();
  stroke(g, P.cyan, Math.max(.8, r * .025), alpha); g.circle(x, y, r * .145); g.stroke();
  stroke(g, P.edge, Math.max(.65, r * .015), alpha * .8); arc(g, x, y, r * .21, r * .21, angle, Math.PI * .8, 8);
}

export function drawShuriken(g: Graphics, x: number, y: number, vx: number, vy: number, size: number, age: number): void {
  const r = Math.max(3, size) * 1.7, angle = age * 19 + Math.atan2(vy, vx);
  const speed = Math.hypot(vx, vy), dx = speed > 0 ? vx / speed : 0, dy = speed > 0 ? vy / speed : 0;
  // Straight motion has a short directional wake; embedded metal uses metalStar directly and stays still.
  if (speed > 0) for (const side of [-1, 1]) {
    stroke(g, P.cyan, 1.2, .27);
    g.moveTo(x - dx * r * .8 - dy * r * .27 * side, y - dy * r * .8 + dx * r * .27 * side);
    g.lineTo(x - dx * r * 2.8 - dy * r * .14 * side, y - dy * r * 2.8 + dx * r * .14 * side); g.stroke();
  }
  stroke(g, P.cyan, Math.max(1, size * .2), .36);
  arc(g, x, y, r * 1.14, r * 1.14, angle - 1.6, 1.4, 10);
  metalStar(g, x, y, r, angle, 1);
}

export type WindNinjaAreaKind = 'eye' | 'tornado' | 'spiral';
export interface WindNinjaAreaView {
  kind: WindNinjaAreaKind; x: number; y: number; radius: number; age: number; duration: number;
}
function opacity(area: WindNinjaAreaView): number {
  return Math.max(0, Math.min(1, (area.duration - area.age) / .22)) * Math.min(1, area.age / .13 + .15);
}
function footprint(g: Graphics, a: WindNinjaAreaView, alpha: number): void {
  stroke(g, a.kind === 'spiral' ? P.blue : P.deep, 2, alpha * .35);
  arc(g, a.x, a.y, a.radius, a.radius, 0, TAU, 36);
  for (let i = 0; i < 4; i++) {
    stroke(g, a.kind === 'spiral' ? P.cyan : P.mint, 1.5, alpha * .65);
    arc(g, a.x, a.y, a.radius * .985, a.radius * .985, i * TAU / 4 + a.age * .45, .3, 5);
  }
}
function drawEye(g: Graphics, a: WindNinjaAreaView, alpha: number): void {
  footprint(g, a, alpha);
  for (let i = 0; i < 5; i++) {
    const r = a.radius * (.19 + i * .156), phase = a.age * (1.8 + i * .16) + i * 1.9;
    ribbon(g, a.x, a.y, r, r * .96, phase, 4.1, 9 + i * 1.3, P.deep, alpha * .48);
    ribbon(g, a.x, a.y, r, r * .96, phase + .08, 3.5, 5 + i, P.teal, alpha * .85);
    stroke(g, P.mint, 1.2 + i * .1, alpha * .83);
    arc(g, a.x, a.y, r + 3, r * .96 + 3, phase + .4, 1.65, 14);
  }
  for (let i = 0; i < 10; i++) {
    const progress = (a.age * .27 + i * .137) % 1, r = a.radius * (1 - progress) * .94;
    const theta = i * 2.4 + a.age * 2.8 + progress * 2;
    leaf(g, a.x + Math.cos(theta) * r, a.y + Math.sin(theta) * r,
      2.5 + i % 3, theta + .5, alpha * Math.sin(progress * Math.PI) * .88, i % 3 === 0);
  }
  stroke(g, P.light, 2.1, alpha * .8);
  arc(g, a.x, a.y, a.radius * .11, a.radius * .1, -a.age * 3, 4.4, 14);
}
function drawTornado(g: Graphics, a: WindNinjaAreaView, alpha: number): void {
  footprint(g, a, alpha);
  // Six widening bands build a readable funnel; no opaque carrier rectangle or filled disk.
  for (let i = 5; i >= 0; i--) {
    const t = i / 5, r = a.radius * (.24 + t * .66), cy = a.y + a.radius * (-.64 + t * 1.22);
    const phase = a.age * (3.8 - t * .8) + i * .9;
    ribbon(g, a.x, cy, r, r * .31, phase, TAU * .83, 10 + t * 8, P.deep, alpha * .72);
    ribbon(g, a.x, cy + 2, r, r * .31, phase + .06, TAU * .67, 6 + t * 6, P.teal, alpha * .92);
    stroke(g, P.mint, 2.2, alpha * .9);
    arc(g, a.x, cy + 3, r, r * .31, phase + .4, 2.4, 14);
    stroke(g, P.light, 1, alpha * .7);
    arc(g, a.x, cy + 5, r, r * .31, phase + .6, .95, 8);
  }
  for (let i = 0; i < 12; i++) {
    const t = (a.age * .42 + i * .0833) % 1, theta = a.age * 4.7 + i * 2.4;
    const r = a.radius * (.24 + t * .7);
    leaf(g, a.x + Math.cos(theta) * r, a.y - a.radius * .68 + t * a.radius * 1.45 + Math.sin(theta) * r * .28,
      2 + i % 3, theta + .6, alpha * Math.sin(t * Math.PI), i % 3 === 0);
  }
}
function drawSpiral(g: Graphics, a: WindNinjaAreaView, alpha: number): void {
  footprint(g, a, alpha);
  const angle = a.age * 6.8;
  for (let arm = 0; arm < 3; arm++) {
    stroke(g, P.cyan, 3.2, alpha * .45);
    for (let i = 0; i <= 26; i++) {
      const t = i / 26, theta = angle - t * 4.8 + arm * TAU / 3, r = a.radius * (.13 + t * .82);
      const x = a.x + Math.cos(theta) * r, y = a.y + Math.sin(theta) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  metalStar(g, a.x, a.y, a.radius * .86, -angle, alpha * .86, true);
  for (let i = 0; i < 4; i++) {
    const phase = -angle + i * Math.PI / 2;
    stroke(g, P.edge, 1.4, alpha * .8);
    arc(g, a.x, a.y, a.radius * .91, a.radius * .91, phase + .1, .55, 7);
  }
}

interface Accent { x: number; y: number; dx: number; dy: number; kind: 'wind' | 'shuriken'; age: number; }
/** One batched Graphics node per hero; caps prevent pathological card/GM overdraw. */
export class WindNinjaVFX {
  private readonly root = new Node('WindNinjaVFX');
  private readonly g: Graphics;
  private accents: Accent[] = [];
  private areas = 0;
  private marks = 0;
  constructor(parent: Node) {
    this.root.layer = Layers.Enum.UI_2D; this.root.setParent(parent);
    this.g = this.root.addComponent(Graphics);
  }
  release(x: number, y: number, dx: number, dy: number, kind: 'wind' | 'shuriken'): void {
    if (this.accents.length >= 24) this.accents.shift();
    this.accents.push({ x, y, dx, dy, kind, age: 0 });
  }
  tick(dt: number): void {
    for (let i = this.accents.length - 1; i >= 0; i--) {
      this.accents[i].age += dt;
      if (this.accents[i].age >= .22) this.accents.splice(i, 1);
    }
  }
  begin(): void { this.g.clear(); this.areas = this.marks = 0; }
  area(area: WindNinjaAreaView): void {
    if (++this.areas > 8) return;
    const alpha = opacity(area);
    if (area.kind === 'eye') drawEye(this.g, area, alpha);
    else if (area.kind === 'tornado') drawTornado(this.g, area, alpha);
    else drawSpiral(this.g, area, alpha);
  }
  mark(x: number, y: number, phase: number, queued = false): void {
    if (++this.marks > 80) return;
    metalStar(this.g, x, y, queued ? 6.8 : 5.8, phase, queued ? .72 : .96);
    if (queued) {
      stroke(this.g, P.cyan, 1, .65); arc(this.g, x, y, 9, 9, phase, 4.2, 12);
    }
  }
  end(): void {
    for (const a of this.accents) {
      const alpha = 1 - a.age / .22, r = 7 + a.age * 70;
      stroke(this.g, a.kind === 'wind' ? P.mint : P.cyan, 2 * alpha + .6, alpha * .8);
      arc(this.g, a.x, a.y, r, r * .6, Math.atan2(a.dy, a.dx) - 1.5, 2.4, 12);
      if (a.kind === 'wind') leaf(this.g, a.x + a.dx * r, a.y + a.dy * r, 3, a.age * 10, alpha, false);
    }
  }
  destroy(): void { this.accents.length = 0; if (this.root.isValid) this.root.destroy(); }
}
