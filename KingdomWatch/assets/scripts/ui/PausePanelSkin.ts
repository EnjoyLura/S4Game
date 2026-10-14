/** Pause-only artwork. Panels keeps the original layout, labels and callbacks. */
import { Graphics, Mask, Node, Sprite } from 'cc';
import { C, CA, gpanel, label, N } from './UIKit';
import { artSetFrame, artSprite, uxFrame } from './Ux';
import { Sfx } from '../core/Sfx';

const SKIN = 'pause_comic_v1/';

/** Sample one continuous bar through each original segment: only the outer ends have corners. */
export function pauseTabFace(segment: Node, index: number, count: number, w: number, h: number, active: boolean): void {
  const clip = N('pauseTabClip', segment, 0, 0, w, h);
  clip.setSiblingIndex(0);
  clip.addComponent(Mask);
  artSprite(clip, ((count - 1) / 2 - index) * w, 0, count * w, h,
    SKIN + (active ? 'tab_gold' : 'tab_neutral'), {
      onLoaded: () => { const g = segment.getComponent(Graphics); if (g) g.enabled = false; },
    });
}

export function pauseRow(parent: Node, x: number, y: number, w: number, h: number): Node {
  const n = gpanel(parent, x, y, w, h, CA('#14181E', .85), undefined, 0, 12);
  artSprite(n, 0, 0, w, h, SKIN + 'settings_row', { belowIdx: 0 });
  return n;
}

export function pauseButton(parent: Node, x: number, y: number, w: number, h: number,
  text: string, onClick: () => void, size: number, tone: 'gold' | 'green' | 'muted'): Node {
  const n = gpanel(parent, x, y, w, h, tone === 'green' ? '#7FB841' : tone === 'gold' ? '#E89A3C' : '#5A6472', undefined, 0, 14);
  n.name = tone === 'green' ? 'pauseResume' : tone === 'gold' ? 'pauseExit' : 'pauseSpeed';
  label(n, 0, 0, text, { size, color: '#3A2A10', bold: true, w: w - 16, h, shrink: true });
  let sprite: Sprite | null = null, pressed = false;
  const tint = (): void => { if (sprite) sprite.color = C(pressed ? '#D7D7D7' : '#FFFFFF'); };
  artSprite(n, 0, 0, w, h, SKIN + 'button_' + tone, {
    belowIdx: 0, onLoaded: art => { sprite = art.getComponent(Sprite); tint(); },
  });
  n.on(Node.EventType.TOUCH_START, () => { pressed = true; tint(); });
  n.on(Node.EventType.TOUCH_CANCEL, () => { pressed = false; tint(); });
  n.on(Node.EventType.TOUCH_END, (e: { propagationStopped?: boolean }) => {
    e.propagationStopped = true; pressed = false; tint(); Sfx.play('ui'); onClick();
  });
  return n;
}

export function pauseSwitch(parent: Node, x: number, y: number, w: number, h: number, on: boolean,
  onChange?: (v: boolean) => void, disabled = false): Node {
  const n = N('pauseSwitch', parent, x, y, w, h), g = n.addComponent(Graphics);
  const draw = (): void => {
    g.clear(); g.fillColor = C(disabled ? '#3A4250' : on ? '#65B441' : '#5A6472');
    g.roundRect(-w / 2, -h / 2, w, h, h / 2); g.fill();
    g.fillColor = C(disabled ? '#889099' : '#FFFFFF');
    g.circle(on ? w / 2 - h / 2 : -w / 2 + h / 2, 0, h / 2 - 3); g.fill();
  };
  draw();
  const id = (): string => SKIN + (disabled ? 'switch_disabled' : on ? 'switch_on' : 'switch_off');
  let sprite: Sprite | null = null;
  artSprite(n, 0, 0, w, h, id(), { fit: false, onLoaded: art => {
    sprite = art.getComponent(Sprite); g.enabled = false;
    if (sprite) artSetFrame(sprite, id());
  }});
  if (!disabled && onChange) {
    ['switch_on', 'switch_off'].forEach(key => uxFrame(SKIN + key, () => {}));
    n.on(Node.EventType.TOUCH_END, (e: { propagationStopped?: boolean }) => {
      e.propagationStopped = true; on = !on;
      if (sprite) artSetFrame(sprite, id()); else draw();
      onChange(on);
      Sfx.play('ui');
    });
  }
  return n;
}
