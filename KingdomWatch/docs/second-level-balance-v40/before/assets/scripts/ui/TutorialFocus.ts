/** A skippable spotlight over a real control, with no synthetic touch dispatch. */
import { _decorator, BlockInputEvents, Component, Graphics, Node, UITransform, Vec3 } from 'cc';
import { LO } from '../config/GameConfig';
import { C, CA, gpanel, label, N } from './UIKit';
import { comicButton } from './ComicUI';
import { bindButton } from './ButtonFeedback';
import { interactionReady } from './UIMotion';

const { ccclass } = _decorator;
@ccclass('TutorialSpotlight')
export class TutorialSpotlight extends Component {
  follow: (() => void) | null = null;
  update(): void { this.follow?.(); }
}

export function tutorialFocus(parent: Node, target: Node, text: string,
  action: () => void, skip: () => void): Node | null {
  if (!target.isValid || !target.activeInHierarchy || !target.getComponent(UITransform)) return null;
  const root = N('firstJourneyFocus', parent, 0, 0, 750, LO.half * 2);
  root.addComponent(BlockInputEvents);
  const ut = root.getComponent(UITransform)!;
  const ink = root.addComponent(Graphics);
  const hotspot = N('tutorialRealControl', root, 0, 0, 1, 1);
  let done = false;
  const finish = (cb: () => void): void => {
    if (done) return;
    done = true; root.active = false; root.destroy(); cb();
  };
  bindButton(hotspot, () => finish(action), { scale: 1, shift: 0, sound: false,
    enabled: () => target.isValid && target.activeInHierarchy && interactionReady(target) });
  const h = 194, minY = -LO.half + LO.safeBottom + h / 2 + 16;
  const maxY = LO.half - LO.safeTop - h / 2 - 16;
  const panel = gpanel(root, 0, 0, 650, h, '#F5E8CD', '#59452D', 2, 14);
  label(panel, 0, 35, text, { size: 24, color: '#3D342A', bold: true, w: 606, h: 88, shrink: true });
  comicButton(panel, 0, -56, 250, 50, '跳过引导', () => finish(skip), { tone: 'dark', size: 20 });
  let lastBounds = '';
  const follow = (): void => {
    if (done) return;
    if (!target.isValid || !target.activeInHierarchy) { finish(skip); return; }
    const box = target.getComponent(UITransform)!.getBoundingBoxToWorld();
    const a = ut.convertToNodeSpaceAR(new Vec3(box.xMin, box.yMin));
    const b = ut.convertToNodeSpaceAR(new Vec3(box.xMax, box.yMax));
    const left = Math.max(-375, a.x - 8), right = Math.min(375, b.x + 8);
    const bottom = Math.max(-LO.half, a.y - 8), top = Math.min(LO.half, b.y + 8);
    if (right <= left || top <= bottom) { finish(skip); return; }
    const key = [left, right, bottom, top].map(v => v.toFixed(1)).join(':');
    if (key === lastBounds) return;
    lastBounds = key;
    ink.clear(); ink.fillColor = CA('#101820', .73);
    ink.rect(-375, top, 750, LO.half - top);
    ink.rect(-375, -LO.half, 750, LO.half + bottom);
    ink.rect(-375, bottom, left + 375, top - bottom);
    ink.rect(right, bottom, 375 - right, top - bottom);
    ink.fill(); ink.strokeColor = C('#FFDC73'); ink.lineWidth = 3;
    ink.roundRect(left, bottom, right - left, top - bottom, 12); ink.stroke();
    hotspot.setPosition((left + right) / 2, (top + bottom) / 2, 0);
    hotspot.getComponent(UITransform)!.setContentSize(right - left, top - bottom);
    const desired = top + 22 + h / 2 <= maxY ? top + 22 + h / 2 : bottom - 22 - h / 2;
    panel.setPosition(0, Math.max(minY, Math.min(maxY, desired)), 0);
  };
  root.addComponent(TutorialSpotlight).follow = follow;
  follow();
  if (done) return null;
  return root;
}
