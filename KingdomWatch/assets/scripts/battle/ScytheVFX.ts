/** Scarlet scythe: Blender elements plus a rising domain, all driven by battle ages. */
import { Graphics,Node } from 'cc';
import { CA,N } from '../ui/UIKit';
import { HeroFxShader } from './HeroFxShader';
import { ScytheAtlas } from './ScytheAtlas';
import { SCYTHE_TIMING as T } from '../config/ScytheConfig';
import { scytheReapCut } from './ScythePlans';
export const SCYTHE_EFFECT='fx/scythe-flow';
interface Accent {x:number;y:number;r:number;age:number;life:number;mode:number;seed:number;}
export interface ScytheReapVisual {x:number;y:number;radius:number;age:number;duration:number;hits:number;seed:number;}
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
 private atlas:ScytheAtlas;private domain:HeroFxShader;
 constructor(parent:Node){this.air=N('scytheVFX',parent.getChildByName('GroundFxLayer')||parent);
  this.domain=new HeroFxShader(this.air,'scytheRisingDomain',3,'plasma',{effect:SCYTHE_EFFECT,technique:0});
  this.ink=N('scytheInk',this.air).addComponent(Graphics);this.shader=new HeroFxShader(this.air,'scytheFire',48,'plasma',{effect:SCYTHE_EFFECT,technique:0});
  this.atlas=new ScytheAtlas(this.air,'scytheBlenderCutsAndWeapon',48);}
 private add(x:number,y:number,r:number,life:number,mode:number):void{if(this.accents.length>=40)this.accents.shift();this.accents.push({x,y,r,age:0,life,mode,seed:(++this.serial*.618)%1});}
 hit(x:number,y:number,r:number):void{this.add(x,y,r,.24,2);}
 charge(x:number,y:number,r:number,life:number):void{this.add(x,y,r,life,3);}
 swing(x:number,y:number,r:number,life:number):void{this.add(x,y,r,life,4);}
 tick(dt:number):void{for(const a of this.accents)a.age+=dt;this.accents=this.accents.filter(a=>a.age<a.life);}
 begin():void{this.ink.clear();this.shader.begin();this.domain.begin();this.atlas.begin();}
 spin(x:number,y:number,r:number,age:number,seed:number,opacity:number,owner:object):void{
  if(opacity<=0)return;
  if(this.atlas.choose(owner)&&this.atlas.draw('spin',x,y,r,age,0,opacity,seed))return;
  if(this.shader.draw(x,y,r*2.8,r*2.8,0,age,seed,opacity,1,r,0))return;
  const a=age*10,co=Math.cos(a),si=Math.sin(a),p=(u:number,v:number)=>[x+(u*co-v*si)*r,y+(u*si+v*co)*r];
  const line=(u:number,v:number,first=false)=>{const q=p(u,v);if(first)this.ink.moveTo(q[0],q[1]);else this.ink.lineTo(q[0],q[1]);};
  this.ink.strokeColor=CA('#FFE8A1',opacity);this.ink.lineWidth=5;
  line(-.38,-.74,true);line(-.21,.65);line(-.49,.65);this.ink.stroke();
  this.ink.fillColor=CA('#FF9B43',opacity);line(-.23,.66,true);
  for(let k=0;k<=24;k++){const t=2-k*2.3/24;line(-.15+Math.cos(t)*.82,-.1+Math.sin(t)*.82);}
  for(let k=24;k>=0;k--){const t=2-k*2.3/24,rr=.82-.14*(1-k/24);line(-.15+Math.cos(t)*rr,-.1+Math.sin(t)*rr);}this.ink.close();this.ink.fill();
 }
 reaping(r:ScytheReapVisual):void{
  const fade=Math.min(1,r.age/.16,Math.max(0,(r.duration-r.age)/.5)),t=r.age/r.duration;
  if(!this.domain.draw(r.x,r.y,r.radius*2.7,r.radius*2.7,0,r.age,r.seed,fade,5,r.radius,t)){
   // Transparent floor and disconnected rising fragments are also present without the shader.
   this.ink.fillColor=CA('#570419',fade*.20);this.ink.circle(r.x,r.y,r.radius*Math.min(1,r.age/.4));this.ink.fill();
   for(let k=0;k<18;k++){const a=k*2.399963+Math.sin(r.age*2+k)*.08,reach=r.radius*(.94+.04*Math.sin(k*7)),lift=(r.age*1.2+k*.217)%1;
    this.ink.strokeColor=CA('#FF1834',fade*(1-lift)*.4);this.ink.lineWidth=1.6;
    const x=r.x+Math.cos(a)*reach,y=r.y+Math.sin(a)*reach;this.ink.moveTo(x,y);this.ink.lineTo(x+Math.sin(k)*6,y+lift*r.radius*.18);this.ink.stroke();}
  }
  const art=this.atlas.choose(r);
  for(let i=0;i<r.hits;i++){
   const age=r.age-T.reapStart-i*T.reapGap;if(age<0||age>.6)continue;
   const final=i===r.hits-1,cut=scytheReapCut(i,r.seed,r.radius,final),count=final?3:2;
   for(let j=0;j<count;j++){
    const localAge=age-j*.035;if(localAge<0)continue;
    const angle=cut.angle+j*(final?Math.PI/3:.92),x=r.x+(j?-.35:1)*cut.x,y=r.y+(j?-.35:1)*cut.y;
    if(art&&this.atlas.draw('slash',x,y,cut.halfLength*(j&&!final?.83:1),localAge,angle,final?1:.95))continue;
    const spread=Math.sin(Math.min(1,localAge/.14)*Math.PI*.5),length=cut.halfLength*spread;
    for(let band=0;band<3;band++){this.ink.strokeColor=CA(band===2?'#FFE2C0':band?'#FF2538':'#59071B',(1-localAge/.6)*(band===0?.6:1));
     this.ink.lineWidth=(band===0?13:band===1?5:1.4)*(final?1.3:1);
     this.ink.moveTo(x-Math.cos(angle)*length,y-Math.sin(angle)*length);this.ink.lineTo(x+Math.cos(angle)*length,y+Math.sin(angle)*length);this.ink.stroke();}
   }
   if(final)this.shader.draw(r.x,r.y,r.radius*2.8,r.radius*2.8,0,age,r.seed,Math.max(0,1-age/.6),6,r.radius,age/.6);
  }
 }
 end():void{for(const a of this.accents){const t=a.age/a.life;
   if(!this.shader.draw(a.x,a.y,a.r*2.8,a.r*2.8,0,a.age,a.seed,1,a.mode,a.r,t)){
    this.ink.strokeColor=CA('#FF9D53',(1-t)*.7);this.ink.lineWidth=3;this.ink.circle(a.x,a.y,Math.max(1,a.r*(.1+t*.5)));this.ink.stroke();
   }}this.shader.end();this.domain.end();this.atlas.end();}
 destroy():void{this.accents.length=0;if(this.air.isValid)this.air.destroy();}
}
