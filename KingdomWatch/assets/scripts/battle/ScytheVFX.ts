/** Procedural red-orange scythe: no effect sprites and no wall-clock timers. */
import { Graphics,Node } from 'cc';
import { CA,N } from '../ui/UIKit';
import { HeroFxShader } from './HeroFxShader';
export const SCYTHE_EFFECT='fx/scythe-flow';
interface Accent {x:number;y:number;r:number;age:number;life:number;mode:number;seed:number;}
export function drawScytheBlade(shader:HeroFxShader|null,g:Graphics,x:number,y:number,angle:number,r:number,age:number,seed:number):void{
 if(shader?.draw(x,y,r*2.5,r*2.05,angle*180/Math.PI-90,age,seed,1,0,r,0))return;
 const ux=Math.cos(angle),uy=Math.sin(angle),px=-uy,py=ux;
 const point=(s:number,back:number)=>({x:x+px*s*r-ux*back*r,y:y+py*s*r-uy*back*r});
 for(const[width,alpha]of [[.10,.18],[.045,.65],[.015,1]]){
  g.strokeColor=CA(width<.02?'#FFF3BB':'#FF703B',alpha);g.lineWidth=Math.max(1,r*width);
  for(let k=0;k<=32;k++){const s=k/16-1,p=point(s,.3*s*s);if(k===0)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);}g.stroke();
 }
 for(let k=0;k<22;k++){const s=k/11-1,phase=(age*(2.5+k*.06)+k*.173)%1;
  const len=.55*(1-s*s),a=point(s,.3*s*s+phase*len),b=point(s+.025*Math.sin(age*19+k),.3*s*s+phase*len+.1);
  g.strokeColor=CA('#FFAB54',(1-phase)*.5);g.lineWidth=1.2;g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
 }
}
export class ScytheVFX {
 private air:Node;private ink:Graphics;private shader:HeroFxShader;private accents:Accent[]=[];private serial=0;
 constructor(parent:Node){this.air=N('scytheVFX',parent);const text=parent.getChildByName('TextLayer');if(text)this.air.setSiblingIndex(text.getSiblingIndex());
  this.ink=N('scytheInk',this.air).addComponent(Graphics);this.shader=new HeroFxShader(this.air,'scytheFire',48,'plasma',{effect:SCYTHE_EFFECT,technique:0});}
 private add(x:number,y:number,r:number,life:number,mode:number):void{if(this.accents.length>=40)this.accents.shift();this.accents.push({x,y,r,age:0,life,mode,seed:(++this.serial*.618)%1});}
 hit(x:number,y:number,r:number):void{this.add(x,y,r,.24,2);}
 charge(x:number,y:number,r:number,life:number):void{this.add(x,y,r,life,3);}
 swing(x:number,y:number,r:number,life:number):void{this.add(x,y,r,life,4);}
 tick(dt:number):void{for(const a of this.accents)a.age+=dt;this.accents=this.accents.filter(a=>a.age<a.life);}
 begin():void{this.ink.clear();this.shader.begin();}
 spin(x:number,y:number,r:number,age:number,seed:number,opacity:number):void{
  if(opacity<=0)return;
  if(this.shader.draw(x,y,r*2.8,r*2.8,0,age,seed,opacity,1,r,0))return;
  const a=age*10,co=Math.cos(a),si=Math.sin(a),p=(u:number,v:number)=>[x+(u*co-v*si)*r,y+(u*si+v*co)*r];
  const line=(u:number,v:number,first=false)=>{const q=p(u,v);if(first)this.ink.moveTo(q[0],q[1]);else this.ink.lineTo(q[0],q[1]);};
  this.ink.strokeColor=CA('#FFE8A1',opacity);this.ink.lineWidth=5;
  line(-.38,-.74,true);line(-.21,.65);line(-.49,.65);this.ink.stroke();
  this.ink.fillColor=CA('#FF9B43',opacity);line(-.23,.66,true);
  for(let k=0;k<=24;k++){const t=2-k*2.3/24;line(-.15+Math.cos(t)*.82,-.1+Math.sin(t)*.82);}
  for(let k=24;k>=0;k--){const t=2-k*2.3/24,rr=.82-.14*(1-k/24);line(-.15+Math.cos(t)*rr,-.1+Math.sin(t)*rr);}this.ink.close();this.ink.fill();
 }
 end():void{for(const a of this.accents){const t=a.age/a.life;
   if(!this.shader.draw(a.x,a.y,a.r*2.8,a.r*2.8,0,a.age,a.seed,1,a.mode,a.r,t)){
    this.ink.strokeColor=CA('#FF9D53',(1-t)*.7);this.ink.lineWidth=3;this.ink.circle(a.x,a.y,Math.max(1,a.r*(.1+t*.5)));this.ink.stroke();
   }}this.shader.end();}
 destroy():void{this.accents.length=0;if(this.air.isValid)this.air.destroy();}
}
