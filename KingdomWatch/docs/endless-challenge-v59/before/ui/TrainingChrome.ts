/** Cultivation-only frames; shared paper and white wells match product/hero details. */
import { Graphics, Node } from 'cc';
import { C, CA, N } from './UIKit';
import { mainLabel } from './PageKit';
import { lobbyAttributeWell, paintLobbyModal, paintLobbyPaper, shopDetailRule } from './LobbyChrome';

export const TRAINING_INK = '#1D3141';
export const TRAINING_SUB = '#706650';
export interface TrainingComparisonRow { name: string; cur: string; next: string; gain: string; }

export function trainingPaper(parent: Node, x: number, y: number, w: number, h: number,
  name: string, title?: string): Node {
  const node = N(name,parent,x,y,w,h);
  if (title) {
    paintLobbyModal(node,w,h,{white:true,headerName:'trainingPanelTitle',headerWidth:w-32});
    mainLabel(node,0,h/2-36,title,{size:w<400?25:27,font:'body',bold:true,color:'#FFF4DD',w:w-72,h:40});
  } else paintLobbyPaper(node,w,h,true);
  return node;
}

export function trainingRule(parent: Node, y: number, width = 690): void {
  shopDetailRule(parent,y,width);
}

/** Thin cut-corner cards have a pale face; only the next milestone uses a gold fill. */
export function trainingCard(parent: Node, x: number, y: number, w: number, h: number,
  name: string, selected: boolean, goldFill = false): Node {
  const node = N(name,parent,x,y,w,h), g = node.addComponent(Graphics);
  const shape = (inset: number, fill: string): void => {
    const a=w/2-inset, b=h/2-inset, c=Math.max(3,10-inset/2);
    g.fillColor=C(fill);g.moveTo(-a+c,-b);g.lineTo(a-c,-b);g.lineTo(a,-b+c);
    g.lineTo(a,b-c);g.lineTo(a-c,b);g.lineTo(-a+c,b);g.lineTo(-a,b-c);g.lineTo(-a,-b+c);g.close();g.fill();
  };
  shape(0,selected?'#C28A2E':'#CDBB97');
  shape(selected?2:1.2,selected?'#FFE8A6':'#FFFEF8');
  shape(selected?4:2.4,goldFill?'#FFE5A0':'#FFFBF0');
  g.strokeColor=CA('#FFFFFF',.9);g.lineWidth=1.2;
  g.moveTo(-w/2+12,h/2-3);g.lineTo(w/2-12,h/2-3);g.stroke();
  return node;
}

/** One continuous white group and fixed comparison columns, shared by pages and forge dialogs. */
export function trainingComparison(parent: Node, y: number, width: number, rows: TrainingComparisonRow[],
  maxed = false): number {
  const step=44, height=rows.length*step+16;
  const well=lobbyAttributeWell(parent,0,y-height/2,width,height,'trainingComparisonWhite');
  rows.forEach((row,i) => {
    const cy=height/2-8-step/2-i*step;
    mainLabel(well,-width*.30,cy,row.name,{font:'body',size:20,color:TRAINING_SUB,align:'left',w:width*.34,h:32});
    mainLabel(well,width*.105,cy,row.cur+'  →  '+row.next,{font:'number',size:23,bold:true,color:TRAINING_INK,w:width*.40,h:32});
    mainLabel(well,width*.397,cy,maxed?'MAX':row.gain,{font:'number',size:22,bold:true,color:'#33772F',align:'right',w:width*.17,h:32});
  });
  return height;
}
