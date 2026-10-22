/** Entry art first; only the selected battlefield and equipped heroes need a first-paint barrier. */
import { director } from 'cc';
import { battleSceneKey } from '../config/Campaign';
import { preloadArcherClip } from '../battle/ArcherIdleAnimation';
import { preloadHeroClip } from '../battle/HeroSequenceAnimation';
import { getMobAnims } from '../battle/MobAnim';
import { uxFrame } from './Ux';
import { warmPickArt } from './PickArt';

export const ENTRY_GATE_ART = 'battle_entry_v3/outpost_gate';
export const THREAT_ART = ['boss_warning_v1/banner', 'boss_warning_v1/crest'] as const;
const HERO_CLIPS: Record<string, [string, string]> = {
  sniper: ['sniper_idle_natural_v2', 'sniper_attack_clean_v1'],
  pyro: ['pyro_idle_loop_v2', 'pyro_attack_user_v2'],
  volt: ['volt_idle_natural_v1', 'volt_attack_user_v2'],
  mora: ['mora_idle_user_v1', 'mora_attack_user_v1'],
};
const jobs = new Map<string, Promise<void>>();
let sceneJob: Promise<boolean> | null = null;

function imageReady(id: string): Promise<void> {
  return new Promise(resolve => uxFrame(id, () => resolve()));
}

/** Called immediately on reaching the lobby, before the long idle-art queue. */
export function warmEntryArt(): void { uxFrame(ENTRY_GATE_ART, () => {}); }

export function warmBattleScene(): Promise<boolean> {
  if (!sceneJob) {
    sceneJob = new Promise(resolve => director.preloadScene('Main', error => resolve(!error)));
    sceneJob.then(ok => { if (!ok) sceneJob = null; });
  }
  return sceneJob;
}

/** Failures settle to the existing fallback. Pending work is shared; failed assets may retry later. */
export function warmBattlefield(levelId: string, heroIds: readonly string[]): Promise<void> {
  const ids = heroIds.length ? [...heroIds] : ['archer', 'sniper'];
  const key = levelId + ':' + ids.join(',');
  const hit = jobs.get(key); if (hit) return hit;
  warmEntryArt(); void warmBattleScene();
  if (levelId === '1-5' || levelId === '1-10') getMobAnims(() => {}, 'goblin_king');
  const firstPaint = [imageReady(battleSceneKey(levelId)), imageReady('defense_wall')];
  for (const id of ids) {
    if (id === 'archer') {
      firstPaint.push(preloadArcherClip('idle'));
      // Attack sheets follow idle sheets, so a large combat atlas cannot delay the first hero pose.
      void preloadArcherClip('idle').then(() => preloadArcherClip('attack'));
    } else if (HERO_CLIPS[id]) {
      const [idle, attack] = HERO_CLIPS[id];
      firstPaint.push(preloadHeroClip(idle, 'idle'));
      void preloadHeroClip(idle, 'idle').then(() => preloadHeroClip(attack, 'attack'));
    }
    // HUD decorations are warm, but never hold an opaque screen hostage.
    for (const part of ['avatar', 'icon_atk', 'icon_skill', 'icon_ult']) {
      uxFrame('ui_' + part + '_' + id, () => {});
    }
  }
  const job = Promise.all(firstPaint).then(() => {
    jobs.delete(key);
    // Cards warm behind the lobby / prepare countdown, never hold the opaque entry screen.
    void warmPickArt(ids);
    for (const key of THREAT_ART) uxFrame(key, () => {});
  });
  jobs.set(key, job);
  return job;
}
