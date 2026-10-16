/** Compact battle meters: shallow track, restrained highlights and exact fill proportions. */
import { Color, Graphics, Node } from 'cc';
import { Bar, C, CA, N } from './UIKit';

type MeterKind = 'health' | 'shield' | 'damage' | 'xp';
const COLORS: Record<MeterKind, string> = {
  health: '#2ACB1D', shield: '#4CC7F5', damage: '#F0793D', xp: '#6CBCC6',
};

export function battleProgressBar(parent: Node, x: number, y: number, w: number, h: number,
  kind: MeterKind, initial?: string | Color): Bar {
  const node = N('battleMeter:' + kind, parent, x, y, w, h);
  const track = node.addComponent(Graphics), detail = N('fill', node).addComponent(Graphics);
  const inset = kind === 'health' ? 2 : 1;
  const radius = Math.min(kind === 'health' ? 5 : 3, h / 3);
  track.fillColor = CA(kind === 'damage' ? '#10171E' : '#243239', .88);
  track.strokeColor = CA(kind === 'health' ? '#111B1E' : '#111B22', .85);
  track.lineWidth = kind === 'health' ? 1.5 : 1;
  track.roundRect(-w / 2, -h / 2, w, h, radius); track.fill(); track.stroke();
  track.strokeColor = CA('#A4B6BC', kind === 'health' ? .55 : .16);
  track.lineWidth = .7;
  track.moveTo(-w / 2 + radius, h / 2 - .8); track.lineTo(w / 2 - radius, h / 2 - .8); track.stroke();
  const base = initial || COLORS[kind];
  const draw = (fraction: number, tint?: string | Color): void => {
    detail.clear();
    const pct = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
    const fw = pct * (w - inset * 2), fh = h - inset * 2;
    if (fw <= 0 || fh <= 0) return;
    const raw = tint || base, color = typeof raw === 'string' ? C(raw) : raw;
    const left = -w / 2 + inset, bottom = -h / 2 + inset;
    const r = Math.min(radius - .5, fh / 2, fw / 2);
    detail.fillColor = color;
    detail.roundRect(left, bottom, fw, fh, r); detail.fill();
    // Broad, quiet top light; short fills keep their real width and never grow a minimum cap.
    const lightW = Math.max(0, fw - Math.min(2, fw * .2));
    if (lightW > 0) {
      detail.fillColor = CA('#FFFFFF', kind === 'damage' ? .12 : .22);
      detail.roundRect(left + (fw - lightW) / 2, bottom + fh * .62, lightW, fh * .25, Math.min(r, fh * .12)); detail.fill();
    }
    if (kind === 'health' && fw > 70) {
      // A pair of clipped slanted glints near the left edge, as in the reference.
      detail.fillColor = CA('#B6FF8E', .13);
      for (const offset of [18, 46]) {
        const end = Math.min(offset + 19, fw - 3);
        if (end <= offset + 4) continue;
        detail.moveTo(left + offset - 8, bottom + 1);
        detail.lineTo(left + offset, bottom + 1);
        detail.lineTo(left + end, bottom + fh - 1);
        detail.lineTo(left + end - 8, bottom + fh - 1);
        detail.close(); detail.fill();
      }
    }
  };
  draw(1);
  return { node, set: draw };
}

/** A blue shield shell outside the full health track. Its hollow center never paints over HP. */
export function battleShieldOutline(parent: Node, x: number, y: number, w: number, h: number): Bar {
  const node = N('lineShieldOutline', parent, x, y, w + 12, h + 12);
  const g = node.addComponent(Graphics);
  type Point = readonly [number, number];
  const contour = (hw: number, hh: number, bevel: number): Point[] => [
    [-hw, hh - bevel], [-hw + bevel, hh], [hw - bevel, hh], [hw, hh - bevel],
    [hw, -hh + bevel], [hw - bevel, -hh], [-hw + bevel, -hh], [-hw, -hh + bevel],
  ];
  const outer = contour(w / 2 + 6, h / 2 + 6, 8);
  const inner = contour(w / 2 + 2, h / 2 + 2, 5);
  const blue = C('#42BFF5'), topLight = C('#BAF4FF'), bottomShade = C('#167CBF');
  // The right end stays fixed: damage removes the shell from left to right.
  const clipped = (polygon: Point[], start: number): Point[] => {
    const points: Point[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      if (a[0] >= start) points.push(a);
      if ((a[0] >= start) !== (b[0] >= start)) {
        const t = (start - a[0]) / (b[0] - a[0]);
        points.push([start, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return points;
  };
  const draw = (fraction: number): void => {
    g.clear();
    const pct = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
    node.active = pct > 0;
    if (!pct) return;
    const start = w / 2 + 6 - (w + 12) * pct;
    for (let i = 0; i < outer.length; i++) {
      const j = (i + 1) % outer.length;
      const points = clipped([outer[i], outer[j], inner[j], inner[i]], start);
      if (points.length < 3) continue;
      g.fillColor = blue;
      g.moveTo(points[0][0], points[0][1]);
      for (let k = 1; k < points.length; k++) g.lineTo(points[k][0], points[k][1]);
      g.close(); g.fill();
      const edge = clipped([outer[i], outer[j]], start);
      if (edge.length < 2) continue;
      const a = edge[0], b = edge[1];
      g.strokeColor = i < 3 ? topLight : bottomShade;
      g.lineWidth = .9;
      g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
  };
  draw(0);
  return { node, set: draw };
}

/** Small native glyphs remain crisp at phone DPR and don't depend on emoji fonts. */
export function battleStatusIcon(parent: Node, x: number, y: number, kind: 'heart' | 'shield'): Node {
  const node = N('lineIcon:' + kind, parent, x, y, 24, 24), g = node.addComponent(Graphics);
  g.fillColor = C(kind === 'heart' ? '#56D83E' : '#63D5FF');
  g.strokeColor = C('#182D30'); g.lineWidth = 1.8;
  if (kind === 'heart') {
    g.moveTo(0, -9);
    g.bezierCurveTo(-3, -6, -12, 0, -10, 6);
    g.bezierCurveTo(-8, 13, -1, 11, 0, 7);
    g.bezierCurveTo(1, 11, 8, 13, 10, 6);
    g.bezierCurveTo(12, 0, 3, -6, 0, -9);
  } else {
    g.moveTo(0, 11); g.lineTo(10, 7); g.lineTo(9, -2);
    g.bezierCurveTo(8, -6, 4, -9, 0, -11);
    g.bezierCurveTo(-4, -9, -8, -6, -9, -2);
    g.lineTo(-10, 7); g.close();
  }
  g.fill(); g.stroke();
  g.strokeColor = CA('#FFFFFF', .65); g.lineWidth = 1.5;
  if (kind === 'heart') { g.moveTo(-7, 5); g.lineTo(-4, 8); }
  else { g.moveTo(-6, 5); g.lineTo(0, 8); g.lineTo(6, 5); }
  g.stroke();
  return node;
}
