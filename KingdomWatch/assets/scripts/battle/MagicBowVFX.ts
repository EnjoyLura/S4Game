/** Silver-blue arcane arrows and a two-stage detonation. Cosmetic battle-clock state only. */
import { Graphics,Node } from 'cc';
import { CA,N } from '../ui/UIKit';
import { HeroFxShader } from './HeroFxShader';
import { swordDebris,swordCrater,swordSoilLip } from './SwordAbilityVFX';
export const MAGIC_BOW_EFFECT='fx/magic-bow-flow';
interface Accent {kind:'hit'|'charge'|'mark'|'impact'|'blast';x:number;y:number;r:number;age:number;life:number;giant:boolean;angle:number;seed:number;}
export function drawMagicArrow(shader:HeroFxShader|null,g:Graphics,x:number,y:number,angle:number,size:number,age:number,seed:number,opacity=1,embedded=false):void{
 const length=size*8,ux=Math.cos(angle),uy=Math.sin(angle),sink=embedded?length*.085*Math.min(1,age/.09):0;
 if(shader?.draw(x-ux*(length*.5-sink),y-uy*(length*.5-sink),length*.75,length*2,angle*180/Math.PI-90,
  age,seed,opacity,0,length,embedded?sink/length:0))return;
 const px=-uy,py=ux;g.strokeColor=CA('#6BB9FF',opacity*.35);g.lineWidth=size*.8;
 g.moveTo(x-ux*length,y-uy*length);g.lineTo(x,y);g.stroke();g.strokeColor=CA('#F1F8FF',opacity);g.lineWidth=size*.18;g.stroke();
 g.fillColor=CA('#D8F4FF',opacity);g.moveTo(x,y);
 g.lineTo(x-ux*size*2.5+px*size*.75,y-uy*size*2.5+py*size*.75);
 g.lineTo(x-ux*size*1.8,y-uy*size*1.8);g.lineTo(x-ux*size*2.5-px*size*.75,y-uy*size*2.5-py*size*.75);g.close();g.fill();
 for(const side of [-1,1]){g.moveTo(x-ux*length*.72,y-uy*length*.72);g.lineTo(x-ux*length*.9+px*size*.75*side,y-uy*length*.9+py*size*.75*side);
  g.lineTo(x-ux*length,y-uy*length);g.close();g.fill();}
}
export class MagicBowVFX {
 private air:Node;private floor:Node;private ink:Graphics;private dirt:Graphics;private front:Graphics;
 private airShader:HeroFxShader;private groundShader:HeroFxShader;private accents:Accent[]=[];private serial=0;
 constructor(parent:Node){this.air=N('magicBow',parent);const text=parent.getChildByName('TextLayer');if(text)this.air.setSiblingIndex(text.getSiblingIndex());
  this.floor=N('magicBowGround',parent.getChildByName('GroundFxLayer')||parent);this.dirt=N('earth',this.floor).addComponent(Graphics);
  this.groundShader=new HeroFxShader(this.floor,'arcaneGround',24,'plasma',{effect:MAGIC_BOW_EFFECT,technique:0});
  this.ink=N('arcaneFallback',this.air).addComponent(Graphics);
  this.airShader=new HeroFxShader(this.air,'arcaneBloom',32,'plasma',{effect:MAGIC_BOW_EFFECT,technique:0});
  this.front=N('arcaneDebris',this.air).addComponent(Graphics);
 }
 private add(kind:Accent['kind'],x:number,y:number,r:number,life:number,giant=false,angle=-Math.PI/2):void{
  if(this.accents.length>=32)this.accents.shift();this.accents.push({kind,x,y,r,age:0,life,giant,angle,seed:(++this.serial*.61803398875)%1});
 }
 hit(x:number,y:number,r:number):void{this.add('hit',x,y,r,.24);}
 charge(x:number,y:number,life:number,giant:boolean):void{this.add('charge',x,y,giant?72:38,life,giant);}
 mark(x:number,y:number,r:number,life:number):void{this.add('mark',x,y,r,life);}
 impact(x:number,y:number,r:number,angle:number,life:number):void{this.add('impact',x,y,r,life,true,angle);}
 explode(x:number,y:number,r:number,giant:boolean):void{this.add('blast',x,y,r,giant?.72:.5,giant);}
 tick(dt:number):void{for(const a of this.accents)a.age+=dt;this.accents=this.accents.filter(a=>a.age<a.life);}
 render():void{
  this.ink.clear();this.dirt.clear();this.front.clear();this.groundShader.begin();this.airShader.begin();
  for(const a of this.accents){const t=a.age/a.life,r=a.r;
   if(a.kind==='impact'){
    swordCrater(this.dirt,a.x,a.y,r,a.age,true);
    this.groundShader.draw(a.x,a.y,r*2.6,r*1.5,0,a.age,a.seed,1,1,r,t*.6);
    drawMagicArrow(this.airShader,this.ink,a.x,a.y,a.angle,42,a.age,a.seed,1,true);
    this.airShader.draw(a.x,a.y+22,r*.85,r*.85,0,a.age,a.seed,.6+t*.6,3,r*.35,t);
    swordSoilLip(this.front,a.x,a.y,r,a.age,true,1);swordDebris(this.front,a.x,a.y,r,a.age,true);
   }else if(a.kind==='blast'){
    const ground=this.groundShader.draw(a.x,a.y,r*2.6,r*1.6,0,a.age,a.seed,1,1,r,t);
    const air=this.airShader.draw(a.x,a.y+r*.1,r*2.4,r*2.1,0,a.age,a.seed,a.giant?1:.8,2,r,t);
    swordDebris(this.front,a.x,a.y,r,a.age,a.giant);
    if(!ground||!air){this.ink.strokeColor=CA('#87CFFF',(1-t)*.8);this.ink.lineWidth=5*(1-t)+1;this.ink.ellipse(a.x,a.y,r*t,r*t*.55);this.ink.stroke();}
   }else if(a.kind==='mark'){
    this.groundShader.draw(a.x,a.y,r*2.5,r*1.5,0,a.age,a.seed,.42,4,r,t);
   }else if(a.kind==='charge'){
    this.airShader.draw(a.x,a.y,r*3,r*3,0,a.age,a.seed,.45+t*.55,3,r,t);
   }else{
    this.airShader.draw(a.x,a.y,r*2.4,r*2.4,0,a.age,a.seed,.8,2,r,t);
   }
  }
  this.groundShader.end();this.airShader.end();
 }
 destroy():void{this.accents.length=0;if(this.air.isValid)this.air.destroy();if(this.floor.isValid)this.floor.destroy();}
}
