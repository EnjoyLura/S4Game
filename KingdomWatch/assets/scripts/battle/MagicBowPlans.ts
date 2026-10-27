import { MAGIC_BOW_TIMING as T } from '../config/MagicBowConfig';
/** Offsets describe one ascent, one descent and two distinct damage events. */
export function magicBowTimeline(){const sky=T.windup+T.ascent,fall=sky+T.skyPause,impact=fall+T.descent,blast=impact+T.detonation;
 return {launch:T.windup,sky,fall,impact,blast,end:blast+T.tail};}
export function magicBowPhase(age:number):'prepare'|'ascent'|'sky'|'descent'|'impact'|'blast'|'done'{
 const p=magicBowTimeline();return age<p.launch?'prepare':age<p.sky?'ascent':age<p.fall?'sky':age<p.impact?'descent':age<p.blast?'impact':age<p.end?'blast':'done';
}
