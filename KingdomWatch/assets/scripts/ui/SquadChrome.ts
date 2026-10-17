/** Formation frames reuse existing hall illustrations and native, resolution-independent trim. */
import { Graphics, Node } from 'cc';
import { C, CA, N } from './UIKit';
import { artSprite } from './Ux';

type Point = readonly [number,number];
function outline(w: number, h: number, cut: number): Point[] {
  return [[-w/2+cut,-h/2],[w/2-cut,-h/2],[w/2,-h/2+cut],[w/2,h/2-cut],
    [w/2-cut,h/2],[-w/2+cut,h/2],[-w/2,h/2-cut],[-w/2,-h/2+cut]];
}
function face(g: Graphics, points: readonly Point[], fill: string, edge?: string, width = 1.5): void {
  g.fillColor = C(fill); g.moveTo(points[0][0],points[0][1]);
  points.slice(1).forEach(([x,y]) => g.lineTo(x,y)); g.close(); g.fill();
  if (edge) { g.strokeColor = C(edge); g.lineWidth = width; g.stroke(); }
}

/** Small stepped shoulders carry the metal around each corner rather than a plain diagonal. */
function cardRim(w: number, h: number, c: number): Point[] {
  const l=-w/2, r=w/2, b=-h/2, t=h/2, step=2;
  return [[l+c,b],[r-c,b],[r-c,b+step],[r-step,b+c],[r,b+c],
    [r,t-c],[r-step,t-c],[r-c,t-step],[r-c,t],
    [l+c,t],[l+c,t-step],[l+step,t-c],[l,t-c],
    [l,b+c],[l+step,b+c],[l+c,b+step]];
}

export function paintSquadFrame(node: Node, w: number, h: number, roster = false): void {
  const g = node.getComponent(Graphics)!; g.clear();
  face(g,outline(w,h,14),'#152B3A','#15232B',2.4);
  face(g,outline(w-5,h-5,12),roster ? '#FFF7E5' : '#1B3648','#D5B372',1.5);
  const bottom = roster ? h/2-65 : h/2-64;
  face(g,[[-w/2+4,bottom],[w/2-4,bottom],[w/2-4,h/2-15],[w/2-15,h/2-4],[-w/2+15,h/2-4],[-w/2+4,h/2-15]],'#244254');
  if (roster) {
    g.fillColor = C('#1B3547'); g.rect(-w/2+4,bottom,w-8,26); g.fill();
  }
  g.strokeColor = C('#F3D99D'); g.lineWidth = 1.2;
  g.moveTo(-w/2+16,h/2-5); g.lineTo(w/2-16,h/2-5); g.stroke();
  for (const x of [-1,1]) for (const y of [-1,1]) {
    g.strokeColor = C('#E3C88A'); g.lineWidth = 1.6;
    g.moveTo(x*(w/2-5),y*(h/2-21)); g.lineTo(x*(w/2-5),y*(h/2-14));
    g.lineTo(x*(w/2-14),y*(h/2-5)); g.lineTo(x*(w/2-21),y*(h/2-5)); g.stroke();
  }
}

export function paintSquadCard(node: Node, w: number, h: number, selected: boolean, occupied = true,
  kind: 'position' | 'hero' = 'hero'): void {
  const g = node.getComponent(Graphics)!; g.clear();
  if (!occupied) {
    face(g,outline(w,h,10),'#1C3545','#5F7D8D',1.8);
    face(g,outline(w-5,h-5,8),'#284656','#738D9A',1.2);
    return;
  }
  const position = kind === 'position', gold = selected && !position;
  const outer = position ? '#D5BC84' : gold ? '#96702F' : '#65869D';
  const metal = position ? '#EFE0B6' : gold ? '#E5B34A' : '#ACC4D2';
  const light = position ? '#FFF7DB' : gold ? '#FFE29A' : '#E5EEF0';
  const inner = position ? '#DCC591' : gold ? '#B58734' : '#7899AC';
  const inset = position ? 3.2 : gold ? 5.4 : 4;
  face(g,cardRim(w,h,11),metal,outer,1.4);
  face(g,cardRim(w-3,h-3,9.5),light,light,.9);
  face(g,cardRim(w-inset*2,h-inset*2,7),'#FFFBEF',inner,1.1);
  // The pale center stays continuous below the level and deployment text.
  g.strokeColor = C(position ? '#FFFFFF' : gold ? '#FFF5C9' : '#F4FBFC'); g.lineWidth = 1.2;
  g.moveTo(-w/2+13,h/2-2.5); g.lineTo(w/2-13,h/2-2.5); g.stroke();
  for (const side of [-1,1]) {
    g.strokeColor = C(side<0 ? light : outer); g.lineWidth = position ? 1 : 1.3;
    g.moveTo(side*(w/2-2.5),side<0 ? h/2-15 : -h/2+15);
    g.lineTo(side*(w/2-2.5),side<0 ? h/2-11 : -h/2+11);
    g.lineTo(side*(w/2-11),side<0 ? h/2-2.5 : -h/2+2.5);
    g.lineTo(side*(w/2-15),side<0 ? h/2-2.5 : -h/2+2.5); g.stroke();
  }
}

export function squadPortraitRim(parent: Node, y: number, radius: number, selected: boolean): void {
  const g = N('squadPortraitRim',parent,0,y).addComponent(Graphics);
  g.fillColor = C('#FFF9E5'); g.strokeColor = C(selected ? '#D1AD59' : '#A9BAC3'); g.lineWidth = 1.3;
  g.circle(0,0,radius); g.fill(); g.stroke();
}

export function squadDivider(parent: Node, x: number, y: number, width: number, gold = false): void {
  const g = N('squadPaperDivider',parent,x,y).addComponent(Graphics);
  const side=x<0 ? -1 : 1, radius=gold ? 5.2 : 4.6;
  const center=-side*(width/2-radius-1), start=center+side*(radius+4), end=side*width/2;
  const ink=gold ? '#B47F28' : '#B88E55';
  // Line tapers outwards; the open diamond sits next to the text at the inner end.
  face(g,[[start,-1],[end,0],[start,1]],ink);
  g.strokeColor = C(ink); g.lineWidth = gold ? 1.8 : 1.6;
  g.moveTo(center,radius); g.lineTo(center+radius,0); g.lineTo(center,-radius);
  g.lineTo(center-radius,0); g.close(); g.stroke();
}

/** The lower hall is intentionally visible through the paper, strongest at the floor. */
export function squadHallBackground(parent: Node, height: number, upperY: number, lowerY: number): void {
  const paper = N('squadBackdrop',parent,0,0,750,height+240).addComponent(Graphics);
  paper.fillColor = C('#FFF5DC'); paper.rect(-375,-height/2-120,750,height+240); paper.fill();
  const lowerH = Math.max(1,height-420);
  artSprite(parent,0,lowerY,750,lowerH,'scenes/bg_heroes_comic_v1',{sliced:false,cover:true});
  const veil = N('squadHallPaperVeil',parent,0,lowerY).addComponent(Graphics);
  const bands = 64, bandH = lowerH/bands;
  for (let i = 0; i < bands; i++) {
    const t = i/(bands-1), alpha = t<.68 ? .97-t*.12 : .888-(t-.68)*1.34;
    veil.fillColor = CA('#FFF5DC',alpha); veil.rect(-375,lowerH/2-(i+1)*bandH,750,bandH+.4); veil.fill();
  }
  const scene = N('squadUpperScene',parent,0,upperY,750,440);
  artSprite(scene,0,0,750,440,'scenes/bg_levels_comic_v1',{sliced:false,cover:true});
}

export function squadWatermark(parent: Node, y: number): void {
  const g = N('squadRoyalWatermark',parent,0,y).addComponent(Graphics);
  // One quiet shield and crossed blades keep the large lower paper from feeling empty.
  g.fillColor = CA('#A98C50',.065); g.strokeColor = CA('#A98C50',.10); g.lineWidth = 5;
  g.moveTo(0,112); g.lineTo(88,65); g.lineTo(75,-39);
  g.bezierCurveTo(65,-73,28,-98,0,-114); g.bezierCurveTo(-28,-98,-65,-73,-75,-39);
  g.lineTo(-88,65); g.close(); g.fill(); g.stroke();
  for (const side of [-1,1]) {
    g.fillColor = CA('#A98C50',.07);
    g.moveTo(side*118,108); g.lineTo(side*129,105); g.lineTo(-side*92,-99);
    g.lineTo(-side*105,-87); g.close(); g.fill();
  }
  g.fillColor = CA('#A98C50',.10);
  g.moveTo(0,64); g.bezierCurveTo(-24,40,-21,8,0,-12); g.bezierCurveTo(21,8,24,40,0,64); g.fill();
  for (const side of [-1,1]) {
    g.moveTo(side*4,-1); g.bezierCurveTo(side*20,30,side*60,27,side*46,-6);
    g.bezierCurveTo(side*41,9,side*19,3,side*12,-14); g.close(); g.fill();
  }
  g.roundRect(-24,-23,48,9,3); g.fill();
  g.moveTo(-10,-25); g.lineTo(0,-44); g.lineTo(10,-25); g.close(); g.fill();
}
