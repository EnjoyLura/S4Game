/** Hero-only layout accents; game text stays native and buttons keep ComicUI feedback. */
import { Graphics, Node, UIOpacity } from 'cc';
import { HERO_DEFS } from '../core/GameData';
import { C, CA, N } from './UIKit';
import { COMIC, comicMark, comicSurface } from './ComicUI';
import { heroPortrait } from './HeroComic';
import { mainLabel } from './PageKit';
import { lobbyAttributeWell, paintLobbyPaper } from './LobbyChrome';
import { detailActionY, detailDialog, detailSkin } from './DetailDialog';

export const HERO_INK = '#1D3141';

export function heroPaper(parent: Node, x: number, y: number, w: number, h: number, name: string): Node {
  const node = N(name,parent,x,y,w,h);
  paintLobbyPaper(node,w,h,true);
  return node;
}

/** Works on the existing modal node so dismissal, backdrop and animations remain intact. */
export const heroModalSkin = detailSkin;

export function heroDialog(parent: Node, w: number, h: number, title: string, name: string): Node {
  return detailDialog(parent,w,h,title,name);
}

/** 30+ units of paper remain under 58-unit actions, including comparison cards. */
export const heroActionY = detailActionY;

export function heroWhiteWell(parent: Node, y: number, w: number, h: number): Node {
  return lobbyAttributeWell(parent,0,y,w,h,'heroAttributeWhite');
}

/** A continuous inventory surface meets the scene/nav without exposed cut-corner triangles. */
export function heroInventoryPaper(parent: Node, y: number, height: number): Node {
  const node = N('heroInventory',parent,0,y,750,height), g = node.addComponent(Graphics);
  g.fillColor = C('#FFF9EC'); g.rect(-375,-height/2,750,height); g.fill();
  g.strokeColor = C('#D9BC83'); g.lineWidth = 2;
  g.moveTo(-375,height/2-1); g.lineTo(375,height/2-1); g.stroke();
  return node;
}

/** Same rail dimensions and portrait art, with a fine outer rim and an uncluttered name capsule. */
export function heroLobbyPortrait(parent: Node, x: number, id: string, active: boolean, owned: boolean, width: number): Node {
  const slot = N('heroLobbyPortrait:'+id,parent,x,0,width,114);
  const rim = N('heroPortraitRim',slot,0,14,94,94).addComponent(Graphics);
  rim.fillColor = CA('#182A38',owned ? .76 : .45); rim.circle(0,0,46); rim.fill();
  rim.strokeColor = C(active?'#C68B30':'#718593'); rim.lineWidth = active?3:1.2; rim.stroke();
  if (active) {
    rim.strokeColor = C('#FFE5A0'); rim.lineWidth = 1.5; rim.circle(0,0,43); rim.stroke();
    comicSurface(slot,0,-40,108,28,'gold',{name:'heroRosterNameTag',radius:14});
  }
  const avatar = heroPortrait(slot,0,14,82,id);
  if (!owned) { avatar.addComponent(UIOpacity).opacity = 125; comicMark(slot,43,-8,'lock',17,COMIC.sub); }
  const def = HERO_DEFS[id];
  mainLabel(slot,0,-39,id==='pyro'?def.name.replace('·',''):def.name.split('·')[0],{
    size:20,font:'body',bold:true,color:active?HERO_INK:owned?COMIC.cream:'#C8C5BA',w:110,h:28,
    outline:active?undefined:COMIC.ink,outlineW:active?0:1.6});
  return slot;
}
