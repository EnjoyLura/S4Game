/** Pure scheduling/geometry; no engine, monster, wall clock or randomness. */
export function lanceRainPlan(x:number,y:number,count:number,radius:number){
  return Array.from({length:Math.max(0,Math.min(16,Math.floor(count)))},(_,i)=>{
    const r=i?radius*.78*Math.sqrt(i/Math.max(1,count-1)):0,a=i*2.39996323;
    return {x:x+Math.cos(a)*r,y:y+Math.sin(a)*r*.65,delay:i*.11};
  });
}
/** Include the last pulse exactly at expiry; never one extra after it. */
export function lanceDuePulses(age:number,next:number,interval:number,seconds:number):number{
  return Math.max(0,Math.floor((Math.min(age,seconds)+1e-7)/interval)-next);
}
export function lanceRecallCount(planted:number,base:number,cap:number):number{
  return Math.min(cap,base+Math.max(0,Math.floor(planted)));
}
export interface LanceFlightPlan {sx:number;sy:number;tx:number;ty:number;vx:number;vy:number;gravity:number;seconds:number;}
/** Constant horizontal velocity and downward acceleration in the throw's projected plane.
 * No lateral steering/control points: a target straight ahead always stays on that X. */
export function lanceFlightPlan(sx:number,sy:number,tx:number,ty:number,kind:'normal'|'rain'|'great'):LanceFlightPlan{
  const gravity=kind==='great'?2400:2100,dx=tx-sx,dy=ty-sy;
  let vy:number,seconds:number;
  if(kind==='rain'){
    vy=-420;seconds=(vy+Math.sqrt(vy*vy+2*gravity*Math.max(1,sy-ty)))/gravity;
    return {sx,sy,tx,ty,vx:dx/seconds,vy,gravity,seconds};
  }
  const distance=Math.hypot(dx,dy);
  seconds=Math.min(1.65,Math.max(kind==='great'?.85:.6,.48+distance/1050));
  // Resolve launch velocity from the fixed endpoint and travel time, then leave it ballistic.
  // Even an unusually distant target must be reached on the descending half of the arc.
  seconds=Math.max(seconds,Math.sqrt(2*Math.max(0,dy+60)/gravity));
  vy=dy/seconds+.5*gravity*seconds;
  return {sx,sy,tx,ty,vx:dx/seconds,vy,gravity,seconds};
}
export function lanceFlightPose(p:LanceFlightPlan,age:number){
  const t=Math.max(0,Math.min(p.seconds,age)),arrived=age>=p.seconds;
  const vy=p.vy-p.gravity*t;
  return {x:arrived?p.tx:p.sx+p.vx*t,y:arrived?p.ty:p.sy+p.vy*t-.5*p.gravity*t*t,
    // Foreshorten the drawing near a stationary projected apex. The projected shaft vector
    // remains continuous even for vx=0, where atan2 alone would flip a full-length spear.
    lengthScale:Math.min(1,Math.hypot(p.vx,vy)/220),
    angle:Math.atan2(vy,p.vx),vx:p.vx,vy,arrived};
}
