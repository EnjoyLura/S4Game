/** Live geometry query, not a lingering debuff: leaving/ending an eye restores resistance immediately. */
export interface WindEyeRegion {kind:string;x:number;y:number;radius:number;age:number;duration:number;delay:number;}
interface Source {areas:readonly WindEyeRegion[];strength:()=>number;}
const sources=new WeakMap<object,Map<object,Source>>();
export function registerWindEyes(manager:object,owner:object,areas:readonly WindEyeRegion[],strength:()=>number):void {
  let group=sources.get(manager);if(!group){group=new Map();sources.set(manager,group);}group.set(owner,{areas,strength});
}
export function removeWindEyes(manager:object,owner?:object):void {
  if(owner)sources.get(manager)?.delete(owner);else sources.delete(manager);
}
export function windEyeShredAt(manager:object|null,x:number,y:number):number {
  const group=manager&&sources.get(manager);if(!group)return 0;let amount=0;
  for(const source of group.values()){
    const strength=source.strength();if(strength<=amount)continue;
    for(const a of source.areas)if(a.kind==='eye'&&a.delay<=0&&a.age<a.duration&&
      (x-a.x)**2+(y-a.y)**2<=a.radius*a.radius){amount=strength;break;}
  }return amount;
}
