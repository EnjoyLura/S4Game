/** Scarlet scythe: Blender elements plus a rising domain, all driven by battle ages. */
import { Graphics,Node } from 'cc';
import { CA,N } from '../ui/UIKit';
import { HeroFxShader } from './HeroFxShader';
import { ScytheAtlas } from './ScytheAtlas';
import { SCYTHE_TIMING as T } from '../config/ScytheConfig';
import { scytheRiftBasis,scytheRiftVolume,SpatialRift } from './ScytheRiftVolume';
export const SCYTHE_EFFECT='fx/scythe-flow';
interface Accent {x:number;y:number;r:number;age:number;life:number;mode:number;seed:number;}
export interface ScytheReapVisual {x:number;y:number;radius:number;age:number;duration:number;hits:number;seed:number;}
export function drawScytheBlade(shader:HeroFxShader|null,g:Graphics,x:number,y:number,angle:number,r:number,age:number,seed:number):void{
 if(shader?.draw(x,y,r*2.5,r*2.05,angle*180/Math.PI-90,age,seed,1,0,r,0))return;
 const ux=Math.cos(angle),uy=Math.sin(angle),px=-uy,py=ux;
 const point=(s:number,back:number)=>({x:x+px*s*r-ux*back*r,y:y+py*s*r-uy*back*r});
 for(const[width,alpha]of [[.10,.18],[.045,.65],[.015,1]]){
  g.strokeColor=CA(width<.02?'#FFF3BB':'#FF703B',alpha);g.lineWidth=Math.max(1,r*width);
  for(let k=0;k<=32;k++){const s=k/16-1,p=point(s,.72*(1-Math.sqrt(Math.max(0,1-s*s))));if(k===0)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);}g.stroke();
 }
 g.fillColor=CA('#21010B',.85);
 for(let k=0;k<=32;k++){const s=k/16-1,env=Math.sqrt(Math.max(0,1-s*s)),p=point(s,.72*(1-env)+.05);if(k===0)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);}
 for(let k=32;k>=0;k--){const s=k/16-1,env=Math.sqrt(Math.max(0,1-s*s)),p=point(s,.72*(1-env)+env*(.58+.10*Math.sin(k*1.9-age*9)));g.lineTo(p.x,p.y);}
 g.close();g.fill();
}
export class ScytheVFX {
 private air:Node;private front:Node;private ink:Graphics;private shader:HeroFxShader;private accents:Accent[]=[];private serial=0;
 private atlas:ScytheAtlas;private frontAtlas:ScytheAtlas;private frontShader:HeroFxShader;private domain:HeroFxShader;
 private readonly riftVolumes=new WeakMap<object,readonly SpatialRift[]>();
 constructor(parent:Node){this.air=N('scytheVFX',parent.getChildByName('GroundFxLayer')||parent);
  this.domain=new HeroFxShader(this.air,'scytheRisingDomain',3,'plasma',{effect:SCYTHE_EFFECT,technique:0});
  this.ink=N('scytheInk',this.air).addComponent(Graphics);this.shader=new HeroFxShader(this.air,'scytheFire',48,'plasma',{effect:SCYTHE_EFFECT,technique:0});
  this.atlas=new ScytheAtlas(this.air,'scytheBlenderCutsAndWeapon',48);
  this.front=N('scytheNearVolume',parent.getChildByName('FxLayer')||parent);
  this.frontShader=new HeroFxShader(this.front,'scytheNearAtmosphere',32,'plasma',{effect:SCYTHE_EFFECT,technique:0});
  this.frontAtlas=new ScytheAtlas(this.front,'scytheNearCutsAndVortex',48);}
 private add(x:number,y:number,r:number,life:number,mode:number):void{if(this.accents.length>=40)this.accents.shift();this.accents.push({x,y,r,age:0,life,mode,seed:(++this.serial*.618)%1});}
 hit(x:number,y:number,r:number):void{this.add(x,y,r,.24,2);}
 charge(x:number,y:number,r:number,life:number):void{this.add(x,y,r,life,3);}
 swing(x:number,y:number,r:number,life:number):void{this.add(x,y,r,life,4);}
 tick(dt:number):void{for(const a of this.accents)a.age+=dt;this.accents=this.accents.filter(a=>a.age<a.life);}
 begin():void{this.ink.clear();this.shader.begin();this.domain.begin();this.atlas.begin();this.frontShader.begin();this.frontAtlas.begin();}
 spin(x:number,y:number,r:number,age:number,seed:number,opacity:number,owner:object):void{
  if(opacity<=0)return;
  // Detached wake lives beyond the sprite silhouette and drifts at its own speed.
  this.shader.draw(x,y,r*4.2,r*3.9,0,age,seed,opacity,8,r,0);
  this.frontShader.draw(x,y,r*4.2,r*3.9,0,age,seed,opacity,8,r,1);
  if(this.atlas.choose(owner)){this.atlas.draw('spin',x,y,r,age*1.8,0,opacity,seed,'back');
   if(this.frontAtlas.draw('spin',x,y,r,age*1.8,0,opacity,seed,'front'))return;}
  if(this.shader.draw(x,y,r*2.8,r*2.8,0,age,seed,opacity,1,r,0))return;
  const phase=age*42.4;
  this.ink.fillColor=CA('#17020A',opacity*.7);this.ink.circle(x,y,r*.75);this.ink.fill();
  for(let k=0;k<2;k++){
   const pts:number[][]=[];for(let j=0;j<=36;j++){const a=phase+k*Math.PI-j/36*2.5;pts.push([x+Math.cos(a)*r*.94,y+Math.sin(a)*r*.82]);}
   for(let band=0;band<3;band++){this.ink.strokeColor=CA(band===2?'#FFD3A1':band?'#FF293A':'#7F051B',opacity*(band===0?.35:.9));this.ink.lineWidth=band===0?18:band===1?6:1.7;
    pts.forEach((p,i)=>i?this.ink.lineTo(p[0],p[1]):this.ink.moveTo(p[0],p[1]));this.ink.stroke();}
  }
  this.ink.fillColor=CA('#FF3047',opacity);this.ink.circle(x,y,r*.07);this.ink.fill();
 }
 reaping(r:ScytheReapVisual):void{
  const fade=Math.min(1,r.age/.16,Math.max(0,(r.duration-r.age)/.5)),t=r.age/r.duration;
  if(!this.domain.draw(r.x,r.y,r.radius*2.7,r.radius*2.7,0,r.age,r.seed,fade,5,r.radius,t)){
   // Transparent floor and disconnected rising fragments are also present without the shader.
   this.ink.fillColor=CA('#570419',fade*.62);this.ink.circle(r.x,r.y,r.radius*Math.min(1,r.age/.4));this.ink.fill();
   for(let k=0;k<18;k++){const a=k*2.399963+Math.sin(r.age*2+k)*.08,reach=r.radius*(.94+.04*Math.sin(k*7)),lift=(r.age*1.2+k*.217)%1;
    this.ink.strokeColor=CA('#FF1834',fade*(1-lift)*.4);this.ink.lineWidth=1.6;
    const x=r.x+Math.cos(a)*reach,y=r.y+Math.sin(a)*reach;this.ink.moveTo(x,y);this.ink.lineTo(x+Math.sin(k)*6,y+lift*r.radius*.18);this.ink.stroke();}
  }
  const art=this.atlas.choose(r);
  const finalBirth=T.reapStart+8*T.reapGap;
  let cuts=this.riftVolumes.get(r);if(!cuts){cuts=scytheRiftVolume(r.seed);this.riftVolumes.set(r,cuts);}
  // Visual births are wholly independent of r.hits and the nine damage callbacks.
  for(const cut of cuts){
   const age=r.age-cut.birth;if(age<0||age>cut.life+.14||!cut.final&&r.age>=finalBirth-.035)continue;
   const reach=r.radius*cut.reach,basis=scytheRiftBasis(cut.pitch,cut.yaw,cut.roll);
   const projection=Math.hypot(basis.xx,basis.xy),angle=Math.atan2(basis.xy,basis.xx);
   const sweep=(Math.min(1,age/cut.life)-.5)*r.radius*.055;
   const x=r.x+cut.x*r.radius+basis.yx*sweep;
   const y=r.y+(cut.groundY+cut.lift)*r.radius+basis.yy*sweep;
   const atlas=cut.near?this.frontAtlas:this.atlas,atmosphere=cut.near?this.frontShader:this.shader;
   atmosphere.draw(x,y,reach*2.6*projection,reach*.68,angle*180/Math.PI,age,cut.seed,cut.final?1.1:.6,7,reach,Math.min(1,age/(cut.life+.14)));
   if(age<=cut.life){
    const clipAge=age<.025?age*5.6:.14+(age-.025)/(cut.life-.025)*.46;
    if(art&&atlas.draw('slash',x,y,reach,clipAge,cut.roll*Math.PI/180,1,0,'full',cut.thickness,cut.pitch,cut.yaw))continue;
    const length=reach*Math.min(1,age/.025),fade=Math.max(0,1-age/cut.life);
    for(let band=0;band<3;band++){this.ink.strokeColor=CA(band===2?'#FFE2C0':band?'#FF2538':'#59071B',fade*(band===0?.6:1));
     this.ink.lineWidth=(band===0?13:band===1?5:1.4)*(cut.final?1.4:1);
     this.ink.moveTo(x-basis.xx*length,y-basis.xy*length);this.ink.lineTo(x+basis.xx*length,y+basis.xy*length);this.ink.stroke();}
   }
  }
  const impactAge=r.age-finalBirth;
  if(impactAge>=0&&impactAge<.55)this.frontShader.draw(r.x,r.y,r.radius*2.8,r.radius*2.8,0,impactAge,r.seed,Math.max(0,1-impactAge/.55),6,r.radius,impactAge/.55);
 }
 end():void{for(const a of this.accents){const t=a.age/a.life;
   if(!this.shader.draw(a.x,a.y,a.r*2.8,a.r*2.8,0,a.age,a.seed,1,a.mode,a.r,t)){
    this.ink.strokeColor=CA('#FF9D53',(1-t)*.7);this.ink.lineWidth=3;this.ink.circle(a.x,a.y,Math.max(1,a.r*(.1+t*.5)));this.ink.stroke();
   }}this.shader.end();this.domain.end();this.atlas.end();this.frontShader.end();this.frontAtlas.end();}
 destroy():void{this.accents.length=0;if(this.air.isValid)this.air.destroy();if(this.front.isValid)this.front.destroy();}
}
