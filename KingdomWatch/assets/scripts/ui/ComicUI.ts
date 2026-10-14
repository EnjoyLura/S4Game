/** Clean comic fantasy: precise shared geometry, with illustration reserved for objects. */
import { Color, Graphics, Mask, Node } from 'cc';
import { C, dimLayer, label, N } from './UIKit';
import { artSprite } from './Ux';
import { Sfx } from '../core/Sfx';

export const COMIC = {
  ink: '#302C29', dark: '#29313B', darkLight: '#414B56', darkShade: '#19222C',
  paper: '#F5E8CD', card: '#FFF5E1', paperShade: '#DDC6A2',
  gold: '#FFC848', goldLight: '#FFE88C', goldShade: '#C58A27',
  green: '#65B441', greenLight: '#A7DC68', greenShade: '#377829',
  muted: '#ABB0AC', mutedLight: '#CCD0C6', mutedShade: '#777E78',
  text: '#342D26', sub: '#77674F', cream: '#FFF4DD',
};

type Tone = 'paper' | 'card' | 'dark' | 'gold' | 'green' | 'muted';
const TONES: Record<Tone, [string, string]> = {
  paper: [COMIC.paper, '#FFF6E2'],
  card: [COMIC.card, '#FFFFFF'],
  dark: [COMIC.dark, COMIC.darkLight],
  gold: [COMIC.gold, COMIC.goldLight],
  green: [COMIC.green, COMIC.greenLight],
  muted: [COMIC.muted, COMIC.mutedLight],
};

function polygon(g: Graphics, points: number[][], fill: string | Color, stroke = false): void {
  g.fillColor = typeof fill === 'string' ? C(fill) : fill;
  g.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(p => g.lineTo(p[0], p[1]));
  g.close(); g.fill();
  if (stroke) { g.strokeColor = C(COMIC.ink); g.lineWidth = 2.4; g.stroke(); }
}

/** One flat face and one contour; offset plates and bottom bevels create unwanted doubled edges. */
export function comicPlate(parent: Node, x: number, y: number, w: number, h: number,
  tone: Tone = 'paper', opts: { name?: string; cut?: number; edge?: boolean; fill?: string } = {}): Node {
  const node = N(opts.name || 'comicPlate', parent, x, y, w, h);
  const g = node.addComponent(Graphics);
  const [face, light] = TONES[tone];
  const c = Math.min(opts.cut ?? 9, h / 4, w / 4);
  const l = -w / 2, r = w / 2, b = -h / 2, t = h / 2;
  const edge = opts.edge !== false;
  const shape: number[][] = [
    [l + c, b], [r - c, b], [r, b + c], [r, t - c],
    [r - c, t], [l + c, t], [l, t - c], [l, b + c],
  ];
  polygon(g, shape, opts.fill || face, edge);
  if (h > 30) {
    polygon(g, [[l + c + 3, t - 3], [r - c - 3, t - 3], [r - c - 5, t - 5], [l + c + 5, t - 5]], light);
  }
  return node;
}

/** All shop and persistent lobby icons use one family, with original proportions retained. */
export function comicArt(parent: Node, x: number, y: number, w: number, h: number, key: string): Node {
  return artSprite(parent, x, y, w, h, key.includes('/') ? key : 'shop_comic_v1/' + key, { sliced: false });
}

/** A true circular crop, with shoulders filling the lower arc instead of a floating cutout. */
export function comicPortrait(parent: Node, x: number, y: number, size: number, key: string,
  background = '#E7DFF0'): Node {
  const portrait = N('comicPortrait', parent, x, y, size, size);
  const backdrop = N('portraitBackdrop', portrait, 0, 0, size, size).addComponent(Graphics);
  backdrop.fillColor = C(background); backdrop.circle(0, 0, size / 2); backdrop.fill();
  backdrop.strokeColor = C('#C6BCCF'); backdrop.lineWidth = 1.5; backdrop.stroke();
  if (key) {
    const clip = N('portraitClip', portrait, 0, 0, size - 2, size - 2);
    const mask = clip.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_ELLIPSE; mask.segments = 96;
    comicArt(clip, 0, -size * .025, size * 1.25, size * 1.25, key);
  }
  return portrait;
}

export function comicMark(parent: Node, x: number, y: number, kind: 'plus' | 'lock' | 'close' | 'check' | 'upgrade', size = 24,
  color = COMIC.cream): Node {
  const node = N('comicMark:' + kind, parent, x, y, size, size);
  const g = node.addComponent(Graphics);
  g.fillColor = C(color); g.strokeColor = C(color); g.lineWidth = Math.max(3, size * 0.13);
  const s = size / 2;
  if (kind === 'plus') {
    g.roundRect(-s * .78, -s * .19, s * 1.56, s * .38, s * .07); g.fill();
    g.roundRect(-s * .19, -s * .78, s * .38, s * 1.56, s * .07); g.fill();
  } else if (kind === 'close') {
    g.moveTo(-s * .6, -s * .6); g.lineTo(s * .6, s * .6); g.stroke();
    g.moveTo(-s * .6, s * .6); g.lineTo(s * .6, -s * .6); g.stroke();
  } else if (kind === 'check') {
    g.moveTo(-s * .75, 0); g.lineTo(-s * .15, -s * .5); g.lineTo(s * .75, s * .65); g.stroke();
  } else if (kind === 'lock') {
    g.moveTo(-s * .43, s * .18); g.lineTo(-s * .43, s * .57);
    g.bezierCurveTo(-s * .43, s * 1.02, s * .43, s * 1.02, s * .43, s * .57);
    g.lineTo(s * .43, s * .18); g.stroke();
    g.roundRect(-s * .7, -s * .8, s * 1.4, s * 1.1, s * .16); g.fill();
  } else {
    const ink = COMIC.ink;
    for (const cy of [-size * .18, size * .21]) {
      polygon(g, [[-s * .85, cy - s * .12], [0, cy + s * .55], [s * .85, cy - s * .12],
        [s * .85, cy - s * .46], [0, cy + s * .19], [-s * .85, cy - s * .46]], COMIC.gold, true);
      g.strokeColor = C(ink);
    }
  }
  return node;
}

/** Button states share an exact silhouette; the face lowers two pixels under the finger. */
export function comicButton(parent: Node, x: number, y: number, w: number, h: number, text: string,
  onClick: () => void, opts: { tone?: Tone; size?: number; color?: string; name?: string } = {}): Node {
  const node = N(opts.name || 'comicButton', parent, x, y, w, h);
  const tone = opts.tone || 'green';
  const face = comicPlate(node, 0, 0, w, h, tone, { name: 'buttonFace', cut: 9 });
  if (text) label(face, 0, 1, text, { size: opts.size ?? 24, color: opts.color || (tone === 'gold' ? COMIC.text : COMIC.cream),
    bold: true, font: 'body', w: w - 16, h: h - 10, shrink: true });
  node.on(Node.EventType.TOUCH_START, () => face.setPosition(0, -2, 0));
  node.on(Node.EventType.TOUCH_CANCEL, () => face.setPosition(0, 0, 0));
  node.on(Node.EventType.TOUCH_END, (e: { propagationStopped?: boolean }) => {
    face.setPosition(0, 0, 0);
    if (e) e.propagationStopped = true;
    Sfx.play('ui');
    onClick();
  });
  return node;
}

/** Purchase/resource dialogs use the same quiet paper and code-rendered typography as the shelf. */
export function comicDialog(parent: Node, w: number, h: number, title: string): Node {
  const dim = dimLayer(parent, 0.66);
  dim.name = 'comicModal';
  dim.on(Node.EventType.TOUCH_END, () => dim.destroy());
  const panel = comicPlate(dim, 0, 0, w, h, 'paper', { name: 'comicDialog', cut: 14 });
  panel.on(Node.EventType.TOUCH_END, (e: { propagationStopped?: boolean }) => {
    if (e) e.propagationStopped = true;
  });
  label(panel, 0, h / 2 - 42, title, { size: 30, bold: true, font: 'body', color: COMIC.text, w: w - 140, h: 42, shrink: true });
  const close = comicButton(panel, w / 2 - 35, h / 2 - 35, 44, 44, '', () => dim.destroy(), { tone: 'dark', name: 'btn_close' });
  comicMark(close.getChildByName('buttonFace')!, 0, 0, 'close', 20);
  return panel;
}
