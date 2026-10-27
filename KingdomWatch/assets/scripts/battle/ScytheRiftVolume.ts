/** Cosmetic space cuts. This schedule never controls damage or changes the combat clock. */
import { SCYTHE_TIMING as T } from '../config/ScytheConfig';
export interface SpatialRift {
 birth:number;life:number;x:number;groundY:number;lift:number;reach:number;
 pitch:number;yaw:number;roll:number;thickness:number;near:boolean;seed:number;final:boolean;
}
export function scytheRiftVolume(seed:number):readonly SpatialRift[]{
 const hash=(v:number)=>{const n=Math.sin(v*127.1+seed*311.7)*43758.5453;return n-Math.floor(n);};
 const result:SpatialRift[]=[],finish=T.reapStart+8*T.reapGap;
 for(let i=0;i<72;i++){
  const final=i>=64,k=i*29+13,az=hash(k)*Math.PI*2;
  const radial=Math.sqrt(hash(k+1))*(final?.48:.82),depth=hash(k+2);
  // Unequal clustered arrivals are independent of the nine damage beats.
  const birth=final?finish+(i-64)*.013:T.reapStart+(i+hash(k+3)*.65)/64*(finish-T.reapStart-.12);
  const lift=.08+hash(k+4)*.60;
  result.push({birth,life:final?.30+hash(k+5)*.12:.20+hash(k+5)*.16,
   x:i===64?0:Math.cos(az)*radial,groundY:i===64?0:Math.sin(az)*radial*.75,lift:i===64?.32:lift,
   reach:final?(i===64?1.22:.64+hash(k+6)*.42):.35+hash(k+6)*.72,
   pitch:(hash(k+7)>.5?1:-1)*(18+hash(k+8)*46),yaw:(hash(k+9)-.5)*112,
   roll:final&&i===64?52:hash(k+10)*360,
   thickness:final&&i===64?1.4:.55+depth*.65,
   near:depth>.34,seed:hash(k+11),final});
 }
 return result.sort((a,b)=>b.groundY-a.groundY||a.birth-b.birth);
}

/** Match Cocos Quat.fromEuler (YZX convention), then Sprite SIMPLE's world-vertex XY projection.
 * Returned XY columns let accompanying motes follow the same tilted plane as the textured rift. */
export function scytheRiftBasis(pitch:number,yaw:number,roll:number){
 const h=Math.PI/360,sx=Math.sin(pitch*h),cx=Math.cos(pitch*h),sy=Math.sin(yaw*h),cy=Math.cos(yaw*h),sz=Math.sin(roll*h),cz=Math.cos(roll*h);
 const x=sx*cy*cz+cx*sy*sz,y=cx*sy*cz+sx*cy*sz,z=cx*cy*sz-sx*sy*cz,w=cx*cy*cz-sx*sy*sz;
 return {xx:1-2*(y*y+z*z),xy:2*(x*y+w*z),yx:2*(x*y-w*z),yy:1-2*(x*x+z*z)};
}
