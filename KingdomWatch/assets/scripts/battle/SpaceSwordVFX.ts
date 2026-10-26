/** Pure procedural art. No image, texture or wall-clock animation dependencies. */
import { Graphics, Node } from 'cc';
import { CA, N } from '../ui/UIKit';
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
interface Accent {x:number;y:number;age:number;duration:number;radius:number;kind:'portal'|'cut'|'array';}
export class SpaceSwordVFX {
  private node:Node;private g:Graphics;private accents:Accent[]=[];private clock=0;
  constructor(parent:Node){this.node=N('spaceSwordProcedural',parent);this.g=this.node.addComponent(Graphics);
    const text=parent.getChildByName('TextLayer');if(text)this.node.setSiblingIndex(text.getSiblingIndex());}
  add(kind:Accent['kind'],x:number,y:number,radius:number,duration=.6):void{
    if(this.accents.length>=40)this.accents.shift();this.accents.push({kind,x,y,radius,duration,age:0});
  }
  tick(dt:number):void{this.clock+=dt;for(let i=this.accents.length-1;i>=0;i--){this.accents[i].age+=dt;if(this.accents[i].age>=this.accents[i].duration)this.accents.splice(i,1);}}
  render():void{
    const g=this.g;g.clear();for(const a of this.accents){const t=a.age/a.duration,fade=Math.min(1,t*8)*Math.min(1,(1-t)*5),r=a.radius;
      const color=a.kind==='portal'?'#BB63D8':'#63D2A4';
      if(a.kind==='cut'){for(let k=0;k<3;k++){g.strokeColor=CA(k?'#63D2A4':'#FFF9DA',fade*(k?.4:.9));g.lineWidth=(k?8:2)*(1-t);
        g.moveTo(a.x-r*(.3+t*.7),a.y-r*.55);g.lineTo(a.x+r*(.3+t*.7),a.y+r*.55);g.stroke();}continue;}
      for(let k=2;k>=0;k--){g.strokeColor=CA(color,fade*(k?.18:.8));g.lineWidth=k?6:2;g.ellipse(a.x,a.y,r*(1+k*.06),r*(a.kind==='portal'?.66:.35));g.stroke();}
      const count=a.kind==='portal'?8:12;
      for(let k=0;k<count;k++){const th=k*TAU/count+this.clock*(a.kind==='portal'?3:.5),rr=r*(a.kind==='portal'?.86:1);
        const x=a.x+Math.cos(th)*rr,y=a.y+Math.sin(th)*rr*(a.kind==='portal'?.66:.35);
        if(a.kind==='array')drawFlyingSword(g,x,y,Math.PI/2,5, a.age);
        else {g.strokeColor=CA('#F2CBFF',fade*.8);g.lineWidth=2;g.moveTo(x,y-4);g.lineTo(x,y+4);g.stroke();}
      }
    }
  }
  destroy():void{this.accents.length=0;if(this.node.isValid)this.node.destroy();}
}
