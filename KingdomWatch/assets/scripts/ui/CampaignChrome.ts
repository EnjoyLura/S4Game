/** Campaign materials with live text over a painted chapter backplate. */
import { Color, Graphics, Node, Sprite, UITransform, UIOpacity } from 'cc';
import { C, CA, N } from './UIKit';
import { COMIC, comicMark } from './ComicUI';
import { artSprite } from './Ux';

type Point = readonly [number, number];
export const CAMPAIGN_TEXT = { ink:'#192C37', body:'#2D302F', secondary:'#555248', heading:'#4A3E2B' } as const;
function face(g: Graphics, points: readonly Point[], fill: string, edge?: string, width = 2): void {
  g.fillColor = C(fill); g.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(p => g.lineTo(p[0], p[1])); g.close(); g.fill();
  if (edge) { g.strokeColor = C(edge); g.lineWidth = width; g.stroke(); }
}
function cut(w: number, h: number, c: number): Point[] {
  return [[-w/2+c,-h/2],[w/2-c,-h/2],[w/2,-h/2+c],[w/2,h/2-c],
    [w/2-c,h/2],[-w/2+c,h/2],[-w/2,h/2-c],[-w/2,-h/2+c]];
}
function line(g: Graphics, points: readonly Point[], color: string, width = 2): void {
  g.strokeColor = C(color); g.lineWidth = width; g.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(p => g.lineTo(p[0], p[1])); g.stroke();
}

/** Small color steps follow the cut silhouette, keeping light continuous across the button face. */
function smoothCutFace(g: Graphics, w: number, h: number, corner: number, top: string, bottom: string): void {
  const light = C(top), dark = C(bottom), steps = Math.ceil(h*1.5), stepH = h/steps;
  const edgeX = (y: number): number => w/2-Math.max(0,Math.abs(y)-(h/2-corner));
  for (let i = 0; i < steps; i++) {
    const y1 = h/2-i*stepH, y0 = h/2-(i+1)*stepH;
    g.fillColor = Color.lerp(new Color(),light,dark,i/(steps-1));
    g.moveTo(-edgeX(y0),y0); g.lineTo(edgeX(y0),y0); g.lineTo(edgeX(y1),y1); g.lineTo(-edgeX(y1),y1);
    g.close(); g.fill();
  }
}

/** The short forest extension belongs to the scrolling terrain, behind the floating controls. */
export function campaignTerrainCrown(parent: Node, height: number, chapter: number): void {
  if (height <= 0) return;
  const g = N('campaignScrollingCanopy', parent).addComponent(Graphics);
  const palettes = [['#638B55','#3E6944','#1C4A3D'], ['#456D50','#294E3D','#153E32'], ['#665F48','#454B3D','#293E34'],
    ['#627A4D','#405D43','#294C3D'], ['#6DA3A5','#4D848E','#315C72'], ['#D8B174','#B98B53','#95673D'],
    ['#BEA97A','#928363','#6D6B56'], ['#B77957','#945239','#683D30'], ['#74674F','#514A40','#393D39'],
    ['#C5DCE1','#94B7CA','#5B7E9B'], ['#8898A0','#5C7381','#394E66'], ['#58456E','#3C3559','#252B45'],
    ['#646C75','#404B59','#283747'], ['#747365','#505451','#333F43'], ['#7B4C35','#53362C','#352B2B'],
    ['#6F6483','#49425F','#302E48']];
  const colors = palettes[chapter] || palettes[0];
  g.fillColor = C(colors[0]); g.rect(-375, -height - 16, 750, height + 16); g.fill();
  if (chapter >= 3) {
    // Later biomes use a quiet terrain ridge rather than a green forest canopy.
    for (let layer = 0; layer < 2; layer++) {
      g.fillColor = C(colors[layer + 1]); g.moveTo(-375,-height-16);
      for (let i=0;i<=14;i++) g.lineTo(-390+i*58,-height*.28-((i*7+layer*3)%5)*height*.07-layer*height*.12);
      g.lineTo(420,-height-16);g.close();g.fill();
    }
    return;
  }
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < 13; i++) {
      const x = -400 + i * 68 + layer * 29, base = -height - 20 + layer * 22;
      const h = height * (.48 + ((i * 7 + layer * 3) % 5) * .09);
      face(g, [[x-42,base],[x-23,base+h*.34],[x-34,base+h*.34],[x-13,base+h*.68],
        [x-21,base+h*.68],[x,base+h],[x+21,base+h*.68],[x+13,base+h*.68],
        [x+34,base+h*.34],[x+23,base+h*.34],[x+42,base]], colors[layer + 1]);
    }
  }
}

export function campaignChapterPlate(parent: Node, x: number, y: number, w: number, h: number): Node {
  const node = N('campaignChapterHeader', parent, x, y, w, h), g = node.addComponent(Graphics);
  const corner = h/2;
  face(g, cut(w,h,corner), '#122633', '#18252B', 2.6);
  face(g, cut(w-5,h-5,corner-2), '#203746', '#D6AF58', 1.5);
  face(g, [[-w/2+7,0],[-w/2+corner+1,h/2-5],[w/2-corner-1,h/2-5],[w/2-7,0]], '#2D4758');
  line(g, [[-w/2+corner+1,h/2-4],[w/2-corner-1,h/2-4]], '#F8DC94', 1);
  line(g, [[-w/2+corner+1,-h/2+5],[w/2-corner-1,-h/2+5]], '#0E202D', 1.5);
  return node;
}

/** The original RGBA canvas is retained; its imported trim rectangle isolates the plaque. */
export function campaignChapterBanner(parent: Node, x: number, y: number, w: number, h: number): Node {
  const node = campaignChapterPlate(parent, x, y, w, h);
  artSprite(node, 0, 0, w, h, 'campaign_chrome_v1/chapter_banner_v1', {
    sliced: false, fit: false, belowIdx: 0,
    onLoaded: art => { art.getComponent(Sprite)!.trim = true; },
  });
  // Narrow carved rails frame the live chapter text without covering the painted material.
  const trim = N('campaignChapterInlay',node).addComponent(Graphics);
  for (const side of [-1,1]) {
    trim.strokeColor = CA('#CDAA5E',.45); trim.lineWidth = 1;
    trim.moveTo(side*(w/2-79),-h/2+20); trim.lineTo(side*(w/2-79),h/2-20); trim.stroke();
  }
  return node;
}

export function campaignChapterArrow(parent: Node, dir: number, enabled: boolean): void {
  const g = N('campaignCarvedArrow', parent).addComponent(Graphics);
  const dark = enabled ? '#795020' : '#263B46', light = enabled ? '#FFF0BD' : '#82959F';
  face(g, [[dir*13,-2],[-dir*9,21],[-dir*5,0],[-dir*9,-23]], '#11222D', '#11222D', 2);
  face(g, [[dir*12,0],[-dir*8,21],[-dir*4,1],[-dir*8,-21]], enabled ? '#DDB15C' : '#526B78', dark, 1.2);
  face(g, [[dir*11,1],[-dir*7,19],[-dir*3,2]], light);
}

/** Map controls have their own material, leaving shared shop and navigation buttons alone. */
export function paintCampaignMapAction(node: Node, w: number, h: number, tone: 'gold' | 'navy', enabled = true): void {
  const g = node.getComponent(Graphics)!; g.clear();
  const gold = tone === 'gold' && enabled;
  const outer = enabled ? '#A78139' : '#6D7B78', edge = enabled ? '#E9C987' : '#C9D1C4';
  const points = cut(w,h,13);
  g.fillColor = CA('#101F28',.35); g.moveTo(points[0][0],points[0][1]-4);
  points.slice(1).forEach(([x,y]) => g.lineTo(x,y-4)); g.close(); g.fill();
  face(g,points,outer,'#172630',2.4);
  face(g,cut(w-5,h-5,11),gold ? '#EDB53D' : enabled ? '#193548' : '#97A398',edge,1.1);
  smoothCutFace(g,w-11,h-11,8,gold ? '#FFDB6A' : enabled ? '#2D4C5E' : '#B9C2B0',
    gold ? '#F4BC3C' : enabled ? '#203B4E' : '#9CA99D');
  // A narrow bevel carries the depth; broad rectangular light/dark strips are gone.
  line(g,[[-w/2+8,h/2-15],[-w/2+15,h/2-7],[w/2-15,h/2-7],[w/2-8,h/2-15]],gold ? '#FFF0AA' : '#708E9B',1.1);
  line(g,[[-w/2+15,-h/2+5],[w/2-15,-h/2+5]],gold ? '#CC9A31' : '#172E3E',1);
}

/** Near-white paper with a neutral edge, without the former double yellow rim. */
export function campaignPreparationPanel(parent: Node, x: number, y: number, w: number, h: number): Node {
  const node = N('campaignPreparationDrawer',parent,x,y,w,h), g = node.addComponent(Graphics);
  g.fillColor = C('#FFF8E7'); g.strokeColor = C('#EAE5D8'); g.lineWidth = .7;
  g.roundRect(-w/2,-h/2,w,h,24); g.fill(); g.stroke();
  return node;
}

export function campaignChestBackdrop(parent: Node, y: number, compact: boolean): void {
  const g = N('campaignChestColumns',parent,0,y).addComponent(Graphics);
  const h = compact ? 166 : 208;
  for (const x of [-226,0,226]) {
    g.fillColor = CA('#EADDBA',.18); g.roundRect(x-104,-h/2,208,h,15); g.fill();
  }
  for (const x of [-113,113]) {
    g.strokeColor = CA('#A78E58',.22); g.lineWidth = 1;
    g.moveTo(x,-h/2+8); g.lineTo(x,h/2+24); g.stroke();
  }
}

export function paintCampaignRewardCard(node: Node, w: number, h: number): void {
  const g = node.getComponent(Graphics)!; g.clear();
  g.fillColor = C('#FFFCF3'); g.strokeColor = C('#E0D4BA'); g.lineWidth = 1;
  g.roundRect(-w/2,-h/2,w,h,12); g.fill(); g.stroke();
  line(g,[[-w/2+14,h/2-2],[w/2-14,h/2-2]],'#FFFFFF',1.4);
}

export function campaignEquipmentHeading(parent: Node, y: number): void {
  const g = N('campaignEquipmentDivider',parent,0,y).addComponent(Graphics);
  for (const side of [-1,1]) {
    line(g,[[side*95,0],[side*136,0]],'#B7A581',1);
    line(g,[[side*136,0],[side*154,0]],'#D9CEB5',.8);
    face(g,[[side*88,0],[side*84,3.5],[side*80,0],[side*84,-3.5]],'#978561');
  }
}

/** Warm paper with restrained edge light, without boxing every individual field. */
export function campaignPaper(parent: Node, x: number, y: number, w: number, h: number, name: string, radius = 22): Node {
  const node = N(name, parent, x, y, w, h), g = node.addComponent(Graphics);
  const r = Math.min(radius, h/2);
  const top = C('#FFF6E0'), bottom = C('#EEDCBD');
  for (let i = 0; i < 18; i++) {
    const bandH = h / 18, bandY = h/2 - (i+1)*bandH;
    g.fillColor = Color.lerp(new Color(), top, bottom, i/17);
    if (i === 0 || i === 17) g.roundRect(-w/2, bandY, w, bandH + 1, Math.min(r, bandH/2));
    else g.rect(-w/2, bandY, w, bandH + 1);
    g.fill();
  }
  // Cover the square band ends with the same rounded silhouette at the two short ends.
  g.fillColor = C('#FFF6E0'); g.roundRect(-w/2, h/2-r*2, w, r*2, r); g.fill();
  g.fillColor = C('#EEDCBD'); g.roundRect(-w/2, -h/2, w, r*2, r); g.fill();
  g.strokeColor = CA('#FFF9E9', .9); g.lineWidth = 2;
  g.moveTo(-w/2+r, h/2-2); g.lineTo(w/2-r, h/2-2); g.stroke();
  return node;
}

export function paintCampaignAction(node: Node, w: number, h: number, enabled: boolean): void {
  const g = node.getComponent(Graphics)!; g.clear();
  face(g, cut(w,h,12), enabled ? '#BD852A' : '#69736D', COMIC.ink, 2.2);
  face(g, cut(w-6,h-6,10), enabled ? '#F3B638' : '#A2AAA0');
  face(g, [[-w/2+5,1],[w/2-5,1],[w/2-5,h/2-14],[w/2-14,h/2-5],[-w/2+14,h/2-5],[-w/2+5,h/2-14]],
    enabled ? '#FFD764' : '#C4C9BC');
  face(g, [[-w/2+6,-h/2+14],[-w/2+14,-h/2+6],[w/2-14,-h/2+6],[w/2-6,-h/2+14],[w/2-6,-h/2+19],[-w/2+6,-h/2+19]],
    enabled ? '#EAA728' : '#8E998E');
  line(g, [[-w/2+8,h/2-15],[-w/2+15,h/2-7],[w/2-15,h/2-7],[w/2-8,h/2-15]], enabled ? '#FFF0A9' : '#D8DED0', 2);
}

export function campaignDockPaper(parent: Node, x: number, y: number, w: number, h: number): Node {
  const node = N('campaignCurrentStage', parent, x, y, w, h), g = node.addComponent(Graphics);
  g.fillColor = C('#202B36'); g.rect(-w/2,-h/2,w,h); g.fill();
  const paper = campaignPaper(node, 0, 0, w-26, h-14, 'campaignCurrentParchment', 8);
  const art = N('campaignDockCastleWatermark', paper, 4, -7).addComponent(Graphics);
  art.fillColor = CA('#AF9870', .14);
  art.ellipse(0,-28,119,19); art.fill();
  for (const [cx,cy,cw,ch] of [[-55,-13,27,42],[-15,-5,34,65],[27,-17,39,38],[65,-2,29,68]]) {
    art.rect(cx-cw/2,cy-ch/2,cw,ch); art.fill();
    art.moveTo(cx-cw*.66,cy+ch/2); art.lineTo(cx,cy+ch/2+18); art.lineTo(cx+cw*.66,cy+ch/2); art.close(); art.fill();
  }
  return node;
}

/** Shared loading barrier, tight imported sprite rectangle and native UI overlays. */
export function campaignPreparationArt(parent: Node, x: number, y: number, w: number, h: number,
  key: string, stretch = false, behind = false): Node {
  return artSprite(parent, x, y, w, h, 'preparation_art_v2/' + key, {
    sliced: false, fit: !stretch, belowIdx: behind ? 0 : undefined,
    onLoaded: art => {
      const sprite = art.getComponent(Sprite)!; sprite.trim = true;
      if (stretch && sprite.spriteFrame) {
        // Keep the painted bevel proportional while extending only the quiet button center.
        sprite.type = Sprite.Type.SLICED;
        const scale = h / sprite.spriteFrame.rect.height;
        art.setScale(scale, scale, 1);
        art.getComponent(UITransform)!.setContentSize(w / scale, h / scale);
      }
    },
  });
}

export function campaignDifficultyFace(node: Node, w: number, h: number, selected: boolean, open: boolean, difficulty = 0): void {
  const g = node.addComponent(Graphics);
  face(g, cut(w,h,11), selected ? '#DBA22E' : '#EADDBD', selected ? '#9E7836' : undefined, 1.2);
  if (selected) {
    face(g,cut(w-5,h-5,9),'#F9C744','#FBE6A1',1);
    face(g, [[-w/2+5,1],[w/2-5,1],[w/2-5,h/2-12],[w/2-12,h/2-5],[-w/2+12,h/2-5],[-w/2+5,h/2-12]], '#FFE380');
    line(g, [[-w/2+12,h/2-4],[w/2-12,h/2-4]], '#FFF0B1', 1.6);
  }
  const id = ['normal','elite','hell'][difficulty] || 'normal';
  const icon = campaignPreparationArt(node, -65, 0, 40, 40, 'difficulty_' + id + '_v2');
  if (!open) {
    icon.addComponent(UIOpacity).opacity = 105;
    comicMark(node, -48, -13, 'lock', 16, COMIC.sub);
  }
}

/** Three reward tiers share a silhouette, with wood, blue enamel and red enamel lids. */
export function campaignRewardChest(parent: Node, x: number, y: number, w: number, tier: number, opened: boolean): Node {
  const node = N('campaignRewardChest:' + tier, parent, x, y, 118, 102), g = node.addComponent(Graphics);
  const scale = w / 118; node.setScale(scale,scale,1);
  const colors = ['#A46A31','#397DAB','#B54639'], lights = ['#CB9757','#66B0D6','#DF7860'];
  const darks = ['#6C4124','#24536F','#7B302B'];
  const i = Math.max(0,Math.min(2,tier)), trim = '#DCA443', ink = '#4A3324';
  g.fillColor = CA('#655438',.16); g.ellipse(2,-43,50,5); g.fill();
  face(g,[[-46,-5],[28,-5],[28,-44],[-46,-44]], colors[i],ink,2.4);
  face(g,[[28,-5],[48,8],[48,-31],[28,-44]],darks[i],ink,2.2);
  face(g,[[-45,-18],[28,-18],[28,-24],[-45,-24]],trim);
  face(g,[[28,-18],[48,-5],[48,-11],[28,-24]],'#B77D30');
  if (opened) {
    face(g,[[-46,0],[-36,37],[36,42],[28,4]],darks[i],ink,2.4);
    face(g,[[-39,3],[-31,30],[27,34],[22,7]],'#463C2C');
    g.fillColor = C('#FFE19A'); g.ellipse(-3,3,37,8); g.fill();
  } else {
    g.fillColor = C(lights[i]); g.strokeColor = C(ink); g.lineWidth = 2.4;
    g.moveTo(-46,-5); g.lineTo(-46,11); g.bezierCurveTo(-46,43,28,43,28,11);
    g.lineTo(28,-5); g.close(); g.fill(); g.stroke();
    face(g,[[28,-5],[48,8],[48,22],[28,11]],darks[i],ink,2);
    for (const cx of [-32,14]) {
      g.fillColor = C(trim); g.moveTo(cx-5,-5); g.lineTo(cx-5,12);
      g.bezierCurveTo(cx-5,23,cx-2,30,cx+5,32); g.lineTo(cx+9,30);
      g.bezierCurveTo(cx+3,25,cx+3,18,cx+3,11); g.lineTo(cx+3,-5); g.close(); g.fill();
    }
    line(g,[[-43,8],[26,8]],'#805729',1.8);
  }
  for (const cx of [-32,14]) {
    face(g,[[cx-5,-7],[cx+4,-7],[cx+4,-43],[cx-5,-43]],trim,ink,1.3);
    g.fillColor = C('#FFE5A4'); g.circle(cx-1,-33,2); g.fill();
  }
  face(g,[[-47,-6],[29,-6],[29,-12],[-47,-12]],'#E6B755',ink,1.2);
  face(g,[[-15,-13],[1,-13],[1,-29],[-7,-34],[-15,-29]],'#F3CE76',ink,1.8);
  g.fillColor = C('#5C4029'); g.circle(-7,-21,3.4); g.fill(); g.rect(-9,-27,4,6); g.fill();
  return node;
}
