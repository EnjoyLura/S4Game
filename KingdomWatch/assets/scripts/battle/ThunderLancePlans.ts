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
