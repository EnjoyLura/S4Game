/** The picker preloads exactly the same art keys it renders, scoped to the equipped squad. */
import { CardDef, M0_POOL } from '../config/Cards';
import { heroPortraitKey } from './HeroComic';
import { uxFrame } from './Ux';

const SHARED = ['pick_comic_v1/title_plate', 'pick_comic_v1/card_base', 'pick_comic_v1/header_strip'];
const CARD_ART: Record<string, string> = {
  heavy_head: 'ui_card_sharp', fast_load: 'ui_card_swift',
  steady_rest: 'ui_card_crit_rate', lethal_aim: 'ui_card_crit_dmg',
  instinct_s: 'ui_card_instinct_a', fast_charge_s: 'ui_card_fast_charge_a',
  pyro_cd: 'ui_card_cd_cut', pyro_eager: 'ui_card_fast_charge_a',
  volt_cd: 'ui_card_cd_cut', volt_eager: 'ui_card_fast_charge_a',
  mora_cd: 'ui_card_cd_cut', mora_eager: 'ui_card_fast_charge_a', mora_linger: 'ui_card_cd_cut',
};
const jobs = new Map<string, Promise<void>>();

export function pickCardArt(card: CardDef): string {
  return card.art || (card.unlocks ? 'ui_icon_' + card.unlocks + '_' + card.owner
    : CARD_ART[card.id] || 'ui_card_' + card.id);
}

/** No nodes or hidden UI trees. Two low-priority requests at a time, shared by lobby / battle. */
export function warmPickArt(heroIds: readonly string[]): Promise<void> {
  // Cocos' loose spread transform treats a Set as one array item; convert iterables explicitly.
  const owners = Array.from(new Set(heroIds)).sort(), key = owners.join(',');
  const pending = jobs.get(key); if (pending) return pending;
  const pool = M0_POOL.filter(card => card.owner === 'global' || owners.includes(card.owner));
  const queue = Array.from(new Set(SHARED.concat(owners.map(heroPortraitKey), pool.map(pickCardArt))));
  let index = 0;
  const next = (): Promise<void> => {
    if (index >= queue.length) return Promise.resolve();
    const id = queue[index++];
    return new Promise<void>(resolve => uxFrame(id, () => resolve()))
      .then(() => new Promise<void>(resolve => setTimeout(resolve, 16))).then(next);
  };
  const job = Promise.all([next(), next()]).then(() => { jobs.delete(key); });
  jobs.set(key, job);
  return job;
}
