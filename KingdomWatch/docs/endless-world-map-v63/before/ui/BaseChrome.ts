/** Settlement-only plaques and codex cards; dialogs share the product detail paper. */
import { Graphics, Node } from 'cc';
import { C, CA, N } from './UIKit';
import { mainLabel } from './PageKit';
import { detailSection } from './DetailDialog';
import { lobbyAttributeWell } from './LobbyChrome';

export const BASE_INK = '#1D3141';
export const BASE_SUB = '#706650';

function face(g: Graphics, w: number, h: number, corner: number, color: string): void {
  const x=w/2, y=h/2, c=Math.min(corner,x,y);
  g.fillColor=C(color);g.moveTo(-x+c,-y);g.lineTo(x-c,-y);g.lineTo(x,-y+c);
  g.lineTo(x,y-c);g.lineTo(x-c,y);g.lineTo(-x+c,y);g.lineTo(-x,y-c);g.lineTo(-x,-y+c);g.close();g.fill();
}

/** Fine nameplate trim never changes the global button or navigation faces. */
export function basePlaque(parent: Node, x: number, y: number, w: number, h: number,
  name: string, gold = false, subdued = false): Node {
  const node=N(name,parent,x,y,w,h), g=node.addComponent(Graphics), c=Math.min(14,h/2);
  face(g,w,h,c,'#263139');
  face(g,w-3,h-3,c-1,subdued?'#9B9278':'#CFAC60');
  face(g,w-6,h-6,c-2,gold?'#FFD25B':'#213847');
  g.strokeColor=CA(gold?'#FFF0B1':'#A6BEC8',subdued ? .22 : .5);g.lineWidth=1;
  g.moveTo(-w/2+c+2,h/2-5);g.lineTo(w/2-c-2,h/2-5);g.stroke();
  return node;
}

export function baseCodexCard(parent: Node, x: number, y: number, w: number, h: number,
  name: string, discovered: boolean): Node {
  const node=N(name,parent,x,y,w,h),g=node.addComponent(Graphics);
  face(g,w,h,12,discovered?'#B68D4A':'#CEC4AC');
  face(g,w-2.4,h-2.4,11,'#FFFEF8');
  g.strokeColor=CA('#FFFFFF',.9);g.lineWidth=1;
  g.moveTo(-w/2+15,h/2-3);g.lineTo(w/2-15,h/2-3);g.stroke();
  return node;
}

export function baseDiscoveryProgress(parent: Node, x: number, y: number, w: number, progress: number): void {
  const g=N('baseDiscoveryProgress',parent,x,y,w,6).addComponent(Graphics);
  g.fillColor=CA('#AA956B',.2);g.roundRect(-w/2,-3,w,6,3);g.fill();
  const fill=Math.max(0,Math.min(1,progress))*w;
  if(fill>0){g.fillColor=C('#C6A15A');g.roundRect(-w/2,-3,fill,6,Math.min(3,fill/2));g.fill();}
}

/** Each reading group is one white well, with no per-line plates. */
export function baseTextGroup(parent: Node, cursor: number, title: string, value: string,
  height: number, width: number, positive = false): number {
  cursor=detailSection(parent,cursor,title,width);
  const bodyW=width-68;
  const well=lobbyAttributeWell(parent,0,-cursor-height/2,bodyW,height,'baseCodexTextWhite');
  mainLabel(well,0,0,value,{font:'body',size:20,color:positive?'#33772F':BASE_SUB,bold:positive,
    align:'left',w:bodyW-36,h:height-20,lineHeight:28});
  return cursor+height+14;
}
