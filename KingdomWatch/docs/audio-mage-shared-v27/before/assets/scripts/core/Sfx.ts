/** Existing combat API backed by the licensed sample mixer. */
import { GameAudio } from './GameAudio';
import { SfxName } from './AudioCatalog';
export type { SfxName } from './AudioCatalog';

const SHOTS: Record<string, SfxName> = { archer: 'bow', sniper: 'crossbow', pyro: 'fire', volt: 'thunder', mora: 'frost' };
const ULTIMATES: Record<string, SfxName> = { archer: 'bowUlt', sniper: 'snipe', pyro: 'fireUlt', volt: 'thunderUlt', mora: 'frostUlt' };
const SKILLS: Record<string, SfxName> = { archer: 'skill', sniper: 'snipe', pyro: 'fireSkill', volt: 'thunderSkill', mora: 'frostSkill' };
const HEAVY_HITS: Record<string, SfxName> = { archer: 'crit', sniper: 'pierceHeavy', pyro: 'fireHeavy', volt: 'thunderHeavy', mora: 'frostHeavy' };

export const Sfx = {
  prepareUltimate(heroId: string, seconds: number): void { GameAudio.prepareUltimate(heroId, seconds); },
  play(name: SfxName): void { GameAudio.play(name); },
  shoot(heroId: string): void { GameAudio.play(SHOTS[heroId] || 'shoot'); },
  death(heroId: string, frozen = false, heavy = false): void {
    const element = heroId === 'pyro' || heroId === 'burn' ? 'fire'
      : heroId === 'mora' || frozen ? 'frost' : heroId === 'volt' ? 'volt' : 'physical';
    GameAudio.death(element, heavy);
  },
  cast(heroId: string, ultimate = false): void {
    GameAudio.play(ultimate ? ULTIMATES[heroId] || 'ult' : SKILLS[heroId] || 'skill');
  },
  impact(heroId: string, heavy = false): void {
    // Ordinary contacts are emitted once by actual monster damage, including area/chain hits.
    if (heavy) GameAudio.play(HEAVY_HITS[heroId] || 'crit');
  },
};
