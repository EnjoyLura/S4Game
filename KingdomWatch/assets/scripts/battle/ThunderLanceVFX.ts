/** Golden lightning geometry; only supplied battle time advances animation. No combat logic. */
import { Graphics,Node } from 'cc';
import { CA,N } from '../ui/UIKit';
import { HeroFxShader } from './HeroFxShader';
import { swordDebris,swordSoilLip } from './SwordAbilityVFX';
import { ThunderLanceAtlas } from './ThunderLanceAtlas';
export const LANCE_EFFECT='fx/thunder-lance-flow';
export interface LanceVisual {x:number;y:number;radius:number;age:number;seconds:number;giant:boolean;seed:number;angle:number;phase?:number;}
interface Accent {kind:'impact'|'wave'|'mark'|'recall'|'explosion';x:number;y:number;r:number;age:number;life:number;seed:number;giant:boolean;tx:number;ty:number;}
interface Arc {x:number;y:number;tx:number;ty:number;age:number;heavy:boolean;seed:number;}
const hash=(v:number)=>{const a=Math.sin(v*127.1)*43758.5453;return a-Math.floor(a);};
/** Local scorch and irregular crawling arcs; no radial star or full circular outline. */
export function lanceGround(g:Graphics,x:number,y:number,r:number,age:number,seed:number,giant:boolean,opacity:number):void{
  const fade=Math.min(1,age*18)*opacity,s=seed*97;
  for(let k=0;k<3;k++){
    g.fillColor=CA(k?'#493B25':'#292821',fade*(k?.15:.28));
    g.ellipse(x+(hash(s+k)-.5)*r*.17,y+(hash(s+k+7)-.5)*r*.06,r*(.08+hash(k+s+19)*.08),r*(.025+hash(k+s+29)*.025));g.fill();
  }
  for(let k=0;k<(giant?7:3);k++){
    const phase=(age*(1.15+hash(s+k)) + hash(s+k+11))%1,alpha=Math.sin(Math.PI*phase)**2*opacity;
    const epoch=Math.floor(age*(1.15+hash(s+k))+hash(s+k+11)),n=s+k*37+epoch*13;
    const angle=hash(n)*Math.PI*2,turn=(hash(n+3)-.5)*1.6;
    const start=.08+hash(n+5)*.28,end=.48+hash(n+7)*.48;
    for(let layer=0;layer<2;layer++){
      g.strokeColor=CA(layer?'#FFF2AB':'#F1AE36',alpha*(layer?.75:.18));g.lineWidth=layer?(giant?1.6:1.05):(giant?6:3.7);
      const points:number[][]=[];
      for(let j=0;j<=18;j++){
        const t=j/18,a=angle+turn*t+Math.sin(t*9+n)*.13+(hash(n+j+21)-.5)*.16,d=r*(start+(end-start)*t);
        const px=x+Math.cos(a)*d,py=y+Math.sin(a)*d*.47;points.push([px,py]);
        if(j===0)g.moveTo(px,py);else g.lineTo(px,py);
      }g.stroke();
      if(k%3===0){const p=points[11];g.moveTo(p[0],p[1]);
        for(let j=1;j<=6;j++){const a=angle+1.2+(hash(n+j+81)-.5)*.5;
          g.lineTo(p[0]+Math.cos(a)*r*j*.035,p[1]+Math.sin(a)*r*j*.018);}g.stroke();}
    }
  }
}
export function drawLanceFlight(shader:HeroFxShader|null,g:Graphics,x:number,y:number,angle:number,size:number,age:number,seed:number,
  opacity=1,planted=false,phase=0):void{
  const length=size*8,ux=Math.cos(angle),uy=Math.sin(angle),bury=planted?length*.095*Math.min(1,age/.12):0;
  const tipX=x+ux*bury,tipY=y+uy*bury;
  if(shader?.draw(tipX-ux*length*.5,tipY-uy*length*.5,length*.9,length*1.7,angle*180/Math.PI-90,
    age+phase,seed,opacity,0,length,planted?bury/length:0))return;
  const px=-uy,py=ux,hash=(v:number)=>{const a=Math.sin(v*127.1)*43758.5453;return a-Math.floor(a);};
  const spine=(t:number)=>Math.sin(t*Math.PI)*((hash(Math.floor(t*18)+seed*37)-.5)*.025);
  const point=(u:number,v:number)=>[tipX-ux*length*(1-u)+px*length*v,tipY-uy*length*(1-u)+py*length*v];
  const limit=1-bury/length;
  const segment=(u:number,v:number,uu:number,vv:number)=>{
    if(u>limit&&uu>limit)return;
    if(uu>limit){vv=v+(vv-v)*(limit-u)/(uu-u);uu=limit;}
    if(u>limit){v=vv+(v-vv)*(limit-uu)/(u-uu);u=limit;}
    const a=point(u,v),b=point(uu,vv);g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();
  };
  for(let layer=0;layer<3;layer++){
    g.strokeColor=CA(layer===2?'#FFFFE3':layer===1?'#FFD543':'#E5A41C',opacity*(layer===0?.3:1));g.lineWidth=size*(layer===0?2.3:layer===1?.9:.35);
    for(let k=0;k<24;k++)segment(k/24,spine(k/24),(k+1)/24,spine((k+1)/24));
    for(let k=0;k<5;k++){const t=.11+k*.15,side=k%2?1:-1,v=spine(t),reach=(.035+hash(k+seed)*.05)*side;
      segment(t,v,t+.03,v+reach*.45);segment(t+.03,v+reach*.45,t+.085,reach);
      if(k===0)segment(t+.03,v+reach*.45,t+.01,reach*.8);
    }
  }
  // Tapered point is part of the same lightning body, not a separate metallic spearhead.
  g.fillColor=CA('#FFF9C7',opacity);const a=point(Math.min(limit,1),0),b=point(.67,.06),c=point(.67,-.06);
  g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.lineTo(c[0],c[1]);g.close();g.fill();
}
export class ThunderLanceVFX {
  private air:Node;private floor:Node;private g:Graphics;private dirt:Graphics;private front:Graphics;
  private spears:HeroFxShader;private ground:HeroFxShader;private accents:Accent[]=[];private arcs:Arc[]=[];private serial=0;
  private bodyArt:ThunderLanceAtlas;private floorArt:ThunderLanceAtlas;private burstArt:ThunderLanceAtlas;
  constructor(parent:Node){
    this.air=N('thunderLance',parent);const text=parent.getChildByName('TextLayer');if(text)this.air.setSiblingIndex(text.getSiblingIndex());
    this.floor=N('thunderLanceGround',parent.getChildByName('GroundFxLayer')||parent);
    this.dirt=N('earth',this.floor).addComponent(Graphics);
    this.ground=new HeroFxShader(this.floor,'electricGround',64,'plasma',{effect:LANCE_EFFECT,technique:0});
    this.g=N('arcsAndFallback',this.air).addComponent(Graphics);
    this.spears=new HeroFxShader(this.air,'plantedAndRecall',52,'plasma',{effect:LANCE_EFFECT,technique:0});
    this.floorArt=new ThunderLanceAtlas(this.floor,'blenderSurfacePasses',64);
    this.burstArt=new ThunderLanceAtlas(this.air,'blenderThunderDetonation',20);
    this.bodyArt=new ThunderLanceAtlas(this.air,'blenderPlantedAndRecall',52);
    this.front=N('buriedTipsAndDebris',this.air).addComponent(Graphics);
  }
  private add(kind:Accent['kind'],x:number,y:number,r:number,life:number,giant=false,seed=0,tx=0,ty=0):void{
    if(this.accents.length>=64)this.accents.shift();this.accents.push({kind,x,y,r,life,age:0,giant,seed,tx,ty});
  }
  impact(x:number,y:number,r:number,giant:boolean,seed:number):void{
    this.add('impact',x,y,r,giant?1.15:.55,giant,seed);
    if(giant){this.wave(x,y,r,seed);this.add('explosion',x,y,r,.8,true,seed);}
  }
  wave(x:number,y:number,r:number,seed:number):void{this.add('wave',x,y,r,.94,true,seed);}
  mark(x:number,y:number,r:number,life:number):void{this.add('mark',x,y,r,life);}
  recall(f:LanceVisual,x:number,y:number,seconds:number):void{this.add('recall',f.x,f.y,12,seconds,false,f.seed,x,y);}
  arc(x:number,y:number,tx:number,ty:number,heavy:boolean):void{
    if(this.arcs.length>=96)this.arcs.shift();this.arcs.push({x,y,tx,ty,age:0,heavy,seed:++this.serial});
  }
  tick(dt:number):void{
    for(const a of this.accents)a.age+=dt;this.accents=this.accents.filter(a=>a.age<a.life);
    for(const a of this.arcs)a.age+=dt;this.arcs=this.arcs.filter(a=>a.age<.18);
  }
  render(fields:readonly LanceVisual[]):void{
    this.g.clear();this.dirt.clear();this.front.clear();this.spears.begin();this.ground.begin();
    this.bodyArt.begin();this.floorArt.begin();this.burstArt.begin();
    for(const f of fields){const fade=Math.min(1,(f.seconds-f.age)*3),size=f.giant?40:12;
      const art=this.bodyArt.choose(f);
      if(!art||!this.floorArt.pass('ground',f.x,f.y,f.radius,f.age,fade*(f.giant?1:.48),f.seed))
        this.ground.draw(f.x,f.y,f.radius*2.4,f.radius*1.4,0,f.age,f.seed,fade*(f.giant?.68:.26),1,f.radius,0);
      lanceGround(this.dirt,f.x,f.y,f.radius,f.age,f.seed,f.giant,fade);
      if(!art||!this.bodyArt.spear(f.x,f.y,f.angle,size,f.age,f.seed,fade,true,f.phase||0))
        drawLanceFlight(this.spears,this.g,f.x,f.y,f.angle,size,f.age,f.seed,fade,true,f.phase||0);
      swordSoilLip(this.front,f.x,f.y,f.giant?f.radius:65,f.age,f.giant,fade);
    }
    for(const a of this.accents){const t=a.age/a.life;
      const art=this.bodyArt.choose(a);
      if(a.kind==='recall'){
        const u=t*t*(3-2*t),x=a.x+(a.tx-a.x)*u,y=a.y+(a.ty-a.y)*u+Math.sin(t*Math.PI)*90;
        const angle=Math.atan2(a.ty-a.y+Math.cos(t*Math.PI)*140,a.tx-a.x);
        if(!art||!this.bodyArt.spear(x,y,angle,a.r,a.age,a.seed,1-t*.45))
          drawLanceFlight(this.spears,this.g,x,y,angle,a.r,a.age,a.seed,1-t*.45);
      }else if(a.kind==='explosion'){
        if(!art||!this.burstArt.pass('impact',a.x,a.y,a.r,a.age))
          this.spears.draw(a.x,a.y+a.r*.15,a.r*2.4,a.r*2.0,0,a.age,a.seed,1,4,a.r,t);
      }else if(a.kind==='mark'){
        this.ground.draw(a.x,a.y,a.r*2.4,a.r*1.4,0,a.age,a.seed,.4*(1-t*.5),3,a.r,t);
      }else{
        const wave=a.kind==='wave';
        const baked=art&&(wave?this.floorArt.pass('wave',a.x,a.y,a.r,a.age)
          :a.giant||this.burstArt.pass('impact',a.x,a.y,a.r*.62,a.age*1.45,1-t*.55));
        const drawn=baked||this.ground.draw(a.x,a.y,a.r*2.4,a.r*1.4,0,a.age,a.seed,wave?1:(1-t)*(a.giant?1:.8),wave?2:1,a.r,t);
        if(!drawn)lanceGround(this.dirt,a.x,a.y,a.r*(.3+t*.7),a.age,a.seed,a.giant,1-t);
        if(!wave&&!baked)swordDebris(this.front,a.x,a.y,a.r,a.age,a.giant);
      }
    }
    for(const a of this.arcs){const fade=1-a.age/.18,dx=a.tx-a.x,dy=a.ty-a.y,len=Math.hypot(dx,dy)||1;
      for(let layer=0;layer<2;layer++){this.g.strokeColor=CA(layer?'#FFFCE4':'#FFC83F',fade*(layer?1:.4));this.g.lineWidth=layer?1.3:a.heavy?6:3.5;
        this.g.moveTo(a.x,a.y);for(let i=1;i<=9;i++){const t=i/9,w=i===9?0:Math.sin(i*17.3+a.seed+Math.floor(a.age*40))*Math.min(15,len*.16);
          this.g.lineTo(a.x+dx*t-dy/len*w,a.y+dy*t+dx/len*w);}this.g.stroke();}
    }
    this.spears.end();this.ground.end();this.bodyArt.end();this.floorArt.end();this.burstArt.end();
  }
  destroy():void{this.accents.length=0;this.arcs.length=0;if(this.floor.isValid)this.floor.destroy();if(this.air.isValid)this.air.destroy();}
}
