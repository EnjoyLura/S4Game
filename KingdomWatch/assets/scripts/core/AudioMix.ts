/** One place to tune the mix; source differences are handled by batch calibration. */
import { SFX_AUTO_TRIM_DB, SFX_MIX_CATEGORY } from './AudioMixCalibration';

export const SFX_MASTER_TRIM_DB = 0;
export const SFX_CATEGORY_TRIM_DB: Readonly<Record<string, number>> = {
  attack: 0,
  hit: 0,
  heavy: 0,
  ultimate: 0,
  ui: 0,
  reward: 0,
  result: 0,
  world: 0,
};

export function sfxMixGain(cue: string, file: string, baseGain: number): number {
  const trim = (SFX_AUTO_TRIM_DB[cue + ':' + file] ?? 0)
    + (SFX_CATEGORY_TRIM_DB[SFX_MIX_CATEGORY[cue]] ?? 0) + SFX_MASTER_TRIM_DB;
  return baseGain * Math.pow(10, trim / 20);
}
