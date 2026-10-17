/** Rarity is confined to the illustration's circular well and upper-left tag. */
import { Graphics, Node } from 'cc';
import { C, CA, label, N } from './UIKit';
import { comicPlate } from './ComicUI';

export interface GearQualityStyle { name: string; edge: string; text: string; well: string; light: string; }
const STYLES: readonly GearQualityStyle[] = [
  { name: '普通', edge: '#85949C', text: '#455761', well: '#E9EDEB', light: '#D6DFDF' },
  { name: '优秀', edge: '#459C32', text: '#286A24', well: '#DCECC3', light: '#B1DF7B' },
  { name: '稀有', edge: '#278CD7', text: '#205E9C', well: '#D3EAF9', light: '#8CD6FF' },
  { name: '史诗', edge: '#A04DD1', text: '#7631A1', well: '#EBDDFA', light: '#D6A4F2' },
];
export function gearQuality(q: number): GearQualityStyle { return STYLES[q] || STYLES[0]; }

/** All equipment uses the same neutral paper face and ink contour. */
export function gearPlate(parent: Node, x: number, y: number, w: number, h: number, q: number,
  opts: { name?: string; cut?: number } = {}): Node {
  return comicPlate(parent, x, y, w, h, 'card', { name: opts.name || 'gearItemPlate', cut: opts.cut ?? 8 });
}

export function gearQualityTag(parent: Node, x: number, y: number, q: number, tier: number,
  w = 96, h = 26): Node {
  const style = gearQuality(q);
  const plate = comicPlate(parent, x, y, w, h, 'dark', { name: 'gearQualityTag', cut: 5, fill: style.edge });
  const text = w < 55 ? style.name : w < 90 ? style.name + tier + '阶' : style.name + ' · ' + tier + '阶';
  label(plate, 0, 0, text, { size: Math.min(15, h * .62), color: '#FFFFFF', bold: true,
    font: 'body', outline: style.text, outlineW: .8, w: w - 8, h: h - 2, shrink: true });
  return plate;
}

/** Still graphics behind the illustration: no new texture, looping animation or white flash. */
export function gearQualityHalo(parent: Node, x: number, y: number, w: number, h: number, q: number): void {
  const style = gearQuality(q), g = N('gearQualityHalo', parent, x, y).addComponent(Graphics);
  g.fillColor = C(style.light); g.circle(0, 0, Math.min(w, h) / 2); g.fill();
  g.strokeColor = CA(style.edge, .45); g.lineWidth = 1; g.stroke();
}
