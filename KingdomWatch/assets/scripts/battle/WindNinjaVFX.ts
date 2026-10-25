/** Painted, bounded Graphics geometry. All age/phase values come from the battle clock. */
import { Color, Graphics, Layers, Node } from 'cc';
import { HeroFxShader } from './HeroFxShader';
import { WindVolumeVFX } from './WindVolumeVFX';

export const WIND_NINJA_FX_EFFECT = 'fx/wind-ninja-flow';

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

/** Convex arc midpoint faces the predicted target, aligned to the actual projectile velocity. */
export function drawWindBlade(g: Graphics, x: number, y: number, vx: number, vy: number, size: number, age: number): void {
  const r = Math.max(3,size)*3, angle=Math.atan2(vy,vx), ca=Math.cos(angle),sa=Math.sin(angle);
  const point=(px:number,py:number,first=false):void=>{
    const xx=x+ca*px-sa*py,yy=y+sa*px+ca*py;
    if(first)g.moveTo(xx,yy);else g.lineTo(xx,yy);
  };
  for(let band=0;band<3;band++) {
    const width=band===0?.48:band===1?.30:.075;
    fill(g,band===0?P.teal:band===1?P.mint:P.light,band===0?.22:band===1?.82:.98);
    for(let side=0;side<2;side++)for(let i=0;i<=24;i++) {
      const t=side===0?i/24:1-i/24,theta=(t-.5)*2.65;
      const px=Math.cos(theta)*r-(side?Math.sin(t*Math.PI)*r*width:0);
      point(px,Math.sin(theta)*r,side===0&&i===0);
    }
    g.close();g.fill();
  }
  for(let i=0;i<5;i++) {
    const theta=(i-2)*.42, px=Math.cos(theta)*r*.85, py=Math.sin(theta)*r;
    stroke(g,P.mint,1.6,.35);
    point(px,py,true);point(px-r*(1.25+.22*Math.sin(age*17+i)),py*.85);g.stroke();
  }
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
// A lightweight luminous fallback survives failed material loads; it has no metal facets or range rings.
function drawEye(g: Graphics, a: WindNinjaAreaView, alpha: number): void {
  for (let i = 0; i < 4; i++) {
    const progress = (a.age * .48 + i * .25) % 1;
    const r = a.radius * (.12 + (1-progress) * .79), phase = a.age * 3.3 + i * 2.4;
    ribbon(g, a.x, a.y, r, r * .78, phase, 3.7, 22 * Math.sin(progress*Math.PI), P.teal, alpha * .12);
    ribbon(g, a.x, a.y, r, r * .78, phase, 2.8, 5, P.mint, alpha * .7);
    stroke(g, P.light, 1.5, alpha * .8);
    arc(g,a.x,a.y,r,r*.78,phase+.12,.8,9);
  }
}
function drawTornado(g: Graphics, a: WindNinjaAreaView, alpha: number): void {
  for (let filament=0;filament<5;filament++) {
    const phase=a.age*4.8+filament*TAU/5;
    for (let pass=0;pass<2;pass++) {
      stroke(g,pass?P.light:P.teal,pass?1.5:9,alpha*(pass?.7:.19));
      for(let i=0;i<=28;i++) {
        const t=i/28, r=a.radius*(.08+.73*t), theta=phase-t*6;
        const x=a.x+Math.cos(theta)*r,y=a.y+a.radius*(-.8+2.25*t)+Math.sin(theta)*r*.18;
        if(i===0)g.moveTo(x,y);else g.lineTo(x,y);
      }
      g.stroke();
    }
  }
}
function drawSpiral(g: Graphics, a: WindNinjaAreaView, alpha: number): void {
  for (let arm=0;arm<4;arm++) {
    const angle=a.age*6.6+arm*TAU/4, r=a.radius*.93, ca=Math.cos(angle),sa=Math.sin(angle);
    const point=(x:number,y:number,first=false):void=>{
      const xx=a.x+(ca*x-sa*y)*r,yy=a.y+(sa*x+ca*y)*r;
      if(first)g.moveTo(xx,yy);else g.lineTo(xx,yy);
    };
    fill(g,P.blue,alpha*.8);stroke(g,P.cyan,2.8,alpha*.85);
    point(.12,.06,true);point(.20,.20);point(1,0);point(.20,-.20);point(.06,-.12);g.close();g.fill();g.stroke();
    stroke(g,P.edge,1.2,alpha*.9);point(.24,.18,true);point(.98,0);point(.24,-.18);g.stroke();
  }
}
function flowParticles(g: Graphics, a: WindNinjaAreaView, alpha: number): void {
  if(a.kind==='spiral')return; // Pure energy blades are drawn entirely by the shader.
  for(let i=0;i<12;i++) {
    const t=(a.age*(a.kind==='eye'?.42:.58)+i*.137)%1;
    const theta=a.age*4.2+i*2.39996+t*3;
    const radius=a.radius*(a.kind==='eye'?.97*(1-t):.10+.76*t);
    const x=a.x+Math.cos(theta)*radius;
    const y=a.y+(a.kind==='eye'?Math.sin(theta)*radius*.8:a.radius*(-.78+2.2*t)+Math.sin(theta)*radius*.23);
    leaf(g,x,y,2.2+i%3,theta+.6,alpha*Math.sin(t*Math.PI)*.7,i%4===0);
  }
}

interface Accent { x: number; y: number; dx: number; dy: number; kind: 'wind' | 'shuriken'; age: number; }
/** One batched Graphics node per hero; caps prevent pathological card/GM overdraw. */
export class WindNinjaVFX {
  private readonly root = new Node('WindNinjaVFX');
  private readonly g: Graphics;
  private readonly flow: HeroFxShader;
  private readonly volume: WindVolumeVFX | null;
  private readonly areaShader = new WeakMap<WindNinjaAreaView, 'volume' | 'energy' | 'fallback'>();
  private accents: Accent[] = [];
  private areas = 0;
  private marks = 0;
  constructor(parent: Node, wind = false) {
    this.root.layer = Layers.Enum.UI_2D; this.root.setParent(parent);
    const textLayer = parent.getChildByName('TextLayer');
    if (textLayer) this.root.setSiblingIndex(textLayer.getSiblingIndex());
    this.g = this.root.addComponent(Graphics);
    this.flow = new HeroFxShader(this.root, 'windNinjaEnergy', 8, 'plasma',
      { effect: WIND_NINJA_FX_EFFECT, technique: 0 });
    this.volume = wind ? new WindVolumeVFX(this.root, 8) : null;
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
  begin(): void { this.g.clear(); this.flow.begin(); this.volume?.begin(); this.areas = this.marks = 0; }
  area(area: WindNinjaAreaView): void {
    if (++this.areas > 8) return;
    const alpha = opacity(area);
    if(!this.areaShader.has(area))this.areaShader.set(area,area.kind!=='spiral'&&this.volume?.ready
      ? 'volume' : this.flow.ready ? 'energy' : 'fallback');
    const mode = this.areaShader.get(area);
    if (mode === 'volume') {
      this.volume!.draw(area,alpha);
      flowParticles(this.g,area,alpha);
    } else if (mode === 'energy') {
      const tornado = area.kind === 'tornado';
      this.flow.draw(area.x, area.y+(tornado?area.radius*.35:0), area.radius*(tornado?2.6:2.5),
        area.radius*(tornado?3.3:2.5), 0, area.age, .73, alpha,
        area.kind==='eye'?0:tornado?1:2, area.radius, area.duration);
      flowParticles(this.g,area,alpha);
    } else if (area.kind === 'eye') drawEye(this.g, area, alpha);
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
    this.flow.end();
    this.volume?.end();
    for (const a of this.accents) {
      const alpha = 1 - a.age / .22, r = 7 + a.age * 70;
      stroke(this.g, a.kind === 'wind' ? P.mint : P.cyan, 2 * alpha + .6, alpha * .8);
      arc(this.g, a.x, a.y, r, r * .6, Math.atan2(a.dy, a.dx) - 1.5, 2.4, 12);
      if (a.kind === 'wind') leaf(this.g, a.x + a.dx * r, a.y + a.dy * r, 3, a.age * 10, alpha, false);
    }
  }
  destroy(): void { this.accents.length = 0; if (this.root.isValid) this.root.destroy(); }
}
