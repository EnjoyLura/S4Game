import { EARLY_FIRST_WIN_GOLD } from '../config/EarlyEconomy';
import { loadSave } from './SaveData';

/** Read live stars/receipts, never cache first-win availability in a challenge definition. */
export function earlyFirstWinGold(id: string, difficulty: number): number {
  const amount = difficulty === 0 ? EARLY_FIRST_WIN_GOLD[id] || 0 : 0;
  if (!amount) return 0;
  const sv = loadSave();
  return !sv.stars[id] && !sv.earlyGold!.claimed[id] ? amount : 0;
}

/** Mark only; the caller credits gold and commits this receipt with victory stars and gifts. */
export function claimEarlyFirstWinGold(id: string, difficulty: number, previousStars: number): number {
  if (previousStars) return 0;
  const amount = earlyFirstWinGold(id, difficulty);
  if (amount) loadSave().earlyGold!.claimed[id] = true;
  return amount;
}
