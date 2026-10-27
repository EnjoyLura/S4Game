/** Hero art shares the shop palette, portraits and inventory illustrations. */
import { Graphics, Node, Sprite, UIOpacity, UITransform } from 'cc';
import { C, CA, label, N, WY } from './UIKit';
import { artSprite } from './Ux';
import { COMIC, comicArt, comicMark, comicPortrait, comicSurface } from './ComicUI';
import { EQUIPS, EquipKind, HERO_DEFS } from '../core/GameData';
import { HeroLobbyIdle, supportsHeroLobbyIdle } from './HeroLobbyIdle';

export const HERO_PASTEL: Record<string, string> = {
  scythe:'#FFD4BD',
  arcane:'#D7E9FF',
  lance:'#FFF0BD',
  space:'#EED6F5', sword:'#DEF1DE',
  wind: '#E4F4EB', ninja: '#DEE3F3',
  cannon: '#F0DFB4', siphon: '#EFD3DF',
  archer: '#DDEBD0', sniper: '#DBE7F2', pyro: '#F4DDC5', volt: '#E7DEF0', mora: '#D9EDF0',
};
export const GEAR_PASTEL = ['#E8E5DC', '#DDEBD0', '#DCE8F1', '#E7DEF0'];
export const GEAR_ART: Record<string, string> = {
  ...Object.values(EQUIPS).reduce((out, item) => { if (item.art) out[item.id] = item.art; return out; }, {} as Record<string, string>),
  helm_falcon: 'comic_helm_falcon_v1', acc_moon: 'comic_acc_moon_v1',
  glove_wind: 'comic_glove_wind_v1', armor_forest: 'comic_armor_forest_v1',
  mat_stone: 'comic_mat_stone_v1', mat_iron: 'comic_mat_iron_v1',
  mat_dust: 'comic_mat_dust_v1', mat_rune: 'comic_mat_rune_v1',
};
export function gearArtKey(id: string): string {
  const key = GEAR_ART[id] || '';
  return key.includes('/') ? key : 'shop_comic_v1/' + key;
}
export const EMPTY_GEAR: Record<EquipKind, string> = {
  weapon: 'wpn_bow', helm: 'helm_falcon', acc: 'acc_moon', glove: 'glove_wind', armor: 'armor_forest',
};
/** Shared with picker prewarming, including the shop prefix applied by comicArt. */
export function heroPortraitKey(id: string): string {
  if (['wind','ninja','space','sword','lance','arcane','scythe'].includes(id)) return 'ui_avatar_' + id;
  if (id === 'cannon' || id === 'siphon') return 'new_heroes_v105/avatar_' + id;
  return id === 'archer' ? 'hero_comic_v1/comic_hero_archer_v1' : 'shop_comic_v1/comic_hero_' + id + '_v1';
}
export function heroPortrait(parent: Node, x: number, y: number, size: number, id: string): Node {
  return comicPortrait(parent, x, y, size, heroPortraitKey(id), HERO_PASTEL[id]);
}

/** Shared free-standing portrait treatment; the surrounding rail still owns scrolling. */
export function heroRosterPortrait(parent: Node, x: number, id: string, active: boolean, owned: boolean, width: number): Node {
  const slot = N('heroRosterPortrait:' + id, parent, x, 0, width, 114);
  if (active) {
    const ring = N('heroRosterSelection', slot, 0, 14).addComponent(Graphics);
    ring.fillColor = CA(COMIC.goldLight, .28); ring.circle(0, 0, 45); ring.fill();
    ring.strokeColor = C(COMIC.gold); ring.lineWidth = 3.5; ring.stroke();
    comicSurface(slot, 0, -40, 108, 28, 'gold', { name: 'heroRosterNameTag', radius: 14 });
  }
  const avatar = heroPortrait(slot, 0, 14, 82, id);
  if (!owned) {
    avatar.addComponent(UIOpacity).opacity = 125;
    comicMark(slot, 43, -8, 'lock', 17, COMIC.sub);
  }
  const def = HERO_DEFS[id];
  label(slot, 0, -39, id === 'pyro' ? def.name.replace('·', '') : def.name.split('·')[0], {
    size: 20, bold: true, font: 'body', color: active ? COMIC.text : owned ? COMIC.cream : '#C8C5BA',
    w: 110, h: 28, shrink: true, outline: active ? undefined : COMIC.ink, outlineW: active ? 0 : 2,
  });
  return slot;
}
export function gearArt(parent: Node, x: number, y: number, w: number, h: number, id: string): Node {
  return comicArt(parent, x, y, w, h, GEAR_ART[id]);
}
/** Keep the complete illustration and align its authored transparent foot margin. */
export function heroFigureKey(id: string): string {
  return 'hero_comic_v1/comic_figure_' + id + (id === 'archer' ? '_v2' : '_v1');
}
export function heroComicFigure(parent: Node, id: string, x: number, footY: number, height: number, maxWidth: number, animated = false): Node {
  const figure = N('heroFigure:' + id, parent, x, footY);
  const ground = N('heroGround', figure).addComponent(Graphics);
  ground.fillColor = CA(COMIC.ink, .24); ground.ellipse(0, -2, Math.min(72, height * .17), 8); ground.fill();
  const key = heroFigureKey(id);
  // Final wind/ninja frames: 512×768, feet at y=744 leave a 24px bottom margin.
  const footMargin = ['wind','ninja','space','sword','lance','arcane','scythe'].includes(id) ? 24 / 768
    : id === 'cannon' ? 81 / 1536 : id === 'siphon' ? 30 / 1536 : id === 'archer' ? 14 / 1546 : 16 / 768;
  const still = N('heroStillFallback', figure);
  const loadStill = (): void => { artSprite(still, 0, height / 2, maxWidth, height, key, {
    sliced: false, onLoaded: art => {
      const h = art.getComponent(UITransform)!.height;
      art.setPosition(0, h / 2 - h * footMargin, 0);
    },
  }); };
  if (animated && supportsHeroLobbyIdle(id)) figure.addComponent(HeroLobbyIdle).configure(id, still, height, maxWidth, loadStill);
  else loadStill();
  return figure;
}
/** Illustrated action icons share the same reference as the shop objects. */
export function heroGlyph(parent: Node, x: number, y: number,
  kind: 'bag' | 'attrs' | 'book' | 'bolt' | 'left' | 'right' | 'forge', size = 26, color = COMIC.ink): Node {
  const keys = { bag: 'hero_comic_v2/comic_bag_v2', attrs: 'hero_comic_v2/comic_attributes_v2', book: 'hero_comic_v2/comic_story_v2',
    forge: 'hero_comic_v2/comic_forge_v2', left: 'hero_comic_v3/comic_cycle_button_v3',
    right: 'hero_comic_v3/comic_cycle_button_v3', bolt: 'hero_comic_v3/comic_power_plate_v3' };
  const art = comicArt(parent, x, y, size, size, keys[kind]);
  if (kind === 'right') art.setScale(-1, 1, 1);
  return art;
}

/** The upper illustration stops at the bag and its dais is aligned to the character's foot anchor. */
export function heroEnvironment(parent: Node, height: number, footX: number, bottomToFoot: number): Node {
  const upper = N('heroUpperScene', parent, 0, WY(0, height), 750, height);
  const footY = -height / 2 + bottomToFoot;
  N('heroPlatformAnchor', upper, footX, footY);
  artSprite(upper, 0, 0, 750, height, 'scenes/bg_heroes_comic_v3', {
    sliced: false, cover: true, onLoaded: art => {
      const rect = art.getComponent(Sprite)!.spriteFrame!.rect;
      // Top-surface center is calibrated against the final generated illustration.
      const u = .326, v = .815, px = footX + 375, py = height - bottomToFoot;
      const k = Math.max(px / (rect.width * u), (750 - px) / (rect.width * (1 - u)),
        py / (rect.height * v), bottomToFoot / (rect.height * (1 - v)));
      const w = rect.width * k, h = rect.height * k;
      art.getComponent(UITransform)!.setContentSize(w, h);
      art.setPosition(footX + w * (.5 - u), footY + h * (v - .5), 0);
    },
  });
  return upper;
}
