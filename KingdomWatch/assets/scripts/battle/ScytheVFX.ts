/** Scarlet scythe: Blender elements plus a rising domain, all driven by battle ages. */
import { Graphics,Node } from 'cc';
import { CA,N } from '../ui/UIKit';
import { HeroFxShader } from './HeroFxShader';
import { ScytheAtlas } from './ScytheAtlas';
import { SCYTHE_TIMING as T } from '../config/ScytheConfig';
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
  const hash=(v:number)=>{const n=Math.sin(v*127.1+r.seed*311.7)*43758.5453;return n-Math.floor(n);};
  const finalBirth=T.reapStart+(r.hits-1)*T.reapGap;
  for(let i=0;i<r.hits;i++){
   const final=i===r.hits-1;if(!final&&r.age>=finalBirth-.045)continue;
   for(let j=0;j<3;j++){
    const key=i*17+j*7,delay=j*(final?.045:.055)+(!j?0:hash(key+2)*.018);
    const age=r.age-T.reapStart-i*T.reapGap-delay,life=final?(j?.27:.36):.145+hash(key+3)*.065;
    if(age<0||age>life+.16)continue;
    const depth=hash(key+11),angle=final&&!j?.35+hash(key+8)*.6:hash(key+5)*Math.PI*2;
    const offset=(hash(key+19)-.5)*r.radius*(final?.15:.78);
    const reach=r.radius*(final?(j?.96:1.22):.78+hash(key+23)*.36);
    const sweep=(Math.min(1,age/life)-.5)*r.radius*.10;
    const x=r.x-Math.sin(angle)*(offset+sweep),y=r.y+Math.cos(angle)*(offset+sweep)+r.radius*(depth*.23-.03);
    const near=final||depth>.42,atlas=near?this.frontAtlas:this.atlas,atmosphere=near?this.frontShader:this.shader;
    atmosphere.draw(x,y,reach*2.6,reach*.84,angle*180/Math.PI,age,hash(key+31),final?1.2:.85,7,reach,Math.min(1,age/(life+.16)));
    if(age<=life){
     // Preserve the approved original rift texture, exposing it quickly then tearing it away.
     const clipAge=final&&!j?(age<.025?age*6:age<.075?.15+(age-.025):.2+(age-.075)/(.36-.075)*.4):age/life*.6;
     if(art&&atlas.draw('slash',x,y,reach,clipAge,angle,1,0,'full',final&&!j?1.45:.65+depth*.70))continue;
     const length=reach*Math.min(1,age/.025),fade=Math.max(0,1-age/life);
     for(let band=0;band<3;band++){this.ink.strokeColor=CA(band===2?'#FFE2C0':band?'#FF2538':'#59071B',fade*(band===0?.6:1));
      this.ink.lineWidth=(band===0?13:band===1?5:1.4)*(final?1.4:1);
      this.ink.moveTo(x-Math.cos(angle)*length,y-Math.sin(angle)*length);this.ink.lineTo(x+Math.cos(angle)*length,y+Math.sin(angle)*length);this.ink.stroke();}
    }
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
