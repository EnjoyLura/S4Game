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
/** Constant downward acceleration. Apex clearance determines a readable throw, not an end-of-flight turn. */
export function lanceFlightPlan(sx:number,sy:number,tx:number,ty:number,kind:'normal'|'rain'|'great'):LanceFlightPlan{
  const gravity=kind==='great'?2400:2100,dx=tx-sx,dy=ty-sy;
  let vy:number,seconds:number;
  if(kind==='rain'){
    vy=-420;seconds=(vy+Math.sqrt(vy*vy+2*gravity*Math.max(1,sy-ty)))/gravity;
  }else{
    const distance=Math.hypot(dx,dy),clearance=kind==='great'?Math.min(240,160+distance*.07):Math.min(145,70+distance*.08);
    const apex=Math.max(sy,ty)+clearance;
    vy=Math.sqrt(2*gravity*(apex-sy));seconds=vy/gravity+Math.sqrt(2*(apex-ty)/gravity);
  }
  return {sx,sy,tx,ty,vx:dx/seconds,vy,gravity,seconds};
}
export function lanceFlightPose(p:LanceFlightPlan,age:number){
  const t=Math.max(0,Math.min(p.seconds,age)),vy=p.vy-p.gravity*t,arrived=age>=p.seconds;
  // A near-vertical throw has vanishing speed at its apex. Preserve angular inertia there,
  // instead of flipping the long weapon by 180 degrees in one frame. Landing remains the exact tangent.
  const turnX=p.vx+(p.vx<0?-1:1)*Math.max(0,100-Math.abs(p.vx))*Math.exp(-((vy/240)**2))*Math.sin(Math.PI*t/p.seconds)**2;
  return {x:arrived?p.tx:p.sx+p.vx*t,y:arrived?p.ty:p.sy+p.vy*t-.5*p.gravity*t*t,
    angle:Math.atan2(vy,arrived?p.vx:turnX),vx:p.vx,vy,arrived};
}
