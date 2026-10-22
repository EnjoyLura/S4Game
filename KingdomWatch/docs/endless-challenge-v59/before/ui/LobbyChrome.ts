/** Shop cards, product details and shared navigation, drawn once at their actual UI size. */
import { Color, Graphics, Node } from 'cc';
import { C, CA, N } from './UIKit';
import { gearQuality } from './GearQuality';

type Point = readonly [number, number];
function polygon(g: Graphics, points: readonly Point[], fill: Color | string): void {
  g.fillColor = typeof fill === 'string' ? C(fill) : fill;
  g.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
  g.close(); g.fill();
}
function cutRect(w: number, h: number, c: number): Point[] {
  return [[-w/2+c,-h/2],[w/2-c,-h/2],[w/2,-h/2+c],[w/2,h/2-c],
    [w/2-c,h/2],[-w/2+c,h/2],[-w/2,h/2-c],[-w/2,-h/2+c]];
}
function stroke(g: Graphics, points: readonly Point[], color: Color | string, width = 1): void {
  g.strokeColor = typeof color === 'string' ? C(color) : color; g.lineWidth = width;
  g.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
  g.stroke();
}

/** Each gradient band respects the silhouette; no masks, textures or per-frame drawing. */
function gradient(g: Graphics, w: number, h: number, c: number, bottom: string, top: string, round = false): void {
  const lo = C(bottom), hi = C(top), bands = 32;
  const left = (y: number): number => {
    const dy = Math.max(0, Math.abs(y) - (h/2-c));
    return -w/2 + (round ? c-Math.sqrt(Math.max(0,c*c-dy*dy)) : dy);
  };
  for (let i = 0; i < bands; i++) {
    const y0 = -h/2+i*h/bands, y1 = -h/2+(i+1)*h/bands;
    polygon(g, [[left(y0),y0],[-left(y0),y0],[-left(y1),y1],[left(y1),y1]],
      Color.lerp(new Color(),lo,hi,(i+.5)/bands));
  }
}

/** Sparse paper perimeter shared by the shop and hero lobby. */
export function paintLobbyPaper(node: Node, w: number, h: number, white = false): void {
  const g = node.getComponent(Graphics) || node.addComponent(Graphics); g.clear();
  polygon(g,cutRect(w,h,22),'#695331');
  polygon(g,cutRect(w-3,h-3,21),'#C99946');
  polygon(g,cutRect(w-7,h-7,19),'#FFE5A0');
  polygon(g,cutRect(w-12,h-12,17),'#D9B26B');
  gradient(g,w-16,h-16,15,white ? '#FFF6E4' : '#F4E4BF',white ? '#FFFCF3' : '#FFF4D9');
  stroke(g,[[-w/2+10,-h/2+25],[-w/2+10,h/2-25],[-w/2+25,h/2-10],
    [w/2-25,h/2-10],[w/2-10,h/2-25]],CA('#FFFCEB',.85),1.3);
  // Sparse paper folds stay at the perimeter, clear of the product and all reading columns.
  for (const dir of [-1,1]) {
    const x = dir*(w/2-18);
    for (let i = 0; i < 4; i++) {
      const y = -h/2+100+i*74;
      stroke(g,[[x,y-24],[x-dir*11,y-12],[x,y]],CA('#D6B77F',.11),1.5);
    }
  }
}

/** Gold belongs to the paper frame; action buttons keep the original single face. */
export function paintLobbyModal(node: Node, w: number, h: number,
  opts: { white?: boolean; headerName?: string; headerWidth?: number } = {}): void {
  paintLobbyPaper(node,w,h,opts.white);
  const header = N(opts.headerName || 'shopProductTitleBar',node,0,h/2-37,500,72), hg = header.addComponent(Graphics);
  header.setScale((opts.headerWidth ?? Math.min(500,w-120))/500,1,1);
  header.setSiblingIndex(0);
  const banner = (width: number, height: number, fill: string): void => {
    const a = width/2, b = height/2;
    hg.fillColor = C(fill); hg.moveTo(-a,b); hg.lineTo(a,b);
    hg.bezierCurveTo(a-2,b-13,a-8,b-20,a-22,b-23);
    hg.bezierCurveTo(a-10,b-36,a-31,-b,a-54,-b);
    hg.lineTo(-a+54,-b);
    hg.bezierCurveTo(-a+31,-b,-a+10,b-36,-a+22,b-23);
    hg.bezierCurveTo(-a+8,b-20,-a+2,b-13,-a,b); hg.close(); hg.fill();
  };
  banner(500,72,'#9C7537'); banner(495,67,'#F6D18A'); banner(487,59,'#1D3141');
  polygon(hg,[[-237,28],[237,28],[221,12],[-221,12]],CA('#6D8E9E',.15));
  stroke(hg,[[-192,-28],[192,-28]],CA('#A0BECA',.2));
  for (const y of [-36,36]) {
    polygon(hg,[[0,y+8],[8,y],[0,y-8],[-8,y]],'#A87D39');
    polygon(hg,[[0,y+5],[5,y],[0,y-5],[-5,y]],'#FFDF90');
  }
}

export function paintShopModal(node: Node, w: number, h: number): void {
  paintLobbyModal(node,w,h);
}

/** A small fleur emblem gives each heading a shared visual anchor without another title plate. */
export function shopSectionEmblem(parent: Node, x: number, y: number): void {
  const g = N('shopSectionEmblem',parent,x,y,28,30).addComponent(Graphics);
  polygon(g,[[0,14],[6,5],[3,-3],[-3,-3],[-6,5]],'#9B6B29');
  polygon(g,[[0,11],[3,5],[0,-1],[-3,5]],'#F4CB69');
  for (const dir of [-1,1]) {
    polygon(g,[[dir*2,-2],[dir*7,8],[dir*13,2],[dir*11,-5],[dir*6,-4],[dir*3,-9]],'#9B6B29');
    polygon(g,[[dir*4,-2],[dir*8,5],[dir*10,1],[dir*8,-2]],'#EABD59');
  }
  polygon(g,[[-4,-4],[4,-4],[5,-8],[0,-13],[-5,-8]],'#B18A42');
}

/** Near-white throughout, including the lower edge; no yellow or transparent row strips. */
export function lobbyAttributeWell(parent: Node, x: number, y: number, w: number, h: number,
  name = 'lobbyAttributeWhite'): Node {
  const node = N(name,parent,x,y,w,h), g = node.addComponent(Graphics);
  gradient(g,w,h,Math.min(12,h/2),'#FFFCF6','#FFFFFF',true);
  return node;
}

export function shopDetailRule(parent: Node, y: number, width = 552): void {
  const g = N('shopDetailRule',parent,0,y,width,14).addComponent(Graphics);
  for (const dir of [-1,1]) {
    const edge = width/2-4;
    stroke(g,[[dir*11,0],[dir*(edge-2),0]],'#AC7F37',1.8);
    polygon(g,[[dir*edge,2.5],[dir*(edge+2.5),0],[dir*edge,-2.5],[dir*(edge-2.5),0]],'#AC7F37');
  }
  polygon(g,[[0,7],[6,0],[0,-7],[-6,0]],'#B58A40');
}

/** Navy strip with a quiet top edge and short separators between actual touch slots. */
export function paintLobbyStrip(node: Node, w: number, h: number, separators: readonly number[]): void {
  const g = node.getComponent(Graphics) || node.addComponent(Graphics); g.clear();
  gradient(g,w,h,0,'#192633','#2C4050');
  stroke(g,[[-w/2,h/2-1],[w/2,h/2-1]],CA('#BDCFD9',.24));
  stroke(g,[[-w/2,-h/2+1],[w/2,-h/2+1]],CA('#101D28',.5));
  for (const x of separators) {
    const extent = h*.35;
    stroke(g,[[x,-extent],[x,extent]],CA('#C7D7DF',.22),1.2);
    stroke(g,[[x,-extent*.62],[x,extent*.62]],CA('#C7D7DF',.10),1.2);
  }
}

/** Neutral warm card, with a soft tonal face and just two faint paper corner folds. */
export function shopProductCard(parent: Node, x: number, y: number, w: number, h: number, name: string): Node {
  const node = N(name,parent,x,y,w,h), g = node.addComponent(Graphics);
  gradient(g,w,h,16,'#FAEDD0','#FFF8E6',true);
  stroke(g,[[-w/2+17,h/2-3],[w/2-17,h/2-3]],CA('#FFFFFF',.7),1.3);
  for (const dir of [-1,1]) {
    const px = dir*(w/2-7), py = h/2-9;
    stroke(g,[[px,py-18],[px,py-6],[px-dir*6,py],[px-dir*19,py]],CA('#D7BB81',.22));
    polygon(g,[[px-dir*3,py-4],[px-dir*13,py-4],[px-dir*3,py-14]],CA('#E3CB96',.17));
  }
  return node;
}

/** Full-size rarity socket matching the shop concept; native text remains outside the artwork. */
export function shopQualitySocket(parent: Node, x: number, y: number, side: number, quality: number): Node {
  const style = gearQuality(quality), node = N('shopQualitySocket',parent,x,y,side,side), g = node.addComponent(Graphics);
  const c = Math.max(5,side*.045), edge = C(style.edge), light = C(style.light);
  const deep = ['#3D4B53','#164820','#133B61','#3D1B62'][quality] || '#3D4B53';
  polygon(g,cutRect(side,side,c),'#263329');
  polygon(g,cutRect(side-3,side-3,c-1),edge);
  polygon(g,cutRect(side-7,side-7,c-2),Color.lerp(new Color(),edge,light,.65));
  gradient(g,side-12,side-12,c-3,deep,style.edge);
  const a = side/2;
  stroke(g,[[-a+4,a-c],[-a+c,a-4],[a-c,a-4]],style.light,1.2);
  stroke(g,[[a-4,a-c],[a-4,-a+c],[a-c,-a+4],[-a+c,-a+4]],CA(deep,.85),1.5);
  polygon(g,[[-a+10,a-11],[-a+25,a-11],[-a+10,a-26]],CA(style.light,.23));
  return node;
}
