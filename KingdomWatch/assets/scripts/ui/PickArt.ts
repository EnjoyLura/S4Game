/** The picker preloads exactly the same art keys it renders, scoped to the equipped squad. */
import { CardDef, M0_POOL } from '../config/Cards';
import { Graphics, Mask, Node } from 'cc';
import { heroPortraitKey } from './HeroComic';
import { ArtPriority, artSprite, warmUXArt } from './Ux';
import { C, N } from './UIKit';

const SHARED = ['pick_comic_v1/title_plate', 'pick_comic_v1/card_base', 'pick_comic_v1/header_strip'];
const CARD_ART: Record<string, string> = {
  heavy_head: 'ui_card_sharp', fast_load: 'ui_card_swift',
  steady_rest: 'ui_card_crit_rate', lethal_aim: 'ui_card_crit_dmg',
  instinct_s: 'ui_card_instinct_a', fast_charge_s: 'ui_card_fast_charge_a',
  pyro_cd: 'ui_card_cd_cut', pyro_eager: 'ui_card_fast_charge_a',
  volt_cd: 'ui_card_cd_cut', volt_eager: 'ui_card_fast_charge_a',
  mora_cd: 'ui_card_cd_cut', mora_eager: 'ui_card_fast_charge_a', mora_linger: 'ui_card_cd_cut',
};

export function pickCardArt(card: CardDef): string {
  return card.art || (card.unlocks ? 'ui_icon_' + card.unlocks + '_' + card.owner
    : CARD_ART[card.id] || 'ui_card_' + card.id);
}

/** Mage cards share a filled circular viewport. Clip only the icon subtree. */
export function pickCardIcon(parent: Node, x: number, y: number, size: number, card: CardDef, hideOnLoad: Node[] = []): Node {
  if (card.owner !== 'pyro' && card.owner !== 'volt' && card.owner !== 'mora') return artSprite(parent, x, y, size, size, pickCardArt(card), { sliced: false, hideOnLoad });
  const clip = N(card.owner + 'CardIcon', parent, x, y, size, size);
  const mask = clip.addComponent(Mask); mask.type = Mask.Type.GRAPHICS_ELLIPSE; mask.segments = 96;
  const backing = N('pyroIconBacking', clip).addComponent(Graphics);
  backing.fillColor = C(card.owner === 'pyro' ? '#652E1D' : card.owner === 'mora' ? '#143B5C' : '#2E1C52'); backing.circle(0, 0, size / 2); backing.fill();
  // Slightly cover the viewport so the painted circle reaches its boundary without transparent rim gaps.
  artSprite(clip, 0, 0, size * 1.04, size * 1.04, pickCardArt(card), { sliced: false, fit: false, hideOnLoad });
  return clip;
}

/** No hidden UI trees. All IDs join the shared priority queue and can be promoted on demand. */
export function warmPickArt(heroIds: readonly string[], priority: ArtPriority = 'next'): Promise<void> {
  // Cocos' loose spread transform treats a Set as one array item; convert iterables explicitly.
  const owners = Array.from(new Set(heroIds)).sort();
  const pool = M0_POOL.filter(card => card.owner === 'global' || owners.includes(card.owner));
  const queue = Array.from(new Set(SHARED.concat(owners.map(heroPortraitKey), pool.map(pickCardArt))));
  return warmUXArt(queue, priority);
}
