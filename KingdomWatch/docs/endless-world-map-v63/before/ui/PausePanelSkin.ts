/** Lobby component styling with a centered, height-adaptive pause surface. */
import { Graphics, Mask, Node, tween } from 'cc';
import { C, N } from './UIKit';
import { COMIC, comicButton, comicPlate } from './ComicUI';
import { bindButton } from './ButtonFeedback';
import { LO } from '../config/GameConfig';

/** Scale the whole layout together; fixed internal gaps survive a short viewport. */
export function pauseFrame(parent: Node): Node {
  const root = N('pauseContent', parent, 0, (LO.safeBottom - LO.safeTop) / 2, 750, 680);
  const scale = Math.min(1, Math.max(.1, (LO.half * 2 - LO.safeTop - LO.safeBottom - 48) / 680));
  root.setScale(scale, scale, 1);
  return root;
}

/** Sample one continuous bar through each original segment: only the outer ends have corners. */
export function pauseTabFace(segment: Node, index: number, count: number, w: number, h: number, active: boolean): void {
  const clip = N('pauseTabClip', segment, 0, 0, w, h);
  clip.setSiblingIndex(0);
  clip.addComponent(Mask);
  comicPlate(clip, ((count - 1) / 2 - index) * w, 0, count * w, h,
    active ? 'gold' : 'dark', { name: 'lobbyTabFace', cut: 9 });
  const fallback = segment.getComponent(Graphics);
  if (fallback) fallback.enabled = false;
}

export function pauseRow(parent: Node, x: number, y: number, w: number, h: number): Node {
  return comicPlate(parent, x, y, w, h, 'dark', { name: 'pauseSettingsRow', cut: 9 });
}

export function pauseButton(parent: Node, x: number, y: number, w: number, h: number,
  text: string, onClick: () => void, size: number, tone: 'gold' | 'green' | 'muted'): Node {
  return comicButton(parent, x, y, w, h, text, onClick, {
    tone, size, color: tone === 'muted' ? COMIC.text : undefined,
    name: tone === 'green' ? 'pauseResume' : tone === 'gold' ? 'pauseExit' : 'pauseSpeed',
  });
}

export function pauseSwitch(parent: Node, x: number, y: number, w: number, h: number, on: boolean,
  onChange?: (v: boolean) => void, disabled = false): Node {
  const n = N('pauseSwitch', parent, x, y, w, h), g = n.addComponent(Graphics);
  const thumb = N('pauseSwitchThumb', n), knob = thumb.addComponent(Graphics);
  knob.fillColor = C(disabled ? COMIC.mutedLight : COMIC.cream);
  knob.strokeColor = C(COMIC.ink); knob.lineWidth = 2.4;
  knob.circle(0, 0, h / 2 - 3); knob.fill(); knob.stroke();
  const thumbX = (): number => on ? w / 2 - h / 2 : -w / 2 + h / 2;
  thumb.setPosition(thumbX(), 0, 0);
  const draw = (): void => {
    g.clear(); g.fillColor = C(disabled ? COMIC.muted : on ? COMIC.green : COMIC.darkLight);
    g.strokeColor = C(COMIC.ink); g.lineWidth = 2.4;
    g.roundRect(-w / 2, -h / 2, w, h, h / 2); g.fill();
    g.stroke();
  };
  draw();
  if (!disabled && onChange) {
    bindButton(n, () => {
      on = !on;
      draw();
      tween(thumb).to(.14, { position: thumb.position.clone().set(thumbX(), 0, 0) }, { easing: 'quadOut' }).start();
      onChange(on);
    }, { radius: h / 2, scale: .97, sound: 'toggle', soundAfterAction: true });
  }
  return n;
}
