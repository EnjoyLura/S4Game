/** Existing combat API backed by the licensed sample mixer. */
import { GameAudio } from './GameAudio';
import { SfxName } from './AudioCatalog';
export type { SfxName } from './AudioCatalog';

const SHOTS: Record<string, SfxName> = { space:'skill', sword:'skill', wind: 'bow', ninja: 'crossbow', cannon: 'snipe', siphon: 'skill', archer: 'bow', sniper: 'crossbow', pyro: 'fire', volt: 'thunder', mora: 'frost' };
const ULTIMATES: Record<string, SfxName> = { space:'ult', sword:'ult', wind: 'bowUlt', ninja: 'ult', cannon: 'fireUlt', siphon: 'ult', archer: 'bowUlt', sniper: 'snipe', pyro: 'fireUlt', volt: 'thunderUlt', mora: 'frostUlt' };
const SKILLS: Record<string, SfxName> = { space:'skill', sword:'skill', wind: 'skill', ninja: 'pierce', cannon: 'fireHeavy', siphon: 'skill', archer: 'skill', sniper: 'snipe', pyro: 'fireSkill', volt: 'thunderSkill', mora: 'frostSkill' };
const HEAVY_HITS: Record<string, SfxName> = { space:'pierceHeavy', sword:'pierceHeavy', wind: 'crit', ninja: 'pierceHeavy', cannon: 'fireHeavy', siphon: 'crit', archer: 'crit', sniper: 'pierceHeavy', pyro: 'fireHeavy', volt: 'thunderHeavy', mora: 'frostHeavy' };

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
  /** Called by the actual meteor, lightning or ice contact, never the wind-up. */
  ultimateImpact(heroId: string): void {
    if (heroId === 'pyro' || heroId === 'volt' || heroId === 'mora') GameAudio.play(ULTIMATES[heroId]);
    // Also cover an empty-ground meteor; the damage path coalesces the same instant's heavy hit.
    if (heroId === 'pyro') GameAudio.play('fireHeavy');
  },
  impact(heroId: string, heavy = false): void {
    // All positive attack damage calls here once, including area, chain, crit and heavy hits.
    GameAudio.play(heavy ? HEAVY_HITS[heroId] || 'crit' : 'hit');
  },
};
