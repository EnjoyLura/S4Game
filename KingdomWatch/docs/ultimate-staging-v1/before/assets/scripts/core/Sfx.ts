/** Existing combat API backed by the licensed sample mixer. */
import { GameAudio } from './GameAudio';
import { SfxName } from './AudioCatalog';
export type { SfxName } from './AudioCatalog';

const SHOTS: Record<string, SfxName> = { archer: 'bow', sniper: 'crossbow', pyro: 'fire', volt: 'thunder', mora: 'frost' };
const ULTIMATES: Record<string, SfxName> = { archer: 'bowUlt', sniper: 'snipe', pyro: 'fireUlt', volt: 'thunderUlt', mora: 'frostUlt' };
const SKILLS: Record<string, SfxName> = { archer: 'skill', sniper: 'snipe', pyro: 'fireSkill', volt: 'thunderSkill', mora: 'frostSkill' };
const HITS: Record<string, SfxName> = { archer: 'hit', sniper: 'pierce', pyro: 'crush', volt: 'zapHit', mora: 'icebreak' };
const HEAVY_HITS: Record<string, SfxName> = { archer: 'crit', sniper: 'pierceHeavy', pyro: 'fireHeavy', volt: 'thunderHeavy', mora: 'frostHeavy' };

export const Sfx = {
  play(name: SfxName): void { GameAudio.play(name); },
  shoot(heroId: string): void { GameAudio.play(SHOTS[heroId] || 'shoot'); },
  cast(heroId: string, ultimate = false): void {
    GameAudio.play(ultimate ? ULTIMATES[heroId] || 'ult' : SKILLS[heroId] || 'skill');
  },
  impact(heroId: string, heavy = false): void {
    GameAudio.play(heavy ? HEAVY_HITS[heroId] || 'crit' : HITS[heroId] || 'hit');
  },
};
