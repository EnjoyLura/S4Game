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
export interface LanceFlightPlan {sx:number;sy:number;tx:number;ty:number;vx:number;vy:number;gravity:number;seconds:number;c1x?:number;c1y?:number;c2x?:number;c2y?:number;}
/** A broad projected throw: the landing handle preserves an oblique approach.
 * Ground-map Y is depth, not world altitude; a screen-Y gravity arc used to fall back over itself. */
export function lanceFlightPlan(sx:number,sy:number,tx:number,ty:number,kind:'normal'|'rain'|'great'):LanceFlightPlan{
  const gravity=kind==='great'?2400:2100,dx=tx-sx,dy=ty-sy;
  let vy:number,seconds:number;
  if(kind==='rain'){
    vy=-420;seconds=(vy+Math.sqrt(vy*vy+2*gravity*Math.max(1,sy-ty)))/gravity;
    return {sx,sy,tx,ty,vx:dx/seconds,vy,gravity,seconds};
  }
  const distance=Math.hypot(dx,dy),side=Math.abs(dx)>90?Math.sign(dx):(tx>=0?1:-1);
  const near=Math.min(1,Math.max(.15,distance/200));
  // Separate the lateral and vertical turning points even when the target is directly ahead.
  const landingX=side*Math.max(85*near,Math.abs(dx)*.36),bend=Math.max(0,1-Math.abs(dx)/150)*280*near;
  const c1x=Math.max(-355,Math.min(355,sx+dx*.23-side*bend));
  const c2x=tx-landingX,c2y=ty+Math.abs(landingX)*.88;
  const c1y=Math.max(sy,ty)+Math.min(220,80+distance*.17)*near+Math.max(0,dy)*.2;
  seconds=Math.min(1.65,Math.max(kind==='great'?.85:.6,.48+distance/1050));
  return {sx,sy,tx,ty,c1x,c1y,c2x,c2y,vx:3*(c1x-sx)/seconds,vy:3*(c1y-sy)/seconds,gravity:0,seconds};
}
export function lanceFlightPose(p:LanceFlightPlan,age:number){
  const t=Math.max(0,Math.min(p.seconds,age)),arrived=age>=p.seconds;
  if(p.c1x!==undefined){
    const u=t/p.seconds,v=1-u,ax=p.c1x,ay=p.c1y!,bx=p.c2x!,by=p.c2y!;
    const x=v*v*v*p.sx+3*v*v*u*ax+3*v*u*u*bx+u*u*u*p.tx;
    const y=v*v*v*p.sy+3*v*v*u*ay+3*v*u*u*by+u*u*u*p.ty;
    const vx=3*(v*v*(ax-p.sx)+2*v*u*(bx-ax)+u*u*(p.tx-bx))/p.seconds;
    const vy=3*(v*v*(ay-p.sy)+2*v*u*(by-ay)+u*u*(p.ty-by))/p.seconds;
    return {x:arrived?p.tx:x,y:arrived?p.ty:y,vx,vy,angle:Math.atan2(vy,vx),arrived};
  }
  const vy=p.vy-p.gravity*t;
  return {x:arrived?p.tx:p.sx+p.vx*t,y:arrived?p.ty:p.sy+p.vy*t-.5*p.gravity*t*t,
    angle:Math.atan2(vy,p.vx),vx:p.vx,vy,arrived};
}
