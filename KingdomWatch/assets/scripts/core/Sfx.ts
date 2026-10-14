/** Existing combat API backed by the licensed sample mixer. */
import { GameAudio } from './GameAudio';
import { SfxName } from './AudioCatalog';
export type { SfxName } from './AudioCatalog';

const SHOTS: Record<string, SfxName> = { archer: 'bow', sniper: 'crossbow', pyro: 'fire', volt: 'thunder', mora: 'frost' };
const ULTIMATES: Record<string, SfxName> = { archer: 'bowUlt', sniper: 'snipe', pyro: 'fireUlt', volt: 'thunderUlt', mora: 'frostUlt' };

export const Sfx = {
  play(name: SfxName): void { GameAudio.play(name); },
  shoot(heroId: string): void { GameAudio.play(SHOTS[heroId] || 'shoot'); },
  cast(heroId: string, ultimate = false): void {
    GameAudio.play(ultimate ? ULTIMATES[heroId] || 'ult' : heroId === 'pyro' ? 'fireSkill' : heroId === 'mora' ? 'frostSkill' : 'skill');
  },
  impact(heroId: string, heavy = false): void {
    GameAudio.play(heroId === 'pyro' ? 'crush' : heroId === 'volt' ? 'zapHit'
      : heroId === 'mora' ? 'icebreak' : heavy ? 'pierce' : 'hit');
  },
};
