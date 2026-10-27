import { SCYTHE_TIMING as T } from '../config/ScytheConfig';
/** Pure presentation and hit schedule. A throw / recall never ticks damage. */
export function scythePose(age:number,duration:number,sx:number,sy:number,x:number,y:number){
 const arrive=T.skillWindup+T.throw,recall=arrive+duration,end=recall+T.recall;
 let t=0,px=sx,py=sy,opacity=1;
 if(age<arrive){t=Math.max(0,(age-T.skillWindup)/T.throw);t=1-(1-t)**2;px=sx+(x-sx)*t;py=sy+(y-sy)*t;}
 else if(age<recall){px=x;py=y;}
 else {t=Math.min(1,(age-recall)/T.recall);px=x+(sx-x)*t;py=y+(sy-y)*t;opacity=1-t;}
 return {x:px,y:py,opacity:age<T.skillWindup?0:opacity,active:age>=arrive&&age<recall,end};
}
export function scythePulseCount(age:number,duration:number){
 const activeAge=age-T.skillWindup-T.throw;
 return activeAge<-1e-7?0:Math.min(Math.ceil(duration/T.tick),Math.floor((activeAge+1e-7)/T.tick)+1);
}
export function scytheReapPulseCount(age:number,hits:number):number{
 return age<T.reapStart-1e-7?0:Math.min(hits,Math.floor((age-T.reapStart+1e-7)/T.reapGap)+1);
}
/** Each cut shares the damaging domain's center; different chords carve through it in rapid succession. */
export function scytheReapCut(index:number,seed:number,radius:number,final=false){
 const angle=(index*2.3999632297+seed*1.7)%(Math.PI*2),offset=final?0:Math.sin(index*7.13+seed)*radius*.32;
 return {angle,x:-Math.sin(angle)*offset,y:Math.cos(angle)*offset,
  halfLength:Math.sqrt(radius*radius-offset*offset)*(final?1.13:1.06)};
}
export function scytheInDomain(x:number,y:number,cx:number,cy:number,radius:number):boolean{
 return (x-cx)**2+(y-cy)**2<=radius*radius;
}
/** Sweep the visible crescent (24 capsule segments), including curved tips and zero-length steps.
 * Axes are forward / transverse. Returns earliest time in [0,1], or Infinity. */
export function scytheBladeEntry(forward:number,lateral:number,travel:number,half:number,radius:number):number{
 if(half<=0||radius<0||travel<0)return Infinity;
 let best=Infinity;const vx=-travel,r2=radius*radius;
 const circle=(ax:number,ay:number)=>{const x=forward-ax,y=lateral-ay,c=x*x+y*y-r2;if(c<=0)return 0;
  const b=x*vx,disc=b*b-travel*travel*c;if(travel<=1e-8||b>=0||disc<0)return Infinity;
  const t=(-b-Math.sqrt(disc))/(travel*travel);return t>=0&&t<=1?t:Infinity;};
 for(let k=0;k<24;k++){
  const ay=(k/12-1)*half,by=((k+1)/12-1)*half,ax=.72*(Math.sqrt(Math.max(0,1-(ay/half)**2))-1)*half,bx=.72*(Math.sqrt(Math.max(0,1-(by/half)**2))-1)*half;
  const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,nx=-uy,ny=ux;
  const px=forward-ax,py=lateral-ay,along=px*ux+py*uy,dist=px*nx+py*ny;
  if(along>=0&&along<=len&&Math.abs(dist)<=radius)return 0;
  best=Math.min(best,circle(ax,ay),circle(bx,by));
  const normalV=vx*nx;if(Math.abs(normalV)<1e-8)continue;
  for(let side=-1;side<=1;side+=2){const t=(side*radius-dist)/normalV,projection=along+vx*ux*t;
   if(t>=0&&t<=1&&projection>=0&&projection<=len)best=Math.min(best,t);}
 }return best;
}
