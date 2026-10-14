/** Resource substitutions only. The calling Panels module owns all original geometry and text. */
import { Color, Graphics, Node, Sprite } from 'cc';
import { C, CA, gpanel, N, btn, dlgConfirm, Bar } from './UIKit';
import { ArtOpts, artSprite, artSetFrame, uxFrame } from './Ux';
import { heroPortrait } from './HeroComic';
import { PAL } from '../config/GameConfig';
import { battleProgressBar } from './BattleProgressBar';

const SKIN = 'battle_skin_v2/';
const ART: Record<string, string> = {
  ui_banner_title: SKIN + 'banner_title', ui_card_plate_base: SKIN + 'card_base',
  ui_tab_l: SKIN + 'tab_l', ui_tab_m: SKIN + 'tab_m', ui_tab_r: SKIN + 'tab_r',
  ui_icon_coin: 'shop_comic_v1/comic_coin_v1', ui_icon_diamond: 'shop_comic_v1/comic_diamond_v1',
  ui_icon_exp: 'hero_comic_v2/comic_attributes_v2',
  ui_star: 'levels_comic_v1/comic_star_v1', ui_star_gray: 'levels_comic_v1/comic_star_v1',
};

export function battleArtSprite(parent: Node, x: number, y: number, w: number, h: number, id: string, o: ArtOpts = {}): Node {
  if (id.startsWith('ui_avatar_')) {
    const n = heroPortrait(parent, x, y, Math.min(w, h), id.slice(10));
    n.name = 'art:' + id;
    (o.hideOnLoad || []).forEach(v => { if (v.isValid) v.active = false; });
    return n;
  }
  const n = artSprite(parent, x, y, w, h, ART[id] || id, o), sp = n.getComponent(Sprite)!;
  if (id.startsWith('ui_tab_')) sp.color = C('#5A6472');
  if (id === 'ui_star_gray') sp.color = C('#666C77');
  return n;
}
export function battleArtIcon(parent: Node, id: string, w: number, h = w): Node {
  return battleArtSprite(parent, 0, 0, w, h, id, { sliced: false });
}

/** Swap the face in place, retaining the existing nested text node and its position. */
export function battleFace(parent: Node, w: number, h: number, tone: 'green' | 'gold' | 'muted', face?: Node): void {
  artSprite(parent, 0, 0, w, h, SKIN + 'button_' + tone, { belowIdx: 0, onLoaded: () => {
    if (face?.isValid) { const g = face.getComponent(Graphics); if (g) g.enabled = false; }
  }});
}
export function battleConfirm(parent: Node, x: number, y: number, w: number, h: number,
  text: string, cb: () => void, size = 24, base = '#E8AE3A', edge = '#BC8320', art = 'ui_btn_confirm'): Node {
  return dlgConfirm(parent, x, y, w, h, text, cb, size, base, edge, SKIN + (art === 'ui_btn_cancel' ? 'button_green' : 'button_gold'));
}
export function battleButton(parent: Node, x: number, y: number, w: number, h: number, text: string,
  color: string | Color, cb: () => void, size = 22, flat = false): Node {
  const tone = color === '#5A6472' ? 'muted' : color === PAL.gold ? 'gold' : 'green';
  return btn(parent, x, y, w, h, text, color, cb, size, flat, '', SKIN + 'button_' + tone);
}

/** Original switch geometry, labels and behavior with a clean replacement bitmap. */
export function battleSwitch(parent: Node, x: number, y: number, w: number, h: number, on: boolean,
  onChange?: (v: boolean) => void, disabled = false): Node {
  const n = N('switch', parent, x, y, w, h), g = n.addComponent(Graphics);
  const draw = (): void => {
    g.clear(); g.fillColor = C(disabled ? '#3A4250' : on ? '#65B441' : '#5A6472');
    g.roundRect(-w / 2, -h / 2, w, h, h / 2); g.fill();
    g.fillColor = C(disabled ? '#889099' : '#FFFFFF');
    g.circle(on ? w / 2 - h / 2 : -w / 2 + h / 2, 0, h / 2 - 3); g.fill();
  };
  draw();
  const id = (): string => SKIN + (disabled ? 'switch_disabled' : on ? 'switch_on' : 'switch_off');
  let sp: Sprite | null = null;
  artSprite(n, 0, 0, w, h, id(), { onLoaded: art => { sp = art.getComponent(Sprite); g.enabled = false; } });
  ['switch_on', 'switch_off'].forEach(key => uxFrame(SKIN + key, () => {}));
  if (!disabled && onChange) n.on(Node.EventType.TOUCH_END, (e: { propagationStopped?: boolean }) => {
    e.propagationStopped = true; on = !on;
    if (sp) artSetFrame(sp, id()); else draw(); onChange(on);
  });
  return n;
}

/** Battle contribution meters share the HUD's compact, lightly highlighted style. */
export function battleStatBar(parent: Node, x: number, y: number, w: number, h: number, fill: string | Color): Bar {
  return battleProgressBar(parent, x, y, w, h, 'damage', fill);
}
