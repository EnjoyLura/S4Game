/** Pure procedural art. No image, texture or wall-clock animation dependencies. */
import { Graphics, Node } from 'cc';
import { CA, N } from '../ui/UIKit';
import { HeroFxShader } from './HeroFxShader';
import { drawSwordFlight, swordDebris, swordCrater, swordImpactLife, SWORD_ABILITY_EFFECT } from './SwordAbilityVFX';
export const SPACE_SWORD_EFFECT='fx/space-sword-burst';
const TAU = Math.PI * 2;
export function drawMagicBlade(g: Graphics, x: number, y: number, angle: number, half: number, age: number, color: string): void {
  const ux = Math.cos(angle), uy = Math.sin(angle), px = -uy, py = ux;
  const point = (s: number, f: number): [number,number] => [x + px*s + ux*f, y + py*s + uy*f];
  const path = (thick: number) => {
    const a=point(-half, -half*.17), b=point(half,-half*.17), c=point(0,half*.3);
    g.moveTo(a[0],a[1]);g.quadraticCurveTo(c[0],c[1],b[0],b[1]);
    const d=point(0,half*.3-thick);g.quadraticCurveTo(d[0],d[1],a[0],a[1]);g.close();g.fill();
  };
  for(let k=3;k>=1;k--){g.fillColor=CA(color,.035*k);path(half*(.12+k*.07));}
  g.fillColor=CA(color,.82);path(half*.17);
  g.fillColor=CA('#F8E9FF',.94);path(half*.038);
  for(let k=0;k<9;k++){
    const s=half*(-.88+k*.22), f=half*(.06-.24*(s/half)**2)-((age*210+k*13)%65);
    const a=point(s,f),b=point(s,f-14-8*Math.sin(k));
    g.strokeColor=CA(color,.32);g.lineWidth=1.6;g.moveTo(...a);g.lineTo(...b);g.stroke();
  }
}
export function drawFlyingSword(g: Graphics,x:number,y:number,angle:number,size:number,age:number):void{
  const ux=Math.cos(angle),uy=Math.sin(angle),px=-uy,py=ux;
  const pt=(s:number,f:number):[number,number]=>[x+px*s+ux*f,y+py*s+uy*f];
  // Tapered wakes have no broad, square stroke caps behind the blade.
  for(let k=3;k>=1;k--){const w=size*(.45+k*.25);g.fillColor=CA('#63D2A4',.045*k);
    g.moveTo(...pt(0,size*3.6));g.quadraticCurveTo(...pt(w,size*.2),...pt(0,-size*(4+k)));
    g.quadraticCurveTo(...pt(-w,size*.2),...pt(0,size*3.6));g.close();g.fill();}
  g.fillColor=CA('#DBFFF1',.98);g.moveTo(...pt(0,size*3.6));g.lineTo(...pt(size*.42,size*1.8));
  g.lineTo(...pt(size*.34,-size*.65));g.lineTo(...pt(0,-size*.48));g.lineTo(...pt(-size*.34,-size*.65));
  g.lineTo(...pt(-size*.42,size*1.8));g.close();g.fill();
  g.fillColor=CA('#78C9AF',.9);g.moveTo(...pt(0,size*3.6));g.lineTo(...pt(size*.42,size*1.8));
  g.lineTo(...pt(size*.34,-size*.65));g.lineTo(...pt(0,-size*.48));g.close();g.fill();
  g.strokeColor=CA('#FFFFFF',.9);g.lineWidth=Math.max(1,size*.09);g.moveTo(...pt(0,-size*.45));g.lineTo(...pt(0,size*3.1));g.stroke();
  g.strokeColor=CA('#F0CD74',1);g.lineWidth=Math.max(1.5,size*.24);g.moveTo(...pt(-size*.8,-size*.7));g.lineTo(...pt(size*.8,-size*.7));g.stroke();
  g.moveTo(...pt(0,-size*.7));g.lineTo(...pt(0,-size*1.65));g.stroke();
  g.strokeColor=CA('#7CE8BA',.7);g.lineWidth=1.4;g.moveTo(...pt(0,-size*2));g.lineTo(...pt(Math.sin(age*18)*size*.2,-size*5.5));g.stroke();
}
export function drawRiftShard(g:Graphics,x:number,y:number,angle:number,size:number,age:number):void{
  const u=Math.cos(angle),v=Math.sin(angle),p=-v,q=u;
  for(let k=3;k>=1;k--){g.fillColor=CA('#BB63D8',.07);g.ellipse(x-u*k*4,y-v*k*4,size*(1+k*.2),size*(1+k*.2));g.fill();}
  g.fillColor=CA('#D598ED',1);g.moveTo(x+u*size*1.8,y+v*size*1.8);g.lineTo(x+p*size*.65,y+q*size*.65);
  g.lineTo(x-u*size*1.2,y-v*size*1.2);g.lineTo(x-p*size*.65,y-q*size*.65);g.close();g.fill();
  g.strokeColor=CA('#FFF1FF',.9);g.lineWidth=1.4;g.moveTo(x,y);g.lineTo(x+u*size*1.4,y+v*size*1.4);g.stroke();
}
/** The tip is the collision point; the blade and hilt extend back into the sky. */
export function drawHeavenSword(g:Graphics,x:number,y:number,angle:number,size:number,age:number,opacity=1):void{
  const ux=Math.cos(angle),uy=Math.sin(angle),px=-uy,py=ux,h=size*5;
  const pt=(s:number,f:number):[number,number]=>[x+px*s+ux*f,y+py*s+uy*f];
  const poly=(pts:number[][],color:string,a:number)=>{g.fillColor=CA(color,a*opacity);g.moveTo(...pt(pts[0][0],pts[0][1]));
    for(let k=1;k<pts.length;k++)g.lineTo(...pt(pts[k][0],pts[k][1]));g.close();g.fill();};
  for(let k=4;k>=1;k--){g.strokeColor=CA('#78F7C1',opacity*.032*k);g.lineWidth=2+k*3;
    g.moveTo(...pt(0,0));g.lineTo(...pt(h*.09,-h*.16));g.lineTo(...pt(h*.075,-h*.77));
    g.moveTo(...pt(0,0));g.lineTo(...pt(-h*.09,-h*.16));g.lineTo(...pt(-h*.075,-h*.77));g.stroke();}
  for(let k=3;k>=1;k--){const w=h*(.08+k*.025);g.fillColor=CA('#63D2A4',opacity*.035*k);
    g.moveTo(...pt(0,h*.07));g.quadraticCurveTo(...pt(w,-h*.4),...pt(0,-h*1.42));
    g.quadraticCurveTo(...pt(-w,-h*.4),...pt(0,h*.07));g.close();g.fill();}
  poly([[0,0],[h*.09,-h*.16],[h*.075,-h*.77],[0,-h*.72],[-h*.075,-h*.77],[-h*.09,-h*.16]],'#E9FFF4',.98);
  poly([[0,0],[h*.09,-h*.16],[h*.075,-h*.77],[0,-h*.72]],'#65B79F',.95);
  poly([[-h*.075,-h*.77],[0,-h*.72],[h*.075,-h*.77],[h*.18,-h*.72],[h*.21,-h*.79],[h*.09,-h*.86],[-h*.09,-h*.86],[-h*.21,-h*.79],[-h*.18,-h*.72]],'#E5BA61',1);
  poly([[-h*.026,-h*.85],[h*.026,-h*.85],[h*.023,-h*1.07],[-h*.023,-h*1.07]],'#275F4D',1);
  poly([[0,-h*1.15],[h*.055,-h*1.09],[0,-h*1.04],[-h*.055,-h*1.09]],'#E9C971',1);
  poly([[0,-h*.75],[h*.035,-h*.795],[0,-h*.84],[-h*.035,-h*.795]],'#6DEAC0',1);
  for(let k=0;k<3;k++){const f=-h*(.3+k*.12),w=h*.016;
    poly([[0,f+w],[w,f],[0,f-w],[-w,f]],'#F4E2A1',.85);}
  g.strokeColor=CA('#FFFFFF',opacity*.9);g.lineWidth=Math.max(1.2,size*.045);g.moveTo(...pt(0,-h*.04));g.lineTo(...pt(0,-h*.7));g.stroke();
  for(let k=0;k<4;k++){const s=(k-1.5)*h*.115,head=((age*2.8+k*.19)%1)*h;
    g.strokeColor=CA('#A0FFE0',opacity*.35);g.lineWidth=1.2;g.moveTo(...pt(s,-head));g.lineTo(...pt(s,-head-h*.12));g.stroke();}
}
export interface SpacePrisonVisual {x:number;y:number;orbX:number;orbY:number;orb:boolean;orbRadius:number;radius:number;}
interface Accent {x:number;y:number;age:number;duration:number;radius:number;angle:number;jade:boolean;kind:'portal'|'arrival'|'riftHit'|'cut'|'array'|'giant'|'landing'|'spacePulse';}
export class SpaceSwordVFX {
  private node:Node;private g:Graphics;private accents:Accent[]=[];private clock=0;
  private volume:HeroFxShader|null=null;
  private swordGround:HeroFxShader|null=null;private swordAir:HeroFxShader|null=null;private groundNode:Node|null=null;
  private groundInk:Graphics|null=null;
  private prisonVisuals:readonly SpacePrisonVisual[]=[];
  private prisonAge=0;private columnStart=0;private columnDuration=0;
  constructor(parent:Node){this.node=N('spaceSwordProcedural',parent);this.g=this.node.addComponent(Graphics);
    const text=parent.getChildByName('TextLayer');if(text)this.node.setSiblingIndex(text.getSiblingIndex());}
  warmVolume():void{this.volume ||= new HeroFxShader(this.node,'spaceSwordLight',32,'plasma',{effect:SPACE_SWORD_EFFECT,technique:0});}
  warmSword():void{
    if(this.swordGround)return;
    const parent=this.node.parent!,ground=parent.getChildByName('GroundFxLayer')||parent;
    this.groundNode=N('jadeSwordGround',ground);
    this.groundInk=this.groundNode.addComponent(Graphics);
    this.swordGround=new HeroFxShader(this.groundNode,'jadeGroundFlow',24,'emission',{effect:SWORD_ABILITY_EFFECT,technique:0});
    this.swordAir=new HeroFxShader(this.node,'jadeImpactFlow',32,'plasma',{effect:SWORD_ABILITY_EFFECT,technique:1});
  }
  setPrison(visuals:readonly SpacePrisonVisual[],age:number,start:number,duration:number):void{
    this.prisonVisuals=visuals;this.prisonAge=age;this.columnStart=start;this.columnDuration=duration;
  }
  add(kind:Accent['kind'],x:number,y:number,radius:number,duration=.6,angle=-Math.PI/2):void{
    if(kind==='cut'||kind==='giant')duration=Math.max(duration,swordImpactLife(kind==='giant',radius));
    if(this.accents.length>=40)this.accents.shift();this.accents.push({kind,x,y,radius,duration,age:0,angle,
      jade:!!this.swordGround?.ready&&!!this.swordAir?.ready});
  }
  tick(dt:number):void{this.clock+=dt;for(let i=this.accents.length-1;i>=0;i--){this.accents[i].age+=dt;if(this.accents[i].age>=this.accents[i].duration)this.accents.splice(i,1);}}
  render():void{
    const g=this.g;g.clear();this.groundInk?.clear();this.volume?.begin();this.swordGround?.begin();this.swordAir?.begin();
    for(const a of this.accents){const t=a.age/a.duration,fade=Math.min(1,t*8)*Math.min(1,(1-t)*5),r=a.radius;
      if(a.kind==='portal'||a.kind==='arrival'||a.kind==='riftHit'){
        if(this.volume?.draw(a.x,a.y,r*2.8,r*2.8,0,a.age,.7,1,a.kind==='portal'?4:a.kind==='arrival'?5:6,r,a.duration))continue;
      }
      if(a.jade&&(a.kind==='array'||a.kind==='landing'||a.kind==='cut'||a.kind==='giant')){
        const mode=a.kind==='array'?3:a.kind==='landing'?4:a.kind==='giant'?2:1;
        const drawn=this.swordGround?.draw(a.x,a.y,r*2.6,r*1.5,0,a.age,.37,1,mode,r,a.duration);
        if(drawn){
          if(mode<3){
            const giant=a.kind==='giant',hold=giant?.82:r>100?.55:.38;
            const opacity=1-Math.max(0,Math.min(1,(a.age-hold)/(a.duration-hold)));
            const sink=(giant?12:4)*Math.min(1,a.age/.07);
            if(this.groundInk)swordCrater(this.groundInk,a.x,a.y,r,a.age,giant);
            swordDebris(g,a.x,a.y,r,a.age,giant);
            drawSwordFlight(this.swordAir,a.x+Math.cos(a.angle)*sink,a.y+Math.sin(a.angle)*sink,a.angle,
              giant?r*.2:r>100?23:9,a.age,.37,giant,opacity,true);
            // Turbulent dust and rising energy share one bounded premultiplied carrier.
            this.swordAir?.draw(a.x,a.y+r*.18,r*2.6,r*1.8,0,a.age,.37,1,giant?6:5,r,a.duration);
          }continue;
        }
      }
      if(a.kind==='landing'){
        g.strokeColor=CA('#B4FFDC',.35*(1-t));g.lineWidth=1.5;g.ellipse(a.x,a.y,r*.7,r*.28);g.stroke();continue;
      }
      if(a.kind==='spacePulse'){
        if(this.volume?.draw(a.x,a.y,r*2.6,r*1.3,0,a.age,.7,.65,7,r,a.duration))continue;
        g.strokeColor=CA('#D5A0FF',fade*.28);g.lineWidth=1.6;g.ellipse(a.x,a.y,r*(.45+t*.5),r*(.14+t*.18));g.stroke();continue;
      }
      if(a.kind==='giant'){
        this.volume?.draw(a.x,a.y,r*2.5,r*1.2,0,a.age,.7,1,2,r,0);
        drawHeavenSword(g,a.x,a.y,a.angle,r*.2,a.age,Math.min(1,(1-t)*3));
        for(let k=0;k<14;k++){const th=k*2.399963,rr=r*(.15+t*.75),height=Math.sin(t*Math.PI)*r*(.12+(k%3)*.04);
          const x=a.x+Math.cos(th)*rr,y=a.y+Math.sin(th)*rr*.4+height;
          g.fillColor=CA(k%3?'#80B59D':'#D9E6BE',(1-t)*.8);g.moveTo(x-3,y);g.lineTo(x,y+6);g.lineTo(x+4,y-2);g.close();g.fill();}
        g.strokeColor=CA('#8FE8C3',(1-t)*.6);g.lineWidth=1.4;
        for(let k=0;k<9;k++){const th=k*TAU/9,len=r*(.35+(k%3)*.16);g.moveTo(a.x+Math.cos(th)*14,a.y+Math.sin(th)*5);
          g.lineTo(a.x+Math.cos(th)*len,a.y+Math.sin(th)*len*.4);g.stroke();}continue;
      }
      const portal=a.kind==='portal'||a.kind==='arrival'||a.kind==='riftHit';
      const color=portal?'#BB63D8':'#63D2A4';
      if(a.kind==='cut'){for(let k=0;k<3;k++){g.strokeColor=CA(k?'#63D2A4':'#FFF9DA',fade*(k?.4:.9));g.lineWidth=(k?8:2)*(1-t);
        g.moveTo(a.x-r*(.3+t*.7),a.y-r*.55);g.lineTo(a.x+r*(.3+t*.7),a.y+r*.55);g.stroke();}continue;}
      for(let k=2;k>=0;k--){g.strokeColor=CA(color,fade*(k?.18:.8));g.lineWidth=k?6:2;g.ellipse(a.x,a.y,r*(1+k*.06),r*(portal?.66:.35));g.stroke();}
      const count=portal?8:12;
      for(let k=0;k<count;k++){const th=k*TAU/count+this.clock*(portal?3:.5),rr=r*(portal?.86:1);
        const x=a.x+Math.cos(th)*rr,y=a.y+Math.sin(th)*rr*(portal?.66:.35);
        if(a.kind==='array')drawFlyingSword(g,x,y,Math.PI/2,5, a.age);
        else {g.strokeColor=CA('#F2CBFF',fade*.8);g.lineWidth=2;g.moveTo(x,y-4);g.lineTo(x,y+4);g.stroke();}
      }
    }
    const age=this.prisonAge,columnAge=age-this.columnStart;
    for(let k=0;k<this.prisonVisuals.length;k++){const v=this.prisonVisuals[k],r=v.radius,h=r*3.8;
      if(columnAge>=0){const drawn=this.volume?.draw(v.x,v.y+h*.36,r*3.2,h,0,columnAge,k*.71,.95,1,r,this.columnDuration);
        if(!drawn){const fade=Math.min(1,columnAge*8)*Math.min(1,(this.columnDuration-columnAge)*5),top=v.y+h*.8;
          for(let j=3;j>=1;j--){g.fillColor=CA('#BB63D8',fade*.06);g.moveTo(v.x-r*.12*j,v.y);
            g.quadraticCurveTo(v.x-r*.2,top-r,v.x,top);g.quadraticCurveTo(v.x+r*.2,top-r,v.x+r*.12*j,v.y);g.close();g.fill();}
          g.strokeColor=CA('#EFCBFF',fade*.8);g.lineWidth=2;g.moveTo(v.x,v.y);g.lineTo(v.x,top);g.stroke();}}
      if(v.orb){const fade=Math.min(1,age*6)*Math.min(1,(this.columnStart+this.columnDuration-age)*5);
        const drawn=this.volume?.draw(v.orbX,v.orbY,v.orbRadius*2.5,v.orbRadius*2.5,0,age,k*.71,fade,0,v.orbRadius,0);
        if(!drawn){g.fillColor=CA('#BB63D8',fade*.07);g.circle(v.orbX,v.orbY,v.orbRadius*.84);g.fill();
          g.strokeColor=CA('#DFA5FF',fade*.8);g.lineWidth=1.8;g.circle(v.orbX,v.orbY,v.orbRadius*.84);g.stroke();
          g.ellipse(v.orbX,v.orbY,v.orbRadius*.84,v.orbRadius*.34);g.stroke();}}
    }
    this.volume?.end();
    this.swordGround?.end();this.swordAir?.end();
  }
  destroy():void{this.accents.length=0;this.prisonVisuals=[];if(this.groundNode?.isValid)this.groundNode.destroy();if(this.node.isValid)this.node.destroy();}
}
