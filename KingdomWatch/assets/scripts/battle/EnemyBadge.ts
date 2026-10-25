/** Small filled silhouettes shared by enemy overhead marks and the inspection rail. No backplate. */
import { Color, Graphics } from 'cc';
export type EnemyBadge = 'armor' | 'ward' | 'armorBroken' | 'wardBroken' | 'heal' | 'rush' | 'health' | 'attack';
const tint = new Color();
export function drawEnemyBadge(g: Graphics, kind: EnemyBadge, x: number, y: number, scale = 1): void {
  const fill = (hex: string): void => { Color.fromHEX(tint, hex); g.fillColor = tint; };
  const line = (hex: string, width: number): void => { Color.fromHEX(tint, hex); g.strokeColor = tint; g.lineWidth = width * scale; };
  const path = (points: readonly number[], closed = true): void => {
    g.moveTo(x + points[0] * scale, y + points[1] * scale);
    for (let i = 2; i < points.length; i += 2) g.lineTo(x + points[i] * scale, y + points[i + 1] * scale);
    if (closed) g.close();
  };
  const shape = (points: readonly number[], color: string): void => {
    fill(color); line('#30271F', 2.4); path(points); g.fill(); g.stroke();
  };
  if (kind === 'armor') {
    shape([-10,11, 0,14, 10,11, 9,-1, 5,-7, 0,-11, -5,-7, -9,-1], '#8FB8CF');
    fill('#D2E5EC'); path([-8,9, 0,11, 0,-7, -4,-4, -7,0]); g.fill();
    line('#F5E7C7', 1.3); path([-7,8, 0,10, 7,8], false); g.stroke();
    line('#506B83', 1.8); path([0,9, 0,-7], false); g.stroke();
  } else if (kind === 'armorBroken') {
    shape([-12,10, -3,12, -5,5, -2,1, -6,-2, -5,-8, -10,-3], '#B5C8CC');
    shape([4,9, 12,7, 11,-3, 5,-11, 3,-4, 6,0, 2,3], '#8399A7');
    line('#F4B460', 1.6); path([-2,14, -3,9, 0,5, -2,1], false); g.stroke();
    path([7,-14, 11,-12], false); g.stroke();
  } else if (kind === 'ward') {
    shape([0,14, 10,8, 10,-2, 0,-12, -10,-2, -10,8], '#7651A8');
    fill('#B99AE4'); path([0,11, 6,5, 0,-7, -6,5]); g.fill();
    line('#F2D9FF', 1.5); path([0,8, 4,3, 0,-3, -4,3], true); g.stroke();
    path([-13,8, -16,8, -16,11], false); g.stroke();
    path([13,-5, 16,-5, 16,-2], false); g.stroke();
  } else if (kind === 'wardBroken') {
    shape([-3,13, -12,7, -12,-3, -5,-9, -7,-1, -3,3, -6,7], '#B296CE');
    shape([4,10, 12,5, 10,-4, 3,-12, 5,-3, 2,1, 7,5], '#7651A8');
    line('#E6C7FF', 1.6); path([-2,15, -1,10], false); g.stroke(); path([6,-15, 9,-12], false); g.stroke();
  } else if (kind === 'heal') {
    shape([-3,12, 3,12, 3,4, 10,4, 10,-2, 3,-2, 3,-10, -3,-10, -3,-2, -10,-2, -10,4, -3,4], '#69CF76');
    line('#D9FFD8', 1.5); path([-1,9, -1,2, -7,2], false); g.stroke();
  } else if (kind === 'health') {
    fill('#E65C4E'); line('#30271F', 2.4);
    g.moveTo(x, y-10*scale); g.bezierCurveTo(x-24*scale,y+5*scale,x-8*scale,y+20*scale,x,y+8*scale);
    g.bezierCurveTo(x+8*scale,y+20*scale,x+24*scale,y+5*scale,x,y-10*scale); g.close(); g.fill(); g.stroke();
  } else if (kind === 'attack') {
    shape([-3,-5, -3,9, 0,14, 3,9, 3,-5], '#D2DFE1');
    shape([-7,-4, 7,-4, 7,-7, 2,-7, 2,-12, -2,-12, -2,-7, -7,-7], '#D7AC57');
  } else {
    shape([-10,11, 0,4, 10,11, 10,4, 0,-4, -10,4], '#EAB55B');
    shape([-8,-1, 0,-7, 8,-1, 8,-7, 0,-13, -8,-7], '#F2CF83');
  }
}
