/** Shared shop/hero detail geometry. Text, inventory and actions remain owned by each page. */
import { Graphics, Label, Mask, Node, ScrollView, UITransform } from 'cc';
import { LO } from '../config/GameConfig';
import { C, CA, N } from './UIKit';
import { COMIC, comicDialog } from './ComicUI';
import { mainLabel } from './PageKit';
import { lobbyAttributeWell, paintShopModal, shopDetailRule, shopSectionEmblem } from './LobbyChrome';

export const DETAIL_WIDTH = 620;
export const DETAIL_ACTION_FOOTER = 118;
export type DetailRow = readonly [string, string];

function metrics(width: number) {
  const compact = width < 400;
  return { compact, bodyW: width-68, headerH: compact?326:304, step: compact?34:38 };
}

export function detailHeight(contentH: number, footerH = DETAIL_ACTION_FOOTER,
  minimum = 640, width = DETAIL_WIDTH): number {
  return Math.min(1120,Math.max(minimum,metrics(width).headerH+contentH+footerH),
    LO.half*2-LO.notchTop*2-48);
}

/** The exact paper, inset ribbon, caption and outline used by product details. */
export function detailSkin(panel: Node, width: number, height: number, title: string): void {
  paintShopModal(panel,width,height);
  const caption = panel.children.find(child => !!child.getComponent(Label))
    || mainLabel(panel,0,height/2-36,title,{font:'body',bold:true});
  caption.setPosition(0,height/2-36,0);
  caption.getComponent(UITransform)!.setContentSize(width-140,42);
  const label = caption.getComponent(Label)!;
  label.string = title; label.fontSize = width<400?23:32; label.lineHeight = 40;
  label.isBold = true; label.color = C(COMIC.cream);
  label.enableOutline = true; label.outlineColor = C('#152736'); label.outlineWidth = 1.2;
}

export function detailDialog(parent: Node, width: number, height: number, title: string, name: string): Node {
  const panel = comicDialog(parent,width,height,title);
  panel.name = name; detailSkin(panel,width,height,title);
  return panel;
}

/** One showcase layout for both pages; narrow comparison cards use a stacked variant. */
export function detailOverview(panel: Node, name: string, meta: string, users: string | undefined,
  description: string, drawArt: (parent: Node, x: number, y: number, side: number) => void): void {
  const { width, height } = panel.getComponent(UITransform)!;
  const { compact, bodyW, headerH } = metrics(width), top = height/2;
  drawArt(panel,compact?0:-192,top-(compact?145:180),compact?112:168);
  mainLabel(panel,compact?0:84,top-(compact?223:121),name,{size:compact?23:34,font:'body',
    color:'#172D3B',bold:true,align:compact?'center':'left',w:compact?bodyW+24:336,h:compact?34:46});
  mainLabel(panel,compact?0:84,top-(compact?257:159),meta,{size:compact?16:19,font:'body',
    color:COMIC.sub,bold:true,align:compact?'center':'left',w:compact?bodyW+24:336,h:28});
  if (users) {
    const badgeW = compact?bodyW+4:328;
    const badge = N('detailUsers',panel,compact?0:80,top-(compact?290:194),badgeW,28);
    const g = badge.addComponent(Graphics);
    g.fillColor = CA('#CEAA61',.2); g.roundRect(-badgeW/2,-14,badgeW,28,5); g.fill();
    mainLabel(badge,0,0,users,{size:compact?15:19,font:'body',color:'#796540',bold:true,
      align:compact?'center':'left',w:badgeW-18,h:26});
  }
  if (!compact && description) mainLabel(panel,84,top-(users?239:222),description,
    {size:19,font:'body',color:'#635744',align:'left',w:336,h:users?62:94,lineHeight:25});
  detailRule(panel,top-headerH+20,width);
}

/** Independent body viewport keeps every footer below the last content row on shorter screens. */
export function detailBody(panel: Node, contentH: number, footerH: number, name = 'detail'): Node {
  const { width, height } = panel.getComponent(UITransform)!;
  const { headerH, bodyW } = metrics(width), bodyH = Math.max(1,height-headerH-footerH);
  const view = N(name+'InfoView',panel,0,height/2-headerH-bodyH/2,bodyW,bodyH);
  view.addComponent(Mask);
  const scroll = view.addComponent(ScrollView);
  const content = N(name+'InfoContent',view,0,bodyH/2,bodyW,Math.max(bodyH,contentH));
  content.getComponent(UITransform)!.setAnchorPoint(.5,1);
  scroll.content = content; scroll.horizontal = false; scroll.vertical = contentH>bodyH;
  return content;
}

export function detailSection(parent: Node, cursor: number, title: string, width = DETAIL_WIDTH): number {
  const { compact, bodyW } = metrics(width);
  shopSectionEmblem(parent,-bodyW/2+15,-cursor-15);
  mainLabel(parent,15,-cursor-15,title,{size:compact?20:25,font:'body',color:'#1D303E',bold:true,
    align:'left',w:bodyW-36,h:32});
  return cursor+38;
}

export function detailGroupHeight(rows: number, width = DETAIL_WIDTH): number {
  return 38+rows*metrics(width).step+12+14;
}

/** A single near-white well per group, never separate row backplates. */
export function detailGroup(parent: Node, cursor: number, title: string, rows: readonly DetailRow[],
  width = DETAIL_WIDTH): number {
  cursor = detailSection(parent,cursor,title,width);
  const { compact, bodyW, step } = metrics(width), height = rows.length*step+12;
  const well = lobbyAttributeWell(parent,0,-cursor-height/2,bodyW,height,'detailAttributeGroup');
  rows.forEach(([name,value],i) => {
    const y = height/2-6-step/2-i*step;
    const prose = !compact && name.length<=4 && value.length>10;
    mainLabel(well,prose?-193:-bodyW*.19,y,name,{size:compact?15:19,font:'body',color:'#74664F',align:'left',
      w:compact?bodyW*.59:prose?116:292,h:30});
    mainLabel(well,prose?64:bodyW*.297,y,value,{size:compact?17:prose?19:23,font:/^[+\d.% /]+$/.test(value)?'number':'body',
      color:value.startsWith('+')||value.includes('→')?'#33772F':'#243746',bold:true,align:'right',
      w:compact?bodyW*.36:prose?380:180,h:32});
  });
  return cursor+height+14;
}

export function detailParagraph(parent: Node, cursor: number, title: string, text: string,
  height: number, width = DETAIL_WIDTH, white = false): number {
  cursor = detailSection(parent,cursor,title,width);
  const bodyW = metrics(width).bodyW;
  if (white) lobbyAttributeWell(parent,0,-cursor-height/2,bodyW,height,'detailTextGroup');
  mainLabel(parent,0,-cursor-height/2,text,{size:18,font:'body',color:'#74664F',align:'left',
    w:bodyW-22,h:height-(white?16:0),lineHeight:25});
  return cursor+height+8;
}

export function detailRule(parent: Node, y: number, width = DETAIL_WIDTH): void {
  shopDetailRule(parent,y,metrics(width).bodyW);
}

export function detailFooter(panel: Node, footerH = DETAIL_ACTION_FOOTER): void {
  const { width, height } = panel.getComponent(UITransform)!;
  detailRule(panel,-height/2+footerH-13,width);
}

/** Original 58-high single-face actions keep 30 units of paper under their lower edge. */
export function detailActionY(panel: Node): number { return -panel.getComponent(UITransform)!.height/2+59; }
