/** Pure placement/timing recipes. No engine, actor, or wall-clock state. */
import { SWORD } from '../config/SpaceSwordConfig';
export interface SwordArena {left:number;right:number;bottom:number;top:number;}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function spacePulseAt(index:number,start:number,duration:number,count:number):number {
  return start+(index+.5)*duration/count;
}
export function swordRainPlan(x:number,y:number,count:number,radius:number) {
  const result:{x:number;y:number;final:boolean;delay:number}[]=[];
  for(let k=0;k<count;k++){
    const angle=k*2.399963,r=Math.sqrt((k+.5)/count)*radius*.78;
    result.push({x:x+Math.cos(angle)*r,y:y+Math.sin(angle)*r*.65,final:false,delay:k*SWORD.rainGap});
  }
  result.push({x,y,final:true,delay:(count+1)*SWORD.rainGap});return result;
}
/** Four oblique strikes in depth/width, then a vertical center finisher. Count is always five. */
export function heavenSwordPlan(x:number,y:number,radius:number,arena:SwordArena) {
  const offsets=[[-.55,0],[0,.45],[.55,0],[0,-.45],[0,0]],lean=[-210,-100,210,100,0];
  return offsets.map(([dx,dy],k)=>{
    const px=clamp(x+dx*radius,arena.left,arena.right),py=clamp(y+dy*radius,arena.bottom,arena.top);
    return {x:px,y:py,startX:px+lean[k],startY:Math.max(arena.top+160,py+480+(k%2)*90),
      delay:k*SWORD.heavenGap+(k===4?SWORD.heavenPause:0),seconds:k===4?.52:.38,final:k===4};
  });
}
